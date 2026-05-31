export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  if (!sid || !date) return new Response('Bad request', { status: 400 });

  const [normal, hard, achs] = await Promise.all([
    env.SONGLESS_KV.get(`state-${sid}-${date}-normal`, 'json'),
    env.SONGLESS_KV.get(`state-${sid}-${date}-hard`, 'json'),
    env.SONGLESS_KV.get(`achievements-${sid}`, 'json'),
  ]);
  return Response.json({ normal, hard, achievements: achs || [] });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  const type = url.searchParams.get('type');
  if (!sid) return new Response('Bad request', { status: 400 });

  if (type === 'achievements') {
    await env.SONGLESS_KV.delete(`achievements-${sid}`);
    return new Response('OK', { status: 200 });
  }

  if (date) {
    await Promise.all([
      env.SONGLESS_KV.delete(`state-${sid}-${date}-normal`),
      env.SONGLESS_KV.delete(`state-${sid}-${date}-hard`),
    ]);
  }
  return new Response('OK', { status: 200 });
}
