import { identify, applyIdentity, handleFromSid, isLocked, verifyElevation } from './_identity.js';
import { isProfane } from './_profanity.js';

const MIN = 3;
const MAX = 16;
const ALLOWED = /^[A-Za-z0-9 _-]+$/;

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const [custom, locked] = await Promise.all([
    env.SONGLESS_KV.get(`profile-name-${ident.sid}`),
    isLocked(env, ident.sid),
  ]);
  const handle = custom || handleFromSid(ident.sid);

  return new Response(JSON.stringify({ sid: ident.sid, handle, custom: !!custom, locked }), { headers });
}

// Set or reset the display name. Empty name resets to the auto-generated handle.
export async function onRequestPost({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const fail = (error, code = 422) => new Response(JSON.stringify({ error }), { status: code, headers });

  // If the profile is locked, a name change needs a fresh passkey assertion.
  if (await isLocked(env, ident.sid) && !(await verifyElevation(request, ident.sid, env))) {
    return fail('This profile is locked. Verify with your passkey to make changes.', 401);
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name ?? '').trim().replace(/\s+/g, ' ');

  // Empty → reset to deterministic auto-handle.
  if (!name) {
    await env.SONGLESS_KV.delete(`profile-name-${ident.sid}`);
    return new Response(JSON.stringify({ ok: true, handle: handleFromSid(ident.sid), custom: false, locked: await isLocked(env, ident.sid) }), { headers });
  }

  if (name.length < MIN)   return fail(`Username must be at least ${MIN} characters.`);
  if (name.length > MAX)   return fail(`Username must be ${MAX} characters or fewer.`);
  if (!ALLOWED.test(name)) return fail('Only letters, numbers, spaces, hyphens and underscores are allowed.');
  if (isProfane(name))     return fail('That username isn’t allowed. Please pick another.');

  await env.SONGLESS_KV.put(`profile-name-${ident.sid}`, name);
  return new Response(JSON.stringify({ ok: true, handle: name, custom: true, locked: await isLocked(env, ident.sid) }), { headers });
}
