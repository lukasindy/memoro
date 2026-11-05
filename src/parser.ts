// Erkennt Wortpaare aus beliebig formatiertem Text (eingefügt oder per Foto erkannt).

export type Pair = { a: string; b: string };

type Sep = { name: string; re: RegExp };

// Reihenfolge = Priorität bei Gleichstand
const SEPARATORS: Sep[] = [
  { name: 'Tab', re: /\t+/ },
  { name: '=', re: /\s*=\s*/ },
  { name: ';', re: /\s*;\s*/ },
  { name: '→', re: /\s*(?:→|->|=>)\s*/ },
  { name: 'Gedankenstrich', re: /\s+[–—]\s+/ },
  { name: 'Bindestrich', re: /\s+-\s+/ },
  { name: ':', re: /\s*:\s+/ },
  { name: 'mehrere Leerzeichen', re: /\s{2,}/ },
  { name: '|', re: /\s*\|\s*/ },
  { name: ',', re: /\s*,\s*/ },
];

function cleanLine(line: string) {
  return line
    .replace(/^\s*(?:\d+[.)]|[-*•·▪◦]|\(\w\))\s+/, '') // Nummerierung, Aufzählungszeichen
    .replace(/\s+$/, '')
    .trim();
}

function splitFirst(line: string, re: RegExp): Pair | null {
  const m = re.exec(line);
  if (!m || m.index === 0) return null;
  const a = line.slice(0, m.index).trim();
  const b = line.slice(m.index + m[0].length).trim();
  if (!a || !b) return null;
  return { a, b };
}

export type ParseResult = { pairs: Pair[]; separator: string; skipped: string[] };

export function parseList(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { pairs: [], separator: '–', skipped: [] };

  // Trennzeichen wählen, das in den meisten Zeilen vorkommt
  let best: Sep | null = null;
  let bestCount = 0;
  for (const sep of SEPARATORS) {
    const count = lines.filter((l) => splitFirst(l, sep.re)).length;
    if (count > bestCount) {
      best = sep;
      bestCount = count;
    }
  }

  // Kein einheitliches Trennzeichen: jede Zeile einzeln mit dem ersten passenden Trennzeichen teilen
  if (!best || bestCount < lines.length * 0.5) {
    const mixed: Pair[] = [];
    const skippedMixed: string[] = [];
    for (const l of lines) {
      let p: Pair | null = null;
      for (const sep of SEPARATORS) {
        p = splitFirst(l, sep.re);
        if (p) break;
      }
      if (p) mixed.push(p);
      else skippedMixed.push(l);
    }
    if (mixed.length >= lines.length * 0.5) {
      return { pairs: dedupe(mixed), separator: 'Gemischt', skipped: skippedMixed };
    }
  }

  // Gar keine Trennzeichen: Zeilen abwechselnd als Wort/Übersetzung lesen
  if (!best || bestCount < lines.length * 0.5) {
    const pairs: Pair[] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) pairs.push({ a: lines[i], b: lines[i + 1] });
    const skipped = lines.length % 2 ? [lines[lines.length - 1]] : [];
    return { pairs, separator: 'Zeilenweise', skipped };
  }

  const pairs: Pair[] = [];
  const skipped: string[] = [];
  for (const l of lines) {
    // Erst das Haupttrennzeichen, für Ausreißer-Zeilen jedes andere
    let p = splitFirst(l, best.re);
    for (const sep of SEPARATORS) {
      if (p) break;
      p = splitFirst(l, sep.re);
    }
    if (p) pairs.push(p);
    else skipped.push(l);
  }
  return { pairs: dedupe(pairs), separator: best.name, skipped };
}

function dedupe(pairs: Pair[]) {
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const k = (p.a + '|' + p.b).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
