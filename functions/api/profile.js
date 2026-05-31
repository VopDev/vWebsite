import { identify, applyIdentity, handleFromSid, isLocked, verifyElevation, getRole } from './_identity.js';
import { isProfane } from './_profanity.js';

const MIN = 3;
const MAX = 16;
const ALLOWED = /^[A-Za-z0-9 _-]+$/;

// Usernames are unique case-insensitively. A reverse index `username-{lower}`→sid
// reserves a name so two players can't share one.
const unameKey = (name) => `username-${name.toLowerCase()}`;

export async function onRequestGet({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const [custom, locked, role] = await Promise.all([
    env.SONGLESS_KV.get(`profile-name-${ident.sid}`),
    isLocked(env, ident.sid),
    getRole(env, ident.sid),
  ]);
  const handle = custom || handleFromSid(ident.sid);

  return new Response(JSON.stringify({ sid: ident.sid, handle, custom: !!custom, locked, role, staff: role !== 'player' }), { headers });
}

// Set or reset the display name. Empty name resets to the auto-generated handle.
export async function onRequestPost({ request, env }) {
  const ident   = await identify(request, env, { create: true });
  const sid     = ident.sid;
  const headers = applyIdentity({ 'Content-Type': 'application/json' }, ident);

  const fail = (error, code = 422) => new Response(JSON.stringify({ error }), { status: code, headers });

  // If the profile is locked, a name change needs a fresh passkey assertion.
  if (await isLocked(env, sid) && !(await verifyElevation(request, sid, env))) {
    return fail('This profile is locked. Verify with your passkey to make changes.', 401);
  }

  const body = await request.json().catch(() => null);
  const name = (body?.name ?? '').trim().replace(/\s+/g, ' ');

  const oldName = await env.SONGLESS_KV.get(`profile-name-${sid}`);

  // Empty → reset to deterministic auto-handle (and release the reserved name).
  if (!name) {
    await env.SONGLESS_KV.delete(`profile-name-${sid}`);
    if (oldName) await env.SONGLESS_KV.delete(unameKey(oldName));
    const role = await getRole(env, sid);
    return new Response(JSON.stringify({
      ok: true, handle: handleFromSid(sid), custom: false,
      locked: await isLocked(env, sid), role, staff: role !== 'player',
    }), { headers });
  }

  if (name.length < MIN)   return fail(`Username must be at least ${MIN} characters.`);
  if (name.length > MAX)   return fail(`Username must be ${MAX} characters or fewer.`);
  if (!ALLOWED.test(name)) return fail('Only letters, numbers, spaces, hyphens and underscores are allowed.');
  if (isProfane(name))     return fail('That username isn’t allowed. Please pick another.');

  // Uniqueness: the name may only be held by this player.
  const owner = await env.SONGLESS_KV.get(unameKey(name));
  if (owner && owner !== sid) return fail('That username is already taken. Please pick another.');

  // Release the previous reservation if the player is renaming.
  if (oldName && oldName.toLowerCase() !== name.toLowerCase()) {
    await env.SONGLESS_KV.delete(unameKey(oldName));
  }

  await env.SONGLESS_KV.put(`profile-name-${sid}`, name);
  await env.SONGLESS_KV.put(unameKey(name), sid);

  const role = await getRole(env, sid);
  return new Response(JSON.stringify({
    ok: true, handle: name, custom: true,
    locked: await isLocked(env, sid), role, staff: role !== 'player',
  }), { headers });
}
