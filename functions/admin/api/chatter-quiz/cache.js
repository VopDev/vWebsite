export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  if (!sid || !date) return new Response('Bad request', { status: 400 });
  const state = await env.SONGLESS_KV.get(`cq-state-${sid}-${date}`, 'json');
  const achs  = await env.SONGLESS_KV.get(`achievements-${sid}`, 'json') || [];
  return Response.json({ state, achievements: achs });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const type = url.searchParams.get('type');

  if (type === 'emotes') {
    await env.SONGLESS_KV.delete('chatter-quiz-emotes-v1');
    return new Response('OK', { status: 200 });
  }

  if (type === 'reseed' && date) {
    const current = parseInt(await env.SONGLESS_KV.get(`chatter-quiz-era-${date}`) || '0', 10) || 0;
    await env.SONGLESS_KV.put(`chatter-quiz-era-${date}`, String(current + 1), { expirationTtl: 60 * 60 * 48 });
    await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
    return new Response('OK', { status: 200 });
  }

  if (type === 'player-state') {
    const sid = url.searchParams.get('sid');
    if (!sid || !date) return new Response('Bad request', { status: 400 });
    await env.SONGLESS_KV.delete(`cq-state-${sid}-${date}`);
    return new Response('OK', { status: 200 });
  }

  if (type === 'stats' && date) {
    await Promise.all([
      env.SONGLESS_KV.delete(`cq-stats-${date}`),
      env.SONGLESS_KV.delete(`cq-players-${date}`),
    ]);
    return new Response('OK', { status: 200 });
  }

  if (type === 'states' && date) {
    // Delete all per-user game states for the given date
    let deleted = 0;
    let cursor;
    do {
      const result = await env.SONGLESS_KV.list({ prefix: 'cq-state-', limit: 1000, cursor });
      const keys   = result.keys.filter(k => k.name.endsWith(`-${date}`));
      await Promise.all(keys.map(k => env.SONGLESS_KV.delete(k.name)));
      deleted += keys.length;
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    return Response.json({ deleted });
  }

  if (!date) return new Response('Bad request', { status: 400 });
  await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
  return new Response('OK', { status: 200 });
}
