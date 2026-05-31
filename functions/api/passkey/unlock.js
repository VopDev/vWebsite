// Remove the passkey lock from a profile. Requires a fresh elevation (i.e. the
// user just proved possession of the passkey via /api/passkey/auth).
import { identify, applyIdentity, isLocked, verifyElevation } from '../_identity.js';

export async function onRequestPost({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const fail = (msg, code) => new Response(JSON.stringify({ error: msg }), { status: code, headers });

  if (!ident.sid || !(await isLocked(env, ident.sid))) {
    return new Response(JSON.stringify({ ok: true, locked: false }), { headers });
  }
  if (!(await verifyElevation(request, ident.sid, env))) {
    return fail('Passkey verification required to unlock.', 401);
  }

  const rec = await env.SONGLESS_KV.get(`passkey-${ident.sid}`, 'json');
  await Promise.all([
    env.SONGLESS_KV.delete(`passkey-${ident.sid}`),
    rec?.credId ? env.SONGLESS_KV.delete(`passkey-cred-${rec.credId}`) : Promise.resolve(),
  ]);
  return new Response(JSON.stringify({ ok: true, locked: false }), { headers });
}
