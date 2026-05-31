import { identify, applyIdentity } from './_identity.js';

const TTL    = 60 * 60 * 24 * 120; // 120 days

const PLAY_THRESHOLDS   = [1, 3, 5, 10, 25, 50, 100];
const STREAK_THRESHOLDS = [1, 3, 5, 7, 10, 25, 50, 100];
const ALL_GAMES         = ['songquiz', 'chatter-quiz', 'words', 'spelling-bee'];

function qualifiedIds(stats) {
  const ids = [];
  for (const t of PLAY_THRESHOLDS)   if ((stats.totalPlays || 0) >= t) ids.push(`global_play_${t}`);
  for (const t of STREAK_THRESHOLDS) if ((stats.streak     || 0) >= t) ids.push(`global_streak_${t}`);
  const played = stats.played || [];
  const lost   = stats.lost   || [];
  const won    = stats.won    || [];
  if (ALL_GAMES.every(g => played.includes(g))) ids.push('global_all_games');
  if (ALL_GAMES.every(g => lost.includes(g)))   ids.push('global_all_losses');
  if (ALL_GAMES.every(g => won.includes(g)))    ids.push('global_all_wins');
  return ids;
}

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  if (!ident.sid) return new Response(JSON.stringify({ totalPlays: 0, streak: 0, longestStreak: 0 }), { headers });
  const stats = (await env.SONGLESS_KV.get(`global-stats-${ident.sid}`, 'json'))
    || { totalPlays: 0, streak: 0, longestStreak: 0, lastPlayDate: null };
  return new Response(JSON.stringify({ totalPlays: stats.totalPlays, streak: stats.streak, longestStreak: stats.longestStreak }), { headers });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.game || !body?.date) return new Response('Bad request', { status: 400 });

  const { game, date } = body;
  const mode = body.mode === 'hard' ? 'hard' : 'normal';
  const lost = body.lost === true;

  const ident = await identify(request, env, { create: true });
  const sid   = ident.sid;
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const statsKey = `global-stats-${sid}`;
  const dedupKey = `global-played-${sid}-${date}-${game}-${mode}`;

  const [statsRaw, alreadyCounted] = await Promise.all([
    env.SONGLESS_KV.get(statsKey, 'json'),
    env.SONGLESS_KV.get(dedupKey),
  ]);

  const stats = statsRaw || { totalPlays: 0, streak: 0, longestStreak: 0, lastPlayDate: null, played: [], lost: [] };

  if (!alreadyCounted) {
    stats.totalPlays = (stats.totalPlays || 0) + 1;

    // Track distinct games played / lost (for "every game" achievements)
    stats.played = stats.played || [];
    if (!stats.played.includes(game)) stats.played.push(game);
    stats.lost = stats.lost || [];
    if (lost && !stats.lost.includes(game)) stats.lost.push(game);
    stats.won = stats.won || [];
    if (!lost && !stats.won.includes(game)) stats.won.push(game);

    // Streak — consecutive distinct days with at least one completion
    if (!stats.lastPlayDate) {
      stats.streak = 1;
    } else if (stats.lastPlayDate !== date) {
      const diff = Math.round((Date.parse(date) - Date.parse(stats.lastPlayDate)) / 86400000);
      if (diff === 1)      stats.streak = (stats.streak || 0) + 1;
      else if (diff > 1)   stats.streak = 1;
      // diff <= 0 (out-of-order date): leave streak unchanged
    }
    // Advance lastPlayDate only forward in time
    if (!stats.lastPlayDate || Date.parse(date) > Date.parse(stats.lastPlayDate)) {
      stats.lastPlayDate = date;
    }
    stats.longestStreak = Math.max(stats.longestStreak || 0, stats.streak || 0);

    await Promise.all([
      env.SONGLESS_KV.put(statsKey, JSON.stringify(stats), { expirationTtl: TTL }),
      env.SONGLESS_KV.put(dedupKey, '1', { expirationTtl: TTL }),
    ]);
  }

  return new Response(JSON.stringify({
    totalPlays: stats.totalPlays,
    streak:     stats.streak,
    qualified:  qualifiedIds(stats),
  }), { headers });
}
