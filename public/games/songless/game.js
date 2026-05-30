// SONGS is defined in songs.js, loaded before this file

const CLIPS       = [0.1, 0.5, 1, 3, 8, 15];
const MAX_GUESSES = 6;
const DAILY_COUNT = 5;

// ── Date helpers ──────────────────────────────────────────────────────────────
function dayIndex() {
  const epoch = Date.UTC(2025, 0, 1);
  const n = new Date();
  return Math.floor((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - epoch) / 86400000);
}

function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}

function seededRand(seed) {
  let s = ((seed || 1) ^ 0x9e3779b9) >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function getDailySongs(offset = 0) {
  const rand    = seededRand(dayIndex() * 1000 + offset + 1);
  const indices = Array.from({ length: SONGS.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const picked  = [];
  const artists = new Set();
  for (const idx of indices) {
    const song = SONGS[idx];
    if (!artists.has(song.artist)) {
      picked.push(song);
      artists.add(song.artist);
      if (picked.length === DAILY_COUNT) break;
    }
  }
  return picked;
}

const TODAY           = todayStr();
const DEBUG_OFFSET_KEY = `songless-debug-offset-${TODAY}`;
let   debugOffset      = parseInt(localStorage.getItem(DEBUG_OFFSET_KEY) || '0', 10);
const SONGS_TODAY      = getDailySongs(debugOffset);

// ── State ─────────────────────────────────────────────────────────────────────
function freshState() {
  return {
    slot: 0,
    games: Array.from({ length: DAILY_COUNT }, () => ({
      guesses: [], clipIdx: 0, over: false, won: false,
    })),
    submitted: new Array(DAILY_COUNT).fill(false),
  };
}

let state     = freshState();
let previews  = new Array(DAILY_COUNT).fill(null);
let audio     = null;
let playTimer = null;
let progTimer = null;
let selected  = null;

let resultAudio     = null;
let resultAudioSlot = -1;

const statsCache = {};

function curGame() { return state.games[state.slot]; }
function curSong() { return SONGS_TODAY[state.slot]; }

// ── Persistence ───────────────────────────────────────────────────────────────
function save() {
  fetch('/api/songless/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, state }),
  }).catch(() => {});
}

async function load() {
  try {
    const res = await fetch(`/api/songless/state?date=${TODAY}`);
    const s   = await res.json();
    if (s && Array.isArray(s.games) && s.games.length === DAILY_COUNT) {
      state = s;
      if (!Array.isArray(state.submitted)) state.submitted = new Array(DAILY_COUNT).fill(false);
      return true;
    }
  } catch {}
  return false;
}

// ── Deezer JSONP ──────────────────────────────────────────────────────────────
function fetchPreview(title, artist) {
  return new Promise((resolve, reject) => {
    const cb = '_dz' + Date.now() + Math.random().toString(36).slice(2);
    const q  = encodeURIComponent(title + ' ' + artist);
    const s  = document.createElement('script');
    s.src    = `https://api.deezer.com/search?q=${q}&limit=10&output=jsonp&callback=${cb}`;

    const tid = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 9000);

    window[cb] = (data) => {
      clearTimeout(tid); cleanup();
      const tl = title.toLowerCase();
      const al = artist.toLowerCase().split(' ')[0];
      const best =
        data.data?.find(t => t.title.toLowerCase().includes(tl) && t.artist.name.toLowerCase().includes(al)) ||
        data.data?.find(t => t.title.toLowerCase().includes(tl)) ||
        data.data?.[0];
      if (best?.preview) resolve(best.preview);
      else reject(new Error('no preview'));
    };

    s.onerror = () => { clearTimeout(tid); cleanup(); reject(new Error('script error')); };
    function cleanup() { delete window[cb]; s.parentNode?.removeChild(s); }
    document.head.appendChild(s);
  });
}

// ── Audio ─────────────────────────────────────────────────────────────────────
function clipDur() {
  const g = curGame();
  if (g.over) return CLIPS[CLIPS.length - 1];
  return CLIPS[Math.min(g.clipIdx, CLIPS.length - 1)];
}

function stopAudio() {
  clearTimeout(playTimer); playTimer = null;
  clearInterval(progTimer); progTimer = null;
  audio?.pause();
  showIcon('play');
}

function playClip() {
  if (!audio) return;
  stopAudio();

  const dur   = clipDur();
  const fill  = document.getElementById('progressFill');
  const start = Date.now();

  audio.currentTime = 0;
  audio.play().then(() => {
    showIcon('pause');
    progTimer = setInterval(() => {
      fill.style.width = Math.min(((Date.now() - start) / 1000 / dur) * 100, 100) + '%';
    }, 60);
    playTimer = setTimeout(() => {
      stopAudio();
      fill.style.width = '100%';
      setTimeout(() => { fill.style.width = '0%'; }, 600);
    }, dur * 1000);
  }).catch(() => showIcon('play'));
}

function showIcon(which) {
  document.getElementById('iconPlay').style.display  = which === 'play'  ? '' : 'none';
  document.getElementById('iconPause').style.display = which === 'pause' ? '' : 'none';
}

function setupAudio(slot) {
  stopAudio();
  const url = previews[slot];
  if (url) {
    audio = new Audio(url);
    audio.addEventListener('ended', stopAudio);
    document.getElementById('playBtn').disabled = false;
  } else {
    audio = null;
    document.getElementById('playBtn').disabled = true;
  }
}

// ── Search / dropdown ─────────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderDropdown(songs) {
  const dd = document.getElementById('dropdown');
  if (!songs.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = songs.map(s =>
    `<div class="dd-item" data-title="${esc(s.title)}" data-artist="${esc(s.artist)}">
       <div class="dd-title">${esc(s.title)}</div>
       <div class="dd-artist">${esc(s.artist)}</div>
     </div>`
  ).join('');
  dd.classList.add('open');
}

function closeDropdown() { document.getElementById('dropdown').classList.remove('open'); }

// ── Emoji helpers ─────────────────────────────────────────────────────────────
function emojiRow(game) {
  return Array.from({ length: MAX_GUESSES }, (_, i) => {
    const g = game.guesses[i];
    if (!g)        return '⬛';
    if (g.skipped) return '⬜';
    if (g.correct) return '🟩';
    return '🟥';
  }).join('');
}

function guessCount(game) {
  if (!game.over) return '-';
  if (game.won)   return String(game.guesses.length);
  return 'X';
}

// ── Stats modal ───────────────────────────────────────────────────────────────
let statsModalTimer = null;

function openStatsModal(slot, game) {
  const modal = document.getElementById('statsModal');
  const sub   = document.getElementById('statsModalSub');
  const bars  = document.getElementById('statsBars');
  const total = document.getElementById('statsTotal');

  // Show modal with loading state
  bars.innerHTML  = '';
  total.textContent = '';
  sub.textContent = 'Loading…';
  modal.classList.add('open');

  // Click backdrop to close
  modal.onclick = e => { if (e.target === modal) closeStatsModal(); };

  // Submit then fetch — update modal when ready
  submitThenFetch(slot, game).then(stats => {
    if (!stats) { sub.textContent = 'Stats unavailable'; return; }
    renderStatsBars(stats, game);
  });
}

function closeStatsModal() {
  document.getElementById('statsModal').classList.remove('open');
}

async function submitThenFetch(slot, game) {
  if (!state.submitted[slot]) {
    try {
      await fetch('/api/songless/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY, slot, guessCount: game.guesses.length, won: game.won }),
      });
      state.submitted[slot] = true;
      save();
    } catch {}
  }

  try {
    const res = await fetch(`/api/songless/stats?date=${TODAY}&slot=${slot}`);
    const data = await res.json();
    statsCache[slot] = data;
    return data;
  } catch {
    return null;
  }
}

function renderStatsBars(stats, game) {
  const keys    = ['1','2','3','4','5','6','fail'];
  const labels  = ['1','2','3','4','5','6','X'];
  const counts  = keys.map(k => stats[k] || 0);
  const total   = stats.total ?? counts.reduce((a, b) => a + b, 0);
  const max     = Math.max(...counts, 1);
  const userKey = game.won ? String(game.guesses.length) : 'fail';

  document.getElementById('statsModalSub').textContent = '';
  document.getElementById('statsBars').innerHTML = keys.map((key, i) => {
    const count = counts[i];
    const pct   = Math.max(Math.round((count / max) * 100), 4);
    const isMe  = key === userKey;
    const cls   = isMe ? (game.won ? 'stat-bar mine-win' : 'stat-bar mine-loss') : 'stat-bar';
    return `<div class="stat-row">
      <div class="stat-key">${labels[i]}</div>
      <div class="stat-track"><div class="${cls}" data-w="${pct}">${count}</div></div>
    </div>`;
  }).join('');

  document.getElementById('statsTotal').textContent =
    `${total} ${total === 1 ? 'player' : 'players'} today`;

  // Animate bars
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('#statsBars .stat-bar').forEach(b => {
      b.style.width = b.dataset.w + '%';
    });
  }));
}

// ── Result preview ────────────────────────────────────────────────────────────
const ICON_PLAY  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

function stopResultAudio() {
  if (!resultAudio) return;
  resultAudio.pause();
  const prev = resultAudioSlot;
  resultAudio = null; resultAudioSlot = -1;
  document.querySelector(`.song-play-btn[data-slot="${prev}"]`)?.replaceChildren();
  document.querySelector(`.song-play-btn[data-slot="${prev}"]`)?.insertAdjacentHTML('afterbegin', ICON_PLAY);
}

function playResultPreview(slot) {
  const url = previews[slot];
  if (!url) return;

  if (resultAudioSlot === slot && resultAudio) {
    if (resultAudio.paused) { resultAudio.play(); }
    else                    { resultAudio.pause(); }
    updateResultBtn(slot);
    return;
  }

  stopResultAudio();
  stopAudio(); // stop main player too

  resultAudioSlot = slot;
  resultAudio = new Audio(url);
  resultAudio.addEventListener('ended', () => stopResultAudio());
  resultAudio.play().catch(() => {});
  updateResultBtn(slot);
}

function updateResultBtn(slot) {
  const btn = document.querySelector(`.song-play-btn[data-slot="${slot}"]`);
  if (!btn) return;
  const playing = resultAudioSlot === slot && resultAudio && !resultAudio.paused;
  btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
}

// ── Hints ─────────────────────────────────────────────────────────────────────
function renderHints(song, game) {
  const el    = document.getElementById('hints');
  const count = game.guesses.length;
  if (count < 2) { el.innerHTML = ''; return; }

  const wordCount = song.title.trim().split(/\s+/).length;
  const artistLetter = song.artist.match(/[a-zA-Z0-9]/)?.[0].toUpperCase() ?? song.artist[0];
  const titleLetter  = song.title.match(/[a-zA-Z0-9]/)?.[0].toUpperCase()  ?? song.title[0];

  const defs = [
    { label: 'Year',   value: song.year ? String(song.year) : '—' },
    { label: 'Artist', value: `"${artistLetter}…"` },
    { label: 'Title',  value: `${wordCount} word${wordCount !== 1 ? 's' : ''}` },
    { label: 'Title',  value: `"${titleLetter}…"` },
  ];

  const visible = defs.slice(0, Math.min(count - 1, defs.length));
  el.innerHTML = `<div class="hints-list">${
    visible.map(h =>
      `<div class="hint-chip"><span class="hint-label">${h.label}</span><span class="hint-value">${h.value}</span></div>`
    ).join('')
  }</div>`;
}

// ── Game logic ────────────────────────────────────────────────────────────────
function makeGuess(song, skipped) {
  const g = curGame();
  const s = curSong();
  const correct = !skipped &&
    song.title.toLowerCase()  === s.title.toLowerCase() &&
    song.artist.toLowerCase() === s.artist.toLowerCase();

  g.guesses.push({
    display: skipped ? '' : `${song.title} — ${song.artist}`,
    correct, skipped,
  });

  if (correct) {
    g.over = true; g.won = true;
  } else if (g.guesses.length >= MAX_GUESSES) {
    g.over = true; g.won = false;
  } else {
    g.clipIdx++;
  }

  save();
  render();

  if (g.over) {
    clearTimeout(statsModalTimer);
    statsModalTimer = setTimeout(() => openStatsModal(state.slot, g), 650);
  }
}

function advanceSlot() {
  if (state.slot >= DAILY_COUNT - 1) return;
  closeStatsModal();
  stopResultAudio();
  state.slot++;
  save();
  setupAudio(state.slot);
  selected = null;
  const si = document.getElementById('searchInput');
  si.value = '';
  document.getElementById('guessBtn').disabled = true;
  closeDropdown();
  render();
}

function nextIn() {
  const n  = new Date();
  const ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - Date.now();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const g      = curGame();
  const s      = curSong();
  const allOver = state.games.every(gm => gm.over);

  // Hints
  renderHints(s, g);

  // Song progress dots
  document.getElementById('songProgress').innerHTML =
    Array.from({ length: DAILY_COUNT }, (_, i) => {
      const gm = state.games[i];
      let cls = 'sp-dot ';
      if (gm.over && gm.won)       cls += 'won';
      else if (gm.over && !gm.won) cls += 'lost';
      else if (i === state.slot)   cls += 'current';
      else                         cls += 'pending';
      return `<div class="${cls}" title="Song ${i+1}"></div>`;
    }).join('') +
    `<span class="sp-label">Song ${state.slot + 1} of ${DAILY_COUNT}</span>`;

  // Guess bars
  document.getElementById('indicators').innerHTML =
    Array.from({ length: MAX_GUESSES }, (_, i) => {
      const guess = g.guesses[i];
      let cls = 'bar ';
      if (!guess)           cls += i === g.clipIdx && !g.over ? 'active' : '';
      else if (guess.correct) cls += 'correct';
      else if (guess.skipped) cls += 'skipped';
      else                    cls += 'wrong';
      return `<div class="${cls}"></div>`;
    }).join('');

  // Clip label & play button
  const dur = clipDur();
  document.getElementById('clipLabel').textContent = g.over
    ? `Full preview — ${dur}s`
    : audio
      ? `Clip ${g.clipIdx + 1} of ${MAX_GUESSES} — ${dur}s`
      : 'Loading audio…';
  document.getElementById('playBtn').disabled = !audio;

  // Guess history
  document.getElementById('guessList').innerHTML = g.guesses.map(gItem => {
    if (gItem.skipped)
      return `<div class="guess-row"><div class="dot skipped"></div><div class="guess-text skipped">Skipped</div></div>`;
    const c = gItem.correct ? 'correct' : 'wrong';
    return `<div class="guess-row"><div class="dot ${c}"></div><div class="guess-text">${esc(gItem.display)}</div></div>`;
  }).join('');

  // Input area
  document.getElementById('inputArea').style.display = (g.over || allOver) ? 'none' : 'flex';

  // Per-song result card
  const resultEl = document.getElementById('result');
  if (g.over && !allOver) {
    resultEl.classList.add('show');
    const st = document.getElementById('resultStatus');
    if (g.won) {
      st.textContent = `Got it in ${g.guesses.length}${g.guesses.length === 1 ? ' try' : ' tries'}!`;
      st.className   = 'result-status won';
    } else {
      st.textContent = 'Better luck next song!';
      st.className   = 'result-status lost';
    }
    document.getElementById('resultSong').innerHTML =
      `<div class="result-song-row">
         <button class="song-play-btn" data-slot="${state.slot}" title="Play preview">${ICON_PLAY}</button>
         <div class="song-info"><strong>${esc(s.title)}</strong><span>${esc(s.artist)}</span></div>
       </div>`;
    document.getElementById('resultEmoji').textContent = emojiRow(g);
    document.getElementById('nextBtn').style.display = state.slot < DAILY_COUNT - 1 ? '' : 'none';
  } else {
    resultEl.classList.remove('show');
  }

  // All-done card
  const allDoneEl = document.getElementById('allDone');
  if (allOver) {
    allDoneEl.classList.add('show');
    const wonCount = state.games.filter(gm => gm.won).length;
    document.getElementById('allDoneScore').innerHTML =
      `${wonCount}/${DAILY_COUNT} <span>songs guessed</span>`;
    document.getElementById('allDoneRows').innerHTML = state.games.map((gm, i) => {
      const song = SONGS_TODAY[i];
      return `<div class="all-done-row">
        <button class="song-play-btn" data-slot="${i}" title="Play preview">${ICON_PLAY}</button>
        <div class="song-info">
          <span class="song-name">${esc(song.title)}</span>
          <span class="song-artist">${esc(song.artist)}</span>
        </div>
        <span class="row-emoji">${emojiRow(gm)}</span>
        <span class="row-count">${guessCount(gm)}/${MAX_GUESSES}</span>
      </div>`;
    }).join('');
    document.getElementById('nextLabel').textContent = `Next songs in ${nextIn()}`;
  } else {
    allDoneEl.classList.remove('show');
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
function setupEvents() {
  document.getElementById('playBtn').addEventListener('click', () => {
    if (document.getElementById('iconPause').style.display !== 'none') stopAudio();
    else playClip();
  });

  const si = document.getElementById('searchInput');
  si.addEventListener('input', () => {
    selected = null;
    document.getElementById('guessBtn').disabled = true;
    const q = si.value.toLowerCase().trim();
    const results = !q ? [] : SONGS.filter(s =>
      s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    ).slice(0, 8);
    renderDropdown(results);
  });

  si.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDropdown();
    if (e.key === 'Enter' && selected) {
      makeGuess(selected, false);
      si.value = ''; selected = null; closeDropdown();
      document.getElementById('guessBtn').disabled = true;
    }
  });

  document.getElementById('dropdown').addEventListener('click', e => {
    const item = e.target.closest('.dd-item');
    if (!item) return;
    selected = { title: item.dataset.title, artist: item.dataset.artist };
    si.value = `${selected.title} — ${selected.artist}`;
    document.getElementById('guessBtn').disabled = false;
    closeDropdown();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeDropdown();
  });

  document.getElementById('skipBtn').addEventListener('click', () => {
    makeGuess({ title: '', artist: '' }, true);
    si.value = ''; selected = null; closeDropdown();
    document.getElementById('guessBtn').disabled = true;
  });

  document.getElementById('guessBtn').addEventListener('click', () => {
    if (!selected) return;
    makeGuess(selected, false);
    si.value = ''; selected = null; closeDropdown();
    document.getElementById('guessBtn').disabled = true;
  });

  document.getElementById('nextBtn').addEventListener('click', advanceSlot);

  document.getElementById('result').addEventListener('click', e => {
    const btn = e.target.closest('.song-play-btn');
    if (btn) playResultPreview(parseInt(btn.dataset.slot, 10));
  });
  document.getElementById('allDone').addEventListener('click', e => {
    const btn = e.target.closest('.song-play-btn');
    if (btn) playResultPreview(parseInt(btn.dataset.slot, 10));
  });

  document.getElementById('shareBtn').addEventListener('click', () => {
    const g   = curGame();
    const cnt = g.won ? g.guesses.length : 'X';
    const txt = `Songless ${TODAY} · Song ${state.slot + 1}/${DAILY_COUNT}\n${cnt}/${MAX_GUESSES}\n\n${emojiRow(g)}\n\nvopori.dev/games/songless/`;
    copyText(document.getElementById('shareBtn'), txt);
  });

  document.getElementById('shareAllBtn').addEventListener('click', () => {
    const wonCount = state.games.filter(g => g.won).length;
    const rows = state.games.map((g, i) =>
      `Song ${i+1}: ${emojiRow(g)} (${guessCount(g)})`
    ).join('\n');
    const txt = `Songless ${TODAY}\n${wonCount}/${DAILY_COUNT} songs\n\n${rows}\n\nvopori.dev/games/songless/`;
    copyText(document.getElementById('shareAllBtn'), txt);
  });

  // Stats modal close button + Escape key
  document.getElementById('statsClose').addEventListener('click', closeStatsModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStatsModal(); });

  // Debug bar
  if (location.search.includes('debug')) {
    document.getElementById('debugBar').classList.add('visible');
  }

  document.getElementById('debugReset').addEventListener('click', async () => {
    try { await fetch(`/api/songless/state?date=${TODAY}`, { method: 'DELETE' }); } catch {}
    location.reload();
  });

  document.getElementById('debugShuffle').addEventListener('click', async () => {
    const next = (debugOffset + DAILY_COUNT) % SONGS.length;
    localStorage.setItem(DEBUG_OFFSET_KEY, String(next));
    try { await fetch(`/api/songless/state?date=${TODAY}`, { method: 'DELETE' }); } catch {}
    location.reload();
  });

  document.getElementById('debugClearStats').addEventListener('click', async () => {
    try {
      await fetch(`/api/songless/stats?date=${TODAY}`, { method: 'DELETE' });
      Object.keys(statsCache).forEach(k => delete statsCache[k]);
      closeStatsModal();
    } catch {}
  });
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await load();
  setupEvents();

  // Show the game shell immediately — don't block on audio loading
  document.getElementById('loading').style.display = 'none';
  document.getElementById('game').classList.add('visible');
  render();

  // Fetch all 5 previews in the background; enable play button as each arrives
  SONGS_TODAY.forEach((song, i) => {
    fetchPreview(song.title, song.artist)
      .then(url => {
        previews[i] = url;
        if (i === state.slot) { setupAudio(i); render(); }
      })
      .catch(() => { previews[i] = null; });
  });

  // If the current slot was already finished before page load, open stats
  if (curGame().over && !state.games.every(g => g.over)) {
    openStatsModal(state.slot, curGame());
  }
}

init();
