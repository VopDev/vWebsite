function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const TODAY    = todayStr();
const audio    = document.getElementById('audio');
const hardMode = localStorage.getItem('spelling-hard') === '1';
const MODE     = hardMode ? 'hard' : 'normal';

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', impossible: 'Impossible', hard_impossible: 'Nightmare' };

let questions = [];
let total     = 10;
let current   = 0;
let gameOver  = false;

// ── Seed widget ───────────────────────────────────────────────────────────────
function initSeedWidget(seed) {
  if (seed) {
    document.getElementById('seedCode').textContent = seed.match(/.{4}/g).join(' ');
    document.getElementById('seedBtn').style.display = '';
  }
  const btn = document.getElementById('seedBtn');
  btn.addEventListener('click', e => { e.stopPropagation(); document.getElementById('seedPopup').classList.toggle('open'); });
  document.addEventListener('click', () => document.getElementById('seedPopup').classList.remove('open'));
}

// ── Achievements ──────────────────────────────────────────────────────────────
async function unlockAchievements(ids) {
  if (!ids.length) return;
  try {
    const res  = await fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids) });
    const data = await res.json();
    for (const id of data.unlocked || []) showAchievementToast(id);
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

function checkAchievements() {
  const correctCount = questions.filter(q => q.correct).length;
  const earn = [];

  if (correctCount >= 1)          earn.push('spelling_first');
  if (correctCount >= 5)          earn.push('spelling_half');
  if (correctCount === total - 1) earn.push('spelling_scholar');
  if (correctCount === total)     earn.push('spelling_perfect');
  if (correctCount === 0)         earn.push('spelling_clueless');
  if (correctCount >= 3)          earn.push('spelling_quarter');

  const easy = questions.filter(q => q.difficulty === 'easy');
  if (easy.length && easy.every(q => q.correct)) earn.push('spelling_easy_sweep');
  const medium = questions.filter(q => q.difficulty === 'medium');
  if (medium.length && medium.every(q => q.correct)) earn.push('spelling_medium_sweep');
  const hard = questions.filter(q => q.difficulty === 'hard');
  if (hard.length && hard.every(q => q.correct)) earn.push('spelling_hard_sweep');
  const imp = questions.find(q => q.difficulty === 'impossible');
  if (imp && imp.correct) earn.push('spelling_impossible');
  const nightmare = questions.find(q => q.difficulty === 'hard_impossible');
  if (nightmare && nightmare.correct) earn.push('spelling_nightmare');

  let streak = 0, maxStreak = 0;
  for (const q of questions) { if (q.correct) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0; }
  if (maxStreak >= 5) earn.push('spelling_streak_5');
  if (questions.slice(0, 5).every(q => q.correct)) earn.push('spelling_hot_start');
  if (questions[0] && !questions[0].correct && questions[total - 1] && questions[total - 1].correct) earn.push('spelling_clutch');
  if (questions[0] && !questions[0].correct && maxStreak >= 5) earn.push('spelling_comeback');

  const lost = correctCount < total;
  recordGlobalCompletion('spelling-bee', TODAY, MODE, lost).then(globalIds => {
    unlockAchievements([...earn, ...globalIds]);
  });
}

// ── Audio ─────────────────────────────────────────────────────────────────────
function playAudio() {
  const btn = document.getElementById('playBtn');
  btn.classList.add('playing');
  try { audio.currentTime = 0; } catch {}
  audio.play().catch(() => btn.classList.remove('playing'));
}
audio.addEventListener('ended', () => document.getElementById('playBtn').classList.remove('playing'));

// ── Render ────────────────────────────────────────────────────────────────────
function renderProgress() {
  document.getElementById('progressLabel').textContent = `${Math.min(current + 1, total)} / ${total}`;
  document.getElementById('progressDots').innerHTML = questions.map((q, i) => {
    let cls = 'pdot';
    if (q.answered)         cls += q.correct ? ' correct' : ' wrong';
    else if (i === current) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function renderQuestion(autoPlay) {
  const q = questions[current];
  renderProgress();

  const card = document.getElementById('wordCard');
  card.classList.remove('revealed');

  const badge = document.getElementById('difficultyBadge');
  badge.textContent = DIFF_LABEL[q.difficulty] || q.difficulty;
  badge.className = `difficulty-badge ${q.difficulty}`;

  audio.src = `/api/spelling-bee/audio?date=${TODAY}&i=${q.index}&mode=${MODE}`;

  // Normal mode shows origin + definition as an aid; hard mode does not
  const info = document.getElementById('wordInfo');
  if (MODE === 'normal') {
    info.style.display = 'flex';
    document.getElementById('wordOrigin').textContent = 'Loading…';
    document.getElementById('wordDef').textContent = 'Loading…';
    loadWordInfo(q.index);
  } else {
    info.style.display = 'none';
  }

  const input = document.getElementById('spellInput');
  input.value = '';
  input.disabled = false;
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('inputRow').style.display = 'flex';
  document.getElementById('playHint').textContent = 'Tap to hear it again';
  input.focus();

  if (autoPlay) playAudio();
}

async function loadWordInfo(i) {
  try {
    const data = await fetch(`/api/spelling-bee/info?date=${TODAY}&i=${i}&mode=${MODE}`).then(r => r.json());
    // Ignore if the player already moved to a different word
    if (!questions[current] || questions[current].index !== i) return;
    document.getElementById('wordOrigin').textContent = data.origin || 'Not available';
    const pos = data.partOfSpeech ? `(${data.partOfSpeech}) ` : '';
    document.getElementById('wordDef').textContent = pos + (data.definition || 'Not available');
  } catch {
    if (!questions[current] || questions[current].index !== i) return;
    document.getElementById('wordOrigin').textContent = 'Not available';
    document.getElementById('wordDef').textContent = 'Not available';
  }
}

async function sendGuess(guess) {
  const input = document.getElementById('spellInput');
  document.getElementById('submitBtn').disabled = true;
  input.disabled = true;

  try {
    const res  = await fetch('/api/spelling-bee/guess', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TODAY, index: questions[current].index, guess, mode: MODE }),
    });
    const data = await res.json();
    revealResult(guess, data.correct, data.word);
  } catch {
    input.disabled = false;
    document.getElementById('submitBtn').disabled = guess.trim().length === 0;
  }
}

function revealResult(guess, correct, word) {
  const q = questions[current];
  q.answered = true; q.correct = correct; q.guess = (guess || '').toUpperCase(); q.word = word;

  const card = document.getElementById('wordCard');
  card.classList.add('revealed');
  document.getElementById('inputRow').style.display = 'none';
  document.getElementById('wordInfo').style.display = 'none';

  const st = document.getElementById('revealStatus');
  st.textContent = correct ? '✓ Correct' : '✗ Incorrect';
  st.className = 'reveal-status ' + (correct ? 'correct' : 'wrong');
  document.getElementById('revealWord').textContent = word;
  document.getElementById('revealYour').innerHTML = correct
    ? ''
    : ((guess || '').trim() ? `You spelled <s>${esc(q.guess)}</s>` : 'Skipped');

  renderProgress();

  setTimeout(() => {
    current++;
    if (current >= total) { gameOver = true; showResults(); }
    else renderQuestion(true);
  }, 2200);
}

function showResults() {
  document.getElementById('game').style.display = 'none';
  const el = document.getElementById('results');
  el.classList.add('show');

  const score = questions.filter(q => q.correct).length;
  document.getElementById('resultsScore').innerHTML =
    `<strong>${score}</strong><span>/ ${total} spelled correctly</span>`;

  document.getElementById('resultsRows').innerHTML = questions.map(q =>
    `<div class="result-row ${q.correct ? 'correct' : 'wrong'}">
      <span class="result-icon">${q.correct ? '✅' : '❌'}</span>
      <span class="result-word">${esc(q.word || '')}</span>
      <span class="result-diff">${DIFF_LABEL[q.difficulty] || q.difficulty}</span>
    </div>`).join('');

  document.getElementById('shareBtn').addEventListener('click', () => {
    const emoji = questions.map(q => q.correct ? '🟩' : '🟥').join('');
    const tag   = hardMode ? ' ⚡Hard' : '';
    navigator.clipboard.writeText(`🐝 Spelling Bee ${TODAY}${tag}\n${score}/${total}\n\n${emoji}\n\nvopori.dev/games/spelling-bee/`).then(() => {
      const btn = document.getElementById('shareBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Result'; }, 2000);
    });
  });

  checkAchievements();
}

// ── Input wiring ──────────────────────────────────────────────────────────────
function setupInput() {
  const input  = document.getElementById('spellInput');
  const submit = document.getElementById('submitBtn');
  input.addEventListener('input', () => { submit.disabled = input.value.trim().length === 0; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) sendGuess(input.value.trim()); });
  submit.addEventListener('click', () => { const v = input.value.trim(); if (v) sendGuess(v); });
  document.getElementById('skipBtn').addEventListener('click', () => sendGuess(''));
  document.getElementById('playBtn').addEventListener('click', playAudio);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  fetch('/api/session').then(r => r.json()).then(({ sid }) => {
    document.getElementById('sidCode').textContent = sid || '—';
  }).catch(() => {});

  if (hardMode) {
    document.getElementById('hardBadge').style.display = '';
    document.getElementById('subtitle').textContent = 'Hard Mode · 10 words, easy → nightmare';
  }

  try {
    const data = await fetch(`/api/spelling-bee/session?date=${TODAY}&mode=${MODE}`).then(r => r.json());
    questions = data.questions || [];
    total     = data.total || 10;
    current   = data.current || 0;
    gameOver  = data.gameOver || false;
    if (data.seed) initSeedWidget(data.seed);
  } catch {
    document.getElementById('loading').style.display = 'none';
    const err = document.getElementById('error');
    err.textContent = "Couldn't load today's words. Try refreshing.";
    err.style.display = '';
    return;
  }

  document.getElementById('loading').style.display = 'none';

  if (gameOver || current >= total) { showResults(); return; }

  document.getElementById('game').style.display = 'flex';
  setupInput();
  renderQuestion(false);
}

init();
