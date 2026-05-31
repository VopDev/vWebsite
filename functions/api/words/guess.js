import { evaluate, getOrCreateWord } from './_words.js';
import { identify, applyIdentity } from '../_identity.js';

const TTL    = 60 * 60 * 24 * 7;

const MAX_GUESSES = { normal: 6, hard: 5 };

async function updateStats(date, mode, sid, guessNum, gameOver, won, env) {
  const suffix   = mode === 'hard' ? '-hard' : '';
  const statsKey = `words-stats${suffix}-${date}`;
  const seenKey  = `words-seen-${sid}-${date}-${mode}`;

  const [statsRaw, seen] = await Promise.all([
    env.SONGLESS_KV.get(statsKey, 'json'),
    env.SONGLESS_KV.get(seenKey),
  ]);

  const stats = statsRaw || { totalGuesses: 0, wins: 0, losses: 0, distribution: {}, uniquePlayers: 0 };

  if (!seen) {
    stats.uniquePlayers++;
    await env.SONGLESS_KV.put(seenKey, '1', { expirationTtl: TTL });
  }

  stats.totalGuesses++;

  if (gameOver) {
    if (won) {
      stats.wins++;
      const k = String(guessNum);
      stats.distribution[k] = (stats.distribution[k] || 0) + 1;
    } else {
      stats.losses++;
      stats.distribution['X'] = (stats.distribution['X'] || 0) + 1;
    }
  }

  await env.SONGLESS_KV.put(statsKey, JSON.stringify(stats), { expirationTtl: TTL });
}

async function isValidWord(word) {
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
    return r.ok;
  } catch { return true; }
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.date) return new Response('Bad request', { status: 400 });

  const { date, word, mode: rawMode, timeout } = body;
  const mode = rawMode === 'hard' ? 'hard' : 'normal';
  const max  = MAX_GUESSES[mode];

  // ── Timeout / forfeit (hard mode timer expired) ──────────────────────────────
  if (timeout) {
    const answer = await getOrCreateWord(date, env, mode);
    const ident = await identify(request, env, { create: true });
    const sid   = ident.sid;
    const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

    const stateKey = `words-state-${sid}-${date}-${mode}`;
    const state    = await env.SONGLESS_KV.get(stateKey, 'json')
      || { guesses: [], gameOver: false, won: false };

    if (state.gameOver) return new Response(JSON.stringify({ gameOver: true, won: state.won, answer, mode }), { headers });

    state.gameOver = true;
    state.won      = false;
    await Promise.all([
      env.SONGLESS_KV.put(stateKey, JSON.stringify(state), { expirationTtl: TTL }),
      updateStats(date, mode, sid, state.guesses.length, true, false, env),
    ]);
    return new Response(JSON.stringify({ gameOver: true, won: false, answer, mode, timedOut: true }), { headers });
  }

  if (!word) return new Response('Bad request', { status: 400 });
  const guess = word.toUpperCase().trim();

  if (guess.length !== 5) return Response.json({ error: 'Word must be 5 letters' }, { status: 400 });

  const valid = await isValidWord(guess);
  if (!valid) return Response.json({ error: 'Not a valid word' }, { status: 422 });

  const answer = await getOrCreateWord(date, env, mode);

  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const stateKey = `words-state-${sid}-${date}-${mode}`;
  const state    = await env.SONGLESS_KV.get(stateKey, 'json')
    || { guesses: [], gameOver: false, won: false };

  if (state.gameOver)            return Response.json({ error: 'Game already over' }, { status: 400 });
  if (state.guesses.length >= max) return Response.json({ error: 'No guesses left' }, { status: 400 });

  const evaluation = evaluate(guess, answer);
  const won        = evaluation.every(e => e === 'correct');

  state.guesses.push({ word: guess, evaluation });

  const gameOver = won || state.guesses.length >= max;
  state.gameOver = gameOver;
  state.won      = won;

  await Promise.all([
    env.SONGLESS_KV.put(stateKey, JSON.stringify(state), { expirationTtl: TTL }),
    updateStats(date, mode, sid, state.guesses.length, gameOver, won, env),
  ]);

  const response = { evaluation, gameOver, won, guessNum: state.guesses.length, mode };
  if (gameOver) response.answer = answer;

  return new Response(JSON.stringify(response), { headers });
}
