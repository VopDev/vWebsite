/* Opt-in passkey (WebAuthn) helpers — "Lock this profile".
 *
 * Locking registers a device/synced passkey bound to your anonymous profile.
 * Afterwards, sensitive actions (renaming) require a fresh Face ID / fingerprint
 * / security-key tap, so a stolen identity token alone can't change your profile.
 * A passkey can also RECOVER your profile on a new device or after wiping data.
 *
 * Exposes window.Passkey. Relies on identity.js having wrapped fetch (so the
 * signed X-Player-Id is attached/adopted automatically).
 */
(function () {
  function b64uToBuf(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  }
  function bufToB64u(buf) {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const supported = () =>
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials?.create === 'function';

  async function platformAvailable() {
    if (!supported()) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch { return false; }
  }

  async function status() {
    try { return await (await fetch('/api/passkey/status')).json(); }
    catch { return { configured: false, locked: false }; }
  }

  // Register a passkey → lock the profile.
  async function lock() {
    if (!supported()) throw new Error('This device does not support passkeys.');
    const opt = await (await fetch('/api/passkey/register')).json();
    if (opt.error) throw new Error(opt.error);

    const pk = opt.publicKey;
    pk.challenge = b64uToBuf(pk.challenge);
    pk.user.id   = b64uToBuf(pk.user.id);

    const cred = await navigator.credentials.create({ publicKey: pk });
    const r = cred.response;
    const res = await fetch('/api/passkey/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: opt.challengeId,
        attestationObject: bufToB64u(r.attestationObject),
        clientDataJSON: bufToB64u(r.clientDataJSON),
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not register passkey.');
    return d;
  }

  // Run a passkey assertion. recover=true uses a discoverable credential and can
  // re-attach this browser to the owning profile. Returns { elevation, ... }.
  async function assert(recover) {
    if (!supported()) throw new Error('This device does not support passkeys.');
    const opt = await (await fetch('/api/passkey/auth' + (recover ? '?recover=1' : ''))).json();
    if (opt.error) throw new Error(opt.error);

    const pk = opt.publicKey;
    pk.challenge = b64uToBuf(pk.challenge);
    if (pk.allowCredentials) {
      pk.allowCredentials = pk.allowCredentials.map((c) => ({ ...c, id: b64uToBuf(c.id) }));
    }

    const cred = await navigator.credentials.get({ publicKey: pk });
    const r = cred.response;
    const res = await fetch('/api/passkey/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: opt.challengeId,
        credentialId: cred.id, // already base64url
        clientDataJSON: bufToB64u(r.clientDataJSON),
        authenticatorData: bufToB64u(r.authenticatorData),
        signature: bufToB64u(r.signature),
      }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not verify passkey.');
    return d;
  }

  const elevate = () => assert(false);   // → { elevation }
  const recover = () => assert(true);    // → { elevation, token, sid }

  async function unlock() {
    const { elevation } = await elevate();
    const res = await fetch('/api/passkey/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Elevation': elevation },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Could not unlock.');
    return d;
  }

  window.Passkey = { supported, platformAvailable, status, lock, elevate, recover, unlock };
})();
