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

  const word   = words[i].word.toLowerCase();
  const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(word)}`;

  try {
    const res = await fetch(ttsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return new Response('TTS unavailable', { status: 502 });
    return new Response(res.body, {
      headers: {
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new Response('TTS error', { status: 502 });
  }
}
