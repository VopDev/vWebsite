const CHANNEL   = 'xqc';
const QUESTIONS = 5;

const CHATTERS = [
  'nymn_tv',
  'crazyslick',
  'trainwreckstv',
  'poke',
  'nmplol',
  'mizkif',
  'buddha',
  'jynxzi',
  'moistcr1tikal',
  'jessesmfi',
  'pokelawls',
  'mightyoaks',
  'zostradamus',
  'cent',
  'idini',
  'mdpog',
  'omie',
  'arthium',
  'scorpyl2',
].map(u => ({ username: u, display: u }));

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
  // Needs at least 3 real words (not just emotes/numbers)
  return text.split(/\s+/).filter(w => /[a-zA-Z]{3,}/.test(w)).length >= 3;
}

export async function onRequestGet({ request, env }) {
  const date     = new URL(request.url).searchParams.get('date') || todayStr();
  const cacheKey = `chatter-quiz-${date}`;

  const cached = await env.SONGLESS_KV.get(cacheKey, 'json');
  if (cached) return Response.json(cached);

  // Fetch logs for every chatter in parallel
  const fetched = await Promise.allSettled(
    CHATTERS.map(async c => {
      const r = await fetch(
        `https://logs.ivr.fi/channel/${CHANNEL}/user/${c.username}?json=true&limit=500`,
        { headers: { Accept: 'application/json' } }
      );
      if (!r.ok) return null;
      const data = await r.json();
      const msgs = (data.messages || [])
        .map(m => (m.text || m.message || '').trim())
        .filter(interesting);
      return msgs.length >= 3 ? { ...c, messages: msgs } : null;
    })
  );

  const pool = fetched
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  if (pool.length < 4) {
    return Response.json({ error: 'Not enough chat data today. Try again later.', questions: [] });
  }

  const rand      = seededRand(dayIndex(date) * 7919 + 3);
  const shuffled  = shuffle(pool, rand);
  const questions = [];

  for (const chatter of shuffled) {
    if (questions.length >= QUESTIONS) break;

    // Pick a message from this chatter
    const msg = chatter.messages[Math.floor(rand() * chatter.messages.length)];

    // 3 wrong options from other chatters
    const others = shuffle(pool.filter(c => c.username !== chatter.username), rand);
    if (others.length < 3) continue;

    const options = shuffle([
      { username: chatter.username, display: chatter.display },
      ...others.slice(0, 3).map(c => ({ username: c.username, display: c.display })),
    ], rand);

    questions.push({ text: msg, answer: chatter.username, options });
  }

  const result = { questions };
  await env.SONGLESS_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 25 });
  return Response.json(result);
}
