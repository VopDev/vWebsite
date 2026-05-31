// Passkey authentication. Two purposes from one assertion:
//   1) ELEVATE — prove a fresh passkey tap to authorize a sensitive action
//   2) RECOVER — re-attach to your sid on a new device / after a full data wipe
//
//   GET  → request options (challenge); pass ?recover=1 for discoverable login
//   POST → verify the assertion, return an elevation token (+ identity token)
import { identify, applyIdentity, signElevation, tokenForSid, cookieHeader } from '../_identity.js';
import { genChallenge, putChallenge, takeChallenge, rpInfo, verifyAssertion } from '../_webauthn.js';

function requireSecret(env, headers) {
  if (!env || !env.ID_SECRET) {
    return new Response(JSON.stringify({ error: 'Passkeys are not configured on this site.' }), { status: 501, headers });
  }
  return null;
}

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const stop = requireSecret(env, headers);
  if (stop) return stop;

  const recover = new URL(request.url).searchParams.get('recover') === '1';
  const { rpId } = rpInfo(request);
  const challenge = genChallenge();

  // When elevating a known profile, scope the assertion to its credential.
  let allowCredentials;
  if (!recover && ident.sid) {
    const rec = await env.SONGLESS_KV.get(`passkey-${ident.sid}`, 'json');
    if (rec) allowCredentials = [{ type: 'public-key', id: rec.credId }];
  }

  const challengeId = await putChallenge(env, { challenge, sid: recover ? null : ident.sid, kind: recover ? 'recover' : 'elev' });
  return new Response(JSON.stringify({
    challengeId,
    publicKey: {
      challenge,
      rpId,
      timeout: 60000,
      userVerification: 'preferred',
      ...(allowCredentials ? { allowCredentials } : {}),
    },
  }), { headers });
}

export async function onRequestPost({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const stop = requireSecret(env, headers);
  if (stop) return stop;

  const fail = (msg, code = 422) => new Response(JSON.stringify({ error: msg }), { status: code, headers });

  const body = await request.json().catch(() => null);
  const chal = await takeChallenge(env, body?.challengeId);
  if (!chal) return fail('Challenge expired. Please try again.');

  const credId = body?.credentialId;
  if (!credId) return fail('Missing credential.');

  // Resolve which sid this credential belongs to.
  const credSid = await env.SONGLESS_KV.get(`passkey-cred-${credId}`);
  if (!credSid) return fail('Unknown passkey.', 404);

  // For elevation the assertion must match the profile the challenge was for.
  if (chal.kind === 'elev' && chal.sid && chal.sid !== credSid) return fail('Passkey does not match this profile.', 403);

  const rec = await env.SONGLESS_KV.get(`passkey-${credSid}`, 'json');
  if (!rec) return fail('Unknown passkey.', 404);

  const { rpId, origin } = rpInfo(request);
  let newCounter;
  try {
    newCounter = await verifyAssertion({
      jwk: rec.jwk,
      clientDataJSON: body.clientDataJSON,
      authenticatorData: body.authenticatorData,
      signature: body.signature,
      expectedChallengeB64u: chal.challenge,
      rpId, origin,
    });
  } catch (e) {
    return fail('Could not verify passkey: ' + e.message);
  }

  // Counter must be strictly increasing when the authenticator reports one
  // (0/0 means the authenticator doesn't track a counter — accept).
  if (newCounter > 0 || rec.counter > 0) {
    if (newCounter <= rec.counter) return fail('Passkey replay detected.', 403);
    rec.counter = newCounter;
    await env.SONGLESS_KV.put(`passkey-${credSid}`, JSON.stringify(rec));
  }

  const elevation = await signElevation(credSid, env);

  // Recovery: hand back the identity token + heal the cookie so this browser
  // becomes (or re-becomes) the owner of credSid.
  const out = { ok: true, elevation, sid: credSid };
  if (credSid !== ident.sid) {
    const token = await tokenForSid(credSid, env.ID_SECRET);
    out.token = token;
    headers['X-Player-Id'] = token;
    headers['Set-Cookie']  = cookieHeader(token);
  }
  return new Response(JSON.stringify(out), { headers });
}
