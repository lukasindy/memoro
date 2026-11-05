import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Route, ScreenProps } from '../nav';
import { Btn, Field, H1, H2, P, Panel, Progress, TopBar, confirm, notify, useTheme } from '../ui';
import { MIN_WORDS, PASS, PathNode, SKIP_PASS, Section, buildPath, effective, estimateDifficulty } from '../engine';
import { Course as CourseT, DEFAULT_MIX, Mix } from '../store';

export type CourseTab = 'learn' | 'vocab' | 'stats' | 'settings';
type SetCourse = (fn: (c: CourseT) => CourseT) => void;

const TABS: { key: CourseTab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'learn', label: 'Lernen', icon: 'school-outline', active: 'school' },
  { key: 'vocab', label: 'Vokabeln', icon: 'book-outline', active: 'book' },
  { key: 'stats', label: 'Statistik', icon: 'stats-chart-outline', active: 'stats-chart' },
  { key: 'settings', label: 'Einstellungen', icon: 'settings-outline', active: 'settings' },
];

const lessonRoute = (id: string, n: PathNode): Route => ({ name: 'lesson', id, node: { key: n.key, kind: n.kind, wordIds: n.wordIds, section: n.section } });
const skipRoute = (id: string, s: Section): Route => ({ name: 'lesson', id, node: { key: `skip${s.index}`, kind: 'skip', wordIds: s.wordIds, section: s.index } });

export function Course({ data, update, go, back, replace, id, tab = 'learn', sec }: ScreenProps & { id: string; tab?: CourseTab; sec?: number }) {
  const t = useTheme();
  const c = data.courses.find((x) => x.id === id);
  if (!c) return <TopBar onBack={back} />;
  const setCourse: SetCourse = (fn) => update((d) => ({ ...d, courses: d.courses.map((x) => (x.id === id ? fn(x) : x)) }));
  const setTab = (next: CourseTab) => replace({ name: 'course', id, tab: next, sec });
  const setSec = (next: number) => replace({ name: 'course', id, tab, sec: next });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView key={tab} contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 620, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 20 }}>
          <TopBar onBack={back} title={`${c.name} · ${c.langA} – ${c.langB}`} />
          {tab === 'learn' && <LearnTab c={c} go={go} sec={sec} setSec={setSec} openVocab={() => setTab('vocab')} />}
          {tab === 'vocab' && <VocabTab c={c} go={go} setCourse={setCourse} />}
          {tab === 'stats' && <StatsTab c={c} premium={data.premium} go={go} />}
          {tab === 'settings' && (
            <SettingsTab
              c={c}
              setCourse={setCourse}
              onDelete={() =>
                confirm(`Kurs „${c.name}“ mit allen Wörtern löschen?`, () => {
                  update((d) => ({ ...d, courses: d.courses.filter((x) => x.id !== id) }));
                  back();
                })
              }
            />
          )}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: t.line, backgroundColor: t.surface, paddingTop: 8, paddingBottom: 6 }}>
        {TABS.map((x) => {
          const on = x.key === tab;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={x.label}
              onPress={() => setTab(x.key)}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}
            >
              <Ionicons name={on ? x.active : x.icon} size={25} color={on ? t.primary : t.muted} />
              <Text style={{ color: on ? t.primary : t.muted, fontSize: 12, fontWeight: on ? '800' : '600' }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Lernen ----------

const OFFSETS = [0, 52, 78, 52, 0, -52, -78, -52];

function LearnTab({ c, go, sec, setSec, openVocab }: { c: CourseT; go: ScreenProps['go']; sec?: number; setSec: (n: number) => void; openVocab: () => void }) {
  const t = useTheme();
  if (c.words.length < MIN_WORDS) {
    return (
      <Panel>
        <H2>{c.words.length === 0 ? 'Noch keine Wörter' : 'Fast startklar'}</H2>
        <P muted>Füge mindestens {MIN_WORDS} Wörter hinzu. Memoro sortiert sie nach Schwierigkeit in Leicht, Mittel und Schwer und baut daraus deinen Lernpfad.</P>
        <Btn label="Zu den Vokabeln" onPress={openVocab} />
      </Panel>
    );
  }
  const sections = buildPath(c);
  const currentIdx = Math.max(0, sections.findIndex((x) => x.status === 'current'));
  const s = sections[Math.min(sec ?? currentIdx, sections.length - 1)];
  const color = t.lvl[s.level];
  const wordOf = (wid: string) => c.words.find((w) => w.id === wid);

  const open = (n: PathNode) => {
    if (n.status === 'locked') {
      notify('Schließe zuerst die vorherigen Lektionen ab.');
      return;
    }
    go(lessonRoute(c.id, n));
  };

  return (
    <View style={{ gap: 26 }}>
      {/* Abschnitte als Segmente */}
      <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 20, borderWidth: 1, borderColor: t.line, padding: 6, gap: 4 }}>
        {sections.map((x) => {
          const on = x.index === s.index;
          const lessons = x.units.flatMap((u) => u.nodes).filter((n) => n.kind === 'lesson');
          const done = lessons.filter((n) => n.status === 'done').length;
          return (
            <Pressable
              key={x.index}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${x.name}, ${done} von ${lessons.length} Lektionen`}
              onPress={() => setSec(x.index)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 15, backgroundColor: on ? t.lvl[x.level] : 'transparent', gap: 2 }}
            >
              <Text style={{ color: on ? t.onLvl : t.ink, fontSize: 18, fontWeight: '800' }}>
                {x.status === 'done' ? '✓ ' : ''}
                {x.name}
              </Text>
              <Text style={{ color: on ? t.onLvl : t.muted, fontSize: 12, fontWeight: '600', opacity: on ? 0.9 : 1 }} numberOfLines={1}>
                {done} / {lessons.length} Lektionen
              </Text>
            </Pressable>
          );
        })}
      </View>

      {s.status === 'locked' && (
        <Panel style={{ borderColor: color }}>
          <H2>Schon fit in „{s.name}“?</H2>
          <P muted>Mit einer Einstufungsprüfung springst du direkt hierher. Ab {SKIP_PASS} % gelten alle Abschnitte davor als erledigt.</P>
          <Btn label="Hierher springen" onPress={() => go(skipRoute(c.id, s))} />
        </Panel>
      )}

      {s.units.map((u) => {
        const first = wordOf(u.wordIds[0]);
        const last = wordOf(u.wordIds[u.wordIds.length - 1]);
        return (
          <View key={u.index} style={{ gap: 18 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
                {s.name}, Abschnitt {u.index + 1}
              </Text>
              {first && last && (
                <Text style={{ color: t.muted, fontSize: 17 }}>
                  {first.a} bis {last.a}
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'center', gap: 22 }}>
              {u.nodes.map((n, k) => (
                <PathStep key={n.key} node={n} color={color} best={c.best[n.key]} offset={OFFSETS[k % OFFSETS.length]} onPress={() => open(n)} />
              ))}
            </View>
          </View>
        );
      })}

      {s.exam && (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Abschlussprüfung</Text>
            <Text style={{ color: t.muted, fontSize: 17 }}>
              {Math.min(s.examSize, s.wordIds.length * 2)} Fragen aus „{s.name}“, bestanden ab {PASS} %
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <PathStep node={s.exam} color={color} best={c.best[s.exam.key]} offset={0} onPress={() => open(s.exam!)} />
          </View>
        </View>
      )}
    </View>
  );
}

function PathStep({ node, color, best, offset, onPress }: { node: PathNode; color: string; best?: number; offset: number; onPress: () => void }) {
  const t = useTheme();
  const { status, kind } = node;
  const size = kind === 'exam' ? 104 : 88;
  const current = status === 'current';
  const done = status === 'done';
  const icon: keyof typeof Ionicons.glyphMap =
    status === 'locked' ? 'lock-closed' : done ? 'checkmark-sharp' : kind === 'exam' ? 'trophy' : kind === 'unitTest' ? 'ribbon' : 'star';
  const bubble = kind === 'exam' ? 'Prüfung' : kind === 'unitTest' ? 'Test' : 'Start';
  const label = done ? `${node.title}, erledigt${best ? `, ${best} %` : ''}` : current ? `${node.title}, starten` : `${node.title}, gesperrt`;
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }] }}>
      {current && (
        <View style={{ alignItems: 'center', marginBottom: 10 }}>
          <View style={{ borderWidth: 2, borderColor: t.line, backgroundColor: t.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{bubble}</Text>
          </View>
          <View style={{ width: 14, height: 14, backgroundColor: t.surface, borderRightWidth: 2, borderBottomWidth: 2, borderColor: t.line, transform: [{ rotate: '45deg' }], marginTop: -8 }} />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => ({
          width: size,
          height: size * 0.92,
          borderRadius: size / 2,
          backgroundColor: status === 'locked' ? t.line : color,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: pressed ? 2 : 8,
          borderColor: 'rgba(0,0,0,0.22)',
          transform: [{ translateY: pressed ? 6 : 0 }],
        })}
      >
        <Ionicons name={icon} size={kind === 'exam' ? 40 : 34} color={status === 'locked' ? t.muted : t.onLvl} />
      </Pressable>
      {kind !== 'lesson' && (
        <Text style={{ color: status === 'locked' ? t.muted : t.ink, fontSize: 13, fontWeight: '700', marginTop: 6 }}>
          {node.title}
          {done && best ? ` · ${best} %` : ''}
        </Text>
      )}
    </View>
  );
}

// ---------- Vokabeln ----------

function VocabTab({ c, go, setCourse }: { c: CourseT; go: ScreenProps['go']; setCourse: SetCourse }) {
  const t = useTheme();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [query, setQuery] = useState('');
  const toggle = (wid: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(wid) ? n.delete(wid) : n.add(wid);
      return n;
    });

  const q = query.trim().toLowerCase();
  const match = (wid: string) => {
    const w = c.words.find((x) => x.id === wid)!;
    return !q || w.a.toLowerCase().includes(q) || w.b.toLowerCase().includes(q);
  };
  const sections = buildPath(c).map((sec) => ({ sec, ids: sec.wordIds.filter(match) })).filter((x) => x.ids.length);

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 4 }}>
        <H1>Vokabeln</H1>
        <P muted>{c.words.length} Wörter · {c.langA} – {c.langB}</P>
      </View>
      <Btn label="Wörter hinzufügen" onPress={() => go({ name: 'add', id: c.id })} />
      <Field value={query} onChangeText={setQuery} placeholder={`Suchen auf ${c.langA} oder ${c.langB}`} />
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: showAll }}
        onPress={() => setShowAll((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingVertical: 4 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: t.primary, backgroundColor: showAll ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {showAll && <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 13 }}>✓</Text>}
        </View>
        <Text style={{ color: t.ink, fontSize: 16 }}>Alle Übersetzungen zeigen</Text>
      </Pressable>

      {c.words.length === 0 && <P muted>Noch keine Wörter. Füge eine Liste ein oder fotografiere eine Vokabelliste ab.</P>}
      {c.words.length > 0 && sections.length === 0 && <P muted>Kein Wort gefunden.</P>}

      {sections.map(({ sec, ids }) => (
        <View key={sec.index} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.lvl[sec.level] }} />
            <Text style={{ color: t.ink, fontSize: 18, fontWeight: '800' }}>{sec.name}</Text>
            <Text style={{ color: t.muted, fontSize: 14 }}>{ids.length} Wörter</Text>
          </View>
          <View style={{ backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
            {ids.map((wid, k) => {
              const w = c.words.find((x) => x.id === wid)!;
              const visible = showAll || open.has(w.id);
              return (
                <View key={w.id} style={{ borderTopWidth: k ? 1 : 0, borderColor: t.line, paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
                  {editing === w.id ? (
                    <View style={{ gap: 10 }}>
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
                    </View>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ flex: 1, color: t.ink, fontSize: 17, fontWeight: '700' }}>{w.a}</Text>
                        {w.lp && <Text style={{ color: t.right, fontSize: 13, fontWeight: '700' }}>gelernt</Text>}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={visible ? `Übersetzung von ${w.a} ausblenden` : `Was heißt ${w.a} auf ${c.langB}?`}
                          onPress={() => toggle(w.id)}
                          hitSlop={8}
                          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: t.primary, backgroundColor: visible ? t.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ color: visible ? t.onPrimary : t.primary, fontSize: 17, fontWeight: '800', fontStyle: 'italic' }}>i</Text>
                        </Pressable>
                      </View>
                      {visible && (
                        <View style={{ backgroundColor: t.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700' }}>{c.langB.toUpperCase()}</Text>
                            <Text style={{ color: t.ink, fontSize: 16 }}>{w.b}</Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              setEditing(w.id);
                              setA(w.a);
                              setB(w.b);
                            }}
                            hitSlop={8}
                          >
                            <Text style={{ color: t.primary, fontWeight: '700', fontSize: 14 }}>Bearbeiten</Text>
                          </Pressable>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

    </View>
  );
}

// ---------- Statistik ----------

function StatsTab({ c, premium, go }: { c: CourseT; premium: boolean; go: ScreenProps['go'] }) {
  const t = useTheme();
  if (!premium) {
    return (
      <View style={{ gap: 16 }}>
        <H1>Statistik</H1>
        <Panel>
          <H2>Teil von Premium</H2>
          <P muted>Sieh, wie viele Wörter du schon kannst, deine Trefferquote und welche Wörter dir am schwersten fallen.</P>
          <Btn label="Premium ansehen" onPress={() => go({ name: 'premium', reason: 'Die Statistik ist Teil von Premium.' })} />
        </Panel>
      </View>
    );
  }
  const right = c.words.reduce((s, w) => s + w.right, 0);
  const wrong = c.words.reduce((s, w) => s + w.wrong, 0);
  const learned = c.words.filter((w) => w.lp).length;
  const sections = buildPath(c);
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
      <H1>Statistik</H1>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tile(String(c.lessons), 'Lektionen')}
        {tile(right + wrong ? `${Math.round((right / (right + wrong)) * 100)} %` : '–', 'Trefferquote')}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tile(`${learned} / ${c.words.length}`, 'Wörter gelernt')}
        {tile(String(sections.filter((x) => x.status === 'done').length), 'Abschnitte geschafft')}
      </View>
      <Panel>
        <H2>Fortschritt</H2>
        {sections.map((x) => (
          <View key={x.index} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{x.name}</Text>
              <P muted>{x.done} von {x.total} Schritten</P>
            </View>
            <Progress value={x.total ? x.done / x.total : 0} color={t.lvl[x.level]} />
          </View>
        ))}
      </Panel>
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

// ---------- Einstellungen ----------

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

function SettingsTab({ c, setCourse, onDelete }: { c: CourseT; setCourse: SetCourse; onDelete: () => void }) {
  const t = useTheme();
  const setMix = (k: keyof Mix, v: number) => setCourse((x) => ({ ...x, mix: { ...x.mix, [k]: v } }));
  const m = c.mix;
  const total = m.ab + m.ba + m.pairs + m.spelling;
  const active = PRESETS.find((p) => (Object.keys(p.mix) as (keyof Mix)[]).every((k) => p.mix[k] === m[k]));

  return (
    <View style={{ gap: 20 }}>
      <H1>Einstellungen</H1>

      <Panel>
        <H2>Kurs</H2>
        <Field label="Name" value={c.name} onChangeText={(v) => setCourse((x) => ({ ...x, name: v }))} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Lernsprache" value={c.langA} onChangeText={(v) => setCourse((x) => ({ ...x, langA: v }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Deine Sprache" value={c.langB} onChangeText={(v) => setCourse((x) => ({ ...x, langB: v }))} />
          </View>
        </View>
      </Panel>

      <H2>Lektionen</H2>
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
        <Stepper label="Lektionen pro Abschnitt" hint="Danach folgt ein Test" value={c.lessonsPerUnit} min={2} max={8} onChange={(v) => setCourse((x) => ({ ...x, lessonsPerUnit: v }))} />
        <P muted>Die Wörter werden nach Schwierigkeit auf Leicht, Mittel und Schwer verteilt. Jede Stufe endet mit einer Abschlussprüfung (10, 20 bzw. 30 Fragen). Dein Fortschritt hängt an den Wörtern, Änderungen hier gehen also nicht verloren.</P>
      </Panel>

      <Btn kind="danger" label="Kurs löschen" onPress={onDelete} />
    </View>
  );
}
