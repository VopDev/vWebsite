function generateSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

export async function onRequestPost({ request, env }) {
  const { date } = await request.json();
  if (!date) return new Response('Bad request', { status: 400 });

  const offsetKey = `seed-offset-${date}`;
  const current   = parseInt(await env.SONGLESS_KV.get(offsetKey) || '0', 10);
  const next      = current + 1;
  const seed      = generateSeed();

  await Promise.all([
    env.SONGLESS_KV.put(offsetKey, String(next)),
    env.SONGLESS_KV.put(`songless-seed-${date}`, seed, { expirationTtl: 60 * 60 * 24 * 7 }),
  ]);

  // Keep the dates index in sync with the new seed offset
  const idx   = (await env.SONGLESS_KV.get('dates-index', 'json')) || [];
  const entry = idx.find(d => d.date === date);
  if (entry) { entry.seedOffset = next; await env.SONGLESS_KV.put('dates-index', JSON.stringify(idx)); }

  return Response.json({ seedOffset: next, seed });
}
