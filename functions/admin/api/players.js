import { identify, handleFromSid, getRole, isAdmin, BOOTSTRAP_ADMIN, ROLES } from '../../api/_identity.js';
import { pointsFor, progress } from '../../api/_achievements.js';
import { isProfane } from '../../api/_profanity.js';

// Manual XP adjustment (admin-editable) layered on top of achievement points.
const adjustKey = (sid) => `xp-adjust-${sid}`;
async function getAdjust(KV, sid) {
  return parseInt((await KV.get(adjustKey(sid))) || '0', 10) || 0;
}
async function totalXp(KV, sid, achievements) {
  const base = pointsFor(achievements || []);
  return Math.max(0, base + await getAdjust(KV, sid));
}

// Per-player state lives under several KV key shapes. The sid is always a
// 36-char UUID that sits immediately after the prefix, so we can both discover
// players (scan prefixes) and wipe a single player (delete by `${prefix}${sid}`).
const STATE_PREFIXES = [
  'words-state-',     // Words      → words-state-{sid}-{date}-{mode}
  'state-',           // SongQuiz   → state-{sid}-{date}-{mode}
  'spelling-state-',  // SpellingBee→ spelling-state-{sid}-{date}-{mode}
  'cq-state-',        // ChatterQz  → cq-state-{sid}-{date}
];

function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
}

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

// Fetch every saved state (all dates/modes) for one player+game prefix.
async function gameStates(KV, prefix, sid) {
  const keys   = await listAll(KV, `${prefix}${sid}-`);
  const states = await Promise.all(keys.map(k => KV.get(k, 'json')));
  return states.filter(Boolean);
}

// Aggregate lifetime stats + today's status for one player across all games.
async function buildGameStats(KV, sid) {
  const TODAY = todayStr();
  const [words, song, spell, chat, wToday, sToday, spToday, cToday] = await Promise.all([
    gameStates(KV, 'words-state-', sid),
    gameStates(KV, 'state-', sid),
    gameStates(KV, 'spelling-state-', sid),
    gameStates(KV, 'cq-state-', sid),
    Promise.all([
      KV.get(`words-state-${sid}-${TODAY}-normal`, 'json'),
      KV.get(`words-state-${sid}-${TODAY}-hard`, 'json'),
    ]),
    Promise.all([
      KV.get(`state-${sid}-${TODAY}-normal`, 'json'),
      KV.get(`state-${sid}-${TODAY}-hard`, 'json'),
    ]),
    Promise.all([
      KV.get(`spelling-state-${sid}-${TODAY}-normal`, 'json'),
      KV.get(`spelling-state-${sid}-${TODAY}-hard`, 'json'),
    ]),
    KV.get(`cq-state-${sid}-${TODAY}`, 'json'),
  ]);

  // Words
  const wDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, X: 0 };
  let wWins = 0, wLosses = 0, wIn = 0;
  for (const s of words) {
    if (s.gameOver) {
      if (s.won) { wWins++; const g = s.guesses?.length || 0; if (g >= 1 && g <= 6) wDist[g]++; }
      else { wLosses++; wDist.X++; }
    } else wIn++;
  }
  const wTodayStatus = (st => st ? (st.gameOver ? (st.won ? '✅ Won' : '❌ Lost') : `⏳ ${st.guesses?.length || 0} guesses`) : '—')(wToday[0] || wToday[1]);

  // SongQuiz
  let sgPlayed = 0, sgWon = 0, sgSweeps = 0;
  for (const s of song) {
    const games = s.games || [];
    sgPlayed += games.length;
    const w = games.filter(g => g.won).length;
    sgWon += w;
    if (w >= 5) sgSweeps++;
  }
  const sgTodayStatus = (() => {
    const parts = [];
    if (sToday[0]) parts.push(`N song ${(sToday[0].slot ?? 0) + 1}/5`);
    if (sToday[1]) parts.push(`H song ${(sToday[1].slot ?? 0) + 1}/5`);
    return parts.length ? parts.join(' · ') : '—';
  })();

  // Spelling Bee
  let spAns = 0, spCorrect = 0, spPerfect = 0;
  for (const s of spell) {
    const ans = (s.answers || []).filter(Boolean);
    spAns += ans.length;
    const c = ans.filter(a => a && a.correct).length;
    spCorrect += c;
    if (c >= 10) spPerfect++;
  }
  const spTodayStatus = (st => {
    if (!st) return '—';
    const ans = (st.answers || []).filter(Boolean);
    const c = ans.filter(a => a && a.correct).length;
    return st.gameOver ? `Done ${c}/${ans.length}` : `⏳ ${ans.length} answered`;
  })(spToday[0] || spToday[1]);

  // Chatter Quiz
  let cAns = 0, cCorrect = 0, cPerfect = 0;
  for (const s of chat) {
    const log = s.log || [];
    cAns += log.length;
    const c = log.filter(a => a.correct).length;
    cCorrect += c;
    if (c >= 10) cPerfect++;
  }
  const cTodayStatus = cToday ? `Q${(cToday.current ?? 0) + 1} · ${cToday.log?.filter(a => a.correct).length ?? 0} correct` : '—';

  return {
    words:    { days: words.length, wins: wWins, losses: wLosses, inProgress: wIn, dist: wDist, today: wTodayStatus },
    songquiz: { days: song.length, songsPlayed: sgPlayed, songsWon: sgWon, sweeps: sgSweeps, today: sgTodayStatus },
    spelling: { days: spell.length, answered: spAns, correct: spCorrect, perfectDays: spPerfect, today: spTodayStatus },
    chatter:  { days: chat.length, answered: cAns, correct: cCorrect, perfectDays: cPerfect, today: cTodayStatus },
  };
}

export async function onRequestGet({ request, env }) {
  const KV  = env.SONGLESS_KV;
  const sid = new URL(request.url).searchParams.get('sid');

  // ── Single-player profile: stats across every game + achievements ───────────
  if (sid) {
    const [name, achievements, games, role, adjust] = await Promise.all([
      KV.get(`profile-name-${sid}`),
      KV.get(`achievements-${sid}`, 'json'),
      buildGameStats(KV, sid),
      getRole(env, sid),
      getAdjust(KV, sid),
    ]);
    const achs   = achievements || [];
    const points = Math.max(0, pointsFor(achs) + adjust);
    return Response.json({
      sid,
      handle: name || handleFromSid(sid),
      custom: !!name,
      role,
      staff: role !== 'player',
      admin: role === 'admin',
      achievements: achs,
      games,
      xp: points,
      baseXp: pointsFor(achs),
      adjust,
      level: progress(points).level,
    });
  }

  // ── Roster: every known player with their display username + role ───────────
  const map = new Map(); // sid -> { sid, name, achievements, role }
  const get = (id) => {
    let e = map.get(id);
    if (!e) { e = { sid: id, name: null, achievements: 0, role: null }; map.set(id, e); }
    return e;
  };

  for (const name of await listAll(KV, 'achievements-')) {
    const id   = name.slice('achievements-'.length);
    const data = await KV.get(name, 'json') || [];
    get(id).achievements = data.length;
  }
  for (const name of await listAll(KV, 'profile-name-')) {
    const id = name.slice('profile-name-'.length);
    get(id).name = await KV.get(name);
  }
  for (const name of await listAll(KV, 'role-')) {
    get(name.slice('role-'.length)).role = await KV.get(name);
  }
  for (const prefix of STATE_PREFIXES) {
    for (const name of await listAll(KV, prefix)) {
      get(name.slice(prefix.length, prefix.length + 36));
    }
  }

  const players = [...map.values()].map(p => {
    const role = p.role || (p.name && p.name.toLowerCase() === BOOTSTRAP_ADMIN ? 'admin' : 'player');
    return {
      sid:          p.sid,
      handle:       p.name || handleFromSid(p.sid),
      custom:       !!p.name,
      role,
      staff:        role !== 'player',
      admin:        role === 'admin',
      achievements: p.achievements,
    };
  });
  players.sort((a, b) => a.handle.localeCompare(b.handle, undefined, { sensitivity: 'base' }));
  return Response.json(players);
}

/**
 * POST /admin/api/players?sid=…   (one of:)
 *   { role: 'player'|'staff'|'admin' }  → set role            (Administrators only)
 *   { name: '…' }                       → set/clear username   (staff; '' resets to auto)
 *   { xp: <number> }                    → set total XP         (staff; stores an adjustment)
 */
const NAME_RE = /^[A-Za-z0-9 _-]+$/;

export async function onRequestPost({ request, env }) {
  const KV        = env.SONGLESS_KV;
  const requester = await identify(request, env);
  if (!requester.sid) return new Response('Forbidden', { status: 403 });

  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const body = await request.json().catch(() => ({}));
  if (!sid) return new Response('Bad request', { status: 400 });

  // ── Role (Administrators only) ──────────────────────────────────────────────
  if ('role' in body) {
    if (!(await isAdmin(env, requester.sid))) return new Response('Forbidden — administrator role required.', { status: 403 });
    if (!ROLES.includes(body.role)) return new Response('Bad request', { status: 400 });
    await KV.put(`role-${sid}`, body.role);
    return Response.json({ role: body.role, staff: body.role !== 'player', admin: body.role === 'admin' });
  }

  // ── Username override (staff — for moderating bad names) ─────────────────────
  if ('name' in body) {
    const name    = String(body.name ?? '').trim().replace(/\s+/g, ' ');
    const oldName = await KV.get(`profile-name-${sid}`);
    if (!name) {
      await KV.delete(`profile-name-${sid}`);
      if (oldName) await KV.delete(`username-${oldName.toLowerCase()}`);
      return Response.json({ handle: handleFromSid(sid), custom: false });
    }
    if (name.length < 3 || name.length > 16) return Response.json({ error: 'Username must be 3–16 characters.' }, { status: 422 });
    if (!NAME_RE.test(name))                  return Response.json({ error: 'Only letters, numbers, spaces, hyphens and underscores.' }, { status: 422 });
    if (isProfane(name))                      return Response.json({ error: 'That username isn’t allowed.' }, { status: 422 });
    const owner = await KV.get(`username-${name.toLowerCase()}`);
    if (owner && owner !== sid)               return Response.json({ error: 'That username is already taken.' }, { status: 422 });
    if (oldName && oldName.toLowerCase() !== name.toLowerCase()) await KV.delete(`username-${oldName.toLowerCase()}`);
    await KV.put(`profile-name-${sid}`, name);
    await KV.put(`username-${name.toLowerCase()}`, sid);
    return Response.json({ handle: name, custom: true });
  }

  // ── XP override (staff) — store the delta so level tracks the new total ──────
  if ('xp' in body) {
    const target = Math.max(0, Math.round(Number(body.xp)));
    if (!Number.isFinite(target)) return new Response('Bad request', { status: 400 });
    const achs   = (await KV.get(`achievements-${sid}`, 'json')) || [];
    const base   = pointsFor(achs);
    const adjust = target - base;
    if (adjust === 0) await KV.delete(adjustKey(sid));
    else              await KV.put(adjustKey(sid), String(adjust));
    return Response.json({ xp: target, baseXp: base, adjust, level: progress(target).level });
  }

  return new Response('Bad request', { status: 400 });
}

// Per-game KV prefixes (game states). `cq-seen-` is paired with chatter.
const GAME_PREFIXES = {
  words:    ['words-state-'],
  songquiz: ['state-'],
  spelling: ['spelling-state-'],
  chatter:  ['cq-state-', 'cq-seen-'],
};
const ALL_GAME_PREFIXES = [...STATE_PREFIXES, 'cq-seen-'];

// Delete every key under `prefix` EXCEPT those belonging to `keepSid`. For state
// keys the sid is the 36 chars after the prefix; for direct keys it's the rest.
async function deleteExcept(KV, prefix, keepSid, sidLen) {
  let cursor, deleted = 0;
  do {
    const res  = await KV.list({ prefix, limit: 1000, cursor });
    const dels = res.keys.map(k => k.name).filter(name => {
      const sid = sidLen ? name.slice(prefix.length, prefix.length + sidLen) : name.slice(prefix.length);
      return sid !== keepSid;
    });
    await Promise.all(dels.map(n => KV.delete(n)));
    deleted += dels.length;
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return deleted;
}

// Wipe one player completely: game states, achievements, name, role, passkey,
// global stats and all dedup keys.
async function wipePlayer(KV, sid) {
  const keys = [`achievements-${sid}`, `profile-name-${sid}`, `role-${sid}`, `xp-adjust-${sid}`, `global-stats-${sid}`];
  const name = await KV.get(`profile-name-${sid}`);
  if (name) keys.push(`username-${name.toLowerCase()}`);
  for (const prefix of [...ALL_GAME_PREFIXES, 'global-played-']) {
    keys.push(...await listAll(KV, `${prefix}${sid}-`));
  }
  const passkey = await KV.get(`passkey-${sid}`, 'json');
  keys.push(`passkey-${sid}`);
  if (passkey?.credId) keys.push(`passkey-cred-${passkey.credId}`);
  await Promise.all(keys.map(k => KV.delete(k)));
  return keys.length;
}

// Delete a player's game progress only (keeps achievements/level/profile/role).
async function wipePlayerGames(KV, sid, prefixes) {
  const keys = [];
  for (const prefix of prefixes) keys.push(...await listAll(KV, `${prefix}${sid}-`));
  await Promise.all(keys.map(k => KV.delete(k)));
  return keys.length;
}

/**
 * DELETE /admin/api/players
 *   ?sid=…&scope=all              → wipe one player completely
 *   ?sid=…&scope=games[&game=…]   → wipe one player's game progress (all or one game)
 *   ?scope=games[&game=…]         → GLOBAL: every player's game progress  (admin only)
 *   ?scope=everything             → GLOBAL: ALL player data except the Vopori account (admin only)
 */
export async function onRequestDelete({ request, env }) {
  const KV    = env.SONGLESS_KV;
  const url   = new URL(request.url);
  const sid   = url.searchParams.get('sid');
  const scope = url.searchParams.get('scope') || 'all';
  const game  = url.searchParams.get('game');
  const prefixes = (game && GAME_PREFIXES[game]) ? GAME_PREFIXES[game] : ALL_GAME_PREFIXES;

  // ── Single player (staff allowed) ───────────────────────────────────────────
  if (sid) {
    if (scope === 'games') return Response.json({ deleted: await wipePlayerGames(KV, sid, prefixes) });
    if (scope === 'all')   return Response.json({ deleted: await wipePlayer(KV, sid) });
    return new Response('Bad request', { status: 400 });
  }

  // ── Global ops (Administrators only) ────────────────────────────────────────
  const requester = await identify(request, env);
  if (!requester.sid || !(await isAdmin(env, requester.sid))) {
    return new Response('Forbidden — administrator role required.', { status: 403 });
  }

  if (scope === 'games') {
    let deleted = 0;
    for (const p of prefixes) {
      const ks = await listAll(KV, p);
      await Promise.all(ks.map(k => KV.delete(k)));
      deleted += ks.length;
    }
    return Response.json({ deleted });
  }

  if (scope === 'everything') {
    // Preserve the Vopori account (the owner's personal account) entirely.
    const vopSid = await KV.get('username-vopori');
    let deleted = 0;

    for (const p of ['achievements-', 'profile-name-', 'role-', 'xp-adjust-', 'global-stats-']) deleted += await deleteExcept(KV, p, vopSid, 0);
    for (const p of [...ALL_GAME_PREFIXES, 'global-played-'])     deleted += await deleteExcept(KV, p, vopSid, 36);

    // Usernames: keep Vopori's reservation.
    const unames = (await listAll(KV, 'username-')).filter(k => k !== 'username-vopori');
    await Promise.all(unames.map(k => KV.delete(k)));
    deleted += unames.length;

    // Passkeys: forward `passkey-{sid}` (skip Vopori), reverse `passkey-cred-{id}`
    // (skip the one owned by Vopori), and clear all ephemeral challenges.
    for (const k of await listAll(KV, 'passkey-')) {
      if (k.startsWith('passkey-cred-')) { if ((await KV.get(k)) !== vopSid) { await KV.delete(k); deleted++; } }
      else if (k.startsWith('passkey-chal-')) { await KV.delete(k); deleted++; }
      else if (k.slice('passkey-'.length) !== vopSid) { await KV.delete(k); deleted++; }
    }

    return Response.json({ deleted, keptVopori: !!vopSid });
  }

  return new Response('Bad request', { status: 400 });
}
