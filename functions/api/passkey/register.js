// Passkey registration = "Lock this profile".
//   GET  → creation options (challenge) for navigator.credentials.create
//   POST → verify the attestation, store the credential, lock the profile
import { identify, applyIdentity, isLocked } from '../_identity.js';
import { genChallenge, putChallenge, takeChallenge, rpInfo, verifyRegistration, bytesToB64u } from '../_webauthn.js';

function requireSecret(env, headers) {
  if (!env || !env.ID_SECRET) {
    return new Response(JSON.stringify({ error: 'Passkeys are not configured on this site.' }), { status: 501, headers });
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const stop = requireSecret(env, headers);
  if (stop) return stop;

  const { rpId } = rpInfo(request);
  const challenge = genChallenge();
  const challengeId = await putChallenge(env, { challenge, sid: ident.sid, kind: 'reg' });

  // userId is the sid bytes; name/displayName are cosmetic (no real account).
  const userId = bytesToB64u(new TextEncoder().encode(ident.sid));
  return new Response(JSON.stringify({
    challengeId,
    publicKey: {
      challenge,
      rp: { id: rpId, name: 'Vopori' },
      user: { id: userId, name: `player-${ident.sid.slice(0, 8)}`, displayName: 'Vopori Player' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      timeout: 60000,
      attestation: 'none',
    },
  }), { headers });
}

export async function onRequestPost({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const stop = requireSecret(env, headers);
  if (stop) return stop;

  const fail = (msg, code = 422) => new Response(JSON.stringify({ error: msg }), { status: code, headers });

  if (await isLocked(env, ident.sid)) return fail('Profile is already locked.', 409);

  const body = await request.json().catch(() => null);
  const chal = await takeChallenge(env, body?.challengeId);
  if (!chal || chal.kind !== 'reg' || chal.sid !== ident.sid) return fail('Challenge expired. Please try again.');

  const { rpId, origin } = rpInfo(request);
  let cred;
  try {
    cred = await verifyRegistration({
      attestationObject: body.attestationObject,
      clientDataJSON: body.clientDataJSON,
      expectedChallengeB64u: chal.challenge,
      rpId, origin,
    });
  } catch (e) {
    return fail('Could not verify passkey: ' + e.message);
  }

  const record = { credId: cred.credId, jwk: cred.jwk, alg: cred.alg, counter: cred.counter, lockedAt: new Date().toISOString() };
  await Promise.all([
    env.SONGLESS_KV.put(`passkey-${ident.sid}`, JSON.stringify(record)),
    // Reverse map for recovery: credentialId → sid.
    env.SONGLESS_KV.put(`passkey-cred-${cred.credId}`, ident.sid),
  ]);

  return new Response(JSON.stringify({ ok: true, locked: true }), { headers });
}
