export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const type = url.searchParams.get('type');

  if (type === 'emotes') {
    await env.SONGLESS_KV.delete('chatter-quiz-emotes-v1');
    return new Response('OK', { status: 200 });
  }

  if (type === 'reseed' && date) {
    // Increment era offset so next fetch pulls from a different historical window
    const current = parseInt(await env.SONGLESS_KV.get(`chatter-quiz-era-${date}`) || '0', 10) || 0;
    await env.SONGLESS_KV.put(`chatter-quiz-era-${date}`, String(current + 1), { expirationTtl: 60 * 60 * 48 });
    await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
    return new Response('OK', { status: 200 });
  }

  if (!date) return new Response('Bad request', { status: 400 });
  await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
  return new Response('OK', { status: 200 });
}
