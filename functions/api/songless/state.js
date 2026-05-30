const COOKIE = 'slsid';
const TTL    = 60 * 60 * 24 * 35;

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

function cookieHeader(sid) {
  return `${COOKIE}=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
}

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') || 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const sid = getSid(request);
  if (!sid) return Response.json(null);

  const data = await env.SONGLESS_KV.get(`state-${sid}-${date}-${mode}`, 'json');
  return Response.json(data);
}

export async function onRequestPost({ request, env }) {
  const { date, state, mode = 'normal' } = await request.json();
  if (!date || !state) return new Response('Bad request', { status: 400 });

  let sid = getSid(request);
  const headers = {};
  const isNew = !sid;
  if (isNew) {
    sid = crypto.randomUUID();
    headers['Set-Cookie'] = cookieHeader(sid);

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
  const sid = getSid(request);
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
