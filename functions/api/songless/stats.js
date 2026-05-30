const CORS = { 'Content-Type': 'application/json' };

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const slot = url.searchParams.get('slot');
  const mode = url.searchParams.get('mode') || 'normal';

  if (!date || slot === null) {
    return new Response('Bad request', { status: 400 });
  }

  const data = (await env.SONGLESS_KV.get(`stats-${mode}-${date}-${slot}`, 'json')) ||
    { total: 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, fail: 0 };

  return new Response(JSON.stringify(data), { headers: CORS });
}

export async function onRequestDelete({ request, env }) {
  const url  = new URL(request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode');

  if (!date) return new Response('Bad request', { status: 400 });

  const modes = mode ? [mode] : ['normal', 'hard'];
  await Promise.all(
    modes.flatMap(m =>
      Array.from({ length: 5 }, (_, i) => env.SONGLESS_KV.delete(`stats-${m}-${date}-${i}`))
    )
  );

  return new Response('OK', { status: 200 });
}
