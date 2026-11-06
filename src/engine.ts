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
  return { id: uid(), a: p.a, b: p.b, ...(p.ex ? { ex: p.ex } : {}), ...(p.exT ? { exT: p.exT } : {}), base: estimateDifficulty(p.a, p.b), box: 0, due: 0, right: 0, wrong: 0 };
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
  | { kind: 'choice'; word: Word; dir: 'ab' | 'ba'; prompt: string; options: string[]; answer: string; isNew: boolean; old?: boolean }
  | { kind: 'spelling'; word: Word; prompt: string; options: string[]; answer: string }
  | { kind: 'pairs'; words: Word[] }
  | { kind: 'listen'; word: Word; prompt: string; options: string[]; answer: string }
  | { kind: 'build'; word: Word; prompt: string; prefix: string; answer: string; tiles: string[] }
  | { kind: 'cloze'; word: Word; before: string; after: string; translation: string; options: string[]; answer: string };

// Lückensatz-Daten, die von außen (mitgelieferte Sätze) kommen
export type Cloze = { before: string; after: string; translation: string; answer: string; options: string[]; word?: Word };
export type BuildOpts = { cloze?: (w: Word) => Cloze | null; old?: Word[]; canListen?: boolean };

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

function listen(c: Course, w: Word): Exercise {
  const options = shuffle([w.b, ...distractors(c, w, 'b')]);
  return { kind: 'listen', word: w, prompt: w.a, options, answer: w.b };
}

// Artikel abtrennen, damit nur das eigentliche Wort gepuzzelt wird
const LEADING_ARTICLE = /^(der|die|das|the|a|an|to|el|la|los|las|le|les|il|lo|gli|i|un|une|una|uno)\s+|^(l'|l’)/i;

function build(c: Course, w: Word): Exercise {
  const m = w.a.match(LEADING_ARTICLE);
  const prefix = m ? m[0] : '';
  const core = w.a.slice(prefix.length).trim();
  const letters = [...core.replace(/\s+/g, ' ')];
  if (letters.length < 3 || letters.length > 14) return choice(c, w, 'ba', false);
  let tiles = shuffle(letters);
  for (let k = 0; k < 5 && tiles.join('') === core; k++) tiles = shuffle(letters);
  return { kind: 'build', word: w, prompt: w.b, prefix, answer: core, tiles };
}

// Bereits gelernte Wörter für die Wiederholung in neuen Lektionen
export function oldWordsFor(c: Course, exclude: Word[], count: number): Word[] {
  const skip = new Set(exclude.map((w) => w.id));
  const learned = c.words.filter((w) => w.lp && !skip.has(w.id));
  // Unsichere und lange nicht gesehene Wörter bevorzugen, mit etwas Zufall
  return learned
    .map((w) => ({ w, s: w.box * 2 + w.due / 864e5 / 7 - effective(w) + Math.random() * 4 }))
    .sort((x, y) => x.s - y.s)
    .slice(0, count)
    .map((x) => x.w);
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
  return { ab: s(mix.ab), ba: s(mix.ba), pairs: s(mix.pairs), spelling: s(mix.spelling), listen: s(mix.listen), build: s(mix.build), cloze: s(mix.cloze) };
}

// Baut eine Lektion aus den Wörtern nach dem eingestellten Übungsmix
export function buildMixed(c: Course, words: Word[], mix: Mix, opts: BuildOpts = {}): Exercise[] {
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
  for (let k = 0; k < (mix.listen ?? 0); k++) {
    const w = next();
    rest.push(opts.canListen ? listen(c, w) : choice(c, w, 'ab', false));
  }
  for (let k = 0; k < (mix.build ?? 0); k++) rest.push(build(c, next()));
  // Lückensätze nur, wenn es passende Sätze mit bekannten Wörtern gibt
  for (let k = 0, tries = 0; k < (mix.cloze ?? 0) && opts.cloze && tries < words.length; tries++) {
    const w = next();
    const cz = opts.cloze(w);
    if (cz) {
      const { word: target, ...rest2 } = cz;
      rest.push({ kind: 'cloze', word: target ?? w, ...rest2 });
      k++;
    }
  }
  // Ein paar zufällige alte Wörter zur Wiederholung einstreuen
  (opts.old ?? []).forEach((w) => rest.push({ ...(choice(c, w, Math.random() < 0.5 ? 'ab' : 'ba', false) as Extract<Exercise, { kind: 'choice' }>), old: true }));
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
  const byId = new Map(c.words.map((w) => [w.id, w]));
  const flags = (ids: string[], f: 'lp' | 'ut' | 'se') => ids.every((id) => byId.get(id)?.[f]);

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
    // Exakt dritteln: 1000 Wörter ergeben 333 / 333 / 334
    const words = sorted.slice(Math.round((n * si) / count), Math.round((n * (si + 1)) / count));
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

export type LevelUp = { from: number; to: number; freezes: number; boost: boolean; minutes: number; shields: number; title: string | null };

export const MAX_SHIELDS = 5;
export const GOAL_BONUS = 20; // Bonus-XP fürs Erreichen des Tagesziels
export const COMBO_STEP = 5; // alle 5 richtigen Antworten in Folge gibt es Bonus-XP
export const COMBO_BONUS = 5;

const TITLES = ['Neuling', 'Wortsammler', 'Vokabelfuchs', 'Wörterjäger', 'Sprachtalent', 'Wortakrobat', 'Vokabelprofi', 'Sprachmeister', 'Wortmagier', 'Legende'];
export const levelTitle = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))];

// Tagesziel: selbst gewählt, sonst automatisch passend zum Level
export function goalTarget(d: { goal: number; xp: number }) {
  if (d.goal > 0) return d.goal;
  return Math.min(150, 40 + levelInfo(d.xp).level * 10);
}

// Belohnungen für Serien (Tage in Folge)
export type StreakReward = { days: number; freezes: number; boosters: number; minutes: number; shields: number };
export const STREAK_REWARDS: StreakReward[] = [
  { days: 3, freezes: 0, boosters: 0, minutes: 5, shields: 1 },
  { days: 7, freezes: 1, boosters: 1, minutes: 10, shields: 0 },
  { days: 14, freezes: 0, boosters: 1, minutes: 15, shields: 1 },
  { days: 30, freezes: 2, boosters: 2, minutes: 30, shields: 2 },
  { days: 60, freezes: 0, boosters: 2, minutes: 45, shields: 2 },
  { days: 100, freezes: 3, boosters: 3, minutes: 60, shields: 3 },
];

// Social-Media-Zeit pro Level: normal 5, jedes 5. Level 10, jedes 10. Level 30 Minuten
export function levelMinutes(level: number) {
  return level % 10 === 0 ? 30 : level % 5 === 0 ? 10 : 5;
}

// Nächste Level-Belohnungen für die Vorschau im Inventar
export function upcomingRewards(level: number, count = 5) {
  return Array.from({ length: count }, (_, k) => {
    const l = level + 1 + k;
    return { level: l, booster: l % 5 === 0, minutes: levelMinutes(l), shield: l % 2 === 0, title: levelTitle(l) !== levelTitle(l - 1) ? levelTitle(l) : null };
  });
}

// XP gutschreiben (mit Booster doppelt) und Level-Boni vergeben
export function gainXp(d: { xp: number; freezes: number; boost: number; boosters?: number; screenMinutes?: number; shields?: number }, base: number) {
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
  let shields = d.shields ?? 0;
  let shieldGain = 0;
  for (let l = from + 1; l <= to; l++) {
    if (l % 2 === 0 && shields < MAX_SHIELDS) {
      shields++;
      shieldGain++;
    }
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
  const up: LevelUp | null =
    to > from ? { from, to, freezes: freezeGain, boost: boostGain, minutes, shields: shieldGain, title: levelTitle(to) !== levelTitle(from) ? levelTitle(to) : null } : null;
  return { xp: d.xp + gained, gained, boosted, freezes, boost, boosters, shields, screenMinutes: (d.screenMinutes ?? 0) + minutes, up };
}

export type Extra = { goal: boolean; reward: StreakReward | null; combo: number };

// XP gutschreiben und alles daran Hängende berechnen: Level, Tagesziel, Serie, Serien-Belohnungen.
// Wird für die Anzeige und (mit dem aktuellen Stand) beim Speichern aufgerufen.
export function settleXp(d: AppData, base: number) {
  const today = todayKey();
  const daily0 = d.daily?.day === today ? d.daily : { day: today, xp: 0, done: false };
  // Das XP-Tagesziel gibt es nicht mehr – stattdessen das Lernziel mit Datum (pro Kurs)
  const g = gainXp(d, base);
  const reached = false;
  const daily = { day: today, xp: daily0.xp + g.gained, done: daily0.done || reached };
  const st = nextStreak(d.streak, g.freezes);
  let freezes = g.freezes - st.used;
  let boosters = g.boosters;
  let screenMinutes = g.screenMinutes;
  let shields = g.shields;
  let claimed = d.streakClaimed ?? 0;
  if (st.streak.count <= 1) claimed = 0;
  let reward: StreakReward | null = null;
  if (st.streak.day !== d.streak.day) {
    for (const r of STREAK_REWARDS) {
      if (r.days <= st.streak.count && r.days > claimed) {
        reward = reward
          ? { days: r.days, freezes: reward.freezes + r.freezes, boosters: reward.boosters + r.boosters, minutes: reward.minutes + r.minutes, shields: reward.shields + r.shields }
          : { ...r };
        claimed = r.days;
      }
    }
  }
  if (reward) {
    freezes = Math.min(MAX_FREEZES, freezes + reward.freezes);
    boosters += reward.boosters;
    screenMinutes += reward.minutes;
    shields = Math.min(MAX_SHIELDS, shields + reward.shields);
  }
  const patch = {
    xp: g.xp,
    freezes,
    boost: g.boost,
    boosters,
    screenMinutes,
    shields,
    streak: st.streak,
    streakSaved: st.used > 0 ? today : d.streakSaved,
    daily,
    streakClaimed: claimed,
  };
  return { g, patch, reached, reward };
}

// ---------- Lernziel (Datum, bis wann alle Wörter gelernt sein sollen) ----------

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

// "24.12.2026", "24.12.26" oder "24.12." (dann das nächste Mal) -> "2026-12-24"
export function parseDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})?$/);
  if (!m) return null;
  const day = +m[1];
  const mon = +m[2];
  let year = m[3] ? +m[3] : new Date().getUTCFullYear();
  if (year < 100) year += 2000;
  const iso = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() + 1 !== mon) return null;
  if (!m[3] && iso < todayKey()) return addMonths(iso, 12);
  return iso;
}

export function targetPlan(c: Course) {
  const t = c.target;
  if (!t) return null;
  const total = c.words.length + (c.pending?.length ?? 0);
  const learned = c.words.filter((w) => w.lp).length;
  const remaining = Math.max(0, total - learned);
  const today = todayKey();
  const daysLeft = Math.max(0, daysBetween(today, t.date));
  const perDay = remaining === 0 ? 0 : Math.ceil(remaining / Math.max(1, daysLeft));
  const span = Math.max(1, daysBetween(t.start, t.date));
  const elapsed = Math.min(span, Math.max(0, daysBetween(t.start, today)));
  const expected = t.startLearned + ((total - t.startLearned) * elapsed) / span;
  const behind = Math.max(0, Math.ceil(expected - learned));
  return { total, learned, remaining, daysLeft, perDay, behind, overdue: daysLeft === 0 && remaining > 0 && today > t.date };
}
