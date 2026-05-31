export async function onRequestGet({ env }) {
  const dates = (await env.SONGLESS_KV.get('dates-index', 'json')) || [];
  return Response.json(dates);
}
