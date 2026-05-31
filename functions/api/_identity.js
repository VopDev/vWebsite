// Shared player-identity helper.
//
// A player is identified by a random UUID ("sid"), which is the KV key. What the
// client actually holds is a SIGNED TOKEN: `${sid}.${HMAC-SHA256(secret, sid)}`.
// The server only trusts a token whose signature verifies, so a client can no
// longer fabricate or guess an arbitrary id by setting the `X-Player-Id` header.
// The token is mirrored client-side across cookie + localStorage + IndexedDB so
// it survives a partial data wipe.
//
// SECURITY NOTE: signing requires the `ID_SECRET` environment variable (a
// Cloudflare Pages secret). If it is unset the code falls back to legacy
// unsigned behaviour so the site keeps working — set the secret to enable
// forgery protection:  npx wrangler pages secret put ID_SECRET
//
// A signed token is still a bearer credential: anyone who physically obtains a
// user's token can replay it. HMAC stops forgery/guessing/tampering, not theft.
// True theft-resistance needs proof-of-possession (passkey / WebAuthn).

const COOKIE = 'slsid';
const YEAR   = 60 * 60 * 24 * 365;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const enc = new TextEncoder();

// Accept legacy bare-UUID cookies (existing users from before signing) so they
// migrate seamlessly; their cookie is upgraded to a signed token on first hit.
// Set to false once the migration window has passed to fully lock things down.
const ACCEPT_LEGACY_COOKIE = true;

function b64url(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const keyCache = new Map();
async function getKey(secret) {
  let k = keyCache.get(secret);
  if (!k) {
    k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    keyCache.set(secret, k);
  }
  return k;
}
async function sign(secret, msg) {
  const sig = await crypto.subtle.sign('HMAC', await getKey(secret), enc.encode(msg));
  return b64url(sig);
}
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function cookieHeader(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${YEAR}; SameSite=Lax; HttpOnly`;
}

// Build the canonical client-facing token for a sid (signed if a secret exists).
export async function tokenForSid(sid, secret) {
  return secret ? `${sid}.${await sign(secret, sid)}` : sid;
}

// Resolve an incoming cookie/header value to a trusted sid (or null).
//   - signed token: verified with HMAC
//   - bare UUID: accepted only when `allowLegacy` (cookie) or no secret is set
async function valueToSid(value, secret, allowLegacy) {
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot === -1) {
    if (!UUID_RE.test(value)) return null;
    return (allowLegacy || !secret) ? value : null;
  }
  const sid = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!UUID_RE.test(sid)) return null;
  if (!secret) return sid;            // legacy mode: can't verify, accept
  return safeEq(sig, await sign(secret, sid)) ? sid : null;
}

/**
 * Resolve the player for a request.
 *   cookie (signed, or legacy bare UUID) → signed `X-Player-Id` header → mint.
 *
 * Returns { sid, token, isNew, setCookie }. `token` is the canonical signed
 * token to hand back to the client; `setCookie` is set whenever the cookie
 * doesn't already hold that token (heals + upgrades legacy cookies).
 */
export async function identify(request, env, { create = false } = {}) {
  const secret    = env && env.ID_SECRET;
  const cookieVal = request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
  const headerVal = request.headers.get('X-Player-Id');

  // Cookie may be a legacy bare UUID; the header must be a valid signed token
  // (it's only ever sent by our own upgraded client).
  let sid = await valueToSid(cookieVal, secret, ACCEPT_LEGACY_COOKIE);
  if (!sid) sid = await valueToSid(headerVal, secret, false);

  let isNew = false;
  if (!sid && create) { sid = crypto.randomUUID(); isNew = true; }

  let token = null;
  let setCookie = null;
  if (sid) {
    token = await tokenForSid(sid, secret);
    if (cookieVal !== token) setCookie = cookieHeader(token);
  }
  return { sid, token, isNew, setCookie };
}

// ── Passkey lock + elevation ──────────────────────────────────────────────────
// A profile is "locked" when a passkey credential is stored for it. Sensitive
// actions then require a short-lived ELEVATION token, minted only after a fresh
// passkey assertion verifies. It's an HMAC over sid + expiry, so it can't be
// forged and auto-expires.
const ELEVATION_TTL = 5 * 60; // seconds

export async function isLocked(env, sid) {
  if (!sid) return false;
  return (await env.SONGLESS_KV.get(`passkey-${sid}`)) !== null;
}

export async function signElevation(sid, env, ttl = ELEVATION_TTL) {
  const secret = env && env.ID_SECRET;
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = await sign(secret, `elev:${sid}:${exp}`);
  return `${exp}.${sig}`;
}

// True only when the request carries a valid, unexpired elevation for this sid.
export async function verifyElevation(request, sid, env) {
  const secret = env && env.ID_SECRET;
  if (!secret || !sid) return false;
  const tok = request.headers.get('X-Elevation');
  if (!tok) return false;
  const dot = tok.indexOf('.');
  if (dot === -1) return false;
  const exp = parseInt(tok.slice(0, dot), 10);
  const sig = tok.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEq(sig, await sign(secret, `elev:${sid}:${exp}`));
}

/**
 * Always echo the signed `X-Player-Id` token so the same-origin client can
 * mirror it; set the cookie only when it needs healing/upgrading.
 */
export function applyIdentity(headers, { token, setCookie }) {
  if (token)     headers['X-Player-Id'] = token;
  if (setCookie) headers['Set-Cookie']  = setCookie;
  return headers;
}

// ── Auto-generated handles ────────────────────────────────────────────────────
const ADJECTIVES = [
  'Brave', 'Swift', 'Clever', 'Mighty', 'Sneaky', 'Cosmic', 'Funky', 'Jolly',
  'Lucky', 'Wild', 'Bold', 'Witty', 'Spicy', 'Mellow', 'Zesty', 'Nimble',
  'Quirky', 'Grumpy', 'Sleepy', 'Dizzy', 'Snappy', 'Breezy', 'Glowing', 'Royal',
];
const ANIMALS = [
  'Otter', 'Falcon', 'Panda', 'Badger', 'Lynx', 'Heron', 'Gecko', 'Moose',
  'Raven', 'Walrus', 'Beaver', 'Cobra', 'Mantis', 'Tapir', 'Narwhal', 'Bison',
  'Ferret', 'Quokka', 'Marmot', 'Puffin', 'Wombat', 'Dingo', 'Koala', 'Yak',
];

// Deterministic so the same id always yields the same handle without any storage.
export function handleFromSid(sid) {
  let h = 2166136261;
  for (let i = 0; i < sid.length; i++) {
    h ^= sid.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const adj    = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[(h >>> 8) % ANIMALS.length];
  const num    = (h >>> 16) % 100;
  return `${adj}${animal}${num}`;
}

// Returns the player's display handle: a custom name if they set one, else the
// deterministic auto-handle.
export async function getHandle(env, sid) {
  const custom = await env.SONGLESS_KV.get(`profile-name-${sid}`);
  return custom || handleFromSid(sid);
}
