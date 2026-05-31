import { identify, applyIdentity, getHandle, getRole } from './_identity.js';

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const [handle, role] = await Promise.all([
    getHandle(env, ident.sid),
    getRole(env, ident.sid),
  ]);

  return new Response(JSON.stringify({ sid: ident.sid, handle, role, staff: role !== 'player' }), { headers });
}
