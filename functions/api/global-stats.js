const COOKIE = 'slsid';
const TTL    = 60 * 60 * 24 * 120; // 120 days

const PLAY_THRESHOLDS   = [1, 5, 10, 50];
const STREAK_THRESHOLDS = [1, 5, 10, 50];

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

function cookieHeader(sid) {
  return `${COOKIE}=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; HttpOnly`;
}

function qualifiedIds(stats) {
  const ids = [];
  for (const t of PLAY_THRESHOLDS)   if ((stats.totalPlays || 0) >= t) ids.push(`global_play_${t}`);
  for (const t of STREAK_THRESHOLDS) if ((stats.streak     || 0) >= t) ids.push(`global_streak_${t}`);
  return ids;
}

export async function onRequestGet({ request, env }) {
  const sid = getSid(request);
  if (!sid) return Response.json({ totalPlays: 0, streak: 0, longestStreak: 0 });
  const stats = (await env.SONGLESS_KV.get(`global-stats-${sid}`, 'json'))
    || { totalPlays: 0, streak: 0, longestStreak: 0, lastPlayDate: null };
  return Response.json({ totalPlays: stats.totalPlays, streak: stats.streak, longestStreak: stats.longestStreak });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body?.game || !body?.date) return new Response('Bad request', { status: 400 });

  const { game, date } = body;
  const mode = body.mode === 'hard' ? 'hard' : 'normal';

  let sid = getSid(request);
  const headers = { 'Content-Type': 'application/json' };
  if (!sid) { sid = crypto.randomUUID(); headers['Set-Cookie'] = cookieHeader(sid); }

  const statsKey = `global-stats-${sid}`;
  const dedupKey = `global-played-${sid}-${date}-${game}-${mode}`;

  const [statsRaw, alreadyCounted] = await Promise.all([
    env.SONGLESS_KV.get(statsKey, 'json'),
    env.SONGLESS_KV.get(dedupKey),
  ]);

  const stats = statsRaw || { totalPlays: 0, streak: 0, longestStreak: 0, lastPlayDate: null };

  if (!alreadyCounted) {
    stats.totalPlays = (stats.totalPlays || 0) + 1;

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
