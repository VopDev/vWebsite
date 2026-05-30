export async function onRequestPost({ request, env }) {
  const { date } = await request.json();
  if (!date) return new Response('Bad request', { status: 400 });

  const key     = `seed-offset-${date}`;
  const current = parseInt(await env.SONGLESS_KV.get(key) || '0', 10);
  const next    = current + 1;
  await env.SONGLESS_KV.put(key, String(next));

  // Keep the dates index in sync with the new seed offset
  const idx   = (await env.SONGLESS_KV.get('dates-index', 'json')) || [];
  const entry = idx.find(d => d.date === date);
  if (entry) { entry.seedOffset = next; await env.SONGLESS_KV.put('dates-index', JSON.stringify(idx)); }

  return Response.json({ seedOffset: next });
}
