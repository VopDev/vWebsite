export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const seedOffset = parseInt(await env.SONGLESS_KV.get(`seed-offset-${date}`) || '0', 10);
  return Response.json({ seedOffset });
}
