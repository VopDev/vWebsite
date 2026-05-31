// Minimal WebAuthn (passkey) verification for Cloudflare Workers.
//
// Uses only WebCrypto (crypto.subtle) — no npm dependency. Attestation is
// treated as "none" (trust-on-first-use): we extract and store the credential
// public key on registration, then verify every later assertion's signature
// against it. We do NOT validate attestation certificate chains (overkill for a
// games site and impossible without bundling roots).
//
// Supports ES256 (P-256 ECDSA, the passkey default) and RS256 (RSA) keys.

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── base64url ─────────────────────────────────────────────────────────────────
export function bytesToB64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64uToBytes(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
function eqBytes(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function genChallenge() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToB64u(b);
}

// Short-lived server-side challenge store (KV). Returns an opaque id the client
// echoes back on verify, so we never trust a client-supplied challenge.
const CHALLENGE_TTL = 300; // seconds
export async function putChallenge(env, data) {
  const id = bytesToB64u(crypto.getRandomValues(new Uint8Array(16)));
  await env.SONGLESS_KV.put(`passkey-chal-${id}`, JSON.stringify(data), { expirationTtl: CHALLENGE_TTL });
  return id;
}
export async function takeChallenge(env, id) {
  if (!id) return null;
  const key = `passkey-chal-${id}`;
  const raw = await env.SONGLESS_KV.get(key, 'json');
  if (raw) await env.SONGLESS_KV.delete(key); // single-use
  return raw;
}

// Relying-party id (host) + expected origin, derived from the request.
export function rpInfo(request) {
  const url = new URL(request.url);
  return { rpId: url.hostname, origin: url.origin };
}

// ── Minimal CBOR decoder (major types 0–5; enough for COSE + attestation) ──────
function cborDecode(bytes) {
  let pos = 0;
  function len(ai) {
    if (ai < 24) return ai;
    if (ai === 24) return bytes[pos++];
    if (ai === 25) { const v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; }
    if (ai === 26) { const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0; pos += 4; return v; }
    throw new Error('CBOR length ' + ai + ' unsupported');
  }
  function read() {
    const ib = bytes[pos++];
    const mt = ib >> 5;
    const n = len(ib & 0x1f);
    switch (mt) {
      case 0: return n;
      case 1: return -1 - n;
      case 2: { const b = bytes.slice(pos, pos + n); pos += n; return b; }
      case 3: { const b = bytes.slice(pos, pos + n); pos += n; return dec.decode(b); }
      case 4: { const a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }
      case 5: { const m = new Map(); for (let i = 0; i < n; i++) { const k = read(); m.set(k, read()); } return m; }
      default: throw new Error('CBOR major type ' + mt + ' unsupported');
    }
  }
  const value = read();
  return { value, pos };
}

// ── COSE public key → JWK (storable) ──────────────────────────────────────────
function coseToJwk(coseBytes) {
  const { value: m } = cborDecode(coseBytes);
  const kty = m.get(1);
  const alg = m.get(3);
  if (kty === 2) { // EC2
    return { jwk: { kty: 'EC', crv: 'P-256', x: bytesToB64u(m.get(-2)), y: bytesToB64u(m.get(-3)), ext: true }, alg: alg || -7 };
  }
  if (kty === 3) { // RSA
    return { jwk: { kty: 'RSA', n: bytesToB64u(m.get(-1)), e: bytesToB64u(m.get(-2)), ext: true }, alg: alg || -257 };
  }
  throw new Error('Unsupported key type ' + kty);
}

async function importVerifyKey(jwk) {
  if (jwk.kty === 'EC') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

// ASN.1 DER ECDSA signature → raw r||s (64 bytes) for WebCrypto.
function derToRawEcdsa(der) {
  let off = 0;
  if (der[off++] !== 0x30) throw new Error('bad DER');
  if (der[off] & 0x80) off += (der[off] & 0x7f) + 1; else off += 1; // seq length
  function readInt() {
    if (der[off++] !== 0x02) throw new Error('bad DER int');
    let l = der[off++];
    let v = der.slice(off, off + l);
    off += l;
    while (v.length > 1 && v[0] === 0x00) v = v.slice(1);   // strip leading zeros
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);                               // left-pad to 32
    return out;
  }
  const r = readInt();
  const s = readInt();
  return concat(r, s);
}

// ── authenticatorData parsing ─────────────────────────────────────────────────
function parseAuthData(authData) {
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const counter = ((authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36]) >>> 0;
  let credId = null;
  let cose = null;
  if (flags & 0x40) { // AT — attested credential data present
    const credIdLen = (authData[53] << 8) | authData[54];
    credId = authData.slice(55, 55 + credIdLen);
    cose = authData.slice(55 + credIdLen);
  }
  return { rpIdHash, flags, counter, credId, cose };
}

async function checkClientData(clientDataJSONb64u, type, expectedChallenge, expectedOrigin) {
  const json = JSON.parse(dec.decode(b64uToBytes(clientDataJSONb64u)));
  if (json.type !== type) throw new Error('bad clientData type');
  if (json.challenge !== expectedChallenge) throw new Error('challenge mismatch');
  if (json.origin !== expectedOrigin) throw new Error('origin mismatch');
  return json;
}

/**
 * Verify a registration (navigator.credentials.create) response.
 * Returns { credId(b64u), jwk, alg, counter } on success; throws otherwise.
 */
export async function verifyRegistration({ attestationObject, clientDataJSON, expectedChallengeB64u, rpId, origin }) {
  await checkClientData(clientDataJSON, 'webauthn.create', expectedChallengeB64u, origin);

  const { value: ao } = cborDecode(b64uToBytes(attestationObject));
  const authData = ao.get('authData');
  const { rpIdHash, flags, counter, credId, cose } = parseAuthData(authData);

  if (!eqBytes(rpIdHash, await sha256(enc.encode(rpId)))) throw new Error('rpId hash mismatch');
  if (!(flags & 0x01)) throw new Error('user not present');
  if (!credId || !cose) throw new Error('no attested credential data');

  const { jwk, alg } = coseToJwk(cose);
  // Sanity-check the key imports before we store it.
  await importVerifyKey(jwk);
  return { credId: bytesToB64u(credId), jwk, alg, counter };
}

/**
 * Verify an authentication (navigator.credentials.get) assertion.
 * Returns the new signature counter on success; throws otherwise.
 */
export async function verifyAssertion({ jwk, clientDataJSON, authenticatorData, signature, expectedChallengeB64u, rpId, origin }) {
  await checkClientData(clientDataJSON, 'webauthn.get', expectedChallengeB64u, origin);

  const authData = b64uToBytes(authenticatorData);
  const { rpIdHash, flags, counter } = parseAuthData(authData);
  if (!eqBytes(rpIdHash, await sha256(enc.encode(rpId)))) throw new Error('rpId hash mismatch');
  if (!(flags & 0x01)) throw new Error('user not present');

  const key = await importVerifyKey(jwk);
  const signed = concat(authData, await sha256(b64uToBytes(clientDataJSON)));
  const sigBytes = b64uToBytes(signature);

  let ok;
  if (jwk.kty === 'EC') {
    ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRawEcdsa(sigBytes), signed);
  } else {
    ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sigBytes, signed);
  }
  if (!ok) throw new Error('signature invalid');
  return counter;
}
