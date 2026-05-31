import { generateSeed, getOrCreateWords } from '../../../api/spelling-bee/_words.js';

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';
  const [words, seed, stats] = await Promise.all([
    getOrCreateWords(date, env, mode),
    env.SONGLESS_KV.get(`spelling-seed${suffix}-${date}`),
    env.SONGLESS_KV.get(`spelling-stats${suffix}-${date}`, 'json'),
  ]);

  return Response.json({ words, seed, stats: stats || null, mode });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  const type = url.searchParams.get('type');
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';

  // Clear analytics: stats counter + per-player "seen" markers for this day/mode
  if (type === 'stats') {
    await env.SONGLESS_KV.delete(`spelling-stats${suffix}-${date}`);
    let cursor;
    do {
      const result = await env.SONGLESS_KV.list({ prefix: 'spelling-seen-', limit: 1000, cursor });
      const keys   = result.keys.filter(k => k.name.endsWith(`-${date}-${mode}`));
      await Promise.all(keys.map(k => env.SONGLESS_KV.delete(k.name)));
      cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    return Response.json({ cleared: true });
  }

  // Default: new seed / new words
  await Promise.all([
    env.SONGLESS_KV.delete(`spelling-words${suffix}-${date}`),
    env.SONGLESS_KV.delete(`spelling-seed${suffix}-${date}`),
  ]);

  const words = await getOrCreateWords(date, env, mode);
  const seed  = await env.SONGLESS_KV.get(`spelling-seed${suffix}-${date}`);
  return Response.json({ words, seed, mode });
}
