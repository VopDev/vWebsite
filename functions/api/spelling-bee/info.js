import { getOrCreateWords } from './_words.js';

// Removes the word (and common inflections) from hint text so the spelling never leaks
function scrub(text, word) {
  if (!text) return '';
  const base = word.toLowerCase();
  const variants = new Set([base, base + 's', base + 'es', base + 'ed', base + 'ing', base + 'd', base + 'er', base + 'ly']);
  if (base.endsWith('e')) { variants.add(base.slice(0, -1) + 'ing'); variants.add(base.slice(0, -1) + 'ed'); }
  if (base.endsWith('y')) { variants.add(base.slice(0, -1) + 'ies'); variants.add(base.slice(0, -1) + 'ied'); }
  let out = text;
  for (const v of [...variants].sort((a, b) => b.length - a.length)) {
    const safe = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${safe}\\b`, 'gi'), '—');
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  const i    = parseInt(url.searchParams.get('i'), 10);
  if (!date || Number.isNaN(i)) return new Response('Bad request', { status: 400 });

  // Hints are a normal-mode aid only
  if (mode === 'hard') return Response.json({ available: false });

  const words = await getOrCreateWords(date, env, mode);
  if (i < 0 || i >= words.length) return new Response('Not found', { status: 404 });
  const word = words[i].word.toLowerCase();

  const cacheKey = `spelling-info-${word}`;
  const cached   = await env.SONGLESS_KV.get(cacheKey, 'json');
  if (cached) return Response.json(cached);

  const result = { available: true, partOfSpeech: '', definition: '', origin: '' };
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data    = await res.json();
      const entry   = Array.isArray(data) ? data[0] : null;
      const meaning = entry?.meanings?.[0];
      result.partOfSpeech = meaning?.partOfSpeech || '';
      result.definition   = scrub(meaning?.definitions?.[0]?.definition || '', word) || 'Definition unavailable';
      result.origin       = scrub(entry?.origin || '', word);
    } else {
      result.definition = 'Definition unavailable';
    }
  } catch {
    result.definition = 'Definition unavailable';
  }

  await env.SONGLESS_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 30 });
  return Response.json(result);
}
