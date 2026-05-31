import { identify, isStaff } from '../api/_identity.js';

// Portal access is identity-based: any player whose role is 'staff' or 'admin'
// (see _identity.js) is let straight through via their signed slsid cookie. The
// old ADMIN_PASSWORD is kept only as an emergency fallback so it's impossible to
// get locked out (e.g. before the first Administrator has claimed the bootstrap
// username).
export async function onRequest({ request, env, next }) {
  // 1. Identity-based access — staff and admins (primary path).
  const { sid } = await identify(request, env);
  if (sid && (await isStaff(env, sid))) return next();

  // 2. Password fallback (emergency only).
  const password = env.ADMIN_PASSWORD;
  if (password) {
    const auth = request.headers.get('Authorization') ?? '';
    if (auth.startsWith('Basic ')) {
      const decoded = atob(auth.slice(6));
      const colon   = decoded.indexOf(':');
      const pass    = colon >= 0 ? decoded.slice(colon + 1) : decoded;
      if (pass === password) return next();
    }
    // Prompt for the fallback password for non-admin visitors.
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Vop Admin"' },
    });
  }

  // 3. No password configured and not an admin → forbidden.
  return new Response('Forbidden — admin access required.', { status: 403 });
}
