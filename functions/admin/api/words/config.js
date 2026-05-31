import { generateSeed, getOrCreateWord } from '../../../api/words/_words.js';

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const [word, seed, statsRaw] = await Promise.all([
    env.SONGLESS_KV.get(`words-word-${date}`),
    env.SONGLESS_KV.get(`words-seed-${date}`),
    env.SONGLESS_KV.get(`words-stats-${date}`, 'json'),
  ]);

  const stats = statsRaw || { totalGuesses: 0, wins: 0, losses: 0, distribution: {}, uniquePlayers: 0 };
  return Response.json({ word: word || null, seed: seed || null, stats });
}

export async function onRequestDelete({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  // Delete existing word + seed so getOrCreateWord generates fresh ones
  await Promise.all([
    env.SONGLESS_KV.delete(`words-word-${date}`),
    env.SONGLESS_KV.delete(`words-seed-${date}`),
  ]);

  // Immediately generate and store the new word + seed
  const word = await getOrCreateWord(date, env);
  const seed = await env.SONGLESS_KV.get(`words-seed-${date}`);

  return Response.json({ word, seed });
}
