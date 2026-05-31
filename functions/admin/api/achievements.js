export async function onRequestGet({ env }) {
  // List all achievement keys and return each player's unlocked achievements
  const players = [];
  let cursor;
  do {
    const result = await env.SONGLESS_KV.list({ prefix: 'achievements-', limit: 1000, cursor });
    for (const key of result.keys) {
      const sid  = key.name.slice('achievements-'.length);
      const data = await env.SONGLESS_KV.get(key.name, 'json') || [];
      if (data.length > 0) players.push({ sid, achievements: data });
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  players.sort((a, b) => {
    const aLatest = Math.max(...a.achievements.map(x => new Date(x.unlockedAt).getTime()));
    const bLatest = Math.max(...b.achievements.map(x => new Date(x.unlockedAt).getTime()));
    return bLatest - aLatest;
  });

  return Response.json(players);
}

export async function onRequestPost({ request, env }) {
  // Grant a specific achievement to a player (admin override).
  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const body = await request.json().catch(() => ({}));
  const id   = body.id;
  if (!sid || !id) return new Response('Bad request', { status: 400 });

  const key  = `achievements-${sid}`;
  const data = (await env.SONGLESS_KV.get(key, 'json')) || [];
  if (!data.some(a => a.id === id)) {
    data.push({ id, unlockedAt: new Date().toISOString() });
    await env.SONGLESS_KV.put(key, JSON.stringify(data));
  }
  return Response.json({ achievements: data });
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const id   = url.searchParams.get('id');
  const all  = url.searchParams.get('all');

  if (all === 'true') {
    // Delete every player's achievements
    let deleted = 0, cursor;
    do {
      const result = await env.SONGLESS_KV.list({ prefix: 'achievements-', limit: 1000, cursor });
      await Promise.all(result.keys.map(k => env.SONGLESS_KV.delete(k.name)));
      deleted += result.keys.length;
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    return Response.json({ deleted });
  }

  if (!sid) return new Response('Bad request', { status: 400 });
  const key = `achievements-${sid}`;

  if (id) {
    // Delete one specific achievement for this player
    const data    = (await env.SONGLESS_KV.get(key, 'json')) || [];
    const updated = data.filter(a => a.id !== id);
    if (updated.length === 0) {
      await env.SONGLESS_KV.delete(key);
    } else {
      await env.SONGLESS_KV.put(key, JSON.stringify(updated));
    }
    return new Response('OK', { status: 200 });
  }

  // Delete all achievements for this player
  await env.SONGLESS_KV.delete(key);
  return new Response('OK', { status: 200 });
}
