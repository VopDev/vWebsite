// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}
function dayIndex() {
  const epoch = Date.UTC(2025, 0, 1);
  const n = new Date();
  return Math.floor((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - epoch) / 86400000);
}

const TODAY  = todayStr();
const ANSWER = ANSWERS[((dayIndex() % ANSWERS.length) + ANSWERS.length) % ANSWERS.length].toUpperCase();
const ROWS   = 6;
const COLS   = 5;

// ── State ─────────────────────────────────────────────────────────────────────
let guesses   = [];   // completed guess strings
let current   = '';   // letters typed for current row
let gameOver  = false;
let gameStart = 0;

function save() {
  fetch('/api/words/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, state: { guesses, gameOver } }),
  }).catch(() => {});
}

async function loadState() {
  try {
    const res = await fetch(`/api/words/state?date=${TODAY}`);
    const s   = await res.json();
    if (s && Array.isArray(s.guesses)) {
      guesses  = s.guesses;
      gameOver = s.gameOver ?? false;
      return true;
    }
  } catch {}
  return false;
}

// ── Seed widget ───────────────────────────────────────────────────────────────
function initSeedWidget(sid) {
  const code = `DAY-${String(dayIndex()).padStart(4,'0')}`;
  document.getElementById('seedCode').textContent = code;
  if (sid) document.getElementById('sidCode').textContent = sid;
  const btn = document.getElementById('seedBtn');
  btn.style.display = '';
  btn.addEventListener('click', e => { e.stopPropagation(); document.getElementById('seedPopup').classList.toggle('open'); });
  document.addEventListener('click', () => document.getElementById('seedPopup').classList.remove('open'));
}

// ── Evaluate guess ────────────────────────────────────────────────────────────
function evaluate(guess) {
  const result   = Array(COLS).fill('absent');
  const ansArr   = ANSWER.split('');
  const guessArr = guess.split('');

  // First pass: correct
  for (let i = 0; i < COLS; i++) {
    if (guessArr[i] === ansArr[i]) {
      result[i] = 'correct';
      ansArr[i] = null;
      guessArr[i] = null;
    }
  }
  // Second pass: present
  for (let i = 0; i < COLS; i++) {
    if (!guessArr[i]) continue;
    const idx = ansArr.indexOf(guessArr[i]);
    if (idx !== -1) { result[i] = 'present'; ansArr[idx] = null; }
  }
  return result;
}

// ── Board rendering ───────────────────────────────────────────────────────────
function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.id = `row-${r}`;
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function setTile(row, col, letter, state) {
  const tile = document.getElementById(`tile-${row}-${col}`);
  if (!tile) return;
  tile.textContent = letter || '';
  tile.dataset.letter = letter || '';
  tile.className = 'tile' + (state ? ` ${state}` : '') + (letter && !state ? ' active' : '');
}

function renderBoard() {
  // Render completed guesses
  guesses.forEach((word, r) => {
    const result = evaluate(word);
    for (let c = 0; c < COLS; c++) {
      setTile(r, c, word[c], result[c]);
    }
  });

  // Render current input row
  if (!gameOver && guesses.length < ROWS) {
    const r = guesses.length;
    for (let c = 0; c < COLS; c++) {
      setTile(r, c, current[c] || '', null);
    }
    // Clear remaining tiles in future rows
    for (let fr = r + 1; fr < ROWS; fr++) {
      for (let c = 0; c < COLS; c++) setTile(fr, c, '', null);
    }
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
const ROWS_KB = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
];

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  kb.innerHTML = '';
  ROWS_KB.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'key-row';
    row.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key' + (k.length > 1 ? ' wide' : '');
      btn.textContent = k;
      btn.dataset.key = k;
      btn.addEventListener('click', () => handleKey(k));
      rowEl.appendChild(btn);
    });
    kb.appendChild(rowEl);
  });
}

function updateKeyboard() {
  const best = {};
  const priority = { correct: 3, present: 2, absent: 1 };
  guesses.forEach(word => {
    evaluate(word).forEach((state, i) => {
      const letter = word[i];
      if ((priority[state] || 0) > (priority[best[letter]] || 0)) best[letter] = state;
    });
  });
  document.querySelectorAll('.key').forEach(btn => {
    const k = btn.dataset.key;
    if (k && k.length === 1) {
      btn.className = 'key' + (best[k] ? ` ${best[k]}` : '');
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 1200) {
  const wrap  = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  wrap.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
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

function checkAchievements(won, guessNum) {
  if (!won) return;
  unlockAchievement('words_first');
  if (guessNum === 1) unlockAchievement('words_genius');
  if (guessNum === 2) unlockAchievement('words_quick');
  if (guessNum <= 3)  unlockAchievement('words_wordsmith');
  if (guessNum === 6) unlockAchievement('words_comeback');
  if (gameStart && Date.now() - gameStart < 45000) unlockAchievement('words_lightning');

  // Hot start: 3+ matching letters on first guess
  if (guesses.length > 0) {
    const firstResult = evaluate(guesses[0]);
    const hotCount = firstResult.filter(s => s !== 'absent').length;
    if (hotCount >= 3) unlockAchievement('words_hot_start');
    if (firstResult[0] === 'correct') unlockAchievement('words_bull_eye');
  }

  // No miss: every letter guessed appears in the answer
  const answerLetters = new Set(ANSWER.split(''));
  const allGuessLetters = guesses.join('').split('');
  if (allGuessLetters.every(l => answerLetters.has(l))) unlockAchievement('words_no_miss');
}

// ── Result card ───────────────────────────────────────────────────────────────
function showResult(won) {
  document.getElementById('game').style.display = 'none';
  const card = document.getElementById('resultCard');
  card.classList.add('show');

  const guessNum = guesses.length;
  document.getElementById('resultTitle').textContent = won
    ? ['Genius!','Magnificent!','Impressive!','Splendid!','Great!','Phew!'][guessNum - 1] || 'Nice!'
    : 'Better luck tomorrow!';

  if (!won) {
    document.getElementById('resultWord').innerHTML = `The word was <strong>${ANSWER}</strong>`;
  }

  const EMOJIS = { correct: '🟩', present: '🟨', absent: '⬛' };
  document.getElementById('resultEmoji').textContent = guesses
    .map(w => evaluate(w).map(s => EMOJIS[s]).join('')).join('\n');

  document.getElementById('shareBtn').addEventListener('click', () => {
    const emoji = guesses.map(w => evaluate(w).map(s => EMOJIS[s]).join('')).join('\n');
    const score = won ? `${guessNum}/6` : 'X/6';
    navigator.clipboard.writeText(`Words ${TODAY} ${score}\n\n${emoji}\n\nvopori.dev/games/words/`).then(() => {
      const btn = document.getElementById('shareBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Result'; }, 2000);
    });
  });

  checkAchievements(won, guessNum);
}

// ── Input handling ────────────────────────────────────────────────────────────
function handleKey(key) {
  if (gameOver) return;

  if (key === '⌫' || key === 'Backspace') {
    current = current.slice(0, -1);
    renderBoard();
    return;
  }

  if (key === 'ENTER' || key === 'Enter') {
    submitGuess();
    return;
  }

  if (/^[A-Za-z]$/.test(key) && current.length < COLS) {
    current += key.toUpperCase();
    renderBoard();
    // Bounce animation on typed tile
    const tile = document.getElementById(`tile-${guesses.length}-${current.length - 1}`);
    if (tile) { tile.classList.remove('bounce'); void tile.offsetWidth; tile.classList.add('bounce'); }
  }
}

function submitGuess() {
  if (current.length < COLS) { showToast('Not enough letters'); shakeRow(guesses.length); return; }
  if (!ALL_WORDS.has(current.toLowerCase())) { showToast('Not in word list'); shakeRow(guesses.length); return; }

  const row    = guesses.length;
  const result = evaluate(current);

  // Flip animation with state reveal
  for (let c = 0; c < COLS; c++) {
    const tile = document.getElementById(`tile-${row}-${c}`);
    if (!tile) continue;
    tile.style.animationDelay = `${c * 80}ms`;
    tile.classList.add('flip');
    setTimeout(() => { tile.className = `tile ${result[c]}`; tile.textContent = current[c]; }, c * 80 + 250);
  }

  guesses.push(current);
  current = '';

  const won = result.every(s => s === 'correct');
  if (won || guesses.length >= ROWS) gameOver = true;

  setTimeout(() => {
    updateKeyboard();
    save();
    if (gameOver) showResult(won);
    else renderBoard();
  }, COLS * 80 + 350);
}

function shakeRow(rowIdx) {
  const row = document.getElementById(`row-${rowIdx}`);
  if (!row) return;
  row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 400);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Session
  fetch('/api/session').then(r => r.json()).then(({ sid }) => initSeedWidget(sid)).catch(() => initSeedWidget(null));

  await loadState();

  buildBoard();
  buildKeyboard();

  if (gameOver || guesses.length > 0) {
    // Render completed state without animations
    renderBoard();
    updateKeyboard();
    if (gameOver) {
      const won = guesses.length > 0 && evaluate(guesses[guesses.length - 1]).every(s => s === 'correct');
      showResult(won);
    } else {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('game').style.display = 'flex';
    }
  } else {
    gameStart = Date.now();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('game').style.display = 'flex';
    renderBoard();
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    handleKey(e.key);
  });
}

init();
