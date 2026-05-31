export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  if (!sid || !date) return new Response('Bad request', { status: 400 });

  const [state, achs] = await Promise.all([
    env.SONGLESS_KV.get(`words-state-${sid}-${date}`, 'json'),
    env.SONGLESS_KV.get(`achievements-${sid}`, 'json'),
  ]);
  return Response.json({ state, achievements: achs || [] });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const date = url.searchParams.get('date');
  if (!sid) return new Response('Bad request', { status: 400 });

  if (date) {
    await env.SONGLESS_KV.delete(`words-state-${sid}-${date}`);
  } else {
    // Delete all dates for this player by listing
    let cursor;
    do {
      const result = await env.SONGLESS_KV.list({ prefix: `words-state-${sid}-`, limit: 1000, cursor });
      await Promise.all(result.keys.map(k => env.SONGLESS_KV.delete(k.name)));
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
  }
  return new Response('OK', { status: 200 });
}
