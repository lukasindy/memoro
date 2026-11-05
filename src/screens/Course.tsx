import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Route, ScreenProps } from '../nav';
import { Btn, CardBox, Field, H1, H2, P, Panel, Progress, TopBar, confirm, notify, useTheme } from '../ui';
import { MIN_WORDS, PathNode, SKIP_PASS, Section, boxCounts, buildPath, dueCount, effective, estimateDifficulty } from '../engine';
import { Course as CourseT, DEFAULT_MIX, Mix } from '../store';

function useCourse(data: ScreenProps['data'], id: string) {
  return data.courses.find((c) => c.id === id);
}

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];

const lessonRoute = (id: string, n: PathNode): Route => ({ name: 'lesson', id, node: { key: n.key, kind: n.kind, wordIds: n.wordIds, section: n.section } });
const skipRoute = (id: string, s: Section): Route => ({ name: 'lesson', id, node: { key: `skip${s.index}`, kind: 'skip', wordIds: s.wordIds, section: s.index } });

export function Course({ data, go, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  if (!c) return <TopBar onBack={back} />;
  const due = dueCount(c);
  const sections = buildPath(c);
  const canLearn = c.words.length >= MIN_WORDS;
  const reviewable = c.words.some((w) => w.box > 0);
  const current = sections.flatMap((s) => [...s.units.flatMap((u) => u.nodes), ...(s.exam ? [s.exam] : [])]).find((n) => n.status === 'current');
  const currentSection = current ? sections[current.section] : undefined;

  return (
    <View style={{ gap: 22 }}>
      <TopBar onBack={back} title={`${c.langA} – ${c.langB}`} />
      <H1>{c.name}</H1>

      {!canLearn ? (
        <Panel>
          <H2>{c.words.length === 0 ? 'Noch keine Wörter' : 'Fast startklar'}</H2>
          <P muted>Füge mindestens {MIN_WORDS} Wörter hinzu. Memoro sortiert sie nach Schwierigkeit in die Abschnitte Leicht, Mittel und Schwer und baut daraus Einheiten mit Lektionen und Tests.</P>
          <Btn label="Wörter hinzufügen" onPress={() => go({ name: 'add', id })} />
        </Panel>
      ) : current && currentSection ? (
        <View style={{ backgroundColor: t.lvl[currentSection.level], borderRadius: 20, padding: 20, gap: 12 }}>
          <Text style={{ color: t.onLvl, opacity: 0.85, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
            ABSCHNITT {currentSection.index + 1} · {currentSection.name.toUpperCase()}
          </Text>
          <Text style={{ color: t.onLvl, fontSize: 24, fontWeight: '800' }}>{current.title}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => go(lessonRoute(id, current))}
            style={({ pressed }) => ({ backgroundColor: t.onLvl, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ color: t.lvl[currentSection.level], fontSize: 17, fontWeight: '800' }}>Weiterlernen</Text>
          </Pressable>
        </View>
      ) : (
        <Panel>
          <H2>Kurs abgeschlossen</H2>
          <P muted>Alle Abschnitte geschafft. Halte die Wörter im Karteikasten frisch oder füge neue hinzu.</P>
        </Panel>
      )}

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

      {canLearn && (
        <View style={{ gap: 12 }}>
          <H2>Abschnitte</H2>
          {sections.map((s) => (
            <SectionCard key={s.index} s={s} onOpen={() => go({ name: 'section', id, index: s.index })} onSkip={() => go(skipRoute(id, s))} />
          ))}
        </View>
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

function SectionCard({ s, onOpen, onSkip }: { s: Section; onOpen: () => void; onSkip: () => void }) {
  const t = useTheme();
  const color = t.lvl[s.level];
  const locked = s.status === 'locked';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abschnitt ${s.index + 1}, ${s.name}`} onPress={onOpen} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
      <View style={{ borderRadius: 18, borderWidth: 2, borderColor: locked ? t.line : color, backgroundColor: t.surface, overflow: 'hidden' }}>
        <View style={{ backgroundColor: locked ? t.line : color, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: locked ? t.muted : t.onLvl, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>ABSCHNITT {s.index + 1}</Text>
          <Text style={{ color: locked ? t.muted : t.onLvl, fontWeight: '700', fontSize: 13 }}>
            {s.status === 'done' ? 'Abgeschlossen ✓' : s.status === 'current' ? 'Aktuell' : 'Gesperrt'}
          </Text>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{s.name}</Text>
          <P muted>
            {s.wordIds.length} Wörter · {s.units.length} {s.units.length === 1 ? 'Einheit' : 'Einheiten'} · Prüfung mit {Math.min(s.examSize, s.wordIds.length * 2)} Fragen
          </P>
          <Progress value={s.total ? s.done / s.total : 0} color={color} />
          {locked && s.wordIds.length >= MIN_WORDS && (
            <Btn kind="secondary" label="Hierher springen" onPress={onSkip} style={{ minHeight: 44 }} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function SectionView({ data, go, back, id, index }: ScreenProps & { id: string; index: number }) {
  const t = useTheme();
  const c = useCourse(data, id);
  const s = c ? buildPath(c)[index] : undefined;
  if (!c || !s) return <TopBar onBack={back} />;
  const color = t.lvl[s.level];

  const open = (n: PathNode) => {
    if (n.status === 'locked') {
      notify('Schließe zuerst die vorherigen Lektionen ab.');
      return;
    }
    go(lessonRoute(id, n));
  };

  return (
    <View style={{ gap: 22 }}>
      <TopBar onBack={back} title={c.name} />
      <View style={{ backgroundColor: color, borderRadius: 20, padding: 20, gap: 8 }}>
        <Text style={{ color: t.onLvl, opacity: 0.85, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>ABSCHNITT {s.index + 1}</Text>
        <Text style={{ color: t.onLvl, fontSize: 28, fontWeight: '800' }}>{s.name}</Text>
        <Text style={{ color: t.onLvl, opacity: 0.9, fontSize: 15 }}>{s.done} von {s.total} Schritten · {s.wordIds.length} Wörter</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round((s.done / Math.max(1, s.total)) * 100)}%`, backgroundColor: t.onLvl }} />
        </View>
      </View>

      {s.status === 'locked' && (
        <Panel>
          <H2>Schon fit in diesem Abschnitt?</H2>
          <P muted>Mit einer Einstufungsprüfung kannst du direkt hierher springen. Ab {SKIP_PASS} % gelten alle Abschnitte bis hierher als abgeschlossen.</P>
          <Btn label="Hierher springen" onPress={() => go(skipRoute(id, s))} />
        </Panel>
      )}

      {s.units.map((u) => {
        const done = u.nodes.filter((n) => n.status === 'done').length;
        return (
          <View key={u.index} style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, height: 2, backgroundColor: t.line }} />
              <Text style={{ color: t.muted, fontWeight: '800', fontSize: 14 }}>
                Einheit {u.index + 1} · {done}/{u.nodes.length}
              </Text>
              <View style={{ flex: 1, height: 2, backgroundColor: t.line }} />
            </View>
            <View style={{ alignItems: 'center', gap: 14 }}>
              {u.nodes.map((n, k) => (
                <PathStep key={n.key} node={n} color={color} best={c.best[n.key]} offset={OFFSETS[k % OFFSETS.length]} onPress={() => open(n)} />
              ))}
            </View>
          </View>
        );
      })}

      {s.exam && (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
            <View style={{ flex: 1, height: 2, backgroundColor: t.line }} />
            <Text style={{ color: t.muted, fontWeight: '800', fontSize: 14 }}>Abschluss</Text>
            <View style={{ flex: 1, height: 2, backgroundColor: t.line }} />
          </View>
          <PathStep node={s.exam} color={color} best={c.best[s.exam.key]} offset={0} onPress={() => open(s.exam!)} />
          <P muted style={{ textAlign: 'center' }}>{Math.min(s.examSize, s.wordIds.length * 2)} Fragen aus dem ganzen Abschnitt, je zur Hälfte in beide Richtungen.</P>
        </View>
      )}
    </View>
  );
}

function PathStep({ node, color, best, offset, onPress }: { node: PathNode; color: string; best?: number; offset: number; onPress: () => void }) {
  const t = useTheme();
  const { status, kind } = node;
  const big = kind !== 'lesson';
  const bg = status === 'done' ? color : status === 'current' ? t.card : t.line;
  const fg = status === 'done' ? t.onLvl : status === 'current' ? t.onCard : t.muted;
  const symbol = status === 'done' ? '✓' : kind === 'exam' ? 'PRÜFUNG' : kind === 'unitTest' ? 'TEST' : node.title.replace('Lektion ', '');
  const sub = status === 'done' ? (best ? `${best} %` : 'erledigt') : status === 'current' ? 'Start' : 'gesperrt';
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }], gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}, ${sub}`}
        onPress={onPress}
        style={({ pressed }) => ({
          width: kind === 'exam' ? 120 : big ? 88 : 72,
          height: kind === 'exam' ? 80 : 72,
          borderRadius: big ? 22 : 36,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 6,
          borderColor: 'rgba(0,0,0,0.18)',
          opacity: pressed ? 0.85 : 1,
          transform: [{ translateY: pressed ? 3 : 0 }],
        })}
      >
        <Text style={{ color: fg, fontSize: big && status !== 'done' ? 14 : 24, fontWeight: '800', letterSpacing: big ? 0.5 : 0 }}>{symbol}</Text>
      </Pressable>
      <Text style={{ color: status === 'locked' ? t.muted : t.ink, fontSize: 13, fontWeight: '700' }}>{node.title}</Text>
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
        <Stepper label="Wörter pro Lektion" value={c.wordsPerLesson} min={3} max={10} onChange={(v) => setCourse((x) => ({ ...x, wordsPerLesson: v }))} />
        <Stepper label="Lektionen pro Einheit" hint="Danach folgt ein Einheitstest" value={c.lessonsPerUnit} min={2} max={8} onChange={(v) => setCourse((x) => ({ ...x, lessonsPerUnit: v }))} />
        <P muted>Die Wörter werden nach Schwierigkeit in die Abschnitte Leicht, Mittel und Schwer verteilt. Jeder Abschnitt endet mit einer Prüfung (10, 20 bzw. 30 Fragen), bestanden ab 50 %. Dein Fortschritt hängt an den Wörtern, Änderungen hier gehen also nicht verloren.</P>
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

  const sectionOf = new Map<string, string>();
  buildPath(c).forEach((sec) => sec.wordIds.forEach((wid) => sectionOf.set(wid, sec.name)));
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
                    setCourse((x) => ({ ...x, words: x.words.filter((y) => y.id !== w.id) }));
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
              <Text style={{ color: t.muted, fontSize: 13, textAlign: 'right' }}>{sectionOf.get(w.id)}{'\n'}{w.box === 0 ? 'neu' : `Fach ${w.box}`}</Text>
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
