// Best-effort profanity filter for user-chosen display names.
//
// Two tiers to balance coverage vs. the "Scunthorpe problem":
//   SUBSTRING — egregious words/slurs blocked even inside other text.
//   WHOLE     — short/ambiguous words blocked only as a standalone token
//               (so "class", "essex", "grass" aren't false positives).

// Strong terms that rarely appear inside innocent words — safe as substrings.
const SUBSTRING = [
  'fuck', 'motherfucker', 'shit', 'bullshit', 'bitch', 'cunt', 'asshole',
  'dickhead', 'whore', 'slut', 'pussy', 'wank', 'wanker', 'jerkoff', 'handjob',
  'blowjob', 'pedophile', 'molest', 'nigger', 'nigga', 'faggot', 'retard',
  'retarded', 'kike', 'tranny', 'nazi', 'hitler', 'kkk', 'jizz', 'pornhub',
  'titties', 'nutsack', 'dildo', 'douchebag', 'twat', 'bollocks', 'arsehole',
];

// Words with common innocent collisions (grape, peacock, cucumber, therapist,
// raccoon, suspicious, Penistone…) — blocked only as a standalone token.
const WHOLE = [
  'ass', 'arse', 'sex', 'tit', 'tits', 'hoe', 'fag', 'damn', 'crap', 'piss',
  'dyke', 'gay', 'homo', 'anal', 'butt', 'turd', 'queer', 'cum', 'cock', 'dick',
  'penis', 'vagina', 'boner', 'rape', 'rapist', 'pedo', 'coon', 'spic', 'chink',
  'porn', 'bastard',
];

// Map leetspeak to letters, drop non-letters, then collapse runs so
// "f.u.u.u.c.k" and "sh1t" still match.
function canon(s) {
  return String(s)
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

// Per-token canon that does NOT collapse repeats, for whole-word matching.
function canonToken(s) {
  return String(s)
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '');
}

export function isProfane(name) {
  const collapsed = canon(name);
  if (SUBSTRING.some((w) => collapsed.includes(w))) return true;

  const tokens = String(name).toLowerCase().split(/[^a-z0-9@!|$]+/).filter(Boolean);
  const tokenSet = new Set(tokens.map(canonToken));
  // Also treat the fully-stripped name as one token (catches "a_s_s").
  tokenSet.add(canonToken(name));
  if (WHOLE.some((w) => tokenSet.has(w))) return true;

  return false;
}
