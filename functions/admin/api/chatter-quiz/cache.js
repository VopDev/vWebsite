export async function onRequestDelete({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });
  await env.SONGLESS_KV.delete(`chatter-quiz-${date}`);
  return new Response('OK', { status: 200 });
}
