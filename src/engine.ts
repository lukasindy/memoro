import { AppData, Course, FREE_WORD_LIMIT, Mix, Word, uid } from './store';
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

// Wie ähnlich sich Wort und Übersetzung sind (0 bis 1), z. B. familia/Familie
export function similarity(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  return 1 - lev(na, nb) / Math.max(na.length, nb.length, 1);
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

// Der Übungsmix gilt für 5 Wörter. Bei mehr Wörtern wird er hochgerechnet,
// damit jedes Wort etwa gleich oft drankommt (rund 2 Aufgaben pro Wort).
export const MIX_BASE_WORDS = 5;
export function scaledMix(mix: Mix, wordCount: number): Mix {
  const f = Math.max(1, wordCount / MIX_BASE_WORDS);
  const s = (v: number) => (v === 0 ? 0 : Math.max(1, Math.round(v * f)));
  return { ab: s(mix.ab), ba: s(mix.ba), pairs: s(mix.pairs), spelling: s(mix.spelling) };
}

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

// Abschnittsprüfung: feste Anzahl Fragen, genau halb in jede Richtung
export function buildExam(c: Course, words: Word[], count: number): Exercise[] {
  const n = Math.min(count, words.length * 2);
  const half = Math.ceil(n / 2);
  const ba = shuffle(words).slice(0, half).map((w) => choice(c, w, 'ba', false));
  const ab = shuffle(words).slice(0, n - half).map((w) => choice(c, w, 'ab', false));
  // Gleiche Wörter nicht direkt hintereinander
  const out = shuffle([...ba, ...ab]);
  for (let k = 1; k < out.length; k++) {
    const prev = out[k - 1], cur = out[k];
    if (prev.kind !== 'pairs' && cur.kind !== 'pairs' && prev.word.id === cur.word.id) {
      const j = (k + 2) % out.length;
      [out[k], out[j]] = [out[j], out[k]];
    }
  }
  return out;
}

export function wordsByIds(c: Course, ids: string[]) {
  return ids.map((id) => c.words.find((w) => w.id === id)).filter(Boolean) as Word[];
}

// ---------- Lernpfad: Abschnitte → Einheiten → Lektionen ----------

export type NodeKind = 'lesson' | 'unitTest' | 'exam';
export type Status = 'done' | 'current' | 'locked';

export type PathNode = {
  key: string;
  kind: NodeKind;
  title: string;
  wordIds: string[];
  section: number;
  status: Status;
};

export type PathUnit = { index: number; nodes: PathNode[]; wordIds: string[] };

export type Section = {
  index: number;
  name: string;
  level: 0 | 1 | 2; // Farbe: leicht, mittel, schwer
  wordIds: string[];
  units: PathUnit[];
  exam: PathNode | null;
  examSize: number;
  status: Status;
  done: number;
  total: number;
};

const EXAM_SIZE = [10, 20, 30];

function chunk<T>(arr: T[], size: number, minLast: number): T[][] {
  const out: T[][] = [];
  for (let k = 0; k < arr.length; k += size) out.push(arr.slice(k, k + size));
  if (out.length > 1 && out[out.length - 1].length < minLast) {
    const last = out.pop()!;
    out[out.length - 1].push(...last);
  }
  return out;
}

export function buildPath(c: Course): Section[] {
  const n = c.words.length;
  if (n === 0) return [];
  const sorted = c.words
    .map((w, i) => ({ w, i }))
    .sort((x, y) => x.w.base - y.w.base || x.i - y.i)
    .map((x) => x.w);

  const count = n >= 15 ? 3 : n >= 8 ? 2 : 1;
  const names = count === 3 ? ['Leicht', 'Mittel', 'Schwer'] : count === 2 ? ['Leicht', 'Schwer'] : ['Grundlagen'];
  const levelsOf: (0 | 1 | 2)[] = count === 3 ? [0, 1, 2] : count === 2 ? [0, 2] : [0];
  const per = Math.ceil(n / count);
  const flags = (ids: string[], f: 'lp' | 'ut' | 'se') => ids.every((id) => c.words.find((w) => w.id === id)?.[f]);

  let open = true; // erster nicht erledigter Knoten wird „aktuell“
  const status = (done: boolean): Status => {
    if (done) return 'done';
    if (open) {
      open = false;
      return 'current';
    }
    return 'locked';
  };

  return names.map((name, si) => {
    const words = sorted.slice(si * per, (si + 1) * per);
    // Bereits gelernte Wörter zuerst, damit erledigte Lektionen beim Umbauen erledigt bleiben
    const rank = (w: Word) => (w.se ? 3 : w.ut ? 2 : w.lp ? 1 : 0);
    const inOrder = [...words].sort((x, y) => rank(y) - rank(x));
    const lessons = chunk(inOrder, c.wordsPerLesson, Math.min(3, c.wordsPerLesson));
    const unitGroups = chunk(lessons, c.lessonsPerUnit, 2);
    let lessonNo = 0;
    const units: PathUnit[] = unitGroups.map((group, ui) => {
      const unitIds = group.flat().map((w) => w.id);
      const nodes: PathNode[] = group.map((ws) => {
        lessonNo++;
        const ids = ws.map((w) => w.id);
        return { key: `s${si}u${ui}l${lessonNo}`, kind: 'lesson', title: `Lektion ${lessonNo}`, wordIds: ids, section: si, status: status(flags(ids, 'lp')) };
      });
      if (unitIds.length >= MIN_WORDS) {
        nodes.push({ key: `s${si}u${ui}t`, kind: 'unitTest', title: `Mini-Prüfung ${ui + 1}`, wordIds: unitIds, section: si, status: status(flags(unitIds, 'ut')) });
      }
      return { index: ui, nodes, wordIds: unitIds };
    });
    const ids = words.map((w) => w.id);
    const examSize = EXAM_SIZE[levelsOf[si]];
    const exam: PathNode | null =
      ids.length >= MIN_WORDS
        ? { key: `s${si}e`, kind: 'exam', title: 'Abschlussprüfung', wordIds: ids, section: si, status: status(flags(ids, 'se')) }
        : null;
    const all = [...units.flatMap((u) => u.nodes), ...(exam ? [exam] : [])];
    const done = all.filter((x) => x.status === 'done').length;
    const secStatus: Status = done === all.length ? 'done' : all.some((x) => x.status === 'current') ? 'current' : 'locked';
    return { index: si, name, level: levelsOf[si], wordIds: ids, units, exam, examSize, status: secStatus, done, total: all.length };
  });
}

export function findNode(c: Course, key: string): PathNode | undefined {
  for (const s of buildPath(c)) {
    for (const u of s.units) for (const n of u.nodes) if (n.key === key) return n;
    if (s.exam?.key === key) return s.exam;
  }
  return undefined;
}

export const PASS = 50; // Prozent für Mini-Prüfung und Abschlussprüfung
export const SKIP_PASS = 80; // Prozent zum Überspringen eines Abschnitts

// Fortschritt nach einer Lektion, einem Test oder einer Prüfung auf die Wörter schreiben
export function markProgress(c: Course, kind: NodeKind | 'skip', wordIds: string[], pct: number, key?: string): Course {
  let ids = new Set(wordIds);
  let flags: ('lp' | 'ut' | 'se')[] = [];
  if (kind === 'lesson') flags = ['lp'];
  if (kind === 'unitTest' && pct >= PASS) flags = ['lp', 'ut'];
  if (kind === 'exam' && pct >= PASS) flags = ['lp', 'ut', 'se'];
  if (kind === 'skip' && pct >= SKIP_PASS) {
    // Springen schaltet auch alle früheren Abschnitte frei
    const sections = buildPath(c);
    const target = sections.find((s) => s.wordIds.some((id) => ids.has(id)));
    ids = new Set(sections.filter((s) => target && s.index <= target.index).flatMap((s) => s.wordIds));
    flags = ['lp', 'ut', 'se'];
  }
  const words = c.words.map((w) => {
    if (!ids.has(w.id) || flags.length === 0) return w;
    const nw = { ...w };
    flags.forEach((f) => (nw[f] = true));
    return nw;
  });
  const best = key ? { ...c.best, [key]: Math.max(c.best[key] ?? 0, pct) } : c.best;
  return { ...c, words, best };
}

// ---------- Gratis-Limit ----------

export function totalWords(d: AppData) {
  return d.courses.reduce((n, c) => n + c.words.length, 0);
}

// Wie viele Wörter noch Platz haben (Premium: unbegrenzt)
export function freeSlots(d: AppData) {
  return d.premium ? Infinity : Math.max(0, FREE_WORD_LIMIT - totalWords(d));
}

// Geparkte Wörter übernehmen, soweit Platz ist
export function releasePending(d: AppData, courseId?: string): AppData {
  let slots = freeSlots(d);
  const courses = d.courses.map((c) => {
    if ((courseId && c.id !== courseId) || !c.pending?.length || slots <= 0) return c;
    const take = c.pending.slice(0, slots === Infinity ? c.pending.length : slots);
    slots -= take.length;
    return { ...c, words: [...c.words, ...take.map(newWord)], pending: c.pending.slice(take.length) };
  });
  return { ...d, courses };
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

// Streak fortschreiben, verpasste Tage mit Streak-Schutz überbrücken
export function nextStreak(s: { day: string; count: number }, freezes = 0) {
  const today = todayKey();
  if (s.day === today) return { streak: s, used: 0 };
  if (!s.day) return { streak: { day: today, count: 1 }, used: 0 };
  const missed = Math.round((Date.parse(today) - Date.parse(s.day)) / DAY) - 1;
  if (missed <= 0) return { streak: { day: today, count: s.count + 1 }, used: 0 };
  if (missed <= freezes) return { streak: { day: today, count: s.count + 1 }, used: missed };
  return { streak: { day: today, count: 1 }, used: 0 };
}

// ---------- Level ----------

export const MAX_FREEZES = 3;
export const BOOST_LESSONS = 3;

// XP, die man für den Schritt von Level n auf n+1 braucht
const stepXp = (n: number) => 100 + 50 * (n - 1);

export function levelInfo(xp: number) {
  let level = 1;
  let base = 0;
  while (xp >= base + stepXp(level)) {
    base += stepXp(level);
    level++;
  }
  const need = stepXp(level);
  return { level, into: xp - base, need, progress: (xp - base) / need };
}

export type LevelUp = { from: number; to: number; freezes: number; boost: boolean; minutes: number };

// Social-Media-Zeit pro Level: normal 5, jedes 5. Level 10, jedes 10. Level 30 Minuten
export function levelMinutes(level: number) {
  return level % 10 === 0 ? 30 : level % 5 === 0 ? 10 : 5;
}

// Nächste Level-Belohnungen für die Vorschau im Inventar
export function upcomingRewards(level: number, count = 5) {
  return Array.from({ length: count }, (_, k) => {
    const l = level + 1 + k;
    return { level: l, booster: l % 5 === 0, minutes: levelMinutes(l) };
  });
}

// XP gutschreiben (mit Booster doppelt) und Level-Boni vergeben
export function gainXp(d: { xp: number; freezes: number; boost: number; boosters?: number; screenMinutes?: number }, base: number) {
  const boosted = d.boost > 0 && base > 0;
  const gained = boosted ? base * 2 : base;
  const from = levelInfo(d.xp).level;
  const to = levelInfo(d.xp + gained).level;
  let freezes = d.freezes;
  const boost = boosted ? d.boost - 1 : d.boost;
  let boosters = d.boosters ?? 0;
  let minutes = 0;
  let freezeGain = 0;
  let boostGain = false;
  for (let l = from + 1; l <= to; l++) {
    minutes += levelMinutes(l);
    if (freezes < MAX_FREEZES) {
      freezes++;
      freezeGain++;
    }
    if (l % 5 === 0) {
      boosters++; // landet im Inventar
      boostGain = true;
    }
  }
  const up: LevelUp | null = to > from ? { from, to, freezes: freezeGain, boost: boostGain, minutes } : null;
  return { xp: d.xp + gained, gained, boosted, freezes, boost, boosters, screenMinutes: (d.screenMinutes ?? 0) + minutes, up };
}
