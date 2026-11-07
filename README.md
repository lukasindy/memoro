# Vokabula

Vokabeltrainer mit eigenen Wortlisten. Listen in beliebigem Format einfügen oder abfotografieren, Vokabula baut daraus Lektionen von leicht bis schwer und wiederholt nach dem Leitner-System.

## Stand (MVP 0.1)

- Kurse mit Lernsprache und eigener Sprache
- Listen einfügen, Format wird automatisch erkannt (`;` `-` `–` `=` `:` Tab, mehrere Leerzeichen, abwechselnde Zeilen, gemischt), Vorschau zum Korrigieren
- Foto-Import (Premium): Web-Version per Tesseract.js, App-Version später mit Apple Vision / Google ML Kit
- Schwierigkeit wird pro Wort geschätzt (Länge, Ähnlichkeit zur Übersetzung) und passt sich an deine Fehler an
- Lektionen: neue Wörter von leicht nach schwer, Wiederholungen fälliger Wörter, Übungen Auswahl in beide Richtungen, Schreibweise, Paare finden
- Karteikasten mit 5 Fächern (Wiederholung nach 1, 2, 4, 8, 16 Tagen)
- XP, Tage in Folge, Stufen Leicht/Mittel/Schwer, Statistik (Premium)
- Premium-Testschalter in den Einstellungen, Backup als Datei

## Entwicklung

```bash
npm install
npx expo start --web     # im Browser testen
npx expo start           # mit Expo Go auf dem Handy testen
```

## Web-Testversion

Jeder Push auf `main` baut die Web-Version und veröffentlicht sie über GitHub Pages unter `https://<benutzer>.github.io/memoro/`.
Einmalig nötig: Repo → Settings → Pages → Source: **GitHub Actions**.

Der Pfad `/memoro` ist in `app.json` unter `experiments.baseUrl` hinterlegt. Bei anderem Repo-Namen dort anpassen.

## Später: App Store / Play Store

```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```

Vorher: Apple Developer Account, Google Play Console, In-App-Käufe (z. B. RevenueCat), native Texterkennung, Datenschutzerklärung.

## Projektstruktur

```
App.tsx               Navigation und Datenhaltung
src/store.ts          Datenmodell, Speicherung
src/parser.ts         Listenerkennung
src/engine.ts         Schwierigkeit, Leitner, Lektionsgenerator
src/platform.ts       Foto-Erkennung, Backup
src/ui.tsx            Farben, Bausteine, Karteikasten
src/screens/          Bildschirme
```
