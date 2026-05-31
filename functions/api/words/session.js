import { getOrCreateWord } from './_words.js';
import { identify, applyIdentity } from '../_identity.js';

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  await getOrCreateWord(date, env, mode);
  const suffix = mode === 'hard' ? '-hard' : '';
  const seed   = await env.SONGLESS_KV.get(`words-seed${suffix}-${date}`);

  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  if (!ident.sid) {
    return new Response(JSON.stringify({ guesses: [], gameOver: false, won: false, seed, mode }), { headers });
  }

  const state = await env.SONGLESS_KV.get(`words-state-${ident.sid}-${date}-${mode}`, 'json')
    || { guesses: [], gameOver: false, won: false };

  const response = { guesses: state.guesses, gameOver: state.gameOver, won: state.won, seed, mode };
  if (state.gameOver) {
    const word = await env.SONGLESS_KV.get(`words-word${suffix}-${date}`);
    response.answer = word;
  }
  return new Response(JSON.stringify(response), { headers });
}
