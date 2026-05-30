function todayStr() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}`;
}

function nextIn() {
  const n  = new Date();
  const ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - Date.now();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMessage(text) {
  return text.split(' ').map(word => {
    const url = emotes[word];
    return url
      ? `<img class="emote" src="${esc(url)}" alt="${esc(word)}" title="${esc(word)}">`
      : esc(word);
  }).join(' ');
}

const TODAY     = todayStr();
const STORE_KEY = `chatter-quiz-${TODAY}`;

let questions = [];
let emotes    = {};
let current   = 0;
let log       = [];

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.log)) { log = s.log; current = s.current ?? log.length; return true; }
  } catch {}
  return false;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ current, log }));
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

  const card = document.getElementById('messageCard');
  card.classList.remove('revealed');
  card.querySelector('.reveal-author').innerHTML = '';
  document.getElementById('messageText').innerHTML = renderMessage(q.text);

  const grid = document.getElementById('answers');
  grid.innerHTML = q.options.map(opt =>
    `<button class="answer-btn" data-username="${esc(opt.username)}">${esc(opt.display)}</button>`
  ).join('');

  grid.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(btn.dataset.username));
  });
}

function handleAnswer(selectedUsername) {
  const q       = questions[current];
  const correct = selectedUsername === q.answer;
  const answer  = q.options.find(o => o.username === q.answer);

  // Lock buttons and style
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

  log.push({ correct, display: answer.display, text: q.text });
  saveState();

  setTimeout(() => {
    current++;
    saveState();
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

  document.getElementById('nextLabel').textContent = `Next quiz in ${nextIn()}`;

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
  } catch {
    document.getElementById('loading').style.display = 'none';
    const err = document.getElementById('error');
    err.textContent = 'Failed to load today\'s quiz.';
    err.style.display = '';
    return;
  }

  document.getElementById('loading').style.display = 'none';
  loadState();

  if (current >= questions.length) {
    document.getElementById('game').style.display = 'none';
    showResults();
    return;
  }

  document.getElementById('game').style.display = 'flex';
  renderQuestion();
}

init();
