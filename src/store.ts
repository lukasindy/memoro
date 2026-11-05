import AsyncStorage from '@react-native-async-storage/async-storage';

export type Word = {
  id: string;
  a: string; // Fremdsprache
  b: string; // Muttersprache
  base: number; // geschätzte Grundschwierigkeit 1–10
  box: number; // Leitner-Fach: 0 = neu, 1–5
  due: number; // Zeitstempel der nächsten Wiederholung
  right: number;
  wrong: number;
  lp?: boolean; // im Lernpfad in einer Lektion gelernt
  ut?: boolean; // Mini-Prüfung bestanden
  se?: boolean; // Abschnittsprüfung bestanden
};

// Wie oft jede Übung in einer Lektion vorkommt
export type Mix = {
  ab: number; // Lernsprache → eigene Sprache (Auswahl)
  ba: number; // eigene Sprache → Lernsprache (Auswahl)
  pairs: number; // Paare finden
  spelling: number; // richtige Schreibweise wählen
};

export const DEFAULT_MIX: Mix = { ab: 3, ba: 4, pairs: 2, spelling: 2 };
export const DEFAULT_WORDS_PER_LESSON = 5;

export const DEFAULT_LESSONS_PER_UNIT = 4;

export type Course = {
  id: string;
  name: string;
  langA: string;
  langB: string;
  words: Word[];
  mix: Mix;
  wordsPerLesson: number;
  lessonsPerUnit: number;
  best: Record<string, number>; // beste Prozentzahl je Lernpfad-Knoten
  pending: { a: string; b: string }[]; // wegen Gratis-Limit geparkte Wörter
  lessons: number; // Anzahl absolvierter Lektionen
  createdAt: number;
};

export type AppData = {
  version: 1;
  courses: Course[];
  xp: number;
  streak: { day: string; count: number };
  freezes: number; // Streak-Schutz: rettet einen verpassten Tag
  streakSaved: string; // Tag, an dem zuletzt ein Streak-Schutz eingesetzt wurde
  boost: number; // Lektionen mit doppelten XP (aktiver Booster)
  boosters: number; // XP-Booster im Inventar, noch nicht aktiviert
  screenMinutes: number; // Social-Media-Zeit-Guthaben in Minuten
  screenUntil: number; // Ende der eingelösten Social-Media-Zeit (Zeitstempel)
  premium: boolean; // Testschalter, später In-App-Kauf
};

const KEY = 'memoro:data';

export const emptyData = (): AppData => ({
  version: 1,
  courses: [],
  xp: 0,
  streak: { day: '', count: 0 },
  freezes: 0,
  streakSaved: '',
  boost: 0,
  boosters: 0,
  screenMinutes: 0,
  screenUntil: 0,
  premium: false,
});

// Ältere Daten auf das aktuelle Format bringen
export function migrate(d: AppData): AppData {
  return {
    ...emptyData(),
    ...d,
    courses: (d.courses ?? []).map((c: any) => {
      // Version 0.2: Fortschritt aus den alten Einheiten auf die Wörter übertragen
      const learned = new Set<string>();
      const tested = new Set<string>();
      (c.units ?? []).forEach((u: any) =>
        (u.lessons ?? []).forEach((l: any) => {
          if (!l.done) return;
          (l.wordIds ?? []).forEach((id: string) => (l.kind === 'test' ? tested : learned).add(id));
        }),
      );
      const { units, ...rest } = c;
      return {
        ...rest,
        words: (c.words ?? []).map((w: Word) => ({
          ...w,
          lp: w.lp || learned.has(w.id) || tested.has(w.id),
          ut: w.ut || tested.has(w.id),
        })),
        mix: { ...DEFAULT_MIX, ...(c.mix ?? {}) },
        wordsPerLesson: c.wordsPerLesson ?? DEFAULT_WORDS_PER_LESSON,
        lessonsPerUnit: c.lessonsPerUnit ?? DEFAULT_LESSONS_PER_UNIT,
        best: c.best ?? {},
        pending: c.pending ?? [],
        lessons: c.lessons ?? 0,
      };
    }),
  };
}

export async function load(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyData();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export async function save(data: AppData) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Speicher voll oder nicht verfügbar – Daten bleiben im Arbeitsspeicher
  }
}

export function isValidBackup(x: any): x is AppData {
  return x && x.version === 1 && Array.isArray(x.courses);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Gratis-Version: ein Kurs, bis zu 1000 Wörter
export const FREE_COURSE_LIMIT = 1;
export const FREE_WORD_LIMIT = 1000;
