const CHANNEL   = 'xqc';
const XQC_ID    = '71092938'; // xQc's Twitch user ID
const QUESTIONS = 10;

const CHATTERS = [
  // Core regulars
  'nymn_tv', 'crazyslick', 'trainwreckstv', 'poke', 'nmplol',
  'mizkif', 'buddha', 'jynxzi', 'moistcr1tikal', 'jessesmfi',
  'pokelawls', 'mightyoaks', 'zostradamus', 'cent', 'idini',
  'mdpog', 'omie', 'arthium', 'scorpyl2',
  // Additional xQc chat participants
  'hasanabi', 'adinross', 'cyr', 'esfandtv', 'erobb221',
  'whipitdev', 'natsumiii', 'ohnePixel',
  'destiny', 'forsen', 'sodapoppin', 'zackrawrr', 'wubby',
  'alinity', 'jakenbakeLIVE', 'qtcinderella', 'fuslie',
  'disguisedtoast', 'sykkuno',
  // Community regulars
  'm0xyy', 'mendo', 'contravz', 'dankjuicer', 'dolev',
  'drkness_x', 'esattt', 'its_physikz', 'jdxl', 'juniorrr',
  'leeqox', 'missdeee', 'prestonalewis', 'thepositivebot', 'tjt811',
  'trestos3', 'wapze', 'wirezs', 'zoil',
].map(u => ({ username: u, display: u }));

const BOTS = new Set([
  'nightbot', 'streamelements', 'moobot', 'fossabot', 'phantombot',
  'wizebot', 'cloudbot', 'streamlabs', 'commanderroot', 'own3d_pro',
  'sery_bot', 'creatisbot', 'logviewer', 'soundalerts', 'pretzelrocks',
  'stay_hydrated_bot', 'anotherttvviewer', 'restreambot', 'buttsbot',
  'supibot', 'pokemoncommunitygame', 'thepositivebot',
]);


// ── Helpers ───────────────────────────────────────────────────────────────────
function generateSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}

function dayIndex(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2025, 0, 1)) / 86400000);
}

function seededRand(seed) {
  let s = ((seed || 1) ^ 0x9e3779b9) >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interesting(text) {
  if (!text || text.length < 20) return false;
  if (/^[!/]/.test(text)) return false;
  if (/subscribed (at Tier|with Prime)/i.test(text)) return false;
  if (/gifted? .{0,40} [Tt]ier/i.test(text)) return false;
  if (/is gifting \d/i.test(text)) return false;
  if (/just subscribed/i.test(text)) return false;
  const words = text.split(/\s+/);
  const freq  = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  if (Math.max(...Object.values(freq)) > 3) return false;
  return words.filter(w => /[a-zA-Z]{3,}/.test(w)).length >= 3;
}

// ── Emote fetching ────────────────────────────────────────────────────────────
async function fetchEmotes() {
  const emotes = {};

  const tryFetch = async url => {
    try { return await fetch(url, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null); }
    catch { return null; }
  };

  const bttvGlobal = await tryFetch('https://api.betterttv.net/3/cached/emotes/global');
  for (const e of bttvGlobal || []) {
    emotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
  }

  const bttvChannel = await tryFetch(`https://api.betterttv.net/3/cached/users/twitch/${XQC_ID}`);
  for (const e of [...(bttvChannel?.channelEmotes || []), ...(bttvChannel?.sharedEmotes || [])]) {
    emotes[e.code] = `https://cdn.betterttv.net/emote/${e.id}/1x`;
  }

  const stv = await tryFetch('https://7tv.io/v3/emote-sets/global');
  for (const e of stv?.emotes || []) {
    if (e.id && e.name) emotes[e.name] = `https://cdn.7tv.app/emote/${e.id}/1x.webp`;
  }

  const stvChannel = await tryFetch(`https://7tv.io/v3/users/twitch/${XQC_ID}`);
  for (const e of stvChannel?.emote_set?.emotes || []) {
    if (e.id && e.name) emotes[e.name] = `https://cdn.7tv.app/emote/${e.id}/1x.webp`;
  }

  const ffz = await tryFetch(`https://api.frankerfacez.com/v1/room/${CHANNEL}`);
  for (const set of Object.values(ffz?.sets || {})) {
    for (const e of set.emoticons || []) {
      const url = e.urls?.['1'] || e.urls?.[1];
      if (url) emotes[e.name] = url.startsWith('//') ? `https:${url}` : url;
    }
  }

  // Twitch subscriber/channel emotes (no auth required via twitchemotes.com)
  const twitch = await tryFetch(`https://api.twitchemotes.com/api/v4/channels/${XQC_ID}`);
  for (const e of twitch?.emotes || []) {
    if (e.code && e.id) {
      emotes[e.code] = `https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/1.0`;
    }
  }

  return emotes;
}

async function getEmotes(env) {
  const key    = 'chatter-quiz-emotes-v1';
  const cached = await env.SONGLESS_KV.get(key, 'json');
  if (cached) return cached;
  const emotes = await fetchEmotes();
  await env.SONGLESS_KV.put(key, JSON.stringify(emotes), { expirationTtl: 60 * 60 * 6 });
  return emotes;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const date     = new URL(request.url).searchParams.get('date') || todayStr();
  const cacheKey = `chatter-quiz-${date}`;

  // Emotes are always fetched fresh from their own cache — never baked into the questions cache
  const cachedQuestions = await env.SONGLESS_KV.get(cacheKey, 'json');
  if (cachedQuestions) {
    const emotes = await getEmotes(env);
    return Response.json({ ...cachedQuestions, emotes });
  }

  // eraOffset shifts the RNG seed so rerolls pick different messages from the same pool
  const eraOffsetRaw = await env.SONGLESS_KV.get(`chatter-quiz-era-${date}`);
  const eraOffset    = parseInt(eraOffsetRaw || '0', 10) || 0;

  // Pick 25 chatters randomly per day — avoids timing out on 50+ parallel requests
  const pickRand    = seededRand(dayIndex(date) * 3571 + eraOffset * 999 + 7);
  const candidates  = shuffle(CHATTERS.filter(c => !BOTS.has(c.username.toLowerCase())), pickRand).slice(0, 25);

  const [fetchedResults, emotes] = await Promise.all([
    Promise.allSettled(
      candidates.map(async c => {
        try {
          const controller = new AbortController();
          const timer      = setTimeout(() => controller.abort(), 8000);
          const r = await fetch(
            `https://logs.ivr.fi/channel/${CHANNEL}/user/${c.username}?json=true&limit=1000`,
            { headers: { Accept: 'application/json' }, signal: controller.signal }
          );
          clearTimeout(timer);
          if (!r.ok) return null;
          const data = await r.json();
          const msgs = (data.messages || [])
            .map(m => ({ text: (m.text || m.message || '').trim(), ts: m.timestamp || null }))
            .filter(m => interesting(m.text));
          return msgs.length >= 3 ? { ...c, messages: msgs } : null;
        } catch { return null; }
      })
    ),
    getEmotes(env), // fetched in parallel but stored separately from questions
  ]);

  const pool = fetchedResults
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (pool.length < 4) {
    return Response.json({ error: 'Not enough chat data for this period. Try again later.', questions: [] });
  }

  const rand         = seededRand(dayIndex(date) * 7919 + eraOffset * 1337 + 3);
  const shuffled     = shuffle(pool, rand);
  const questions    = [];
  const usedMessages = new Set();

  // Two passes: first use each chatter once, then allow reuse with different messages
  for (let pass = 0; pass < 2 && questions.length < QUESTIONS; pass++) {
    for (const chatter of shuffled) {
      if (questions.length >= QUESTIONS) break;
      const others = shuffle(pool.filter(c => c.username !== chatter.username), rand);
      if (others.length < 3) continue;
      const available = chatter.messages.filter(m => !usedMessages.has(m.text));
      if (available.length === 0) continue;
      const msgObj = available[Math.floor(rand() * available.length)];
      usedMessages.add(msgObj.text);
      const options = shuffle([
        { username: chatter.username, display: chatter.display },
        ...others.slice(0, 3).map(c => ({ username: c.username, display: c.display })),
      ], rand);
      questions.push({ text: msgObj.text, timestamp: msgObj.ts, answer: chatter.username, options });
    }
  }

  // Store questions WITHOUT emotes so a stale emote fetch never poisons the cache
  const result = { questions, variant: eraOffset, seed: generateSeed() };
  await env.SONGLESS_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 25 });
  return Response.json({ ...result, emotes });
}
