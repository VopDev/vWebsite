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
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';
  await Promise.all([
    env.SONGLESS_KV.delete(`spelling-words${suffix}-${date}`),
    env.SONGLESS_KV.delete(`spelling-seed${suffix}-${date}`),
  ]);

  const words = await getOrCreateWords(date, env, mode);
  const seed  = await env.SONGLESS_KV.get(`spelling-seed${suffix}-${date}`);
  return Response.json({ words, seed, mode });
}
