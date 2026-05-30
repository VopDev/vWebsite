export async function onRequestPost({ request, env }) {
  try {
    const { date, slot, guessCount, won } = await request.json();

    if (!date || slot === undefined || slot === null) {
      return new Response('Bad request', { status: 400 });
    }

    const key = `stats-${date}-${slot}`;
    const stats = (await env.SONGLESS_KV.get(key, 'json')) || { total: 0 };

    stats.total = (stats.total || 0) + 1;

    if (won) {
      const k = String(guessCount);
      stats[k] = (stats[k] || 0) + 1;
    } else {
      stats.fail = (stats.fail || 0) + 1;
    }

    await env.SONGLESS_KV.put(key, JSON.stringify(stats), {
      expirationTtl: 60 * 60 * 24 * 30,
    });

    return new Response('OK', { status: 200 });
  } catch {
    return new Response('Internal error', { status: 500 });
  }
}
