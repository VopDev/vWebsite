import { getOrCreateWord } from './_words.js';

const COOKIE = 'slsid';
const TTL    = 60 * 60 * 24 * 7;

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  await getOrCreateWord(date, env); // ensure word + seed exist
  const seed = await env.SONGLESS_KV.get(`words-seed-${date}`);

  const sid = getSid(request);
  if (!sid) return Response.json({ guesses: [], gameOver: false, won: false, seed });

  const state = await env.SONGLESS_KV.get(`words-state-${sid}-${date}`, 'json')
    || { guesses: [], gameOver: false, won: false };

  const response = { guesses: state.guesses, gameOver: state.gameOver, won: state.won, seed };
  if (state.gameOver) {
    const word = await env.SONGLESS_KV.get(`words-word-${date}`);
    response.answer = word;
  }
  return Response.json(response);
}
