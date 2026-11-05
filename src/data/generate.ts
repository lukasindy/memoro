// Automatisch erstellte Kurse aus dem mitgelieferten Grundwortschatz
import { Course, Word, uid } from '../store';
import { VOCAB } from './vocab';
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
    rows = VOCAB.trim()
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

// Lückensatz für ein Wort, aber nur, wenn alle anderen Wörter im Satz schon gelernt sind
export function clozeFor(c: Course, w: Word) {
  if (!c.gen || !w.k) return null;
  const a = c.gen.a as LangCode;
  const b = c.gen.b as LangCode;
  const learned = new Set(c.words.filter((x) => x.lp && x.k).map((x) => x.k!));
  const inCourse = new Set(c.words.filter((x) => x.k).map((x) => x.k!));
  // Zuerst Sätze mit dem neuen Wort als Lücke, sonst Sätze aus lauter bekannten Wörtern
  let fits = sentences().filter((s) => s.blank === w.k && s.keys.slice(1).every((k) => learned.has(k) && inCourse.has(k)));
  if (fits.length === 0) fits = sentences().filter((s) => s.keys.every((k) => learned.has(k) && inCourse.has(k)));
  if (fits.length === 0) return null;
  const s = fits[Math.floor(Math.random() * fits.length)];
  const target = c.words.find((x) => x.k === s.blank) ?? w;
  const parts = split(s.text[a]);
  if (!parts) return null;
  // Falsche Antworten: Lückenwörter aus anderen Sätzen derselben Sprache
  const others = [...new Set(sentences().map((x) => split(x.text[a])?.answer).filter((x): x is string => !!x && x.toLowerCase() !== parts.answer.toLowerCase()))];
  const pick = others.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [parts.answer, ...pick].sort(() => Math.random() - 0.5);
  return { before: parts.before, after: parts.after, answer: parts.answer, translation: plain(s.text[b]), options, word: target };
}
