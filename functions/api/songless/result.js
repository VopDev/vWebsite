export async function onRequestPost({ request, env }) {
  try {
    const { date, slot, guessCount, won, mode = 'normal' } = await request.json();

    if (!date || slot === undefined || slot === null) {
      return new Response('Bad request', { status: 400 });
    }

    const key   = `stats-${mode}-${date}-${slot}`;
    const stats = (await env.SONGLESS_KV.get(key, 'json')) || { total: 0 };
    stats.total = (stats.total || 0) + 1;
    if (won) { const k = String(guessCount); stats[k] = (stats[k] || 0) + 1; }
    else     { stats.fail = (stats.fail || 0) + 1; }
    await env.SONGLESS_KV.put(key, JSON.stringify(stats));

    // Register date in the dates index on first slot submission
    if (slot === 0) {
      const idx        = (await env.SONGLESS_KV.get('dates-index', 'json')) || [];
      const seedOffset = parseInt(await env.SONGLESS_KV.get(`seed-offset-${date}`) || '0', 10);
      if (!idx.find(d => d.date === date)) {
        idx.unshift({ date, seedOffset });
        idx.sort((a, b) => b.date.localeCompare(a.date));
        await env.SONGLESS_KV.put('dates-index', JSON.stringify(idx));
      }
    }

    return new Response('OK', { status: 200 });
  } catch {
    return new Response('Internal error', { status: 500 });
  }
}
