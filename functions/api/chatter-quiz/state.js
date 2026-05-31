import { identify, applyIdentity } from '../_identity.js';

const TTL    = 60 * 60 * 24 * 7;

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  if (!ident.sid) return new Response('null', { headers });

  const data = await env.SONGLESS_KV.get(`cq-state-${ident.sid}-${date}`, 'json');
  return new Response(JSON.stringify(data ? { ...data, sid: ident.sid } : { sid: ident.sid }), { headers });
}

export async function onRequestPost({ request, env }) {
  const { date, state } = await request.json();
  if (!date || !state) return new Response('Bad request', { status: 400 });

  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({}, ident);

  await env.SONGLESS_KV.put(`cq-state-${sid}-${date}`, JSON.stringify(state), {
    expirationTtl: TTL,
  });

  return new Response('OK', { status: 200, headers });
}
