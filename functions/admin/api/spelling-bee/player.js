export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!sid || !date) return new Response('Bad request', { status: 400 });

  const [state, achs] = await Promise.all([
    env.SONGLESS_KV.get(`spelling-state-${sid}-${date}-${mode}`, 'json'),
    env.SONGLESS_KV.get(`achievements-${sid}`, 'json'),
  ]);
  return Response.json({ state, achievements: achs || [] });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode');
  if (!sid || !date) return new Response('Bad request', { status: 400 });

  if (mode) {
    await env.SONGLESS_KV.delete(`spelling-state-${sid}-${date}-${mode}`);
  } else {
    await Promise.all([
      env.SONGLESS_KV.delete(`spelling-state-${sid}-${date}-normal`),
      env.SONGLESS_KV.delete(`spelling-state-${sid}-${date}-hard`),
    ]);
  }
  return new Response('OK', { status: 200 });
}
