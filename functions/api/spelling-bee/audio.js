import { getOrCreateWords } from './_words.js';

// Streams TTS audio for a word WITHOUT ever exposing the spelling to the client.
// The client requests by date + index only.
export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') === 'hard' ? 'hard' : 'normal';
  const i    = parseInt(url.searchParams.get('i'), 10);
  if (!date || Number.isNaN(i)) return new Response('Bad request', { status: 400 });

  const words = await getOrCreateWords(date, env, mode);
  if (i < 0 || i >= words.length) return new Response('Not found', { status: 404 });

  const word = words[i].word.toLowerCase();
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(word)}`;

  try {
    const res = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer':    'https://translate.google.com/',
      },
    });
    if (!res.ok) return new Response('TTS unavailable', { status: 502 });
    return new Response(res.body, {
      headers: {
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('TTS error', { status: 502 });
  }
}
