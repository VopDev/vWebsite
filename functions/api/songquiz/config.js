function generateSeed() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr   = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const [seedOffsetRaw, existingSeed] = await Promise.all([
    env.SONGLESS_KV.get(`seed-offset-${date}`),
    env.SONGLESS_KV.get(`songquiz-seed-${date}`),
  ]);

  const seedOffset = parseInt(seedOffsetRaw || '0', 10);
  let seed = existingSeed;
  if (!seed) {
    seed = generateSeed();
    await env.SONGLESS_KV.put(`songquiz-seed-${date}`, seed, { expirationTtl: 60 * 60 * 24 * 7 });
  }

  const sid = request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
  return Response.json({ seedOffset, seed, sid });
}
