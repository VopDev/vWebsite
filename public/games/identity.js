/* Persistent anonymous player identity.
 *
 * A browser cannot read a real hardware id, so identity is a random UUID minted
 * by the server and mirrored across three stores: cookie (server-set, HttpOnly),
 * localStorage and IndexedDB. If the user clears one store (e.g. just cookies)
 * the id self-heals from the others. Only a full "clear all site data" wipes it.
 *
 * This script wraps window.fetch so every /api request automatically:
 *   - sends the mirrored id via the `X-Player-Id` header, and
 *   - adopts the id the server reports back via the `X-Player-Id` response header
 * No game code needs to change.
 */
(function () {
  const LS_KEY  = 'vop-pid';
  const DB_NAME = 'vop-identity';
  const STORE   = 'kv';
  const REC_KEY = 'pid';

  let currentId = null;
  try { currentId = localStorage.getItem(LS_KEY) || null; } catch (_) {}

  // ── IndexedDB (best-effort; resolves null/undefined on any failure) ──────────
  function withDb(fn) {
    return new Promise((resolve) => {
      let open;
      try { open = indexedDB.open(DB_NAME, 1); } catch (_) { return resolve(); }
      open.onupgradeneeded = () => {
        try { open.result.createObjectStore(STORE); } catch (_) {}
      };
      open.onsuccess = () => { try { fn(open.result, resolve); } catch (_) { resolve(); } };
      open.onerror   = () => resolve();
    });
  }
  function idbGet() {
    return withDb((db, resolve) => {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(REC_KEY);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror   = () => resolve(null);
    });
  }
  function idbPut(id) {
    return withDb((db, resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(id, REC_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
  }

  // Write an id to every store we control.
  function store(id) {
    if (!id || id === currentId) { currentId = id || currentId; return; }
    currentId = id;
    try { localStorage.setItem(LS_KEY, id); } catch (_) {}
    idbPut(id);
  }

  // Reconcile localStorage <-> IndexedDB on startup, then propagate to both.
  const ready = (async () => {
    const fromIdb = await idbGet();
    if (!currentId && fromIdb) currentId = fromIdb;
    if (currentId) {
      try { localStorage.setItem(LS_KEY, currentId); } catch (_) {}
      if (currentId !== fromIdb) idbPut(currentId);
    }
    return currentId;
  })();

  const origFetch = window.fetch.bind(window);

  // One-time bootstrap so concurrent first-load calls don't each mint a
  // different id: establish a single id via /api/session first.
  let bootPromise = null;
  function bootstrap() {
    if (currentId) return Promise.resolve();
    if (!bootPromise) {
      // Adopt the signed token from the response header. (Never store the raw
      // sid from the JSON body — the server rejects an unsigned id in the header.)
      bootPromise = origFetch('/api/session', { credentials: 'same-origin' })
        .then((r) => { store(r.headers.get('X-Player-Id')); })
        .catch(() => {});
    }
    return bootPromise;
  }

  function isApi(url) {
    return typeof url === 'string' && (url.startsWith('/api') || url.indexOf('/api/') !== -1);
  }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!isApi(url)) return origFetch(input, init);

    await ready;
    if (!currentId) await bootstrap();

    init = Object.assign({ credentials: 'same-origin' }, init);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    if (currentId) headers.set('X-Player-Id', currentId);
    init.headers = headers;

    const res = await origFetch(typeof input === 'string' ? input : input.url, init);
    const served = res.headers.get('X-Player-Id');
    if (served && served !== currentId) store(served);
    return res;
  };

  // Public API + lazy handle (the auto-generated display name).
  let handle = null;
  const PlayerId = {
    get: () => currentId,
    ready,
    adopt: store,
    async getHandle() {
      if (handle) return handle;
      try {
        const r = await window.fetch('/api/profile');
        const d = await r.json();
        handle = d && d.handle || null;
      } catch (_) {}
      // Fill any opt-in placeholders, e.g. <span data-player-handle></span>
      if (handle) {
        document.querySelectorAll('[data-player-handle]').forEach((el) => { el.textContent = handle; });
      }
      return handle;
    },
  };
  window.PlayerId = PlayerId;

  // Auto-populate handle placeholders once the DOM is ready.
  if (document.querySelector('[data-player-handle]') !== null || document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.querySelector('[data-player-handle]')) PlayerId.getHandle();
    });
  }
})();
