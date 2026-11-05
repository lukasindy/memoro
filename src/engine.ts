import { Course, Word, uid } from './store';
import { Pair } from './parser';

const DAY = 24 * 60 * 60 * 1000;
// Wartezeit in Tagen je Leitner-Fach (Index = Fach)
export const INTERVALS = [0, 1, 2, 4, 8, 16];
export const BOXES = 5;

// ---------- Schwierigkeit ----------

const ARTICLES = /^(der|die|das|ein|eine|the|a|an|to|le|la|les|l'|un|une|el|los|las|il|lo|gli|i)\s+/i;

export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(ARTICLES, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
}

function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function estimateDifficulty(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  const len = na.length;
  const lenScore = len <= 4 ? 1 : len <= 7 ? 2 : len <= 10 ? 3 : 4;
  const sim = 1 - lev(na, nb) / Math.max(na.length, nb.length, 1);
  const multi = /\s/.test(na) ? 1 : 0;
  return Math.max(1, Math.min(10, Math.round(lenScore + (1 - sim) * 4 + multi)));
}

export function effective(w: Word) {
  return w.base + (4 * w.wrong) / (w.right + w.wrong + 1);
}

export function newWord(p: Pair): Word {
  return { id: uid(), a: p.a, b: p.b, base: estimateDifficulty(p.a, p.b), box: 0, due: 0, right: 0, wrong: 0 };
}

// ---------- Stufen Leicht / Mittel / Schwer ----------

export type Level = { name: string; words: Word[]; learned: number };

export function levels(c: Course): Level[] {
  const sorted = [...c.words].sort((x, y) => x.base - y.base);
  const third = Math.ceil(sorted.length / 3);
  const names = ['Leicht', 'Mittel', 'Schwer'];
  return names.map((name, i) => {
    const words = sorted.slice(i * third, (i + 1) * third);
    return { name, words, learned: words.filter((w) => w.box >= 2).length };
  });
}

export function boxCounts(c: Course) {
  const counts = Array(BOXES + 1).fill(0);
  c.words.forEach((w) => counts[w.box]++);
  return counts; // Index 0 = neu
}

export function dueCount(c: Course, now = Date.now()) {
  return c.words.filter((w) => w.box > 0 && w.due <= now).length;
}

// ---------- Übungen ----------

export type Exercise =
  | { kind: 'choice'; word: Word; dir: 'ab' | 'ba'; prompt: string; options: string[]; answer: string; isNew: boolean }
  | { kind: 'spelling'; word: Word; prompt: string; options: string[]; answer: string }
  | { kind: 'pairs'; words: Word[] };

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function distractors(c: Course, w: Word, field: 'a' | 'b', n = 3) {
  const answer = w[field];
  const others = c.words.filter((o) => o.id !== w.id && o[field].toLowerCase() !== answer.toLowerCase());
  // Ähnlich schwere und ähnlich lange Wörter zuerst, damit es nicht zu leicht wird
  const scored = shuffle(others)
    .map((o) => ({ o, s: Math.abs(o.base - w.base) + Math.abs(o[field].length - answer.length) / 3 + Math.random() * 2 }))
    .sort((x, y) => x.s - y.s);
  const out: string[] = [];
  for (const { o } of scored) {
    if (!out.includes(o[field])) out.push(o[field]);
    if (out.length === n) break;
  }
  return out;
}

const VOWELS = 'aeiou';

function misspellings(word: string, n = 3) {
  const out = new Set<string>();
  const letters = [...word];
  const mutations = [
    () => { // zwei Buchstaben vertauschen
      const i = 1 + Math.floor(Math.random() * Math.max(1, letters.length - 2));
      const l = [...letters];
      if (i + 1 < l.length) [l[i], l[i + 1]] = [l[i + 1], l[i]];
      return l.join('');
    },
    () => { // Vokal ersetzen
      const idx = letters.map((ch, i) => (VOWELS.includes(ch.toLowerCase()) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) return word;
      const i = idx[Math.floor(Math.random() * idx.length)];
      const pool = VOWELS.replace(letters[i].toLowerCase(), '');
      const l = [...letters];
      l[i] = pool[Math.floor(Math.random() * pool.length)];
      return l.join('');
    },
    () => { // Buchstaben verdoppeln oder entfernen
      const i = 1 + Math.floor(Math.random() * Math.max(1, letters.length - 1));
      const l = [...letters];
      if (l[i] && l[i] === l[i - 1]) l.splice(i, 1);
      else if (l[i]) l.splice(i, 0, l[i]);
      return l.join('');
    },
    () => { // Buchstaben weglassen
      const i = 1 + Math.floor(Math.random() * Math.max(1, letters.length - 1));
      const l = [...letters];
      l.splice(i, 1);
      return l.join('');
    },
  ];
  let guard = 0;
  while (out.size < n && guard++ < 60) {
    const m = mutations[Math.floor(Math.random() * mutations.length)]();
    if (m && m !== word && m.trim().length > 0) out.add(m);
  }
  return [...out];
}

function choice(c: Course, w: Word, dir: 'ab' | 'ba', isNew: boolean): Exercise {
  const prompt = dir === 'ab' ? w.a : w.b;
  const answer = dir === 'ab' ? w.b : w.a;
  const options = shuffle([answer, ...distractors(c, w, dir === 'ab' ? 'b' : 'a')]);
  return { kind: 'choice', word: w, dir, prompt, options, answer, isNew };
}

function spelling(c: Course, w: Word): Exercise {
  const wrong = misspellings(w.a);
  if (w.a.length < 4 || wrong.length < 3) return choice(c, w, 'ba', false);
  return { kind: 'spelling', word: w, prompt: w.b, options: shuffle([w.a, ...wrong]), answer: w.a };
}

export const MIN_WORDS = 4;

export function buildLesson(c: Course, now = Date.now()): Exercise[] {
  if (c.words.length < MIN_WORDS) return [];

  const reviews = c.words
    .filter((w) => w.box > 0 && w.due <= now)
    .sort((x, y) => x.box - y.box || effective(y) - effective(x))
    .slice(0, 6);

  const fresh = c.words
    .filter((w) => w.box === 0)
    .sort((x, y) => x.base - y.base)
    .slice(0, Math.min(6, Math.max(3, 8 - reviews.length)));

  // Nichts fällig und nichts neu: die unsichersten Wörter vorziehen
  let pool = [...fresh, ...reviews];
  if (pool.length === 0) {
    pool = [...c.words].sort((x, y) => x.box - y.box || effective(y) - effective(x)).slice(0, 6);
  }

  const ex: Exercise[] = [];
  // Neue Wörter: erst erkennen (Fremdsprache → Muttersprache), dann aktiv wählen
  fresh.forEach((w) => ex.push(choice(c, w, 'ab', true)));
  const active = shuffle(pool).map((w, i) =>
    w.box >= 2 && i % 2 === 0 ? spelling(c, w) : choice(c, w, 'ba', w.box === 0),
  );
  if (pool.length >= 4) {
    const half = Math.ceil(active.length / 2);
    ex.push(...active.slice(0, half));
    ex.push({ kind: 'pairs', words: shuffle(pool).slice(0, 4) });
    ex.push(...active.slice(half));
  } else {
    ex.push(...active);
  }
  return ex;
}

// ---------- Auswertung ----------

export function applyResults(c: Course, results: Map<string, boolean>, now = Date.now()): Course {
  const words = c.words.map((w) => {
    if (!results.has(w.id)) return w;
    const ok = results.get(w.id)!;
    if (ok) {
      const box = Math.min(BOXES, w.box + 1);
      return { ...w, box, due: now + INTERVALS[box] * DAY, right: w.right + 1 };
    }
    return { ...w, box: 1, due: now, wrong: w.wrong + 1 };
  });
  return { ...c, words, lessons: c.lessons + 1 };
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function nextStreak(s: { day: string; count: number }) {
  const today = todayKey();
  if (s.day === today) return s;
  const y = todayKey(new Date(Date.now() - DAY));
  return { day: today, count: s.day === y ? s.count + 1 : 1 };
}
