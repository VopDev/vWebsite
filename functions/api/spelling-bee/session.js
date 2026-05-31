import { getOrCreateWords } from './_words.js';
import { identify, applyIdentity } from '../_identity.js';

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  if (!date) return new Response('Bad request', { status: 400 });

  const suffix = mode === 'hard' ? '-hard' : '';
  const words  = await getOrCreateWords(date, env, mode);
  const seed   = await env.SONGLESS_KV.get(`spelling-seed${suffix}-${date}`);

  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const state = ident.sid ? await env.SONGLESS_KV.get(`spelling-state-${ident.sid}-${date}-${mode}`, 'json') : null;
  const answers = state?.answers || [];

  // Only reveal the spelling for questions the player has already answered
  const questions = words.map((w, i) => {
    const ans = answers[i];
    return ans
      ? { index: i, difficulty: w.difficulty, answered: true, guess: ans.guess, correct: ans.correct, word: w.word }
      : { index: i, difficulty: w.difficulty, answered: false };
  });

  return new Response(JSON.stringify({
    seed,
    mode,
    total:    words.length,
    current:  state?.current ?? answers.filter(Boolean).length,
    gameOver: state?.gameOver ?? false,
    questions,
  }), { headers });
}
