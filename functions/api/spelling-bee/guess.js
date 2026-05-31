import { getOrCreateWords, normalize } from './_words.js';
import { identify, applyIdentity } from '../_identity.js';

const TTL    = 60 * 60 * 24 * 7;

function emptyStats() {
  return {
    uniquePlayers: 0, completions: 0, correct: 0, wrong: 0,
    perQuestion: Array.from({ length: 10 }, () => ({ correct: 0, wrong: 0 })),
    byDifficulty: {
      easy: { correct: 0, wrong: 0 }, medium: { correct: 0, wrong: 0 }, hard: { correct: 0, wrong: 0 },
      impossible: { correct: 0, wrong: 0 }, hard_impossible: { correct: 0, wrong: 0 },
    },
  };
}

async function updateStats(date, mode, sid, index, difficulty, correct, complete, env) {
  const suffix   = mode === 'hard' ? '-hard' : '';
  const statsKey = `spelling-stats${suffix}-${date}`;
  const seenKey  = `spelling-seen-${sid}-${date}-${mode}`;

  const [statsRaw, seen] = await Promise.all([
    env.SONGLESS_KV.get(statsKey, 'json'),
    env.SONGLESS_KV.get(seenKey),
  ]);

  const stats  = statsRaw || emptyStats();
  const writes = [];

  if (!seen) {
    stats.uniquePlayers = (stats.uniquePlayers || 0) + 1;
    writes.push(env.SONGLESS_KV.put(seenKey, '1', { expirationTtl: TTL }));
  }

  if (correct) stats.correct++; else stats.wrong++;
  if (!stats.perQuestion[index]) stats.perQuestion[index] = { correct: 0, wrong: 0 };
  stats.perQuestion[index][correct ? 'correct' : 'wrong']++;
  if (!stats.byDifficulty[difficulty]) stats.byDifficulty[difficulty] = { correct: 0, wrong: 0 };
  stats.byDifficulty[difficulty][correct ? 'correct' : 'wrong']++;
  if (complete) stats.completions = (stats.completions || 0) + 1;

  writes.push(env.SONGLESS_KV.put(statsKey, JSON.stringify(stats), { expirationTtl: TTL }));
  await Promise.all(writes);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.date || body.index == null) return new Response('Bad request', { status: 400 });

  const { date, index } = body;
  const mode  = body.mode === 'hard' ? 'hard' : 'normal';
  const words = await getOrCreateWords(date, env, mode);
  if (index < 0 || index >= words.length) return new Response('Bad request', { status: 400 });

  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const stateKey = `spelling-state-${sid}-${date}-${mode}`;
  const state    = await env.SONGLESS_KV.get(stateKey, 'json') || { answers: [], current: 0, gameOver: false };

  // Already answered this one — return the stored result (no double counting)
  if (state.answers[index]) {
    const a = state.answers[index];
    return new Response(JSON.stringify({ correct: a.correct, word: a.word, gameOver: state.gameOver, alreadyAnswered: true }), { headers });
  }

  const target  = words[index];
  const correct = normalize(body.guess) === normalize(target.word);

  state.answers[index] = { guess: (body.guess || '').toUpperCase(), correct, word: target.word };
  state.current  = Math.max(state.current || 0, index + 1);
  const complete = state.answers.filter(Boolean).length >= words.length;
  state.gameOver = complete;

  await Promise.all([
    env.SONGLESS_KV.put(stateKey, JSON.stringify(state), { expirationTtl: TTL }),
    updateStats(date, mode, sid, index, target.difficulty, correct, complete, env),
  ]);

  return new Response(JSON.stringify({ correct, word: target.word, gameOver: state.gameOver }), { headers });
}
