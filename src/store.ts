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

export type Course = {
  id: string;
  name: string;
  langA: string;
  langB: string;
  words: Word[];
  lessons: number;
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

export async function load(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyData();
    return { ...emptyData(), ...JSON.parse(raw) };
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
