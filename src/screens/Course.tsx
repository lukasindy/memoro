import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, CardBox, Field, H1, H2, P, Panel, TopBar, confirm, notify, useTheme } from '../ui';
import { MIN_WORDS, PathNode, boxCounts, dueCount, effective, estimateDifficulty, makeUnit, pathNodes, removeWordFromPath } from '../engine';
import { Course as CourseT, DEFAULT_MIX, Mix } from '../store';

function useCourse(data: ScreenProps['data'], id: string) {
  return data.courses.find((c) => c.id === id);
}

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

export function Course({ data, go, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  if (!c) return <TopBar onBack={back} />;
  const due = dueCount(c);
  const nodes = pathNodes(c);
  const canLearn = c.words.length >= MIN_WORDS;
  const reviewable = c.words.some((w) => w.box > 0);

  const open = (n: PathNode) => {
    if (n.status === 'locked') {
      notify('Schließe zuerst die vorherige Lektion ab.');
      return;
    }
    if (!canLearn) {
      notify(`Der Kurs braucht mindestens ${MIN_WORDS} Wörter.`);
      return;
    }
    go({ name: 'lesson', id, lessonId: n.lesson.id });
  };

  return (
    <View style={{ gap: 22 }}>
      <TopBar onBack={back} title={`${c.langA} – ${c.langB}`} />
      <H1>{c.name}</H1>

      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <H2>Karteikasten</H2>
          <P muted>{due > 0 ? `${due} fällig` : 'nichts fällig'}</P>
        </View>
        <CardBox counts={boxCounts(c)} compact />
        <Btn
          kind={due > 0 ? 'primary' : 'secondary'}
          label={due > 0 ? `${due} ${due === 1 ? 'Wort' : 'Wörter'} wiederholen` : 'Schwächste Wörter üben'}
          disabled={!reviewable || !canLearn}
          onPress={() => go({ name: 'lesson', id })}
        />
      </Panel>

      {nodes.length === 0 ? (
        <Panel>
          <H2>Noch keine Lektionen</H2>
          <P muted>Füge eine Wortliste hinzu. Memoro sortiert sie von leicht nach schwer und baut daraus einen Lernpfad mit Lektionen und Abschlusstest.</P>
          <Btn label="Wörter hinzufügen" onPress={() => go({ name: 'add', id })} />
        </Panel>
      ) : (
        c.units.map((u) => {
          const unitNodes = nodes.filter((n) => n.unit.id === u.id);
          const done = u.lessons.filter((l) => l.done).length;
          return (
            <View key={u.id} style={{ gap: 18 }}>
              <View style={{ backgroundColor: t.primary, borderRadius: 18, padding: 18, gap: 8 }}>
                <Text style={{ color: t.onPrimary, fontSize: 20, fontWeight: '800' }}>{u.title}</Text>
                <Text style={{ color: t.onPrimary, opacity: 0.85, fontSize: 15 }}>
                  {done} von {u.lessons.length} abgeschlossen · {new Set(u.lessons.flatMap((l) => l.wordIds)).size} Wörter
                </Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.round((done / u.lessons.length) * 100)}%`, backgroundColor: t.card }} />
                </View>
              </View>
              <View style={{ alignItems: 'center', gap: 14 }}>
                {unitNodes.map((n, k) => (
                  <PathStep key={n.lesson.id} node={n} offset={OFFSETS[k % OFFSETS.length]} number={u.lessons.filter((l, j) => l.kind === 'lesson' && j <= k).length} onPress={() => open(n)} />
                ))}
              </View>
            </View>
          );
        })
      )}

      <View style={{ gap: 10 }}>
        <Btn kind="secondary" label="Wörter hinzufügen" onPress={() => go({ name: 'add', id })} />
        <Btn kind="secondary" label="Lektionen einstellen" onPress={() => go({ name: 'lessonSettings', id })} />
        <Btn kind="secondary" label={`Wortliste (${c.words.length})`} onPress={() => go({ name: 'words', id })} disabled={!c.words.length} />
        <Btn
          kind="secondary"
          label="Statistik"
          disabled={!c.words.length}
          onPress={() => (data.premium ? go({ name: 'stats', id }) : go({ name: 'premium', reason: 'Die Statistik ist Teil von Premium.' }))}
        />
      </View>
    </View>
  );
}

function PathStep({ node, offset, number, onPress }: { node: PathNode; offset: number; number: number; onPress: () => void }) {
  const t = useTheme();
  const { status, lesson } = node;
  const isTest = lesson.kind === 'test';
  const bg = status === 'done' ? t.primary : status === 'current' ? t.card : t.line;
  const fg = status === 'done' ? t.onPrimary : status === 'current' ? t.onCard : t.muted;
  const label = isTest ? 'Abschlusstest' : `Lektion ${number}`;
  const sub = status === 'done' ? (lesson.best ? `${lesson.best} %` : 'erledigt') : status === 'current' ? 'Start' : 'gesperrt';
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }], gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${sub}`}
        onPress={onPress}
        style={({ pressed }) => ({
          width: isTest ? 84 : 72,
          height: 72,
          borderRadius: isTest ? 20 : 36,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 6,
          borderColor: 'rgba(0,0,0,0.18)',
          opacity: pressed ? 0.85 : 1,
          transform: [{ translateY: pressed ? 3 : 0 }],
        })}
      >
        <Text style={{ color: fg, fontSize: isTest ? 15 : 24, fontWeight: '800' }}>
          {status === 'done' ? '✓' : isTest ? 'TEST' : String(number)}
        </Text>
      </Pressable>
      <Text style={{ color: status === 'locked' ? t.muted : t.ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: -4 }}>{sub}</Text>
    </View>
  );
}

const PRESETS: { name: string; note: string; mix: Mix }[] = [
  { name: 'Gemischt', note: 'Alle Übungen ausgewogen', mix: DEFAULT_MIX },
  { name: 'Aktiv', note: 'Mehr in die Lernsprache', mix: { ab: 2, ba: 6, pairs: 1, spelling: 3 } },
  { name: 'Kurz', note: 'Schnelle Lektionen', mix: { ab: 2, ba: 2, pairs: 1, spelling: 1 } },
];

function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const btn = (txt: string, v: number, disabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => onChange(v)}
      style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Text style={{ color: t.primary, fontSize: 22, fontWeight: '700' }}>{txt}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        {hint ? <Text style={{ color: t.muted, fontSize: 13 }}>{hint}</Text> : null}
      </View>
      {btn('−', value - 1, value <= min, `${label} weniger`)}
      <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800', minWidth: 28, textAlign: 'center' }}>{value}</Text>
      {btn('+', value + 1, value >= max, `${label} mehr`)}
    </View>
  );
}

export function LessonSettings({ data, update, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  if (!c) return <TopBar onBack={back} />;
  const setCourse = (fn: (c: CourseT) => CourseT) =>
    update((d) => ({ ...d, courses: d.courses.map((x) => (x.id === id ? fn(x) : x)) }));
  const setMix = (k: keyof Mix, v: number) => setCourse((x) => ({ ...x, mix: { ...x.mix, [k]: v } }));
  const m = c.mix;
  const total = m.ab + m.ba + m.pairs + m.spelling;
  const active = PRESETS.find((p) => (Object.keys(p.mix) as (keyof Mix)[]).every((k) => p.mix[k] === m[k]));

  const rebuild = () =>
    confirm('Alle Einheiten mit der neuen Lektionsgröße neu aufteilen? Der Fortschritt im Lernpfad startet dann von vorn, der Karteikasten bleibt erhalten.', () =>
      setCourse((x) => ({
        ...x,
        units: x.units.map((u) => {
          const ids = new Set(u.lessons.flatMap((l) => l.wordIds));
          const fresh = makeUnit(u.title, x.words.filter((w) => ids.has(w.id)), x.wordsPerLesson);
          return { ...fresh, id: u.id };
        }),
      })),
    );

  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} title={c.name} />
      <H1>Lektionen einstellen</H1>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PRESETS.map((p) => {
          const on = active?.name === p.name;
          return (
            <Pressable
              key={p.name}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setCourse((x) => ({ ...x, mix: { ...p.mix } }))}
              style={{ flex: 1, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: t.surface, gap: 2 }}
            >
              <Text style={{ color: on ? t.primary : t.ink, fontWeight: '800', fontSize: 15 }}>{p.name}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{p.note}</Text>
            </Pressable>
          );
        })}
      </View>

      <Panel>
        <H2>Übungen pro Lektion</H2>
        <Stepper label={`${c.langA} → ${c.langB}`} hint="Wort erkennen, Übersetzung wählen" value={m.ab} min={0} max={10} onChange={(v) => setMix('ab', v)} />
        <Stepper label={`${c.langB} → ${c.langA}`} hint="Wort in der Lernsprache wählen" value={m.ba} min={0} max={10} onChange={(v) => setMix('ba', v)} />
        <Stepper label="Paare finden" hint="Je bis zu 4 Wortpaare zuordnen" value={m.pairs} min={0} max={5} onChange={(v) => setMix('pairs', v)} />
        <Stepper label="Schreibweise" hint="Richtig geschriebenes Wort wählen" value={m.spelling} min={0} max={10} onChange={(v) => setMix('spelling', v)} />
        <P muted>{total === 0 ? 'Mindestens eine Übung muss aktiv sein, sonst stellt Memoro jedes Wort einmal vor.' : `Eine Lektion hat ${total} Aufgaben. Neue Wörter kommen zuerst in Richtung ${c.langA} → ${c.langB}.`}</P>
      </Panel>

      <Panel>
        <H2>Lernpfad</H2>
        <Stepper label="Wörter pro Lektion" hint="Gilt für neu hinzugefügte Listen" value={c.wordsPerLesson} min={3} max={10} onChange={(v) => setCourse((x) => ({ ...x, wordsPerLesson: v }))} />
        <Btn kind="secondary" label="Bestehende Einheiten neu aufteilen" onPress={rebuild} disabled={!c.units.length} />
        <P muted>Jede Einheit endet mit einem Abschlusstest. Er fragt jedes Wort einmal ab, je zur Hälfte in beide Richtungen, und gilt ab 50 % als bestanden.</P>
      </Panel>
    </View>
  );
}

export function Words({ data, update, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  const [editing, setEditing] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [query, setQuery] = useState('');
  if (!c) return <TopBar onBack={back} />;

  const setCourse = (fn: (c: CourseT) => CourseT) =>
    update((d) => ({ ...d, courses: d.courses.map((x) => (x.id === id ? fn(x) : x)) }));

  const q = query.trim().toLowerCase();
  const list = [...c.words]
    .filter((w) => !q || w.a.toLowerCase().includes(q) || w.b.toLowerCase().includes(q))
    .sort((x, y) => x.base - y.base || x.a.localeCompare(y.a));

  return (
    <View style={{ gap: 18 }}>
      <TopBar onBack={back} title={c.name} />
      <H1>Wortliste</H1>
      <Field value={query} onChangeText={setQuery} placeholder="Suchen" />
      <View style={{ gap: 8 }}>
        {list.map((w) =>
          editing === w.id ? (
            <Panel key={w.id} style={{ padding: 14 }}>
              <Field label={c.langA} value={a} onChangeText={setA} />
              <Field label={c.langB} value={b} onChangeText={setB} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn
                  label="Speichern"
                  style={{ flex: 1 }}
                  disabled={!a.trim() || !b.trim()}
                  onPress={() => {
                    setCourse((x) => ({
                      ...x,
                      words: x.words.map((y) => (y.id === w.id ? { ...y, a: a.trim(), b: b.trim(), base: estimateDifficulty(a, b) } : y)),
                    }));
                    setEditing(null);
                  }}
                />
                <Btn kind="secondary" label="Abbrechen" style={{ flex: 1 }} onPress={() => setEditing(null)} />
              </View>
              <Btn
                kind="danger"
                label="Wort löschen"
                onPress={() =>
                  confirm(`„${w.a}“ löschen?`, () => {
                    setCourse((x) => removeWordFromPath({ ...x, words: x.words.filter((y) => y.id !== w.id) }, w.id));
                    setEditing(null);
                  })
                }
              />
            </Panel>
          ) : (
            <Pressable
              key={w.id}
              accessibilityRole="button"
              accessibilityLabel={`${w.a}, ${w.b}, bearbeiten`}
              onPress={() => {
                setEditing(w.id);
                setA(w.a);
                setB(w.b);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: t.line }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600' }}>{w.a}</Text>
                <Text style={{ color: t.muted, fontSize: 15 }}>{w.b}</Text>
              </View>
              <Text style={{ color: t.muted, fontSize: 13 }}>{w.box === 0 ? 'Neu' : `Fach ${w.box}`}</Text>
            </Pressable>
          ),
        )}
      </View>
      <Btn
        kind="danger"
        label="Kurs löschen"
        onPress={() =>
          confirm(`Kurs „${c.name}“ mit allen Wörtern löschen?`, () => {
            update((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== id) }));
            back();
            back();
          })
        }
      />
    </View>
  );
}

export function Stats({ data, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  if (!c) return <TopBar onBack={back} />;
  const right = c.words.reduce((s, w) => s + w.right, 0);
  const wrong = c.words.reduce((s, w) => s + w.wrong, 0);
  const sure = c.words.filter((w) => w.box >= 4).length;
  const hardest = c.words
    .filter((w) => w.wrong > 0)
    .sort((x, y) => effective(y) - effective(x))
    .slice(0, 10);

  const tile = (value: string, label: string) => (
    <Panel style={{ flex: 1, gap: 2, padding: 14 }}>
      <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <P muted>{label}</P>
    </Panel>
  );

  return (
    <View style={{ gap: 18 }}>
      <TopBar onBack={back} title={c.name} />
      <H1>Statistik</H1>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tile(String(c.lessons), 'Lektionen')}
        {tile(right + wrong ? `${Math.round((right / (right + wrong)) * 100)} %` : '–', 'Trefferquote')}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tile(String(sure), 'Wörter in Fach 4–5')}
        {tile(String(c.words.filter((w) => w.box === 0).length), 'Noch nicht gelernt')}
      </View>
      <Panel>
        <H2>Deine schwierigsten Wörter</H2>
        {hardest.length === 0 ? (
          <P muted>Noch keine Fehler. Sobald du dich vertust, erscheinen die Wörter hier.</P>
        ) : (
          hardest.map((w) => (
            <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <P style={{ flex: 1 }}>{w.a} – {w.b}</P>
              <P muted>{w.wrong}× falsch</P>
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}
