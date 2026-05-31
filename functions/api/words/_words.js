// Server-side only — never served to the client

export function evaluate(guess, answer) {
  const result   = Array(5).fill('absent');
  const ansArr   = answer.toUpperCase().split('');
  const guessArr = guess.toUpperCase().split('');
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === ansArr[i]) {
      result[i] = 'correct'; ansArr[i] = null; guessArr[i] = null;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (!guessArr[i]) continue;
    const idx = ansArr.indexOf(guessArr[i]);
    if (idx !== -1) { result[i] = 'present'; ansArr[idx] = null; }
  }
  return result;
}

export function generateSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function fetchRandomWord() {
  try {
    const res = await fetch(
      'https://api.datamuse.com/words?sp=?????&md=f&max=1000',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('api failed');
    const words = await res.json();

    // Keep only common words (frequency > 5 per million) made of plain letters
    const common = words.filter(w => {
      if (!/^[a-z]{5}$/.test(w.word)) return false;
      const tag  = (w.tags || []).find(t => t.startsWith('f:'));
      const freq = tag ? parseFloat(tag.slice(2)) : 0;
      return freq > 5;
    });

    const pool = common.length >= 10 ? common : words.filter(w => /^[a-z]{5}$/.test(w.word));
    if (!pool.length) throw new Error('empty pool');

    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    return pool[rand[0] % pool.length].word.toUpperCase();
  } catch {
    // Last-resort fallback so the game never breaks
    const fallbacks = ['CRANE','SLATE','AUDIO','ROAST','POINT','TRAIN','LIGHT','DANCE','MUSIC','STORM'];
    const rand = new Uint8Array(1);
    crypto.getRandomValues(rand);
    return fallbacks[rand[0] % fallbacks.length];
  }
}

export async function getOrCreateWord(date, env) {
  const wordKey = `words-word-${date}`;
  const existing = await env.SONGLESS_KV.get(wordKey);
  if (existing) return existing;

  const [word, existingSeed] = await Promise.all([
    fetchRandomWord(),
    env.SONGLESS_KV.get(`words-seed-${date}`),
  ]);

  const seed = existingSeed || generateSeed();
  await Promise.all([
    env.SONGLESS_KV.put(wordKey, word, { expirationTtl: 60 * 60 * 24 * 8 }),
    existingSeed ? Promise.resolve() : env.SONGLESS_KV.put(`words-seed-${date}`, seed, { expirationTtl: 60 * 60 * 24 * 8 }),
  ]);

  return word;
}
