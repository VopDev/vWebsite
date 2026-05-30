export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const type = url.searchParams.get('type');

  if (type === 'emotes') {
    await env.SONGLESS_KV.delete('chatter-quiz-emotes-v1');
    return new Response('OK', { status: 200 });
  }

  if (!date) return new Response('Bad request', { status: 400 });
  await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
  return new Response('OK', { status: 200 });
}
