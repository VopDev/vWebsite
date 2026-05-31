import { identify, handleFromSid, getRole, isAdmin, BOOTSTRAP_ADMIN, ROLES } from '../../api/_identity.js';

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
    const [name, achievements, games, role] = await Promise.all([
      KV.get(`profile-name-${sid}`),
      KV.get(`achievements-${sid}`, 'json'),
      buildGameStats(KV, sid),
      getRole(env, sid),
    ]);
    return Response.json({
      sid,
      handle: name || handleFromSid(sid),
      custom: !!name,
      role,
      staff: role !== 'player',
      admin: role === 'admin',
      achievements: achievements || [],
      games,
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

// POST /admin/api/players?sid=…  body { role: 'player'|'staff'|'admin' }
// Managing roles is restricted to Administrators (not plain staff).
export async function onRequestPost({ request, env }) {
  const requester = await identify(request, env);
  if (!requester.sid || !(await isAdmin(env, requester.sid))) {
    return new Response('Forbidden — administrator role required.', { status: 403 });
  }

  const url  = new URL(request.url);
  const sid  = url.searchParams.get('sid');
  const body = await request.json().catch(() => ({}));
  const role = body.role;
  if (!sid || !ROLES.includes(role)) return new Response('Bad request', { status: 400 });

  await env.SONGLESS_KV.put(`role-${sid}`, role);
  return Response.json({ role, staff: role !== 'player', admin: role === 'admin' });
}

// DELETE /admin/api/players?sid=…&scope=all → wipe every trace of one player:
// all game states (every date/mode), achievements, custom name and passkey.
export async function onRequestDelete({ request, env }) {
  const KV    = env.SONGLESS_KV;
  const url   = new URL(request.url);
  const sid   = url.searchParams.get('sid');
  const scope = url.searchParams.get('scope') || 'all';
  if (!sid || scope !== 'all') return new Response('Bad request', { status: 400 });

  const keys = [
    `achievements-${sid}`,
    `profile-name-${sid}`,
    `role-${sid}`,
  ];
  // Release the player's reserved username, if any.
  const name = await KV.get(`profile-name-${sid}`);
  if (name) keys.push(`username-${name.toLowerCase()}`);
  for (const prefix of [...STATE_PREFIXES, 'cq-seen-']) {
    keys.push(...await listAll(KV, `${prefix}${sid}-`));
  }

  // Passkey: remove both the forward record and its reverse credential lookup.
  const passkey = await KV.get(`passkey-${sid}`, 'json');
  keys.push(`passkey-${sid}`);
  if (passkey?.credId) keys.push(`passkey-cred-${passkey.credId}`);

  await Promise.all(keys.map(k => KV.delete(k)));
  return Response.json({ deleted: keys.length });
}
