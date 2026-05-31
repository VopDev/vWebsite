import { identify, applyIdentity } from '../_identity.js';

const TTL    = 60 * 60 * 24 * 35;

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') || 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  if (!ident.sid) return new Response('null', { headers });

  const data = await env.SONGLESS_KV.get(`state-${ident.sid}-${date}-${mode}`, 'json');
  return new Response(JSON.stringify(data ?? null), { headers });
}

export async function onRequestPost({ request, env }) {
  const { date, state, mode = 'normal' } = await request.json();
  if (!date || !state) return new Response('Bad request', { status: 400 });

  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({}, ident);
  if (ident.isNew) {
    const pk    = `players-${date}`;
    const count = parseInt(await env.SONGLESS_KV.get(pk) || '0', 10);
    await env.SONGLESS_KV.put(pk, String(count + 1));
  }

  await env.SONGLESS_KV.put(`state-${sid}-${date}-${mode}`, JSON.stringify(state), {
    expirationTtl: TTL,
  });

  return new Response('OK', { status: 200, headers });
}

export async function onRequestDelete({ request, env }) {
  const { sid } = await identify(request, env);
  if (!sid) return new Response('OK', { status: 200 });

  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode');
  if (!date) return new Response('Bad request', { status: 400 });

  if (mode) {
    await env.SONGLESS_KV.delete(`state-${sid}-${date}-${mode}`);
  } else {
    await Promise.all([
      env.SONGLESS_KV.delete(`state-${sid}-${date}-normal`),
      env.SONGLESS_KV.delete(`state-${sid}-${date}-hard`),
    ]);
  }

  return new Response('OK', { status: 200 });
}
