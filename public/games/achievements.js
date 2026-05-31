const ALL_ACHIEVEMENTS = [
  // ── Global (any game) ──────────────────────────────────────────────────────
  { id: 'global_play_1',    game: 'Global', icon: '🎮', title: 'Getting Started', desc: 'Complete any game for the first time' },
  { id: 'global_play_5',    game: 'Global', icon: '🎯', title: 'Regular',         desc: 'Complete 5 games total' },
  { id: 'global_play_10',   game: 'Global', icon: '🕹️', title: 'Dedicated',       desc: 'Complete 10 games total' },
  { id: 'global_play_50',   game: 'Global', icon: '👾', title: 'Veteran',         desc: 'Complete 50 games total' },
  { id: 'global_streak_1',  game: 'Global', icon: '📅', title: 'Day One',         desc: 'Play on a single day' },
  { id: 'global_streak_5',  game: 'Global', icon: '🔥', title: 'On a Streak',     desc: 'Play 5 days in a row' },
  { id: 'global_streak_10', game: 'Global', icon: '⚡', title: 'Unstoppable',     desc: 'Play 10 days in a row' },
  { id: 'global_streak_50', game: 'Global', icon: '💎', title: 'Devoted',         desc: 'Play 50 days in a row' },
  { id: 'global_all_games', game: 'Global', icon: '🌐', title: 'Jack of All',     desc: 'Play every game at least once' },
  { id: 'global_all_losses',game: 'Global', icon: '💀', title: 'Rough Week',      desc: 'Lose every game at least once' },

  // ── SongQuiz ──────────────────────────────────────────────────────────────
  { id: 'songless_first',      game: 'SongQuiz', icon: '🎵', title: 'First Note',      desc: 'Win your first SongQuiz song' },
  { id: 'songless_sweep',      game: 'SongQuiz', icon: '🏆', title: 'Sweep',            desc: 'Win all 5 songs in a single day' },
  { id: 'songless_perfect',    game: 'SongQuiz', icon: '🎯', title: 'Perfect Pitch',    desc: 'Guess a song on the very first clip' },
  { id: 'songless_no_skip',    game: 'SongQuiz', icon: '⭐', title: 'No Filler',        desc: 'Win a song without ever skipping' },
  { id: 'songless_hard_win',   game: 'SongQuiz', icon: '🔥', title: 'Hard Ears',        desc: 'Win any song in Hard Mode' },
  { id: 'songless_hard_first', game: 'SongQuiz', icon: '⚡', title: 'Superhuman',       desc: 'Guess correctly on clip 1 in Hard Mode' },
  { id: 'songless_beat_clock', game: 'SongQuiz', icon: '⏱️', title: 'Beat the Clock',   desc: 'Guess correctly with 15+ seconds left on the timer' },
  { id: 'songless_3_streak',   game: 'SongQuiz', icon: '🎶', title: 'Hat Trick',        desc: 'Win 3 songs in a row in one session' },
  { id: 'songless_quick',      game: 'SongQuiz', icon: '💡', title: 'Quick Ears',       desc: 'Guess a song correctly in 2 tries or fewer' },
  { id: 'songless_clutch',     game: 'SongQuiz', icon: '🎲', title: 'Clutch',           desc: 'Guess a song correctly on the very last clip' },
  { id: 'songless_hard_sweep', game: 'SongQuiz', icon: '💀', title: 'Untouchable',      desc: 'Win all 5 songs in Hard Mode in one day' },
  { id: 'songless_no_skip_day',game: 'SongQuiz', icon: '🤐', title: 'Purist',           desc: 'Complete all 5 songs in a day without a single skip' },
  { id: 'songless_comeback',   game: 'SongQuiz', icon: '🔄', title: 'Never Give Up',    desc: 'Win a song after guessing wrong 4 or more times' },
  { id: 'songless_early_bird', game: 'SongQuiz', icon: '🐦', title: 'Early Bird',       desc: 'Win the very first song of the day' },
  { id: 'songless_2x_perfect', game: 'SongQuiz', icon: '🎯', title: 'Audiophile',       desc: 'Guess 2 different songs on the first clip in one day' },
  { id: 'songless_hard_clutch',game: 'SongQuiz', icon: '⏰', title: 'Photo Finish',     desc: 'Win a song in Hard Mode with 5 or fewer seconds left' },
  { id: 'songless_full_day',   game: 'SongQuiz', icon: '✅', title: 'Completionist',    desc: 'Attempt all 5 songs in a single day' },

  // ── xQc Chatter Quiz ─────────────────────────────────────────────────────
  { id: 'chatquiz_first',       game: 'xQc Chatter Quiz', icon: '💬', title: 'Chat Regular',    desc: 'Get your first Chatter Quiz question correct' },
  { id: 'chatquiz_perfect',     game: 'xQc Chatter Quiz', icon: '🏆', title: 'Super Chatter',   desc: 'Get all 10 questions correct in one day' },
  { id: 'chatquiz_streak',      game: 'xQc Chatter Quiz', icon: '🔥', title: 'On a Roll',       desc: 'Get 3 correct answers in a row' },
  { id: 'chatquiz_no_miss',     game: 'xQc Chatter Quiz', icon: '🎯', title: 'No Miss',         desc: 'Complete a full quiz without a single wrong answer' },
  { id: 'chatquiz_fast',        game: 'xQc Chatter Quiz', icon: '⚡', title: 'Lurker Instinct', desc: 'Answer correctly within 3 seconds' },
  { id: 'chatquiz_comeback',    game: 'xQc Chatter Quiz', icon: '🔄', title: 'Bounce Back',     desc: 'Get a correct answer immediately after 2 wrong in a row' },
  { id: 'chatquiz_clueless',    game: 'xQc Chatter Quiz', icon: '🤡', title: 'Clueless',        desc: 'Get every single question wrong' },
  { id: 'chatquiz_deep_thinker',game: 'xQc Chatter Quiz', icon: '🤔', title: 'Deep Thinker',    desc: 'Take 30+ seconds on a question and still get it right' },
  { id: 'chatquiz_speed_run',   game: 'xQc Chatter Quiz', icon: '🏃', title: 'Speed Chatter',   desc: 'Answer all 10 questions in 30 seconds or less' },
  { id: 'chatquiz_3_wrong',     game: 'xQc Chatter Quiz', icon: '😬', title: 'Out of Touch',    desc: 'Get 3 questions wrong in a row' },
  { id: 'chatquiz_clutch',      game: 'xQc Chatter Quiz', icon: '💪', title: 'Clutch',          desc: 'Get the last question right after missing the very first one' },
  { id: 'chatquiz_instant',     game: 'xQc Chatter Quiz', icon: '🫡', title: 'Instant Read',    desc: 'Answer correctly in under 1 second' },
  { id: 'chatquiz_second_wind', game: 'xQc Chatter Quiz', icon: '🌟', title: 'Warm Up',         desc: 'Miss the first question then get 5 in a row correct' },
  { id: 'chatquiz_scholar',     game: 'xQc Chatter Quiz', icon: '📚', title: 'Scholar',         desc: 'Finish with 9 out of 10 correct' },
  { id: 'chatquiz_hot_start',   game: 'xQc Chatter Quiz', icon: '🚀', title: 'Hot Start',       desc: 'Get the first 5 questions correct in a row' },
  { id: 'chatquiz_no_hints',    game: 'xQc Chatter Quiz', icon: '🧠', title: 'Pure Instinct',   desc: 'Complete a full quiz without using any hints' },

  // ── Words ─────────────────────────────────────────────────────────────────
  { id: 'words_first',     game: 'Words', icon: '🟩', title: 'First Word',   desc: 'Win your first Words game' },
  { id: 'words_genius',    game: 'Words', icon: '🧠', title: 'Genius',       desc: 'Guess the word on the very first try' },
  { id: 'words_quick',     game: 'Words', icon: '⚡', title: 'Sharp Mind',   desc: 'Guess the word in 2 tries' },
  { id: 'words_wordsmith', game: 'Words', icon: '🏆', title: 'Wordsmith',    desc: 'Win in 3 or fewer guesses' },
  { id: 'words_comeback',  game: 'Words', icon: '🎲', title: 'Last Chance',  desc: 'Win on the 6th and final guess' },
  { id: 'words_lightning', game: 'Words', icon: '⏱️', title: 'Lightning',    desc: 'Guess the word in under 45 seconds' },
  { id: 'words_hot_start', game: 'Words', icon: '🔥', title: 'Hot Start',    desc: 'Get 3+ matching letters on your first guess' },
  { id: 'words_bull_eye',  game: 'Words', icon: '🎯', title: "Bull's Eye",   desc: 'Get the first letter correct on your opening guess' },
  { id: 'words_no_miss',        game: 'Words', icon: '✨', title: 'Surgical',       desc: 'Win using only letters that appear in the answer' },
  { id: 'words_hard_win',       game: 'Words', icon: '🔥', title: 'Hard Mode',      desc: 'Win a Words game in Hard Mode' },
  { id: 'words_hard_genius',    game: 'Words', icon: '🧠', title: 'Hard Genius',    desc: 'Guess the word on the first try in Hard Mode' },
  { id: 'words_hard_clutch',    game: 'Words', icon: '🎲', title: 'Clutch 5',       desc: 'Win on the 5th and final guess in Hard Mode' },
  { id: 'words_beat_clock',     game: 'Words', icon: '⏱️', title: 'Clockwork',      desc: 'Win in Hard Mode with 30 or more seconds left' },
  { id: 'words_hard_lightning', game: 'Words', icon: '⚡', title: 'Hard Lightning', desc: 'Win in Hard Mode in under 20 seconds' },

  // ── Spelling Bee ───────────────────────────────────────────────────────────
  { id: 'spelling_first',      game: 'Spelling Bee', icon: '🐝', title: 'First Buzz',        desc: 'Spell your first word correctly' },
  { id: 'spelling_half',       game: 'Spelling Bee', icon: '✏️', title: 'Halfway There',     desc: 'Spell 5 or more words correctly in a day' },
  { id: 'spelling_scholar',    game: 'Spelling Bee', icon: '📚', title: 'Honor Roll',        desc: 'Spell 9 of 10 words correctly' },
  { id: 'spelling_perfect',    game: 'Spelling Bee', icon: '🏆', title: 'Spelling Champion', desc: 'Spell all 10 words correctly' },
  { id: 'spelling_easy_sweep', game: 'Spelling Bee', icon: '🌱', title: 'Warm Up',           desc: 'Spell all 3 easy words correctly' },
  { id: 'spelling_hard_sweep', game: 'Spelling Bee', icon: '💪', title: 'Wordsmith',         desc: 'Spell all 3 hard words correctly' },
  { id: 'spelling_impossible', game: 'Spelling Bee', icon: '🤯', title: 'The Impossible',    desc: 'Spell the impossible word correctly' },
  { id: 'spelling_streak_5',   game: 'Spelling Bee', icon: '🔥', title: 'Buzzing',           desc: 'Spell 5 words correctly in a row' },
  { id: 'spelling_hot_start',  game: 'Spelling Bee', icon: '🚀', title: 'Strong Start',      desc: 'Spell the first 5 words correctly' },
  { id: 'spelling_clueless',   game: 'Spelling Bee', icon: '🤡', title: 'Buzzed Out',        desc: 'Get all 10 words wrong' },

  // ── Secret (easter eggs) ───────────────────────────────────────────────────
  // `secret: true` → shown as "???" with `hint` until unlocked.
  { id: 'egg_heart',     game: 'Secret', icon: '💌', title: 'Heartfelt',   desc: 'You clicked the heart that makes it all worthwhile', secret: true, hint: 'Some love is hiding in the footer…' },
  { id: 'egg_collector', game: 'Secret', icon: '💎', title: 'Treasure Hunter', desc: 'You found the secret in your rank emblem', secret: true, hint: 'That shiny emblem looks clickable…' },
  { id: 'egg_konami',    game: 'Secret', icon: '🎮', title: 'Old School',  desc: 'You entered the legendary code', secret: true, hint: '↑ ↑ ↓ ↓ … you know the rest' },
];

// ── Global completion (play count + day streak) ────────────────────────────────
// Records a finished game and returns the global achievement IDs the player now
// qualifies for. Deduped server-side per game+date+mode.
async function recordGlobalCompletion(game, date, mode = 'normal', lost = false) {
  try {
    const res  = await fetch('/api/global-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, date, mode, lost }),
    });
    const data = await res.json();
    return data.qualified || [];
  } catch { return []; }
}

// ── Easter eggs (self-contained unlock + toast, works on any page) ─────────────
async function eggUnlock(id) {
  try {
    const res  = await fetch('/api/achievements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([id]),
    });
    const data = await res.json();
    if ((data.unlocked || []).includes(id)) eggToast(id);
  } catch {}
}

function eggToast(id) {
  const def = ALL_ACHIEVEMENTS.find(a => a.id === id);
  if (!def) return;
  let wrap = document.getElementById('eggToastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'eggToastWrap';
    wrap.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none';
    document.body.appendChild(wrap);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'display:flex;align-items:center;gap:0.75rem;background:#1a1a1a;border:1px solid #b58a00;border-radius:10px;padding:0.75rem 1rem;min-width:220px;max-width:280px;box-shadow:0 4px 24px rgba(0,0,0,0.6);transform:translateX(110%);opacity:0;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),opacity 0.3s;';
  toast.innerHTML = `<span style="font-size:1.5rem">${def.icon}</span><div><div style="font-size:0.58rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#f59e0b">★ Secret unlocked</div><div style="font-size:0.85rem;font-weight:700;color:#f0f0f0">${def.title}</div><div style="font-size:0.7rem;color:#888">${def.desc}</div></div>`;
  wrap.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }));
  setTimeout(() => { toast.style.transform = 'translateX(110%)'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 350); }, 4500);
}

function initEasterEggs() {
  // Footer heart — click the ♥
  document.querySelectorAll('.egg-heart').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => eggUnlock('egg_heart'));
  });

  // Konami code — ↑↑↓↓←→←→ b a
  const seq = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
  let pos = 0;
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; eggUnlock('egg_konami'); } }
    else { pos = (k === seq[0]) ? 1 : 0; }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEasterEggs);
else initEasterEggs();
