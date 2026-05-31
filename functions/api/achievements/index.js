const COOKIE = 'slsid';

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

function cookieHeader(sid) {
  return `${COOKIE}=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
}

export async function onRequestGet({ request, env }) {
  const sid = getSid(request);
  if (!sid) return Response.json([]);
  const data = (await env.SONGLESS_KV.get(`achievements-${sid}`, 'json')) || [];
  return Response.json(data);
}

export async function onRequestPost({ request, env }) {
  const body  = await request.json();
  // Accept either a single {id} or an array of id strings
  const ids   = Array.isArray(body) ? body : [body.id];
  const valid = ids.filter(Boolean);
  if (!valid.length) return new Response('Bad request', { status: 400 });

  // Mint a session if the visitor doesn't have one yet (e.g. achievements page eggs)
  let sid = getSid(request);
  const headers = { 'Content-Type': 'application/json' };
  if (!sid) { sid = crypto.randomUUID(); headers['Set-Cookie'] = cookieHeader(sid); }

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
