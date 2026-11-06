// Automatisch erstellte Kurse aus dem mitgelieferten Grundwortschatz
import { Course, Word, uid } from '../store';
import { VOCAB } from './vocab';
import { VOCAB2 } from './vocab2';
import { SENTENCES } from './sentences';

export const GEN_LANGS = [
  { code: 'de', name: 'Deutsch' },
  { code: 'en', name: 'Englisch' },
  { code: 'es', name: 'Spanisch' },
  { code: 'fr', name: 'Französisch' },
  { code: 'it', name: 'Italienisch' },
] as const;
export type LangCode = (typeof GEN_LANGS)[number]['code'];

// Spaltenreihenfolge in vocab.ts und sentences.ts
const COLS: LangCode[] = ['en', 'de', 'es', 'fr', 'it'];

type Row = Record<LangCode, string>;
let rows: Row[] | null = null;
function vocab(): Row[] {
  if (!rows) {
    rows = (VOCAB.trim() + '\n' + VOCAB2.trim())
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter((p) => p.length === COLS.length && p.every(Boolean))
      .map((p) => Object.fromEntries(COLS.map((c, i) => [c, p[i]])) as Row);
  }
  return rows;
}

export const GEN_MAX = () => vocab().length;

export function langName(code: string) {
  return GEN_LANGS.find((l) => l.code === code)?.name ?? code;
}

// Wörter nach Häufigkeit: Rang bestimmt die Schwierigkeit, damit sauber gedrittelt wird
export function generateWords(a: LangCode, b: LangCode, count: number): Word[] {
  const list = vocab().slice(0, count);
  return list.map((r, i) => ({
    id: uid(),
    a: r[a],
    b: r[b],
    k: r.en,
    base: 1 + Math.floor((9 * i) / Math.max(1, list.length)),
    box: 0,
    due: 0,
    right: 0,
    wrong: 0,
  }));
}

// ---------- Lückensätze ----------

type Sentence = { blank: string; keys: string[]; text: Row };
let sents: Sentence[] | null = null;
function sentences(): Sentence[] {
  if (!sents) {
    sents = SENTENCES.trim()
      .split('\n')
      .map((l) => l.split('|').map((x) => x.trim()))
      .filter((p) => p.length === COLS.length + 1)
      .map((p) => {
        const keys = p[0].split(',').map((k) => k.trim());
        return { blank: keys[0], keys, text: Object.fromEntries(COLS.map((c, i) => [c, p[i + 1]])) as Row };
      });
  }
  return sents;
}

const split = (s: string) => {
  const m = s.match(/^(.*)\[(.+?)\](.*)$/);
  return m ? { before: m[1], answer: m[2], after: m[3] } : null;
};
const plain = (s: string) => s.replace(/\[(.+?)\]/g, '$1');

// ---------- Eigene Kurse mit dem Wortschatz abgleichen ----------

const ART = /^(der|die|das|the|a|an|to|el|la|los|las|le|les|il|lo|gli|i|un|une|una|uno)\s+|^(l'|l’)/i;
const normW = (s: string) => s.toLowerCase().replace(ART, '').replace(/\(.*?\)/g, '').trim();
const core = (s: string) => s.replace(ART, '').trim();

export function codeOf(name: string): LangCode | undefined {
  return GEN_LANGS.find((l) => l.name.toLowerCase() === name.trim().toLowerCase())?.code;
}

const indexes: Partial<Record<LangCode, Map<string, string>>> = {};
function index(code: LangCode) {
  if (!indexes[code]) {
    const m = new Map<string, string>();
    vocab().forEach((r) => {
      const k = normW(r[code]);
      if (!m.has(k)) m.set(k, r.en);
    });
    indexes[code] = m;
  }
  return indexes[code]!;
}

// Begriff im Wortschatz für ein (auch selbst eingepflegtes) Wort
function keyOf(w: Word, a?: LangCode, b?: LangCode) {
  if (w.k) return w.k;
  return (a && index(a).get(normW(w.a))) || (b && index(b).get(normW(w.b))) || undefined;
}

// Lückensatz aus einem eigenen Beispielsatz
function ownCloze(c: Course, w: Word) {
  if (!w.ex) return null;
  const target = core(w.a);
  const at = w.ex.toLowerCase().indexOf(target.toLowerCase());
  if (!target || at < 0) return null;
  const others = [...new Set(c.words.filter((x) => x.id !== w.id).map((x) => core(x.a)).filter((x) => x && x.toLowerCase() !== target.toLowerCase()))]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  if (others.length < 2) return null;
  const answer = w.ex.slice(at, at + target.length);
  return {
    before: w.ex.slice(0, at),
    after: w.ex.slice(at + target.length),
    answer,
    translation: w.exT ?? `(${w.b})`,
    options: [answer, ...others].sort(() => Math.random() - 0.5),
    word: w,
  };
}

// Lückensatz für ein Wort: eigener Beispielsatz, sonst eingebaute Sätze, bei denen
// alle übrigen Wörter schon gelernt sind
export function clozeFor(c: Course, w: Word) {
  const own = ownCloze(c, w);
  if (own) return own;

  const a = (c.gen?.a as LangCode | undefined) ?? codeOf(c.langA);
  const b = (c.gen?.b as LangCode | undefined) ?? codeOf(c.langB);
  if (a) {
    const keyed = c.words.map((x) => ({ x, k: keyOf(x, a, b) }));
    const learned = new Set(keyed.filter((e) => e.k && e.x.lp).map((e) => e.k!));
    const inCourse = new Map(keyed.filter((e) => e.k).map((e) => [e.k!, e.x]));
    const wk = keyOf(w, a, b);
    let fits = wk ? sentences().filter((s) => s.blank === wk && s.keys.slice(1).every((k) => learned.has(k))) : [];
    if (fits.length === 0) fits = sentences().filter((s) => s.keys.every((k) => learned.has(k)));
    if (fits.length > 0) {
      const s = fits[Math.floor(Math.random() * fits.length)];
      const parts = split(s.text[a]);
      if (parts) {
        const others = [...new Set(sentences().map((x) => split(x.text[a])?.answer).filter((x): x is string => !!x && x.toLowerCase() !== parts.answer.toLowerCase()))];
        const options = [parts.answer, ...others.sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5);
        return {
          before: parts.before,
          after: parts.after,
          answer: parts.answer,
          translation: b ? plain(s.text[b]) : '',
          options,
          word: inCourse.get(s.blank) ?? w,
        };
      }
    }
  }

  // Sonst: ein eigener Beispielsatz eines schon gelernten Wortes
  const withEx = c.words.filter((x) => x.ex && x.lp && x.id !== w.id).sort(() => Math.random() - 0.5);
  for (const x of withEx) {
    const cz = ownCloze(c, x);
    if (cz) return cz;
  }
  return null;
}

// Kann Memoro für diesen Kurs gerade Lückensätze bilden? Mit Begründung für die Einstellungen.
export function clozeStatus(c: Course): { ready: boolean; reason: string } {
  if (c.words.some((w) => ownCloze(c, w))) return { ready: true, reason: '' };
  const a = (c.gen?.a as LangCode | undefined) ?? codeOf(c.langA);
  const b = (c.gen?.b as LangCode | undefined) ?? codeOf(c.langB);
  if (!a) {
    return {
      ready: false,
      reason: `Für ${c.langA} gibt es keine eingebauten Sätze. Trag in der Vokabelliste zu einigen Wörtern Beispielsätze ein, dann kommen Lückensätze.`,
    };
  }
  const keyed = c.words.map((x) => ({ x, k: keyOf(x, a, b) }));
  const learned = new Set(keyed.filter((e) => e.k && e.x.lp).map((e) => e.k!));
  const inCourse = new Set(keyed.filter((e) => e.k).map((e) => e.k!));
  const ok = sentences().some((s) => inCourse.has(s.blank) && s.keys.slice(1).every((k) => learned.has(k)));
  if (ok) return { ready: true, reason: '' };
  if (inCourse.size < 3) {
    return {
      ready: false,
      reason: 'In deinem Kurs stehen kaum Wörter, die Memoro für Sätze nutzen kann. Trag Beispielsätze in der Vokabelliste ein oder füge Grundwortschatz hinzu.',
    };
  }
  return {
    ready: false,
    reason: `Du kennst noch nicht genug Wörter für Lückensätze. Lern noch ein paar Lektionen weiter (bisher ${learned.size} passende Wörter gelernt), dann tauchen sie automatisch auf.`,
  };
}
