import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenProps } from '../nav';
import { Btn, Field, H1, H2, P, Panel, Progress, TopBar, confirm, notify, useTheme } from '../ui';
import { buildPath, levelInfo } from '../engine';
import { releasePending } from '../engine';
import { DEFAULT_LESSONS_PER_UNIT, DEFAULT_MIX, DEFAULT_WORDS_PER_LESSON, FREE_COURSE_LIMIT, isValidBackup, emptyData, migrate, uid } from '../store';
import { exportBackup, pickBackupFile } from '../platform';
import { BUILD_ID } from '../update';
import { Platform } from 'react-native';

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

      {/* Inventar */}
      <Pressable accessibilityRole="button" accessibilityLabel="Inventar öffnen" onPress={() => go({ name: 'inventory' })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ backgroundColor: t.surface, borderRadius: 20, borderWidth: 2, borderColor: t.card, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bag-handle" size={20} color={t.onCard} />
            </View>
            <Text style={{ flex: 1, color: t.ink, fontSize: 18, fontWeight: '900' }}>Inventar</Text>
            {data.screenUntil > Date.now() && (
              <View style={{ backgroundColor: '#D6457A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Timer läuft</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={t.muted} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { icon: 'snow' as const, color: '#4A9BD9', value: `${data.freezes}/3`, label: 'Schutz' },
              { icon: 'rocket' as const, color: '#E8742C', value: data.boost > 0 ? 'aktiv' : String(data.boosters), label: 'Booster' },
              { icon: 'phone-portrait' as const, color: '#D6457A', value: `${data.screenMinutes} Min.`, label: 'Social' },
            ].map((x) => (
              <View key={x.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Ionicons name={x.icon} size={18} color={x.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.ink, fontSize: 15, fontWeight: '900' }}>{x.value}</Text>
                  <Text style={{ color: t.muted, fontSize: 11 }} numberOfLines={1}>{x.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

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
  const [name, setName] = useState('');
  const [langA, setLangA] = useState('');
  const [langB, setLangB] = useState('Deutsch');
  const limitReached = !data.premium && data.courses.length >= FREE_COURSE_LIMIT;

  const create = () => {
    if (limitReached) {
      replace({ name: 'premium', reason: 'In der Gratis-Version ist ein Kurs möglich. Mit Premium legst du beliebig viele an.' });
      return;
    }
    const id = uid();
    update((d) => ({
      ...d,
      courses: [...d.courses, { id, name: name.trim(), langA: langA.trim() || 'Fremdsprache', langB: langB.trim() || 'Deutsch', words: [], pending: [], mix: { ...DEFAULT_MIX }, wordsPerLesson: DEFAULT_WORDS_PER_LESSON, lessonsPerUnit: DEFAULT_LESSONS_PER_UNIT, best: {}, lessons: 0, createdAt: Date.now() }],
    }));
    replace({ name: 'course', id });
    go({ name: 'add', id });
  };

  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <H1>Neuer Kurs</H1>
      <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Latein Kapitel 1–5" autoFocus />
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
      <P muted style={{ textAlign: 'center', fontSize: 13 }}>Memoro 1.3 – Testversion{BUILD_ID ? ` · Build ${BUILD_ID.slice(0, 7)}` : ''}</P>
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
