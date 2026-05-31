// Whether the current profile is locked with a passkey, and whether the browser
// platform is even capable (the client decides whether to offer the UI).
import { identify, applyIdentity, isLocked } from '../_identity.js';

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env);
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);
  const configured = !!(env && env.ID_SECRET);
  const locked = configured && (await isLocked(env, ident.sid));
  return new Response(JSON.stringify({ configured, locked }), { headers });
}
