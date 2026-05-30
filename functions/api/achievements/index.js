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

  const { id } = await request.json();
  if (!id) return new Response('Bad request', { status: 400 });

  const data = (await env.SONGLESS_KV.get(`achievements-${sid}`, 'json')) || [];
  if (data.find(a => a.id === id)) return Response.json({ already: true });

  data.push({ id, unlockedAt: new Date().toISOString() });
  await env.SONGLESS_KV.put(`achievements-${sid}`, JSON.stringify(data));
  return Response.json({ unlocked: true });
}
