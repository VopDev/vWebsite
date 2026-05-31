import { identify, applyIdentity, getHandle } from './_identity.js';

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const handle  = await getHandle(env, ident.sid);

  return new Response(JSON.stringify({ sid: ident.sid, handle }), { headers });
}
