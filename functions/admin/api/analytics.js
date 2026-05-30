export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const [players, ...slots] = await Promise.all([
    env.SONGLESS_KV.get(`players-${date}`).then(v => parseInt(v || '0', 10)),
    ...Array.from({ length: 5 }, (_, i) =>
      env.SONGLESS_KV.get(`stats-${date}-${i}`, 'json').then(s => s || { total: 0 })
    ),
  ]);

  return Response.json({ players, slots });
}
