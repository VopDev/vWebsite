const COOKIE = 'slsid';
const TTL    = 60 * 60 * 24 * 35;

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

function cookieHeader(sid) {
  return `${COOKIE}=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
}

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const sid = getSid(request);
  if (!sid) return Response.json(null);

  const data = await env.SONGLESS_KV.get(`state-${sid}-${date}`, 'json');
  return Response.json(data);
}

export async function onRequestPost({ request, env }) {
  const { date, state } = await request.json();
  if (!date || !state) return new Response('Bad request', { status: 400 });

  let sid = getSid(request);
  const headers = {};
  if (!sid) {
    sid = crypto.randomUUID();
    headers['Set-Cookie'] = cookieHeader(sid);
  }

  await env.SONGLESS_KV.put(`state-${sid}-${date}`, JSON.stringify(state), {
    expirationTtl: TTL,
  });

  return new Response('OK', { status: 200, headers });
}

export async function onRequestDelete({ request, env }) {
  const sid = getSid(request);
  if (!sid) return new Response('OK', { status: 200 });

  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  await env.SONGLESS_KV.delete(`state-${sid}-${date}`);
  return new Response('OK', { status: 200 });
}
