import { Platform } from 'react-native';

// Wird beim Build von GitHub Actions gesetzt (Commit-Hash), lokal leer
export const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID ?? '';

// Prüft am Cache vorbei, ob auf dem Server eine neuere Version liegt
export async function checkForUpdate(): Promise<string | null> {
  if (Platform.OS !== 'web' || !BUILD_ID) return null;
  try {
    const res = await fetch(`/memoro/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const { v } = await res.json();
    return v && v !== BUILD_ID ? v : null;
  } catch {
    return null; // offline: einfach weitermachen
  }
}

const TRIED_KEY = 'memoro:update-tried';

// Wurde diese Version schon einmal automatisch geladen? (Schutz vor Endlosschleife,
// falls der Server kurzzeitig noch die alte Seite ausliefert)
export function alreadyTried(v: string) {
  try {
    return sessionStorage.getItem(TRIED_KEY) === v;
  } catch {
    return false;
  }
}

// Neu laden mit neuer Adresse, damit iOS keine alte Seite aus dem Cache nimmt
export function applyUpdate(v: string) {
  if (Platform.OS !== 'web') return;
  try {
    sessionStorage.setItem(TRIED_KEY, v);
  } catch {}
  window.location.replace(`/memoro/?v=${encodeURIComponent(v.slice(0, 12))}`);
}

// Beim Zurückkehren in die App (Homebildschirm) erneut prüfen
export function onAppVisible(cb: () => void) {
  if (Platform.OS !== 'web') return () => {};
  const handler = () => document.visibilityState === 'visible' && cb();
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('focus', handler);
  window.addEventListener('pageshow', handler);
  const timer = setInterval(cb, 5 * 60 * 1000);
  return () => {
    document.removeEventListener('visibilitychange', handler);
    window.removeEventListener('focus', handler);
    window.removeEventListener('pageshow', handler);
    clearInterval(timer);
  };
}
