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
  const name = `memoro-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
