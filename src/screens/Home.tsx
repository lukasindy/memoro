import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenProps } from '../nav';
import { Btn, Field, H1, H2, P, Panel, Progress, TopBar, confirm, notify, useTheme } from '../ui';
import { MIN_WORDS, buildPath, levelInfo } from '../engine';
import { GEN_LANGS, GEN_MAX, LangCode, generateWords, langName } from '../data/generate';
import { releasePending } from '../engine';
import { DEFAULT_LESSONS_PER_UNIT, DEFAULT_MIX, DEFAULT_WORDS_PER_LESSON, FREE_COURSE_LIMIT, FREE_WORD_LIMIT, isValidBackup, emptyData, migrate, uid } from '../store';
import { exportBackup, pickBackupFile } from '../platform';
import { BUILD_ID } from '../update';
import { Platform } from 'react-native';

// Schnellwahl bei der Kurserstellung. Bewusst nur diese vier Stufen und auch dann so lassen, wenn der
// Wortschatz weiter wächst (aktuell rund 3000 Wörter). Größere oder genaue Mengen gibt man von Hand ein.
const QUICK_PICKS = [150, 300, 600, 1000];

// Nur Web: Fenstergröße und Ränder anzeigen (Fehlersuche für die iPhone-Ansicht)
function viewportInfo() {
  try {
    const w: any = window;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const top = cs.paddingTop;
    const bottom = cs.paddingBottom;
    document.body.removeChild(el);
    return `Fenster ${w.innerWidth}×${w.innerHeight} · Bildschirm ${w.screen.width}×${w.screen.height} · Rand oben ${top} unten ${bottom} · ${w.navigator.standalone ? 'App' : 'Browser'} · App-Höhe ${document.documentElement.style.getPropertyValue('--app-h') || '–'}`;
  } catch {
    return '';
  }
}

// Begrüßungsfeld in beiden Farbmodi gleich: Tafelgrün mit weißer Schrift
const HERO_BG = '#1F5E4E';
const HERO_INK = '#FFFFFF';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Noch wach?';
  if (h < 11) return 'Guten Morgen!';
  if (h < 17) return 'Schön, dass du da bist!';
  if (h < 22) return 'Guten Abend!';
  return 'Noch eine Runde?';
}

function motto(streak: number, hasCourses: boolean) {
  if (!hasCourses) return 'Lerne genau die Wörter, die du brauchst, aus deinem Buch, deinem Heft oder deiner Liste.';
  if (streak >= 7) return `${streak} Tage am Stück, stark! Bleib dran.`;
  if (streak >= 2) return `Schon ${streak} Tage in Folge. Mach heute weiter!`;
  return 'Ein paar Minuten am Tag reichen, damit die Wörter hängen bleiben.';
}

// Kleiner Karteikasten als Illustration im Begrüßungsbereich
function HeroCards() {
  const t = useTheme();
  return (
    <View style={{ width: 92, height: 80 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', left: 6, top: 4, width: 58, height: 42, borderRadius: 7, backgroundColor: t.card, opacity: 0.75, transform: [{ rotate: '-10deg' }] }} />
      <View style={{ position: 'absolute', left: 26, top: 10, width: 58, height: 42, borderRadius: 7, backgroundColor: t.card, transform: [{ rotate: '6deg' }] }}>
        <View style={{ position: 'absolute', left: 8, right: 8, top: 10, height: 2, backgroundColor: 'rgba(0,0,0,0.15)' }} />
        <View style={{ position: 'absolute', left: 8, right: 18, top: 18, height: 2, backgroundColor: 'rgba(0,0,0,0.15)' }} />
      </View>
      <View style={{ position: 'absolute', left: 4, right: 4, bottom: 0, height: 34, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 22, height: 5, borderRadius: 3, backgroundColor: t.primary }} />
      </View>
    </View>
  );
}

export function Home({ data, go }: ScreenProps) {
  const t = useTheme();
  const has = data.courses.length > 0;
  const lv = levelInfo(data.xp);
  return (
    <View style={{ gap: 22 }}>
      {/* Kopfzeile: Premium + Einstellungen */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <Text style={{ color: t.primary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>Memoro</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={data.premium ? 'Premium ist aktiv' : 'Premium holen'}
            onPress={() => go({ name: 'premium', reason: 'Hol dir mehr aus Memoro heraus.' })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: t.card,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name={data.premium ? 'checkmark-circle' : 'diamond'} size={16} color={t.onCard} />
            <Text style={{ color: t.onCard, fontWeight: '800', fontSize: 14 }}>{data.premium ? 'Premium aktiv' : 'Premium'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Inventar${data.boosters || data.screenMinutes ? ', es liegt etwas bereit' : ''}`}
            onPress={() => go({ name: 'inventory' })}
            hitSlop={8}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="bag-handle" size={20} color={t.ink} />
            {(data.boosters > 0 || data.screenMinutes > 0) && (
              <View style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8742C', borderWidth: 2, borderColor: t.surface }} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Einstellungen"
            onPress={() => go({ name: 'settings' })}
            hitSlop={8}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, opacity: pressed ? 0.8 : 1 })}
          >
            <Ionicons name="options-outline" size={20} color={t.ink} />
          </Pressable>
        </View>
      </View>

      {/* Begrüßung */}
      <View style={{ backgroundColor: HERO_BG, borderRadius: 26, padding: 20, gap: 18, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: HERO_INK, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 33 }}>{greeting()}</Text>
            <Text style={{ color: HERO_INK, opacity: 0.88, fontSize: 15, lineHeight: 21 }}>{motto(data.streak.count, has)}</Text>
          </View>
          <HeroCards />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Streak */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="flame" size={18} color={t.onCard} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: HERO_INK, fontSize: 20, fontWeight: '900' }}>{data.streak.count}</Text>
              <Text style={{ color: HERO_INK, opacity: 0.85, fontSize: 12 }}>
                {data.streak.count === 1 ? 'Tag in Folge' : 'Tage in Folge'}
                {data.freezes > 0 ? ` · ${data.freezes}× Schutz` : ''}
              </Text>
            </View>
          </View>
          {/* Level */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.onCard, fontSize: 15, fontWeight: '900' }}>{lv.level}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: HERO_INK, fontSize: 14, fontWeight: '900' }}>Level {lv.level}</Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${Math.round(lv.progress * 100)}%`, backgroundColor: t.card }} />
              </View>
              <Text style={{ color: HERO_INK, opacity: 0.85, fontSize: 11 }}>
                {data.xp} XP{data.boost > 0 ? ` · Booster ×2` : ''}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {!has ? (
        <Panel style={{ gap: 16 }}>
          <H2>So einfach geht’s</H2>
          {[
            { icon: 'add-circle' as const, title: 'Kurs anlegen', text: 'z. B. „Latein Kapitel 1–5“ oder „Englisch Business“' },
            { icon: 'clipboard' as const, title: 'Liste einfügen', text: 'Egal welches Format, Memoro erkennt Wort und Übersetzung' },
            { icon: 'map' as const, title: 'Loslernen', text: 'Lektionen von leicht bis schwer, mit Mini-Prüfungen' },
          ].map((x, k) => (
            <View key={x.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.lvl[k], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={x.icon} size={22} color={t.onLvl} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{x.title}</Text>
                <Text style={{ color: t.muted, fontSize: 14 }}>{x.text}</Text>
              </View>
            </View>
          ))}
          <Btn label="Ersten Kurs anlegen" onPress={() => go({ name: 'newCourse' })} />
        </Panel>
      ) : (
        <View style={{ gap: 14 }}>
          <H2>Deine Kurse</H2>
          {data.courses.map((c) => {
            const path = buildPath(c);
            const done = path.reduce((n, x) => n + x.done, 0);
            const total = path.reduce((n, x) => n + x.total, 0);
            const current = path.find((x) => x.status === 'current');
            const color = current ? t.lvl[current.level] : t.primary;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} öffnen`} onPress={() => go({ name: 'course', id: c.id })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
                  <View style={{ height: 6, backgroundColor: color }} />
                  <View style={{ padding: 18, gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: t.onLvl, fontSize: 22, fontWeight: '900' }}>{c.langA.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>{c.name}</Text>
                        <Text style={{ color: t.muted, fontSize: 14 }}>
                          {c.words.length} Wörter · {current ? `Stufe ${current.name}` : total ? 'alles geschafft' : 'noch leer'}
                        </Text>
                      </View>
                      <Text style={{ color, fontSize: 18, fontWeight: '900' }}>{pct} %</Text>
                    </View>
                    <Progress value={total ? done / total : 0} color={color} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color, borderRadius: 14, minHeight: 48 }}>
                      <Ionicons name={c.words.length ? 'play' : 'add'} size={18} color={t.onLvl} />
                      <Text style={{ color: t.onLvl, fontSize: 16, fontWeight: '800' }}>{c.words.length ? 'Weiterlernen' : 'Wörter hinzufügen'}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={() => go({ name: 'newCourse' })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: t.line, minHeight: 56, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="add" size={20} color={t.primary} />
            <Text style={{ color: t.primary, fontSize: 16, fontWeight: '800' }}>Neuen Kurs anlegen</Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

export function NewCourse({ data, update, back, replace, go }: ScreenProps) {
  const t = useTheme();
  const [mode, setMode] = useState<'own' | 'auto'>('own');
  const [name, setName] = useState('');
  const [langA, setLangA] = useState('');
  const [langB, setLangB] = useState('Deutsch');
  const [genA, setGenA] = useState<LangCode>('en');
  const [genB, setGenB] = useState<LangCode>('de');
  const max = GEN_MAX();
  const [count, setCount] = useState(Math.min(FREE_WORD_LIMIT, max));
  const [countText, setCountText] = useState('');
  const limitReached = !data.premium && data.courses.length >= FREE_COURSE_LIMIT;
  const cap = data.premium ? max : Math.min(FREE_WORD_LIMIT, max); // Gratis: bis 1000 Wörter
  const amount = Math.min(count, cap);
  const thirds = [0, 1, 2].map((i) => Math.round((amount * (i + 1)) / 3) - Math.round((amount * i) / 3));

  const blocked = () => {
    if (!limitReached) return false;
    replace({ name: 'premium', reason: 'In der Gratis-Version ist ein Kurs möglich. Mit Premium legst du beliebig viele an.' });
    return true;
  };

  const base = { pending: [], mix: { ...DEFAULT_MIX }, wordsPerLesson: DEFAULT_WORDS_PER_LESSON, lessonsPerUnit: DEFAULT_LESSONS_PER_UNIT, best: {}, lessons: 0, createdAt: Date.now() };

  const create = () => {
    if (blocked()) return;
    const id = uid();
    update((d) => ({
      ...d,
      courses: [...d.courses, { id, name: name.trim(), langA: langA.trim() || 'Fremdsprache', langB: langB.trim() || 'Deutsch', words: [], ...base }],
    }));
    replace({ name: 'course', id });
    go({ name: 'add', id });
  };

  const generate = () => {
    if (blocked()) return;
    const id = uid();
    const words = generateWords(genA, genB, amount);
    update((d) => ({
      ...d,
      courses: [...d.courses, { id, name: `${langName(genA)} Grundwortschatz`, langA: langName(genA), langB: langName(genB), words, gen: { a: genA, b: genB }, ...base }],
    }));
    replace({ name: 'course', id });
  };

  const chips = (value: LangCode, set: (c: LangCode) => void, exclude: LangCode) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {GEN_LANGS.filter((l) => l.code !== exclude).map((l) => {
        const on = l.code === value;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => set(l.code)}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primary : t.surface }}
          >
            <Text style={{ color: on ? t.onPrimary : t.ink, fontWeight: '800', fontSize: 15 }}>{l.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <H1>Neuer Kurs</H1>

      <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.line, padding: 4, gap: 4 }}>
        {([
          ['own', 'Eigene Liste', 'create-outline'],
          ['auto', 'Automatisch erstellen', 'sparkles'],
        ] as const).map(([k, label, icon]) => {
          const on = mode === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setMode(k)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: on ? t.primary : 'transparent' }}
            >
              <Ionicons name={icon} size={16} color={on ? t.onPrimary : t.ink} />
              <Text style={{ color: on ? t.onPrimary : t.ink, fontWeight: '800', fontSize: 14 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'own' ? (
        <>
          <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Latein Kapitel 1–5" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Lernsprache" value={langA} onChangeText={setLangA} placeholder="z. B. Latein" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Deine Sprache" value={langB} onChangeText={setLangB} />
            </View>
          </View>
          <P muted>Die Lernsprache steht in deiner Liste links, deine Sprache rechts. Falls es andersherum ist, kannst du das beim Einfügen tauschen.</P>
          <Btn label="Kurs anlegen und Wörter hinzufügen" onPress={create} disabled={!name.trim()} />
        </>
      ) : (
        <>
          <P muted>Memoro erstellt dir einen Kurs mit dem Grundwortschatz, sortiert nach Häufigkeit: die wichtigsten Wörter zuerst, sauber gedrittelt in Leicht, Mittel und Schwer. Dazu gibt es Lückensätze mit Wörtern, die du schon kennst.</P>
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>Lernsprache</Text>
            {chips(genA, (v) => { setGenA(v); if (v === genB) setGenB(v === 'de' ? 'en' : 'de'); }, '' as LangCode)}
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>Deine Sprache</Text>
            {chips(genB, setGenB, genA)}
          </View>
          <Panel style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <H2>{amount} Wörter</H2>
              {!data.premium && <Text style={{ color: t.muted, fontSize: 13, fontWeight: '700' }}>Gratis-Version</Text>}
            </View>
            {true ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_PICKS.filter((v) => v <= cap).map((v) => (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    accessibilityState={{ selected: count === v && !countText }}
                    onPress={() => {
                      setCount(v);
                      setCountText('');
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 2, borderColor: count === v && !countText ? t.primary : t.line, backgroundColor: count === v && !countText ? t.primary : t.surface }}
                  >
                    <Text style={{ color: count === v && !countText ? t.onPrimary : t.ink, fontWeight: '800' }}>{v}</Text>
                  </Pressable>
                ))}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexBasis: '100%' }}>
                  <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>Eigene Anzahl:</Text>
                  <TextInput
                    value={countText}
                    onChangeText={(v) => {
                      const digits = v.replace(/[^0-9]/g, '');
                      setCountText(digits);
                      const n = parseInt(digits, 10);
                      if (n >= 1) setCount(Math.min(n, cap));
                    }}
                    keyboardType="number-pad"
                    placeholder="z. B. 750"
                    placeholderTextColor={t.muted}
                    accessibilityLabel="Eigene Anzahl Wörter"
                    style={{ flex: 1, color: t.ink, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16 }}
                  />
                </View>
                {parseInt(countText, 10) > cap && (
                  <P muted style={{ fontSize: 13 }}>
                    {!data.premium && cap < max
                      ? `In der Gratis-Version sind bis zu ${FREE_WORD_LIMIT} Wörter möglich, Memoro nimmt ${cap}. Mit Premium wählst du mehr.`
                      : `Derzeit sind ${max} Wörter im Grundwortschatz verfügbar, Memoro nimmt alle davon.`}
                  </P>
                )}
                {amount < MIN_WORDS && <P muted style={{ fontSize: 13 }}>Für Lektionen brauchst du mindestens {MIN_WORDS} Wörter.</P>}
              </View>
            ) : null}
            {!data.premium && max > FREE_WORD_LIMIT && <P muted style={{ fontSize: 13 }}>Gratis-Version: bis zu {FREE_WORD_LIMIT} Wörter. Mit Premium wählst du bis zu {max}.</P>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['Leicht', 'Mittel', 'Schwer'].map((n, i) => (
                <View key={n} style={{ flex: 1, backgroundColor: t.lvl[i], borderRadius: 12, paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: t.onLvl, fontWeight: '900', fontSize: 16 }}>{thirds[i]}</Text>
                  <Text style={{ color: t.onLvl, fontSize: 12 }}>{n}</Text>
                </View>
              ))}
            </View>
          </Panel>
          <Btn label={`${langName(genA)}-Kurs erstellen`} onPress={generate} />
        </>
      )}
    </View>
  );
}

export function Settings({ data, update, back }: ScreenProps) {
  const t = useTheme();
  const [pasted, setPasted] = useState('');

  const doImport = (raw: string | null) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!isValidBackup(parsed)) throw new Error();
      confirm('Backup laden? Deine aktuellen Kurse werden dabei ersetzt.', () => {
        update(() => migrate(parsed));
        notify('Backup geladen.');
      });
    } catch {
      notify('Diese Datei ist kein Memoro-Backup.');
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <H1>Einstellungen</H1>

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <H2>Premium (Test)</H2>
            <P muted>Schaltet Premium-Funktionen zum Testen frei. In der Store-Version ersetzt das der In-App-Kauf.</P>
          </View>
          <Switch
            value={data.premium}
            onValueChange={(v) => update((d) => (v ? releasePending({ ...d, premium: true }) : { ...d, premium: false }))}
            trackColor={{ true: t.primary, false: t.line }}
            accessibilityLabel="Premium testen"
          />
        </View>
      </Panel>

      <Panel>
        <H2>Backup</H2>
        <P muted>Fortschritt und Wörter als Datei sichern oder auf ein anderes Gerät übertragen.</P>
        <Btn kind="secondary" label="Backup exportieren" onPress={() => exportBackup(JSON.stringify(data))} />
        {Platform.OS === 'web' ? (
          <Btn kind="secondary" label="Backup importieren" onPress={async () => doImport(await pickBackupFile())} />
        ) : (
          <>
            <Field value={pasted} onChangeText={setPasted} placeholder="Backup-Inhalt hier einfügen" multiline style={{ minHeight: 90 }} />
            <Btn kind="secondary" label="Backup importieren" disabled={!pasted.trim()} onPress={() => doImport(pasted)} />
          </>
        )}
      </Panel>

      <Btn
        kind="danger"
        label="Alle Daten löschen"
        onPress={() => confirm('Alle Kurse, Wörter und Fortschritte löschen? Das lässt sich nicht rückgängig machen.', () => update(() => emptyData()))}
      />
      <P muted style={{ textAlign: 'center', fontSize: 13 }}>Memoro 3.0 – Testversion{BUILD_ID ? ` · Build ${BUILD_ID.slice(0, 7)}` : ''}</P>
      {Platform.OS === 'web' && <P muted style={{ textAlign: 'center', fontSize: 11 }}>{viewportInfo()}</P>}
    </View>
  );
}

export function Premium({ back, update, data, reason }: ScreenProps & { reason: string }) {
  const t = useTheme();
  const perks = [
    { icon: 'camera' as const, title: 'Kamera', text: 'Vokabellisten aus Buch oder Heft einfach abfotografieren' },
    { icon: 'albums' as const, title: 'Beliebig viele Kurse', text: 'Latein, Englisch, Fachbegriffe, alles getrennt' },
    { icon: 'infinite' as const, title: 'Mehr als 1000 Wörter', text: 'Kein Limit für deine Wortlisten' },
  ];
  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 22, gap: 10, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.onCard, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="diamond" size={32} color={t.card} />
        </View>
        <Text style={{ color: t.onCard, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>Memoro Premium</Text>
        <Text style={{ color: t.onCard, fontSize: 15, textAlign: 'center', opacity: 0.9 }}>{reason}</Text>
      </View>
      <Panel style={{ gap: 16 }}>
        {perks.map((x) => (
          <View key={x.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={x.icon} size={22} color={t.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{x.title}</Text>
              <Text style={{ color: t.muted, fontSize: 14 }}>{x.text}</Text>
            </View>
          </View>
        ))}
      </Panel>
      <P muted style={{ textAlign: 'center' }}>Testversion: Es gibt noch keinen Kauf, Premium lässt sich hier zum Ausprobieren aktivieren.</P>
      <Btn
        label={data.premium ? 'Premium ist aktiv' : 'Premium aktivieren'}
        disabled={data.premium}
        onPress={() => {
          update((d) => releasePending({ ...d, premium: true }));
          back();
        }}
      />
    </View>
  );
}
