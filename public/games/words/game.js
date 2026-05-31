// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}

const TODAY = todayStr();
const ROWS  = 6;
const COLS  = 5;

// ── State (client mirrors server) ─────────────────────────────────────────────
let guesses   = [];   // [{word, evaluation}]
let current   = '';
let gameOver  = false;
let gameWon   = false;
let gameStart = 0;
let validating = false;

// ── Seed widget ───────────────────────────────────────────────────────────────
function initSeedWidget(seed, sid) {
  if (seed) {
    document.getElementById('seedCode').textContent = seed.match(/.{4}/g).join(' ');
    document.getElementById('seedBtn').style.display = '';
  }
  if (sid) document.getElementById('sidCode').textContent = sid;
  const btn = document.getElementById('seedBtn');
  btn.addEventListener('click', e => { e.stopPropagation(); document.getElementById('seedPopup').classList.toggle('open'); });
  document.addEventListener('click', () => document.getElementById('seedPopup').classList.remove('open'));
}

// ── Board ─────────────────────────────────────────────────────────────────────
function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'board-row'; row.id = `row-${r}`;
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile'; tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function setTile(row, col, letter, state) {
  const tile = document.getElementById(`tile-${row}-${col}`);
  if (!tile) return;
  tile.textContent = letter || '';
  tile.className = 'tile' + (state ? ` ${state}` : '') + (letter && !state ? ' active' : '');
}

function renderAll() {
  guesses.forEach(({ word, evaluation }, r) => {
    for (let c = 0; c < COLS; c++) setTile(r, c, word[c], evaluation[c]);
  });
  if (!gameOver) {
    const r = guesses.length;
    for (let c = 0; c < COLS; c++) setTile(r, c, current[c] || '', null);
    for (let fr = r + 1; fr < ROWS; fr++)
      for (let c = 0; c < COLS; c++) setTile(fr, c, '', null);
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key' + (k.length > 1 ? ' wide' : '');
      btn.textContent = k; btn.dataset.key = k;
      btn.addEventListener('click', () => handleKey(k));
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
}

function updateKeyboard() {
  const best = {};
  const priority = { correct: 3, present: 2, absent: 1 };
  guesses.forEach(({ word, evaluation }) => {
    evaluation.forEach((state, i) => {
      const letter = word[i];
      if ((priority[state] || 0) > (priority[best[letter]] || 0)) best[letter] = state;
    });
  });
  document.querySelectorAll('.key').forEach(btn => {
    const k = btn.dataset.key;
    if (k?.length === 1) btn.className = 'key' + (best[k] ? ` ${best[k]}` : '');
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 1400) {
  const wrap  = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = 'toast'; toast.textContent = msg;
  wrap.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 200); }, duration);
}

function shakeRow(r) {
  const row = document.getElementById(`row-${r}`);
  if (!row) return;
  row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}

// ── Achievements ──────────────────────────────────────────────────────────────
async function unlockAchievement(id) {
  try {
    const res  = await fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const data = await res.json();
    if (data.unlocked) showAchievementToast(id);
  } catch {}
}

function showAchievementToast(id) {
  const def = ALL_ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  const toast = document.createElement('div');
  toast.style.cssText = 'display:flex;align-items:center;gap:0.75rem;background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:0.75rem 1rem;min-width:220px;max-width:280px;box-shadow:0 4px 24px rgba(0,0,0,0.6);transform:translateX(110%);opacity:0;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),opacity 0.3s;';
  toast.innerHTML = `<span style="font-size:1.5rem">${def.icon}</span><div><div style="font-size:0.58rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#f59e0b">Achievement unlocked</div><div style="font-size:0.85rem;font-weight:700;color:#f0f0f0">${def.title}</div><div style="font-size:0.7rem;color:#555">${def.desc}</div></div>`;
  document.getElementById('toastContainer').appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }));
  setTimeout(() => { toast.style.transform = 'translateX(110%)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 4000);
}

function checkAchievements(won, guessNum, answer) {
  if (!won) return;
  unlockAchievement('words_first');
  if (guessNum === 1) unlockAchievement('words_genius');
  if (guessNum === 2) unlockAchievement('words_quick');
  if (guessNum <= 3)  unlockAchievement('words_wordsmith');
  if (guessNum === 6) unlockAchievement('words_comeback');
  if (gameStart && Date.now() - gameStart < 45000) unlockAchievement('words_lightning');

  if (guesses.length > 0) {
    const first = guesses[0].evaluation;
    if (first.filter(s => s !== 'absent').length >= 3) unlockAchievement('words_hot_start');
    if (first[0] === 'correct') unlockAchievement('words_bull_eye');
    if (answer) {
      const ansSet = new Set(answer.split(''));
      if (guesses.flatMap(g => g.word.split('')).every(l => ansSet.has(l))) unlockAchievement('words_no_miss');
    }
  }
}

// ── Result card ───────────────────────────────────────────────────────────────
function showResult(won, answer, guessNum) {
  document.getElementById('game').style.display = 'none';
  const card = document.getElementById('resultCard');
  card.classList.add('show');

  document.getElementById('resultTitle').textContent = won
    ? ['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!'][(guessNum || 1) - 1]
    : 'Better luck tomorrow!';

  if (answer) {
    document.getElementById('resultWord').innerHTML = won
      ? '' : `The word was <strong>${answer}</strong>`;
  }

  const EMOJIS = { correct: '🟩', present: '🟨', absent: '⬛' };
  document.getElementById('resultEmoji').textContent =
    guesses.map(g => g.evaluation.map(s => EMOJIS[s]).join('')).join('\n');

  document.getElementById('shareBtn').addEventListener('click', () => {
    const emoji  = guesses.map(g => g.evaluation.map(s => EMOJIS[s]).join('')).join('\n');
    const score  = won ? `${guessNum}/6` : 'X/6';
    navigator.clipboard.writeText(`Words ${TODAY} ${score}\n\n${emoji}\n\nvopori.dev/games/words/`).then(() => {
      const btn = document.getElementById('shareBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Result'; }, 2000);
    });
  });

  checkAchievements(won, guessNum, answer);
}

// ── Input ─────────────────────────────────────────────────────────────────────
function handleKey(key) {
  if (gameOver || validating) return;
  if (key === '⌫' || key === 'Backspace') {
    current = current.slice(0, -1); renderAll(); return;
  }
  if (key === 'ENTER' || key === 'Enter') { submitGuess(); return; }
  if (/^[A-Za-z]$/.test(key) && current.length < COLS) {
    current += key.toUpperCase(); renderAll();
    const tile = document.getElementById(`tile-${guesses.length}-${current.length - 1}`);
    if (tile) { tile.classList.remove('bounce'); void tile.offsetWidth; tile.classList.add('bounce'); }
  }
}

async function submitGuess() {
  if (validating || gameOver) return;
  if (current.length < COLS) { showToast('Not enough letters'); shakeRow(guesses.length); return; }

  validating = true;
  setKeyboardLocked(true);

  try {
    const res  = await fetch('/api/words/guess', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TODAY, word: current }),
    });

    if (res.status === 422) {
      const data = await res.json();
      showToast(data.error || 'Not a valid word');
      shakeRow(guesses.length);
      return;
    }
    if (!res.ok) { showToast('Something went wrong'); return; }

    const data       = await res.json();
    const { evaluation, gameOver: over, won, guessNum, answer } = data;
    const row        = guesses.length;
    const word       = current;

    // Animate flip with delayed state reveal
    for (let c = 0; c < COLS; c++) {
      const tile = document.getElementById(`tile-${row}-${c}`);
      if (!tile) continue;
      tile.style.animationDelay = `${c * 80}ms`;
      tile.classList.add('flip');
      setTimeout(() => { tile.className = `tile ${evaluation[c]}`; tile.textContent = word[c]; }, c * 80 + 250);
    }

    guesses.push({ word, evaluation });
    current  = '';
    gameOver = over;
    gameWon  = won;

    setTimeout(() => {
      updateKeyboard();
      if (over) showResult(won, answer, guessNum);
      else renderAll();
    }, COLS * 80 + 400);

  } finally {
    validating = false;
    setKeyboardLocked(false);
  }
}

function setKeyboardLocked(locked) {
  document.querySelectorAll('.key').forEach(btn => { btn.disabled = locked; });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Session ID for ⓘ popup
  fetch('/api/session').then(r => r.json()).then(({ sid }) => {
    document.getElementById('sidCode').textContent = sid || '—';
  }).catch(() => {});

  let seed;
  try {
    const res  = await fetch(`/api/words/session?date=${TODAY}`);
    const data = await res.json();

    seed    = data.seed;
    guesses = data.guesses || [];
    gameOver = data.gameOver || false;
    gameWon  = data.won || false;

    if (seed) initSeedWidget(seed, null);

    buildBoard();
    buildKeyboard();

    if (guesses.length > 0) {
      renderAll();
      updateKeyboard();
    }

    if (gameOver) {
      showResult(gameWon, data.answer, guesses.length);
    } else {
      gameStart = Date.now();
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game').style.display = 'flex';
      renderAll();
    }
  } catch {
    document.getElementById('loading').textContent = 'Failed to load — try refreshing.';
    return;
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    handleKey(e.key);
  });
}

init();
