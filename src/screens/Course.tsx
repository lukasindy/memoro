import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Route, ScreenProps } from '../nav';
import { Btn, Field, H1, H2, P, Panel, Progress, StatPills, TopBar, confirm, notify, useTheme } from '../ui';
import { MIX_BASE_WORDS, scaledMix, todayKey, MIN_WORDS, PASS, PathNode, SKIP_PASS, Section, buildPath, effective, estimateDifficulty, freeSlots, releasePending } from '../engine';
import { canSpeak } from '../platform';
import { AppData, Course as CourseT, DEFAULT_MIX, FREE_WORD_LIMIT, Mix } from '../store';

export type CourseTab = 'learn' | 'vocab' | 'stats' | 'settings';
type SetCourse = (fn: (c: CourseT) => CourseT) => void;

const TABS: { key: CourseTab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'learn', label: 'Lernen', icon: 'map-outline', active: 'map' },
  { key: 'vocab', label: 'Vokabeln', icon: 'albums-outline', active: 'albums' },
  { key: 'stats', label: 'Statistik', icon: 'analytics-outline', active: 'analytics' },
  { key: 'settings', label: 'Einstellungen', icon: 'options-outline', active: 'options' },
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
          <TopBar onBack={back} right={<StatPills streak={data.streak.count} xp={data.xp} saved={data.streakSaved === todayKey()} boost={data.boost} onInventory={() => go({ name: 'inventory' })} hasItems={data.boosters > 0 || data.screenMinutes > 0} />} />
          {tab === 'learn' && <LearnTab c={c} go={go} sec={sec} setSec={setSec} openVocab={() => setTab('vocab')} />}
          {tab === 'vocab' && <VocabTab c={c} go={go} setCourse={setCourse} data={data} update={update} />}
          {tab === 'stats' && <StatsTab c={c} />}
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

// Sanfte Welle statt Zickzack
const OFFSETS = [0, 34, 48, 34, 0, -34, -48, -34];

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

// Pulsierender Ring um den aktuellen Schritt
function Pulse({ color, w, h, radius }: { color: string; w: number; h: number; radius: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: w,
        height: h,
        borderRadius: radius,
        borderWidth: 3,
        borderColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
      }}
    />
  );
}

// Mini-Prüfung: abgerundetes Rechteck mit Pokal
function MiniStep({ node, color, best, offset, onPress }: { node: PathNode; color: string; best?: number; offset: number; onPress: () => void }) {
  const t = useTheme();
  const { status } = node;
  const current = status === 'current';
  const done = status === 'done';
  const locked = status === 'locked';
  const w = 120;
  const h = 86;
  const radius = 24;
  const bg = locked ? t.line : done ? color : t.card;
  const fg = locked ? t.muted : done ? t.onLvl : t.onCard;
  const label = done ? `${node.title}, erledigt${best ? `, ${best} %` : ''}` : current ? `${node.title}, starten` : `${node.title}, gesperrt`;
  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }] }}>
      {current && (
        <View style={{ backgroundColor: t.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 }}>
          <Text style={{ color: t.onCard, fontSize: 14, fontWeight: '800' }}>Los geht’s</Text>
        </View>
      )}
      <View style={{ width: w, height: h + 8, alignItems: 'center', justifyContent: 'flex-start' }}>
        {current && <Pulse color={t.card} w={w} h={h} radius={radius} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => ({
            width: w,
            height: h,
            borderRadius: radius,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: pressed ? 2 : 8,
            borderColor: 'rgba(0,0,0,0.22)',
            transform: [{ translateY: pressed ? 6 : 0 }],
          })}
        >
          <Ionicons name="trophy" size={34} color={fg} />
        </Pressable>
      </View>
      <Text style={{ color: locked ? t.muted : t.ink, fontSize: 16, fontWeight: '800', marginTop: 6 }}>
        {node.title}
        {done && best ? ` · ${best} %` : ''}
      </Text>
    </View>
  );
}

// Lernpfad-Schritt als Karteikarte (Memoro-eigene Optik)
function PathStep(props: { node: PathNode; color: string; best?: number; offset: number; onPress: () => void }) {
  if (props.node.kind === 'unitTest') return <MiniStep {...props} />;
  const { node, color, best, offset, onPress } = props;
  const t = useTheme();
  const { status, kind } = node;
  const current = status === 'current';
  const done = status === 'done';
  const locked = status === 'locked';
  const mini = kind === 'unitTest';
  const exam = kind === 'exam';
  const w = exam ? 118 : mini ? 100 : 92;
  const h = exam ? 84 : mini ? 76 : 68;
  const radius = 12;
  const tilt = offset > 0 ? '3deg' : offset < 0 ? '-3deg' : '0deg';

  const bg = locked ? t.line : mini && !done ? t.card : color;
  const fg = locked ? t.muted : mini && !done ? t.onCard : t.onLvl;
  const icon: keyof typeof Ionicons.glyphMap = locked
    ? 'lock-closed-outline'
    : done
      ? 'checkmark-done'
      : exam
        ? 'medal'
        : mini
          ? 'flash'
          : 'play';
  const bubble = exam ? 'Abschlussprüfung' : mini ? 'Mini-Prüfung' : 'Los geht’s';
  const label = done ? `${node.title}, erledigt${best ? `, ${best} %` : ''}` : current ? `${node.title}, starten` : `${node.title}, gesperrt`;

  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }] }}>
      {current && (
        <View style={{ backgroundColor: mini ? t.card : color, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {mini && <Ionicons name="flash" size={14} color={t.onCard} />}
          <Text style={{ color: mini ? t.onCard : t.onLvl, fontSize: 14, fontWeight: '800' }}>{bubble}</Text>
        </View>
      )}
      <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
        {/* Karten dahinter: bei Prüfungen ein kleiner Stapel */}
        {(mini || exam) && (
          <View style={{ position: 'absolute', width: w, height: h, borderRadius: radius, backgroundColor: locked ? t.line : bg, opacity: 0.45, transform: [{ rotate: '-8deg' }, { translateY: -4 }] }} />
        )}
        {exam && (
          <View style={{ position: 'absolute', width: w, height: h, borderRadius: radius, backgroundColor: locked ? t.line : bg, opacity: 0.3, transform: [{ rotate: '7deg' }, { translateY: -6 }] }} />
        )}
        {current && <Pulse color={mini ? t.card : color} w={w} h={h} radius={radius} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={({ pressed }) => ({
            width: w,
            height: h,
            borderRadius: radius,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: current ? 3 : 0,
            borderColor: t.surface,
            transform: [{ rotate: tilt }, { scale: pressed ? 0.94 : 1 }],
            shadowColor: '#000',
            shadowOpacity: locked ? 0 : 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: locked ? 0 : 4,
          })}
        >
          {/* Linien wie auf einer Karteikarte */}
          {!locked && !mini && !exam && (
            <View style={{ position: 'absolute', left: 12, right: 12, top: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
          )}
          <Ionicons name={icon} size={exam ? 38 : mini ? 34 : 30} color={fg} />
        </Pressable>
      </View>
      {kind !== 'lesson' && (
        <Text style={{ color: locked ? t.muted : t.ink, fontSize: 13, fontWeight: '700', marginTop: 8 }}>
          {node.title}
          {done && best ? ` · ${best} %` : ''}
        </Text>
      )}
    </View>
  );
}

// ---------- Vokabeln ----------

function VocabTab({ c, go, setCourse, data, update }: { c: CourseT; go: ScreenProps['go']; setCourse: SetCourse; data: AppData; update: ScreenProps['update'] }) {
  const t = useTheme();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(150);
  const toggle = (wid: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(wid) ? n.delete(wid) : n.add(wid);
      return n;
    });

  const sections = buildPath(c);
  const levelOf = new Map<string, number>();
  sections.forEach((sec) => sec.wordIds.forEach((wid) => levelOf.set(wid, sec.level)));
  const q = query.trim().toLowerCase();
  const ids = sections
    .filter((sec) => filter === null || sec.index === filter)
    .flatMap((sec) => sec.wordIds)
    .filter((wid) => {
      const w = c.words.find((x) => x.id === wid)!;
      return !q || w.a.toLowerCase().includes(q) || w.b.toLowerCase().includes(q);
    });

  const chip = (label: string, on: boolean, onPress: () => void, color?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? (color ?? t.primary) : t.surface, borderWidth: 1, borderColor: on ? (color ?? t.primary) : t.line }}
    >
      {color && !on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <Text style={{ color: on ? t.onLvl : t.ink, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <H1>Vokabeln</H1>
          <P muted>{c.words.length} Wörter · {c.langA} – {c.langB}</P>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wörter hinzufügen"
          onPress={() => go({ name: 'add', id: c.id })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.85 : 1 })}
        >
          <Ionicons name="add" size={18} color={t.onPrimary} />
          <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 15 }}>Hinzufügen</Text>
        </Pressable>
      </View>

      {c.pending?.length > 0 && <PendingPanel c={c} data={data} update={update} go={go} setCourse={setCourse} />}

      {c.words.length === 0 ? (
        <P muted>Noch keine Wörter. Füge eine Liste ein oder fotografiere eine Vokabelliste ab.</P>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={18} color={t.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Suchen auf ${c.langA} oder ${c.langB}`}
              placeholderTextColor={t.muted}
              style={{ flex: 1, color: t.ink, fontSize: 16, paddingVertical: 12 }}
            />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: showAll }}
              accessibilityLabel="Alle Übersetzungen zeigen"
              onPress={() => setShowAll((v) => !v)}
              hitSlop={8}
            >
              <Ionicons name={showAll ? 'eye' : 'eye-off'} size={22} color={showAll ? t.primary : t.muted} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chip(`Alle ${c.words.length}`, filter === null, () => setFilter(null))}
            {sections.map((sec) => chip(`${sec.name} ${sec.wordIds.length}`, filter === sec.index, () => setFilter(sec.index), t.lvl[sec.level]))}
          </View>

          {ids.length === 0 ? (
            <P muted>Kein Wort gefunden.</P>
          ) : (
            <View style={{ backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
              {ids.slice(0, limit).map((wid, k) => {
                const w = c.words.find((x) => x.id === wid)!;
                const visible = showAll || open.has(w.id);
                if (editing === w.id) {
                  return (
                    <View key={w.id} style={{ borderTopWidth: k ? 1 : 0, borderColor: t.line, padding: 14, gap: 10 }}>
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
                  );
                }
                return (
                  <Pressable
                    key={w.id}
                    accessibilityRole="button"
                    accessibilityLabel={visible ? `${w.a}: ${w.b}` : `${w.a}, Übersetzung anzeigen`}
                    onPress={() => toggle(w.id)}
                    onLongPress={() => {
                      setEditing(w.id);
                      setA(w.a);
                      setB(w.b);
                    }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: k ? 1 : 0, borderColor: t.line, backgroundColor: pressed ? t.bg : 'transparent' })}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.lvl[levelOf.get(w.id) ?? 0] }} />
                    <Text style={{ flex: 1, color: t.ink, fontSize: 16, fontWeight: '700' }} numberOfLines={2}>
                      {w.a}
                    </Text>
                    {visible ? (
                      <Text style={{ flex: 1, color: t.muted, fontSize: 15, textAlign: 'right' }} numberOfLines={2}>
                        {w.b}
                      </Text>
                    ) : (
                      <Ionicons name="information-circle-outline" size={22} color={t.primary} />
                    )}
                    {w.lp && <Ionicons name="checkmark-circle" size={16} color={t.right} />}
                    {visible && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${w.a} bearbeiten`}
                        hitSlop={8}
                        onPress={() => {
                          setEditing(w.id);
                          setA(w.a);
                          setB(w.b);
                        }}
                      >
                        <Ionicons name="create-outline" size={18} color={t.muted} />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
          {ids.length > limit && <Btn kind="secondary" label={`Weitere ${Math.min(150, ids.length - limit)} von ${ids.length - limit} anzeigen`} onPress={() => setLimit(limit + 150)} />}
          <P muted style={{ fontSize: 13, textAlign: 'center' }}>Tippen zeigt die Übersetzung, gedrückt halten zum Bearbeiten.</P>
        </>
      )}
    </View>
  );
}

// Wörter, die wegen des Gratis-Limits warten
function PendingPanel({ c, data, update, go, setCourse }: { c: CourseT; data: AppData; update: ScreenProps['update']; go: ScreenProps['go']; setCourse: SetCourse }) {
  const t = useTheme();
  const [showAll, setShowAll] = useState(false);
  const n = c.pending.length;
  const slots = freeSlots(data);
  const canAdd = Math.min(n, slots);
  const list = showAll ? c.pending : c.pending.slice(0, 5);
  return (
    <View style={{ borderRadius: 18, borderWidth: 2, borderColor: t.card, backgroundColor: t.surface, overflow: 'hidden' }}>
      <View style={{ backgroundColor: t.card, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="lock-closed" size={16} color={t.onCard} />
        <Text style={{ color: t.onCard, fontWeight: '800', fontSize: 15 }}>
          {n} {n === 1 ? 'Wort wartet' : 'Wörter warten'} auf Premium
        </Text>
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <P muted>
          {n === 1 ? 'Dieses Wort wurde' : 'Diese Wörter wurden'} nicht hinzugefügt, weil die Gratis-Version auf {FREE_WORD_LIMIT} Wörter begrenzt ist. Kaufe Premium, um {n === 1 ? 'es' : 'sie'} hinzuzufügen.
        </P>
        <View style={{ gap: 4 }}>
          {list.map((p, k) => (
            <Text key={k} style={{ color: t.ink, fontSize: 15 }}>
              {p.a} <Text style={{ color: t.muted }}>– {p.b}</Text>
            </Text>
          ))}
          {n > 5 && (
            <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: t.primary, fontWeight: '700', fontSize: 14, marginTop: 4 }}>{showAll ? 'Weniger anzeigen' : `+ ${n - 5} weitere anzeigen`}</Text>
            </Pressable>
          )}
        </View>
        {canAdd > 0 ? (
          <Btn
            label={canAdd === n ? `${n === 1 ? 'Wort' : 'Alle'} jetzt hinzufügen` : `${canAdd} davon jetzt hinzufügen`}
            onPress={() => update((d) => releasePending(d, c.id))}
          />
        ) : (
          <Btn label={`Premium holen, um ${n === 1 ? 'es' : 'sie'} hinzuzufügen`} onPress={() => go({ name: 'premium', reason: `${n} ${n === 1 ? 'Wort wartet' : 'Wörter warten'} darauf, hinzugefügt zu werden. Mit Premium gibt es kein Limit.` })} />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => confirm(`${n === 1 ? 'Das wartende Wort' : `Die ${n} wartenden Wörter`} verwerfen?`, () => setCourse((x) => ({ ...x, pending: [] })))}
          style={{ alignSelf: 'center', paddingVertical: 4 }}
        >
          <Text style={{ color: t.muted, fontSize: 14 }}>Verwerfen</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Statistik ----------

function StatsTab({ c }: { c: CourseT }) {
  const t = useTheme();
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

const scaledTotal = (m: Mix, words: number) => {
  const s = scaledMix(m, words);
  return s.ab + s.ba + s.pairs + s.spelling + s.listen + s.build + s.cloze;
};

const PRESETS: { name: string; note: string; mix: Mix }[] = [
  { name: 'Gemischt', note: 'Alle Übungen ausgewogen', mix: DEFAULT_MIX },
  { name: 'Aktiv', note: 'Mehr in die Lernsprache', mix: { ab: 2, ba: 4, pairs: 1, spelling: 2, listen: 1, build: 2, cloze: 1 } },
  { name: 'Kurz', note: 'Schnelle Lektionen', mix: { ab: 2, ba: 2, pairs: 1, spelling: 0, listen: 1, build: 1, cloze: 0 } },
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
  const total = m.ab + m.ba + m.pairs + m.spelling + m.listen + m.build + m.cloze;
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
        <Stepper label="Hörübung" hint={canSpeak(c.langA) ? 'Wort hören, Bedeutung wählen' : `Für ${c.langA} gibt es keine Sprachausgabe`} value={m.listen} min={0} max={10} onChange={(v) => setMix('listen', v)} />
        <Stepper label="Buchstaben-Puzzle" hint="Wort aus Buchstaben zusammensetzen" value={m.build} min={0} max={10} onChange={(v) => setMix('build', v)} />
        <Stepper label="Lückensatz" hint={c.gen ? 'Satz mit bekannten Wörtern vervollständigen' : 'Nur in automatisch erstellten Kursen'} value={m.cloze} min={0} max={10} onChange={(v) => setMix('cloze', v)} />
        <P muted>{total === 0 ? 'Mindestens eine Übung muss aktiv sein, sonst stellt Memoro jedes Wort einmal vor.' : `Gilt für ${MIX_BASE_WORDS} Wörter. Bei ${c.wordsPerLesson} Wörtern pro Lektion rechnet Memoro automatisch auf ${scaledTotal(m, c.wordsPerLesson)} Aufgaben hoch, damit jedes Wort etwa gleich oft drankommt. Neue Wörter kommen zuerst in Richtung ${c.langA} → ${c.langB}.`}</P>
      </Panel>

      <Panel>
        <H2>Lernpfad</H2>
        <Stepper label="Wörter pro Lektion" hint={`${scaledTotal(m, c.wordsPerLesson)} Aufgaben pro Lektion, etwa ${(scaledTotal(m, c.wordsPerLesson) / c.wordsPerLesson).toFixed(1).replace('.', ',')} pro Wort`} value={c.wordsPerLesson} min={3} max={20} onChange={(v) => setCourse((x) => ({ ...x, wordsPerLesson: v }))} />
        <Stepper label="Lektionen pro Abschnitt" hint="Danach folgt eine Mini-Prüfung" value={c.lessonsPerUnit} min={2} max={8} onChange={(v) => setCourse((x) => ({ ...x, lessonsPerUnit: v }))} />
        <P muted>Die Wörter werden nach Schwierigkeit auf Leicht, Mittel und Schwer verteilt. Jede Stufe endet mit einer Abschlussprüfung (10, 20 bzw. 30 Fragen). Dein Fortschritt hängt an den Wörtern, Änderungen hier gehen also nicht verloren.</P>
      </Panel>

      <Btn kind="danger" label="Kurs löschen" onPress={onDelete} />
    </View>
  );
}
