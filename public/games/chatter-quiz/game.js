function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}


function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Achievements ──────────────────────────────────────────────────────────────
async function unlockAchievements(ids) {
  if (!ids.length) return;
  try {
    const res  = await fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    });
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

function checkAchievements(correct, elapsedMs) {
  totalElapsed += elapsedMs;
  const earn = [];

  if (correct) {
    earn.push('chatquiz_first');
    if (elapsedMs <= 1000)  earn.push('chatquiz_instant');
    if (elapsedMs <= 3000)  earn.push('chatquiz_fast');
    if (elapsedMs >= 30000) earn.push('chatquiz_deep_thinker');

    const recent = log.slice(-2);
    if (recent.length === 2 && recent.every(a => a.correct)) earn.push('chatquiz_streak');

    const prev2 = log.slice(-3, -1);
    if (prev2.length === 2 && prev2.every(a => !a.correct)) earn.push('chatquiz_comeback');
  }

  const last3 = log.slice(-3);
  if (last3.length === 3 && last3.every(a => !a.correct)) earn.push('chatquiz_3_wrong');

  if (log.length >= 5 && log.slice(0, 5).every(a => a.correct)) earn.push('chatquiz_hot_start');

  const isComplete = log.length === questions.length;
  if (isComplete) {
    const correctCount = log.filter(a => a.correct).length;
    if (correctCount === questions.length) { earn.push('chatquiz_perfect'); earn.push('chatquiz_no_miss'); }
    if (correctCount === 0) earn.push('chatquiz_clueless');
    if (correctCount === questions.length - 1) earn.push('chatquiz_scholar');
    if (totalElapsed <= 30000) earn.push('chatquiz_speed_run');
    if (hintsUsedTotal === 0)  earn.push('chatquiz_no_hints');
    if (!log[0].correct && log[log.length - 1].correct) earn.push('chatquiz_clutch');
    if (!log[0].correct) {
      for (let i = 1; i <= log.length - 5; i++) {
        if (log.slice(i, i + 5).every(a => a.correct)) { earn.push('chatquiz_second_wind'); break; }
      }
    }
  }

  if (isComplete) {
    // Finishing the quiz counts toward global play/streak achievements
    recordGlobalCompletion('chatter-quiz', TODAY).then(globalIds => unlockAchievements([...earn, ...globalIds]));
  } else {
    unlockAchievements(earn);
  }
}

function renderMessage(text) {
  return text.split(' ').map(word => {
    const url = emotes[word];
    return url
      ? `<img class="emote" src="${esc(url)}" alt="${esc(word)}" title="${esc(word)}">`
      : esc(word);
  }).join(' ');
}

const TODAY = todayStr();

let questions      = [];
let emotes         = {};
let current        = 0;
let log            = [];
let questionStart  = 0;
let totalElapsed   = 0;
let hintsLeft      = 3;
let hintsUsedTotal = 0;

function save() {
  fetch('/api/chatter-quiz/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, state: { current, log, hintsLeft, hintsUsedTotal } }),
  }).catch(() => {});
}

async function loadState() {
  try {
    const res = await fetch(`/api/chatter-quiz/state?date=${TODAY}`);
    const s   = await res.json();
    if (s && Array.isArray(s.log)) {
      log            = s.log;
      current        = s.current ?? log.length;
      hintsLeft      = s.hintsLeft ?? 3;
      hintsUsedTotal = s.hintsUsedTotal ?? 0;
      return true;
    }
  } catch {}
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${date} · ${time}`;
  } catch { return ''; }
}

function updateHintButton() {
  const btn   = document.getElementById('hintBtn');
  const count = document.getElementById('hintCount');
  if (!btn) return;
  count.textContent = hintsLeft;
  btn.disabled = hintsLeft <= 0;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderProgress() {
  document.getElementById('progressLabel').textContent = `${current + 1} / ${questions.length}`;
  document.getElementById('progressDots').innerHTML = questions.map((_, i) => {
    let cls = 'pdot';
    if (i < log.length)  cls += log[i].correct ? ' correct' : ' wrong';
    else if (i === current) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function renderQuestion() {
  const q = questions[current];

  renderProgress();

  questionStart = Date.now();

  const card = document.getElementById('messageCard');
  card.classList.remove('revealed');
  card.querySelector('.reveal-author').innerHTML = '';
  document.getElementById('messageText').innerHTML = renderMessage(q.text);
  document.getElementById('msgTimestamp').textContent = formatTimestamp(q.timestamp);
  updateHintButton();

  const grid = document.getElementById('answers');
  grid.innerHTML = q.options.map(opt =>
    `<button class="answer-btn" data-username="${esc(opt.username)}">${esc(opt.display)}</button>`
  ).join('');

  grid.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(btn.dataset.username));
  });
}

function initSeedWidget(seed, sid) {
  document.getElementById('seedCode').textContent = seed.match(/.{4}/g).join(' ');
  if (sid) document.getElementById('sidCode').textContent = sid;
  const btn = document.getElementById('seedBtn');
  btn.style.display = '';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('seedPopup').classList.toggle('open');
  });
  document.addEventListener('click', () => document.getElementById('seedPopup').classList.remove('open'));
}

function trackAnswer(questionIndex, correct, complete) {
  fetch('/api/chatter-quiz/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, questionIndex, correct, complete, first: questionIndex === 0 }),
  }).catch(() => {});
}

function handleAnswer(selectedUsername) {
  const q       = questions[current];
  const correct = selectedUsername === q.answer;
  const answer  = q.options.find(o => o.username === q.answer);

  // Lock hint and answer buttons
  document.getElementById('hintBtn').disabled = true;
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.username === q.answer)         btn.classList.add('correct');
    else if (btn.dataset.username === selectedUsername) btn.classList.add('wrong');
    else btn.classList.add('dim');
  });

  // Reveal author on the card
  const card = document.getElementById('messageCard');
  card.classList.add('revealed');
  card.querySelector('.reveal-author').innerHTML =
    `<span>Said by</span><span class="author-name">${esc(answer.display)}</span>`;

  const elapsed = Date.now() - questionStart;
  log.push({ correct, display: answer.display, text: q.text });
  save();
  checkAchievements(correct, elapsed);
  trackAnswer(current, correct, current + 1 >= questions.length);

  setTimeout(() => {
    current++;
    save();
    if (current >= questions.length) showResults();
    else renderQuestion();
  }, 1400);
}

function showResults() {
  document.getElementById('game').style.display    = 'none';
  const resultsEl = document.getElementById('results');
  resultsEl.classList.add('show');

  const score = log.filter(a => a.correct).length;
  document.getElementById('resultsScore').innerHTML =
    `<strong>${score}</strong><span>/ ${questions.length} correct</span>`;

  document.getElementById('resultsRows').innerHTML = log.map((a, i) => {
    const short = a.text.length > 55 ? a.text.slice(0, 55) + '…' : a.text;
    return `<div class="result-row ${a.correct ? 'correct' : 'wrong'}">
      <span class="result-icon">${a.correct ? '✅' : '❌'}</span>
      <span class="result-msg">${esc(short)}</span>
      <span class="result-who">${esc(a.display)}</span>
    </div>`;
  }).join('');


  document.getElementById('shareBtn').addEventListener('click', () => {
    const emoji = log.map(a => a.correct ? '✅' : '❌').join('');
    const text  = `xQc Chatter Quiz ${TODAY}\n${score}/${questions.length}\n\n${emoji}\n\nvopori.dev/games/chatter-quiz/`;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('shareBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Result'; }, 2000);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  fetch('/api/session').then(r => r.json()).then(({ sid }) => {
    if (sid) document.getElementById('sidCode').textContent = sid;
  }).catch(() => {});

  try {
    const res  = await fetch(`/api/chatter-quiz/messages?date=${TODAY}`);
    const data = await res.json();

    if (!data.questions || data.questions.length === 0) {
      document.getElementById('loading').style.display = 'none';
      const err = document.getElementById('error');
      err.textContent = data.error || 'No questions available today — check back later.';
      err.style.display = '';
      return;
    }

    questions = data.questions;
    emotes    = data.emotes || {};
    if (data.seed) initSeedWidget(data.seed);
  } catch {
    document.getElementById('loading').style.display = 'none';
    const err = document.getElementById('error');
    err.textContent = 'Failed to load today\'s quiz.';
    err.style.display = '';
    return;
  }

  document.getElementById('loading').style.display = 'none';
  await loadState();

  if (current >= questions.length) {
    document.getElementById('game').style.display = 'none';
    showResults();
    return;
  }

  document.getElementById('game').style.display = 'flex';

  document.getElementById('hintBtn').addEventListener('click', () => {
    if (hintsLeft <= 0) return;
    const wrong = Array.from(document.querySelectorAll('.answer-btn'))
      .filter(b => b.dataset.username !== questions[current].answer && !b.classList.contains('eliminated') && !b.disabled);
    if (!wrong.length) return;
    wrong[Math.floor(Math.random() * wrong.length)].classList.add('eliminated');
    hintsLeft--;
    hintsUsedTotal++;
    updateHintButton();
    save();
  });

  renderQuestion();
}

init();
