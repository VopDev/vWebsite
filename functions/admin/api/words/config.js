import { generateSeed, getOrCreateWord } from '../../../api/words/_words.js';

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';
  const [word, seed, statsRaw] = await Promise.all([
    env.SONGLESS_KV.get(`words-word${suffix}-${date}`),
    env.SONGLESS_KV.get(`words-seed${suffix}-${date}`),
    env.SONGLESS_KV.get(`words-stats${suffix}-${date}`, 'json'),
  ]);

  const stats = statsRaw || { totalGuesses: 0, wins: 0, losses: 0, distribution: {}, uniquePlayers: 0 };
  return Response.json({ word: word || null, seed: seed || null, stats, mode });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';
  await Promise.all([
    env.SONGLESS_KV.delete(`words-word${suffix}-${date}`),
    env.SONGLESS_KV.delete(`words-seed${suffix}-${date}`),
  ]);

  const word = await getOrCreateWord(date, env, mode);
  const seed = await env.SONGLESS_KV.get(`words-seed${suffix}-${date}`);
  return Response.json({ word, seed, mode });
}
