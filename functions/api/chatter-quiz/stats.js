const COOKIE = 'slsid';
const TTL    = 60 * 60 * 24 * 30;

function getSid(request) {
  return request.headers.get('Cookie')?.match(/slsid=([^;]+)/)?.[1] ?? null;
}

function emptyStats() {
  return {
    totalAnswers: 0, correct: 0, wrong: 0, completions: 0,
    perQuestion: Array(10).fill(null).map(() => ({ correct: 0, wrong: 0 })),
  };
}

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date) return new Response('Bad request', { status: 400 });

  const [stats, players] = await Promise.all([
    env.SONGLESS_KV.get(`cq-stats-${date}`, 'json'),
    env.SONGLESS_KV.get(`cq-players-${date}`),
  ]);

  return Response.json({
    players: parseInt(players || '0', 10),
    ...(stats || emptyStats()),
  });
}

export async function onRequestPost({ request, env }) {
  const sid  = getSid(request);
  const body = await request.json().catch(() => null);
  if (!body?.date) return new Response('Bad request', { status: 400 });

  const { date, questionIndex, correct, complete } = body;

  const [statsRaw, players] = await Promise.all([
    env.SONGLESS_KV.get(`cq-stats-${date}`, 'json'),
    sid ? env.SONGLESS_KV.get(`cq-seen-${sid}-${date}`) : Promise.resolve('1'),
  ]);

  const stats = statsRaw || emptyStats();
  const writes = [];

  // Count unique players on first answer
  if (sid && !players) {
    writes.push(
      env.SONGLESS_KV.put(`cq-seen-${sid}-${date}`, '1', { expirationTtl: TTL }),
      env.SONGLESS_KV.get(`cq-players-${date}`)
        .then(n => env.SONGLESS_KV.put(`cq-players-${date}`, String((parseInt(n || '0', 10) || 0) + 1), { expirationTtl: TTL }))
    );
  }

  // Record answer
  if (questionIndex != null) {
    stats.totalAnswers++;
    if (correct) stats.correct++;
    else stats.wrong++;
    if (!stats.perQuestion[questionIndex]) stats.perQuestion[questionIndex] = { correct: 0, wrong: 0 };
    if (correct) stats.perQuestion[questionIndex].correct++;
    else stats.perQuestion[questionIndex].wrong++;
  }

  if (complete) stats.completions++;

  writes.push(env.SONGLESS_KV.put(`cq-stats-${date}`, JSON.stringify(stats), { expirationTtl: TTL }));
  await Promise.all(writes);

  return new Response('OK', { status: 200 });
}
