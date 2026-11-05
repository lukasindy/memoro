import { Course, LessonDef, Mix, Unit, Word, uid } from './store';
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

// Baut eine Lektion aus den Wörtern nach dem eingestellten Übungsmix
export function buildMixed(c: Course, words: Word[], mix: Mix): Exercise[] {
  if (words.length === 0) return [];
  const order = shuffle(words);
  let i = 0;
  const next = () => order[i++ % order.length];
  const seen = new Set<string>();

  const intro: Exercise[] = [];
  for (let k = 0; k < mix.ab; k++) {
    const w = next();
    intro.push(choice(c, w, 'ab', w.box === 0 && !seen.has(w.id)));
    seen.add(w.id);
  }

  const rest: Exercise[] = [];
  for (let k = 0; k < mix.ba; k++) rest.push(choice(c, next(), 'ba', false));
  for (let k = 0; k < mix.spelling; k++) rest.push(spelling(c, next()));
  const pairsList: Exercise[] = [];
  if (words.length >= 2) {
    for (let k = 0; k < mix.pairs; k++) {
      const start = (k * 4) % words.length;
      const rotated = [...order.slice(start), ...order.slice(0, start)];
      pairsList.push({ kind: 'pairs', words: shuffle(rotated.slice(0, 4)) });
    }
  }

  // Paare gleichmäßig zwischen die übrigen Aufgaben verteilen
  const mixed = shuffle(rest);
  const step = Math.max(1, Math.floor(mixed.length / (pairsList.length + 1)));
  pairsList.forEach((p, k) => mixed.splice(Math.min(mixed.length, (k + 1) * step + k), 0, p));

  const all = [...intro, ...mixed];
  if (all.length === 0) return words.map((w) => choice(c, w, 'ab', w.box === 0));
  return all;
}

// Abschlusstest: jedes Wort genau einmal, halb in jede Richtung
export function buildTest(c: Course, words: Word[]): Exercise[] {
  const picked = shuffle(words).slice(0, 20);
  return picked.map((w, k) => choice(c, w, k % 2 === 0 ? 'ba' : 'ab', false));
}

// Wiederholung fälliger Wörter aus dem Karteikasten
export function reviewWords(c: Course, now = Date.now()) {
  const due = c.words
    .filter((w) => w.box > 0 && w.due <= now)
    .sort((x, y) => x.box - y.box || effective(y) - effective(x));
  if (due.length) return due.slice(0, 8);
  return [...c.words].filter((w) => w.box > 0).sort((x, y) => x.box - y.box || effective(y) - effective(x)).slice(0, 8);
}

export function buildReview(c: Course): Exercise[] {
  const words = reviewWords(c);
  return buildMixed(c, words, { ...c.mix, ab: Math.min(c.mix.ab, 2) });
}

export function buildFromDef(c: Course, def: LessonDef): Exercise[] {
  const words = def.wordIds.map((id) => c.words.find((w) => w.id === id)).filter(Boolean) as Word[];
  return def.kind === 'test' ? buildTest(c, words) : buildMixed(c, words, c.mix);
}

// ---------- Lernpfad ----------

export function makeUnit(title: string, words: Word[], perLesson: number): Unit {
  const sorted = [...words].sort((x, y) => x.base - y.base);
  const chunks: Word[][] = [];
  for (let k = 0; k < sorted.length; k += perLesson) chunks.push(sorted.slice(k, k + perLesson));
  // Zu kleinen Rest an die vorige Lektion hängen
  if (chunks.length > 1 && chunks[chunks.length - 1].length < Math.min(3, perLesson)) {
    const last = chunks.pop()!;
    chunks[chunks.length - 1].push(...last);
  }
  const lessons: LessonDef[] = chunks.map((ch) => ({ id: uid(), kind: 'lesson', wordIds: ch.map((w) => w.id), done: false, best: 0 }));
  if (sorted.length >= MIN_WORDS && chunks.length > 1) {
    lessons.push({ id: uid(), kind: 'test', wordIds: sorted.map((w) => w.id), done: false, best: 0 });
  }
  return { id: uid(), title, lessons };
}

// Wörter ohne Einheit (z. B. aus Version 0.1) in eine Einheit packen
export function ensureUnits(c: Course): Course {
  const inUnit = new Set(c.units.flatMap((u) => u.lessons.flatMap((l) => l.wordIds)));
  const loose = c.words.filter((w) => !inUnit.has(w.id));
  if (loose.length === 0) return c;
  return { ...c, units: [...c.units, makeUnit(`Einheit ${c.units.length + 1}`, loose, c.wordsPerLesson)] };
}

export function removeWordFromPath(c: Course, wordId: string): Course {
  const units = c.units
    .map((u) => ({
      ...u,
      lessons: u.lessons
        .map((l) => ({ ...l, wordIds: l.wordIds.filter((id) => id !== wordId) }))
        .filter((l) => l.wordIds.length > 0),
    }))
    .filter((u) => u.lessons.length > 0);
  return { ...c, units };
}

export type PathNode = { unit: Unit; lesson: LessonDef; index: number; status: 'done' | 'current' | 'locked' };

export function pathNodes(c: Course): PathNode[] {
  const out: PathNode[] = [];
  let open = true;
  c.units.forEach((unit) =>
    unit.lessons.forEach((lesson) => {
      const status = lesson.done ? 'done' : open ? 'current' : 'locked';
      if (!lesson.done) open = false;
      out.push({ unit, lesson, index: out.length, status });
    }),
  );
  return out;
}

export function markLesson(c: Course, lessonId: string, pct: number): Course {
  return {
    ...c,
    units: c.units.map((u) => ({
      ...u,
      lessons: u.lessons.map((l) => (l.id === lessonId ? { ...l, done: l.done || l.kind === 'lesson' || pct >= 50, best: Math.max(l.best, pct) } : l)),
    })),
  };
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
