// Single source of truth for achievement SCORING (XP) and the level curve.
// Harder achievements are worth more points. The leaderboard endpoint and the
// achievements page both derive a player's level/XP from these values, so the
// client fetches the point map rather than duplicating it.

export const POINTS = {
  // ── Global (cross-game) ──
  global_play_1: 10, global_play_5: 20, global_play_10: 35, global_play_50: 75,
  global_streak_1: 10, global_streak_5: 35, global_streak_10: 50, global_streak_50: 100,
  global_all_games: 35, global_all_losses: 35,
  global_play_3: 15, global_play_25: 50, global_play_100: 100,
  global_streak_3: 20, global_streak_7: 40, global_streak_25: 70, global_streak_100: 100,
  global_all_wins: 50,

  // ── SongQuiz ──
  songless_first: 10, songless_sweep: 50, songless_perfect: 35, songless_no_skip: 20,
  songless_hard_win: 35, songless_hard_first: 50, songless_beat_clock: 25, songless_3_streak: 35,
  songless_quick: 20, songless_clutch: 35, songless_hard_sweep: 75, songless_no_skip_day: 50,
  songless_comeback: 35, songless_early_bird: 15, songless_2x_perfect: 50, songless_hard_clutch: 50,
  songless_full_day: 20,
  songless_3x_perfect: 60, songless_hard_streak: 50, songless_clean: 25, songless_no_skip_hard: 35,

  // ── xQc Chatter Quiz ──
  chatquiz_first: 10, chatquiz_perfect: 50, chatquiz_streak: 20, chatquiz_no_miss: 50,
  chatquiz_fast: 25, chatquiz_comeback: 25, chatquiz_clueless: 30, chatquiz_deep_thinker: 30,
  chatquiz_speed_run: 40, chatquiz_3_wrong: 15, chatquiz_clutch: 30, chatquiz_instant: 35,
  chatquiz_second_wind: 40, chatquiz_scholar: 35, chatquiz_hot_start: 30, chatquiz_no_hints: 25,
  chatquiz_half: 20, chatquiz_flawless_speed: 60, chatquiz_redemption: 35, chatquiz_no_first: 30,

  // ── Words ──
  words_first: 10, words_genius: 50, words_quick: 30, words_wordsmith: 25, words_comeback: 30,
  words_lightning: 25, words_hot_start: 20, words_bull_eye: 15, words_no_miss: 40, words_hard_win: 35,
  words_hard_genius: 75, words_hard_clutch: 40, words_beat_clock: 30, words_hard_lightning: 50,
  words_flash: 35, words_sniper: 40, words_unlucky: 15, words_almost: 25, words_green_open: 30,

  // ── Spelling Bee ──
  spelling_first: 10, spelling_half: 20, spelling_scholar: 40, spelling_perfect: 60,
  spelling_easy_sweep: 15, spelling_hard_sweep: 35, spelling_impossible: 40, spelling_streak_5: 25,
  spelling_hot_start: 25, spelling_clueless: 30,
  spelling_quarter: 15, spelling_medium_sweep: 35, spelling_clutch: 30, spelling_comeback: 30, spelling_nightmare: 50,

  // ── Secret (easter eggs) ──
  egg_heart: 40, egg_collector: 40, egg_konami: 40,
  egg_night_owl: 40, egg_typist: 40, egg_persistent: 40, egg_explorer: 40,
};

export const DEFAULT_POINTS = 10;            // fallback for any unmapped id
export const MAX_LEVEL = 100;
const CURVE = 1.6;                            // >1 → higher levels need more XP
export const TOTAL_POINTS = Object.values(POINTS).reduce((a, b) => a + b, 0);

export const pointsForId = (id) => POINTS[id] ?? DEFAULT_POINTS;
export const pointsFor = (achievements) =>
  (achievements || []).reduce((sum, a) => sum + pointsForId(a.id), 0);

// Cumulative XP required to REACH a level (1 → 0, MAX_LEVEL → TOTAL_POINTS).
export function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return TOTAL_POINTS;
  return Math.round(TOTAL_POINTS * Math.pow((level - 1) / (MAX_LEVEL - 1), CURVE));
}

export function levelFromXp(xp) {
  if (xp <= 0) return 1;
  if (xp >= TOTAL_POINTS) return MAX_LEVEL;
  const lvl = 1 + (MAX_LEVEL - 1) * Math.pow(xp / TOTAL_POINTS, 1 / CURVE);
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(lvl)));
}

// Full progress breakdown for an XP total (used by the leaderboard endpoint).
export function progress(xp) {
  const points = xp || 0;
  const level  = levelFromXp(points);
  const start  = xpForLevel(level);
  const next   = xpForLevel(level + 1);
  return {
    points, level,
    levelStartXp: start,
    nextLevelXp:  next,
    intoLevel:    points - start,
    levelSpan:    Math.max(1, next - start),
    atMax:        level >= MAX_LEVEL,
  };
}
