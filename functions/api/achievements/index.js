function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

export async function onRequestGet({ request, env }) {
  const sid = getSid(request);
  if (!sid) return Response.json([]);
  const data = (await env.SONGLESS_KV.get(`achievements-${sid}`, 'json')) || [];
  return Response.json(data);
}

export async function onRequestPost({ request, env }) {
  const sid = getSid(request);
  if (!sid) return new Response('No session', { status: 401 });

  const body = await request.json();
  // Accept either a single {id} or an array of id strings
  const ids  = Array.isArray(body) ? body : [body.id];
  const valid = ids.filter(Boolean);
  if (!valid.length) return new Response('Bad request', { status: 400 });

  const data     = (await env.SONGLESS_KV.get(`achievements-${sid}`, 'json')) || [];
  const existing = new Set(data.map(a => a.id));
  const newOnes  = valid.filter(id => !existing.has(id));

  if (!newOnes.length) return Response.json({ unlocked: [] });

  const now = new Date().toISOString();
  for (const id of newOnes) data.push({ id, unlockedAt: now });
  await env.SONGLESS_KV.put(`achievements-${sid}`, JSON.stringify(data));
  return Response.json({ unlocked: newOnes });
}
