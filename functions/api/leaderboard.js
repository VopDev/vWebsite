import { identify, applyIdentity, handleFromSid } from './_identity.js';
import { POINTS, TOTAL_POINTS, MAX_LEVEL, pointsFor, progress } from './_achievements.js';

const TOP_N = 50;

async function listAll(KV, prefix) {
  const keys = [];
  let cursor;
  do {
    const res = await KV.list({ prefix, limit: 1000, cursor });
    keys.push(...res.keys.map(k => k.name));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return keys;
}

// GET /api/leaderboard → { me, top, points, totalPoints, maxLevel }
// Public ranking of players by total achievement XP. `me` is the caller's own
// standing (level + progress to next level), resolved from their slsid.
export async function onRequestGet({ request, env }) {
  const KV      = env.SONGLESS_KV;
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  // Names, roles + manual XP adjustments in bulk (avoids a get-per-sid storm).
  const nameMap = {}, roleMap = {}, adjMap = {};
  for (const k of await listAll(KV, 'profile-name-')) nameMap[k.slice('profile-name-'.length)] = await KV.get(k);
  for (const k of await listAll(KV, 'role-'))         roleMap[k.slice('role-'.length)]         = await KV.get(k);
  for (const k of await listAll(KV, 'xp-adjust-'))     adjMap[k.slice('xp-adjust-'.length)]      = parseInt(await KV.get(k), 10) || 0;

  // Every player who has either achievements or a manual XP adjustment.
  const sids = new Set();
  for (const k of await listAll(KV, 'achievements-')) sids.add(k.slice('achievements-'.length));
  for (const s of Object.keys(adjMap)) sids.add(s);

  const entries = [];
  for (const sid of sids) {
    const achs   = (await KV.get(`achievements-${sid}`, 'json')) || [];
    const points = Math.max(0, pointsFor(achs) + (adjMap[sid] || 0));
    if (points <= 0) continue;
    const name = nameMap[sid];
    const role = roleMap[sid] || (name && name.toLowerCase() === 'vopori' ? 'admin' : 'player');
    entries.push({ sid, handle: name || handleFromSid(sid), points, count: achs.length, staff: role !== 'player' });
  }
  entries.sort((a, b) => b.points - a.points || b.count - a.count);

  const top = entries.slice(0, TOP_N).map((e, i) => ({
    rank:  i + 1,
    handle: e.handle,
    points: e.points,
    count:  e.count,
    level:  progress(e.points).level,
    staff:  e.staff,
    me:     !!(ident.sid && e.sid === ident.sid),
  }));

  let me = null;
  if (ident.sid) {
    const idx = entries.findIndex(e => e.sid === ident.sid);
    me = {
      ...progress(idx >= 0 ? entries[idx].points : 0),
      rank:    idx >= 0 ? idx + 1 : null,
      players: entries.length,
    };
  }

  return new Response(
    JSON.stringify({ me, top, points: POINTS, totalPoints: TOTAL_POINTS, maxLevel: MAX_LEVEL }),
    { headers },
  );
}
