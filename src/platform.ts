import { Platform, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// ---------- Foto → Text ----------
// Web-Testversion: Tesseract.js (läuft im Browser).
// App-Version: wird später durch Apple Vision / Google ML Kit ersetzt.

const LANG_CODES: Record<string, string> = {
  deutsch: 'deu', englisch: 'eng', latein: 'lat', französisch: 'fra', franzoesisch: 'fra',
  spanisch: 'spa', italienisch: 'ita', portugiesisch: 'por', niederländisch: 'nld',
  schwedisch: 'swe', norwegisch: 'nor', dänisch: 'dan', polnisch: 'pol', türkisch: 'tur',
  russisch: 'rus', griechisch: 'ell', kroatisch: 'hrv', tschechisch: 'ces',
};

export function ocrLanguages(...names: string[]) {
  const codes = new Set<string>();
  names.forEach((n) => {
    const c = LANG_CODES[n.trim().toLowerCase()];
    if (c) codes.add(c);
  });
  if (codes.size === 0) ['deu', 'eng'].forEach((c) => codes.add(c));
  return [...codes].join('+');
}

export const ocrAvailable = Platform.OS === 'web';

let tesseractLoading: Promise<any> | null = null;

function loadTesseract(): Promise<any> {
  const w = window as any;
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (!tesseractLoading) {
    tesseractLoading = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      el.onload = () => resolve(w.Tesseract);
      el.onerror = () => {
        tesseractLoading = null;
        reject(new Error('Texterkennung konnte nicht geladen werden. Prüfe die Internetverbindung.'));
      };
      document.head.appendChild(el);
    });
  }
  return tesseractLoading;
}

export async function pickImage(fromCamera: boolean): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  if (fromCamera && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Ohne Kamerazugriff kann kein Foto aufgenommen werden. Erlaube den Zugriff in den Einstellungen.');
  }
  const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  return res.assets[0].uri;
}

export async function recognizeText(uri: string, langs: string, onProgress: (p: number) => void): Promise<string> {
  if (!ocrAvailable) throw new Error('Die Foto-Erkennung folgt in der App-Version.');
  const T = await loadTesseract();
  const result = await T.recognize(uri, langs, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  return result.data.text as string;
}

// ---------- Backup ----------

export async function exportBackup(json: string) {
  const name = `vokabula-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: name, message: json });
}

export function pickBackupFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsText(f);
    };
    input.click();
  });
}

// ---------- Sprachausgabe (Hörübungen) ----------

import * as Speech from 'expo-speech';

const TTS: Record<string, string> = {
  deutsch: 'de-DE', englisch: 'en-US', spanisch: 'es-ES', französisch: 'fr-FR', franzoesisch: 'fr-FR',
  italienisch: 'it-IT', portugiesisch: 'pt-PT', niederländisch: 'nl-NL', schwedisch: 'sv-SE',
  norwegisch: 'nb-NO', dänisch: 'da-DK', polnisch: 'pl-PL', türkisch: 'tr-TR', russisch: 'ru-RU',
  griechisch: 'el-GR', kroatisch: 'hr-HR', tschechisch: 'cs-CZ',
  english: 'en-US', german: 'de-DE', spanish: 'es-ES', french: 'fr-FR', italian: 'it-IT', portuguese: 'pt-PT', dutch: 'nl-NL',
  swedish: 'sv-SE', norwegian: 'nb-NO', danish: 'da-DK', polish: 'pl-PL', turkish: 'tr-TR', russian: 'ru-RU', greek: 'el-GR',
  croatian: 'hr-HR', czech: 'cs-CZ', latin: 'it-IT',
  latein: 'it-IT', // keine Latein-Stimme verfügbar: italienische Aussprache kommt am nächsten
};

export function ttsLang(name: string) {
  return TTS[name.trim().toLowerCase()] ?? null;
}

// Gibt es eine Sprachausgabe für diese Sprache?
export function canSpeak(name: string) {
  if (!ttsLang(name)) return false;
  if (Platform.OS === 'web') return typeof window !== 'undefined' && 'speechSynthesis' in window;
  return true;
}

// Beste verfügbare Stimme je Sprache: hochwertige ("Natural", "Neural", "Enhanced", "Premium",
// Google-Netzstimmen) vor einfachen Standard- und Kompaktstimmen.
type Voice = { identifier: string; name: string; language: string; quality?: string };
const voiceCache: Record<string, string | null> = {};

function score(v: Voice) {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/^alice/.test(n)) s += 200; // Standardstimme
  if (/natural|neural|online/.test(n)) s += 50;
  if (/premium|enhanced|siri/.test(n) || v.quality === 'Enhanced') s += 40;
  if (/google/.test(n)) s += 30;
  if (/compact|eloquence|espeak|novelty|zarvox|whisper|bad |good news|bells|bubbles|cellos|organ|trinoids|boing|albert|junior|ralph|kathy|fred/.test(n)) s -= 60;
  return s;
}

// Selbst gewählte Stimme je Sprache (bleibt gespeichert)
const prefKey = (language: string) => `memoro:voice:${language}`;
export function savedVoice(language: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(prefKey(language)) : null;
  } catch {
    return null;
  }
}
export function chooseVoice(langName: string, id: string | null) {
  const language = ttsLang(langName);
  if (!language) return;
  try {
    if (typeof localStorage !== 'undefined') {
      if (id) localStorage.setItem(prefKey(language), id);
      else localStorage.removeItem(prefKey(language));
    }
  } catch {
    // ohne Speicher: Auswahl gilt nur bis zum Schließen
  }
  delete voiceCache[language];
}

export type VoiceOption = { id: string; name: string; tag: string; best: boolean };

// Alle Stimmen für die Sprache, die beste zuerst
export async function listVoices(langName: string): Promise<VoiceOption[]> {
  const language = ttsLang(langName);
  if (!language) return [];
  try {
    const all = ((await Speech.getAvailableVoicesAsync()) as Voice[]) ?? [];
    const lang = language.toLowerCase().replace('_', '-');
    const base = lang.split('-')[0];
    const pool = all.filter((v) => v.language.toLowerCase().replace('_', '-').startsWith(base));
    // Nur brauchbare Stimmen anbieten (keine Kompakt-/Spaßstimmen), falls es welche gibt
    const good = pool.filter((v) => score(v) > -60);
    const sorted = [...(good.length > 0 ? good : pool)].sort((x, y) => score(y) - score(x));
    return sorted.map((v, i) => {
      const n = v.name.toLowerCase();
      const tag = /premium/.test(n) ? 'Premium' : /enhanced/.test(n) || v.quality === 'Enhanced' ? 'Verbessert' : /natural|neural|online/.test(n) ? 'Natürlich' : /compact/.test(n) ? 'Kompakt' : 'Standard';
      return { id: v.identifier, name: v.name, tag, best: i === 0 };
    });
  } catch {
    return [];
  }
}

async function bestVoice(language: string): Promise<string | undefined> {
  if (language in voiceCache) return voiceCache[language] ?? undefined;
  try {
    const all = ((await Speech.getAvailableVoicesAsync()) as Voice[]) ?? [];
    const lang = language.toLowerCase().replace('_', '-');
    const base = lang.split('-')[0];
    const exact = all.filter((v) => v.language.toLowerCase().replace('_', '-') === lang);
    const pool = exact.length > 0 ? exact : all.filter((v) => v.language.toLowerCase().startsWith(base));
    const best = [...pool].sort((x, y) => score(y) - score(x))[0];
    voiceCache[language] = best && score(best) > -60 ? best.identifier : null;
  } catch {
    voiceCache[language] = null;
  }
  return voiceCache[language] ?? undefined;
}

// Stimmenliste wird im Browser oft erst nach dem Start geladen: Cache dann neu aufbauen
if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    Object.keys(voiceCache).forEach((k) => delete voiceCache[k]);
  };
}

export async function speak(text: string, langName: string) {
  const language = ttsLang(langName) ?? undefined;
  const voice = language ? await bestVoice(language) : undefined;
  Speech.stop();
  Speech.speak(text, { language, voice, rate: 0.9, pitch: 1 });
}
