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

export type LessonDef = {
  id: string;
  kind: 'lesson' | 'test';
  wordIds: string[];
  done: boolean;
  best: number; // beste Prozentzahl, 0 = noch nicht gemacht
};

export type Unit = {
  id: string;
  title: string;
  lessons: LessonDef[];
};

export type Course = {
  id: string;
  name: string;
  langA: string;
  langB: string;
  words: Word[];
  units: Unit[];
  mix: Mix;
  wordsPerLesson: number;
  lessons: number; // Anzahl absolvierter Lektionen
  createdAt: number;
};

export type AppData = {
  version: 1;
  courses: Course[];
  xp: number;
  streak: { day: string; count: number };
  premium: boolean; // Testschalter, später In-App-Kauf
};

const KEY = 'memoro:data';

export const emptyData = (): AppData => ({
  version: 1,
  courses: [],
  xp: 0,
  streak: { day: '', count: 0 },
  premium: false,
});

// Ältere Daten (ohne Lernpfad) auf das aktuelle Format bringen
export function migrate(d: AppData): AppData {
  return {
    ...emptyData(),
    ...d,
    courses: (d.courses ?? []).map((c: any) => ({
      ...c,
      mix: { ...DEFAULT_MIX, ...(c.mix ?? {}) },
      wordsPerLesson: c.wordsPerLesson ?? DEFAULT_WORDS_PER_LESSON,
      units: c.units ?? [],
      lessons: c.lessons ?? 0,
    })),
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

export const FREE_COURSE_LIMIT = 3;
