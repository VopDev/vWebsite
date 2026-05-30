export async function onRequest({ request, env, next }) {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return new Response('Admin not configured — set ADMIN_PASSWORD env var.', { status: 503 });
  }

  const auth = request.headers.get('Authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const colon   = decoded.indexOf(':');
    const pass    = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    if (pass === password) return next();
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Vop Admin"' },
  });
}
