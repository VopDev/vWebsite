const COOKIE = 'slsid';

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

export async function onRequestGet({ request }) {
  let sid = getSid(request);
  const headers = { 'Content-Type': 'application/json' };

  if (!sid) {
    sid = crypto.randomUUID();
    headers['Set-Cookie'] =
      `${COOKIE}=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
  }

  return new Response(JSON.stringify({ sid }), { headers });
}
