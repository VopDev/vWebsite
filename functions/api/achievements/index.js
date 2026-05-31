import { identify, applyIdentity } from '../_identity.js';

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  if (!ident.sid) return new Response('[]', { headers });
  const data = (await env.SONGLESS_KV.get(`achievements-${ident.sid}`, 'json')) || [];
  return new Response(JSON.stringify(data), { headers });
}

export async function onRequestPost({ request, env }) {
  const body  = await request.json();
  // Accept either a single {id} or an array of id strings
  const ids   = Array.isArray(body) ? body : [body.id];
  const valid = ids.filter(Boolean);
  if (!valid.length) return new Response('Bad request', { status: 400 });

  // Mint a session if the visitor doesn't have one yet (e.g. achievements page eggs)
  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const data     = (await env.SONGLESS_KV.get(`achievements-${sid}`, 'json')) || [];
  const existing = new Set(data.map(a => a.id));
  const newOnes  = valid.filter(id => !existing.has(id));

  if (newOnes.length) {
    const now = new Date().toISOString();
    for (const id of newOnes) data.push({ id, unlockedAt: now });
    await env.SONGLESS_KV.put(`achievements-${sid}`, JSON.stringify(data));
  }

  return new Response(JSON.stringify({ unlocked: newOnes }), { headers });
}
