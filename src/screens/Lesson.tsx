import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, H1, P, Panel, Progress, TopBar, confirm, useTheme } from '../ui';
import { Exercise, PASS, SKIP_PASS, applyResults, gainXp, levelInfo, buildExam, buildMixed, buildPath, buildReview, buildTest, markProgress, nextStreak, similarity, wordsByIds } from '../engine';
import type { Word } from '../store';
import { LessonKind, LessonRef } from '../nav';
import { Ionicons } from '@expo/vector-icons';
import type { LevelUp } from '../engine';

type Item = Exercise & { retry?: boolean };

function build(c: NonNullable<ScreenProps['data']['courses'][number]>, node?: LessonRef): Exercise[] {
  if (!node) return buildReview(c);
  const words = wordsByIds(c, node.wordIds);
  if (node.kind === 'lesson') return buildMixed(c, words, c.mix);
  if (node.kind === 'unitTest') return buildTest(c, words);
  const size = buildPath(c)[node.section]?.examSize ?? 10;
  return buildExam(c, words, size);
}

export function Lesson({ data, update, back, replace, id, node }: ScreenProps & { id: string; node?: LessonRef }) {
  const t = useTheme();
  const c = data.courses.find((x) => x.id === id)!;
  const kind: LessonKind = node ? node.kind : 'review';
  const isTest = kind === 'unitTest' || kind === 'exam' || kind === 'skip';
  // einmal pro Lektion erzeugen
  const initial = useMemo(() => (c ? build(c, node) : []), []);
  const [queue, setQueue] = useState<Item[]>(initial);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [pairsDone, setPairsDone] = useState(false);
  const results = useRef(new Map<string, boolean>());
  const score = useRef({ firstTry: 0, xp: 0 });

  // Neue Wörter vor der Lektion spielerisch kennenlernen
  const introWords = useMemo(
    () => (c && node?.kind === 'lesson' ? wordsByIds(c, node.wordIds).filter((w) => !w.lp && w.right + w.wrong === 0) : []),
    [],
  );
  const [intro, setIntro] = useState(introWords.length > 0);

  if (!c || initial.length === 0) return <TopBar onBack={back} />;
  if (intro) {
    return (
      <IntroView
        words={introWords}
        langA={c.langA}
        langB={c.langB}
        onDone={() => setIntro(false)}
        onQuit={() => confirm('Lektion abbrechen?', back)}
      />
    );
  }

  const ex = queue[pos];
  const total = initial.length;
  const progress = Math.min(1, pos / queue.length);

  const mark = (wordId: string, ok: boolean) => {
    if (!results.current.has(wordId)) results.current.set(wordId, ok);
    else if (!ok) results.current.set(wordId, false);
  };

  const finish = () => {
    const errors = total - score.current.firstTry;
    const pct = Math.round(((total - errors) / total) * 100);
    const need = kind === 'skip' ? SKIP_PASS : PASS;
    const passed = !isTest || pct >= need;
    const base = score.current.xp + (errors === 0 ? 10 : 0) + (isTest && passed ? (kind === 'unitTest' ? 20 : 50) : 0);
    const g = gainXp(data, base);
    update((d) => {
      const gx = gainXp(d, base);
      const st = nextStreak(d.streak, gx.freezes);
      return {
      ...d,
      xp: gx.xp,
      freezes: gx.freezes - st.used,
      boost: gx.boost,
      boosters: gx.boosters,
      streak: st.streak,
      courses: d.courses.map((x) => {
        if (x.id !== id) return x;
        const updated = applyResults(x, results.current);
        return node ? markProgress(updated, node.kind, node.wordIds, pct, node.kind === 'skip' ? undefined : node.key) : updated;
      }),
      };
    });
    replace({ name: 'result', id, total, errors, xp: g.gained, kind, passed, boosted: g.boosted, up: g.up });
  };

  const next = () => {
    setPicked(null);
    setPairsDone(false);
    if (pos + 1 >= queue.length) finish();
    else setPos(pos + 1);
  };

  const answer = (opt: string) => {
    if (picked || ex.kind === 'pairs') return;
    setPicked(opt);
    const ok = opt === ex.answer;
    mark(ex.word.id, ok);
    if (ok && !ex.retry) {
      score.current.firstTry++;
      score.current.xp += 10;
    }
    if (!ok && !ex.retry) setQueue((q) => [...q, { ...ex, retry: true }]);
  };

  const quit = () => confirm('Lektion abbrechen? Der Fortschritt dieser Lektion geht verloren.', back);

  const correct = picked !== null && ex.kind !== 'pairs' && picked === ex.answer;

  return (
    <View style={{ gap: 22, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={quit} accessibilityRole="button" accessibilityLabel="Lektion abbrechen" hitSlop={12}>
          <Text style={{ color: t.muted, fontSize: 26, fontWeight: '600' }}>×</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Progress value={progress} />
        </View>
      </View>

      {ex.kind === 'pairs' ? (
        <PairsView
          key={pos}
          ex={ex}
          onMistake={(wid) => mark(wid, false)}
          onDone={(clean) => {
            ex.words.forEach((w) => mark(w.id, true));
            if (clean) score.current.firstTry++;
            score.current.xp += clean ? 10 : 5;
            setPairsDone(true);
          }}
        />
      ) : (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 8 }}>
            <P muted>
              {ex.retry
                ? 'Noch einmal'
                : isTest && pos === 0
                  ? `${kind === 'unitTest' ? 'Mini-Prüfung' : kind === 'skip' ? 'Einstufungsprüfung' : 'Abschlussprüfung'}: ${total} Fragen, bestanden ab ${kind === 'skip' ? SKIP_PASS : PASS} %.`
                : ex.kind === 'spelling'
                  ? `Wie schreibt man das auf ${c.langA}?`
                  : ex.dir === 'ab'
                    ? ex.isNew ? `Neues Wort. Was heißt das auf ${c.langB}?` : `Was heißt das auf ${c.langB}?`
                    : `Was heißt das auf ${c.langA}?`}
            </P>
            {/* Die Karteikarte */}
            <View style={{ backgroundColor: t.card, borderRadius: 6, paddingVertical: 34, paddingHorizontal: 20, alignItems: 'center', transform: [{ rotate: '-1deg' }] }}>
              <Text style={{ color: t.onCard, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>{ex.prompt}</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {ex.options.map((o) => {
              const isAnswer = o === ex.answer;
              const isPicked = o === picked;
              const state = picked ? (isAnswer ? 'right' : isPicked ? 'wrong' : 'idle') : 'idle';
              return (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  onPress={() => answer(o)}
                  disabled={!!picked}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    justifyContent: 'center',
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderColor: state === 'right' ? t.right : state === 'wrong' ? t.wrong : t.line,
                    backgroundColor: state === 'right' ? t.rightBg : state === 'wrong' ? t.wrongBg : t.surface,
                    opacity: picked && state === 'idle' ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: t.ink, fontSize: 18, fontWeight: '600' }}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {(picked || pairsDone) && (
        <Panel style={{ backgroundColor: ex.kind === 'pairs' || correct ? t.rightBg : t.wrongBg, borderColor: 'transparent' }}>
          <Text style={{ color: ex.kind === 'pairs' || correct ? t.right : t.wrong, fontSize: 18, fontWeight: '800' }}>
            {ex.kind === 'pairs' ? 'Alle Paare gefunden' : correct ? 'Richtig' : 'Nicht ganz'}
          </Text>
          {ex.kind !== 'pairs' && !correct && (
            <P>
              {ex.kind === 'spelling' ? `Richtig geschrieben: ${ex.answer}` : `${ex.prompt} = ${ex.answer}`}
              {'\n'}Das Wort kommt am Ende noch einmal.
            </P>
          )}
          <Btn label={pos + 1 >= queue.length ? 'Lektion abschließen' : 'Weiter'} onPress={next} />
        </Panel>
      )}
    </View>
  );
}

// Karteikarten zum Umdrehen: Wort vorne, Bedeutung mit Infobox hinten
function IntroView({ words, langA, langB, onDone, onQuit }: { words: Word[]; langA: string; langB: string; onDone: () => void; onQuit: () => void }) {
  const t = useTheme();
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const w = words[idx];
  const last = idx === words.length - 1;
  const easy = similarity(w.a, w.b) >= 0.6;

  const flip = () => {
    const native = Platform.OS !== 'web';
    Animated.timing(scale, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: native }).start(() => {
      setFlipped((f) => !f);
      Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
    });
  };

  const next = () => {
    if (last) return onDone();
    setFlipped(false);
    setIdx(idx + 1);
  };

  return (
    <View style={{ gap: 22, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={onQuit} accessibilityRole="button" accessibilityLabel="Lektion abbrechen" hitSlop={12}>
          <Text style={{ color: t.muted, fontSize: 26, fontWeight: '600' }}>×</Text>
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {words.map((_, k) => (
            <View key={k} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: k < idx || (k === idx && flipped) ? t.card : t.line }} />
          ))}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sparkles" size={18} color="#D99A00" />
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: '900' }}>Neue Wörter kennenlernen</Text>
        </View>
        <P muted>
          Wort {idx + 1} von {words.length} · {flipped ? 'Präg es dir kurz ein.' : 'Tippe auf die Karte, um sie umzudrehen.'}
        </P>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={flipped ? `${w.a} heißt ${w.b}` : `${w.a}, Karte umdrehen`} onPress={flip}>
        <Animated.View
          style={{
            transform: [{ scaleX: scale }, { rotate: flipped ? '1deg' : '-1.5deg' }],
            backgroundColor: flipped ? t.surface : t.card,
            borderRadius: 14,
            borderWidth: flipped ? 2 : 0,
            borderColor: t.card,
            minHeight: 210,
            padding: 22,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Text style={{ color: flipped ? t.muted : t.onCard, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>
            {(flipped ? langB : langA).toUpperCase()}
          </Text>
          <Text style={{ color: flipped ? t.ink : t.onCard, fontSize: 34, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
            {flipped ? w.b : w.a}
          </Text>
          {!flipped && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.75 }}>
              <Ionicons name="sync" size={16} color={t.onCard} />
              <Text style={{ color: t.onCard, fontSize: 14, fontWeight: '700' }}>Tippen zum Umdrehen</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {flipped && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, backgroundColor: t.rightBg, borderRadius: 16, padding: 14, alignItems: 'flex-start' }}>
            <Ionicons name="information-circle" size={22} color={t.right} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.ink, fontSize: 15, fontWeight: '800' }}>
                {w.a} auf {langB}
              </Text>
              <Text style={{ color: t.ink, fontSize: 15 }}>„{w.a}“ bedeutet „{w.b}“.</Text>
            </View>
          </View>
          {easy && (
            <View style={{ flexDirection: 'row', gap: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 16, padding: 14, alignItems: 'flex-start' }}>
              <Ionicons name="bulb" size={22} color="#D99A00" />
              <Text style={{ flex: 1, color: t.ink, fontSize: 15 }}>
                Merktipp: Das Wort ähnelt dem {langB}-Wort. Das merkst du dir leicht!
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={{ flex: 1 }} />
      {flipped ? (
        <Btn label={last ? 'Lektion starten' : 'Nächstes Wort'} onPress={next} />
      ) : (
        <Btn label="Umdrehen" onPress={flip} />
      )}
      <Pressable accessibilityRole="button" onPress={onDone} style={{ alignSelf: 'center', paddingVertical: 4 }}>
        <Text style={{ color: t.muted, fontSize: 14 }}>Überspringen und direkt loslegen</Text>
      </Pressable>
    </View>
  );
}

function PairsView({ ex, onMistake, onDone }: { ex: Extract<Exercise, { kind: 'pairs' }>; onMistake: (id: string) => void; onDone: (clean: boolean) => void }) {
  const t = useTheme();
  const right = useMemo(() => [...ex.words].sort(() => Math.random() - 0.5), [ex]);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [clean, setClean] = useState(true);

  const pickRight = (wid: string) => {
    if (!sel || matched.includes(wid)) return;
    if (sel === wid) {
      const m = [...matched, wid];
      setMatched(m);
      setSel(null);
      if (m.length === ex.words.length) onDone(clean);
    } else {
      onMistake(sel);
      setClean(false);
      setFlash(wid);
      setTimeout(() => setFlash(null), 450);
      setSel(null);
    }
  };

  const tile = (label: string, wid: string, side: 'l' | 'r') => {
    const done = matched.includes(wid);
    const active = side === 'l' && sel === wid;
    const bad = side === 'r' && flash === wid;
    return (
      <Pressable
        key={side + wid}
        accessibilityRole="button"
        disabled={done}
        onPress={() => (side === 'l' ? setSel(wid) : pickRight(wid))}
        style={{
          minHeight: 56,
          justifyContent: 'center',
          paddingHorizontal: 12,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: bad ? t.wrong : active ? t.primary : done ? t.right : t.line,
          backgroundColor: bad ? t.wrongBg : done ? t.rightBg : t.surface,
          opacity: done ? 0.55 : 1,
        }}
      >
        <Text style={{ color: t.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      <P muted>Finde die Paare.</P>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 10 }}>{ex.words.map((w) => tile(w.a, w.id, 'l'))}</View>
        <View style={{ flex: 1, gap: 10 }}>{right.map((w) => tile(w.b, w.id, 'r'))}</View>
      </View>
    </View>
  );
}

export function Result({ total, errors, xp, back, kind, passed, boosted, up, data }: ScreenProps & { id: string; total: number; errors: number; xp: number; kind: LessonKind; passed: boolean; boosted?: boolean; up?: LevelUp | null }) {
  const t = useTheme();
  const lv = levelInfo(data.xp);
  const pct = Math.round(((total - errors) / total) * 100);
  const isTest = kind === 'unitTest' || kind === 'exam' || kind === 'skip';
  const title = isTest
    ? passed ? (kind === 'skip' ? 'Abschnitt übersprungen' : 'Bestanden') : 'Noch nicht bestanden'
    : pct === 100 ? 'Fehlerfrei' : pct >= 80 ? 'Stark' : pct >= 50 ? 'Gut dran' : 'Weiter üben';
  const notes: Record<LessonKind, [string, string]> = {
    lesson: ['Lektion geschafft, die nächste ist freigeschaltet. Falsch beantwortete Wörter kommen in der Wiederholung wieder dran.', ''],
    unitTest: ['Mini-Prüfung geschafft, weiter geht es mit dem nächsten Abschnitt.', `Für die Mini-Prüfung brauchst du mindestens ${PASS} %. Wiederhole die Lektionen des Abschnitts und versuch es noch einmal.`],
    exam: ['Abschnitt abgeschlossen. Der nächste Abschnitt ist freigeschaltet.', `Für die Abschlussprüfung brauchst du mindestens ${PASS} %. Übe noch etwas und versuch es dann erneut.`],
    skip: ['Du bist direkt in den Abschnitt gesprungen. Alle Abschnitte bis hierher gelten als abgeschlossen.', `Zum Überspringen brauchst du mindestens ${SKIP_PASS} %. Du kannst den Abschnitt auch ganz normal durcharbeiten.`],
    review: [errors > 0 ? 'Falsch beantwortete Wörter liegen wieder in Fach 1 und kommen bei der nächsten Wiederholung zuerst dran.' : 'Alle Wörter sind ein Fach im Karteikasten weitergerutscht.', ''],
  };
  const note = passed ? notes[kind][0] : notes[kind][1];
  return (
    <View style={{ gap: 24, paddingTop: 30 }}>
      <H1>{title}</H1>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          [`${pct} %`, 'richtig'],
          [String(errors), 'Fehler'],
          [`+${xp}`, 'XP'],
        ].map(([v, l]) => (
          <Panel key={l} style={{ flex: 1, gap: 2, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>{v}</Text>
            <P muted>{l}</P>
          </Panel>
        ))}
      </View>
      {boosted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="rocket" size={18} color={t.primary} />
          <P>XP-Booster aktiv: doppelte XP für diese Lektion.</P>
        </View>
      )}
      {up && (
        <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, gap: 10, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.onCard, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.card, fontSize: 26, fontWeight: '900' }}>{up.to}</Text>
          </View>
          <Text style={{ color: t.onCard, fontSize: 22, fontWeight: '900' }}>Level {up.to} erreicht!</Text>
          <Text style={{ color: t.onCard, fontSize: 15, fontWeight: '700' }}>Dein Bonus:</Text>
          {up.freezes > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="snow" size={18} color={t.onCard} />
              <Text style={{ color: t.onCard, fontSize: 15 }}>
                +{up.freezes} Streak-Schutz (rettet einen verpassten Tag)
              </Text>
            </View>
          )}
          {up.boost && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="rocket" size={18} color={t.onCard} />
              <Text style={{ color: t.onCard, fontSize: 15 }}>+1 XP-Booster im Inventar (doppelte XP für 3 Lektionen)</Text>
            </View>
          )}
          {up.freezes === 0 && !up.boost && <Text style={{ color: t.onCard, fontSize: 15 }}>Streak-Schutz ist schon voll (max. 3).</Text>}
        </View>
      )}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>Level {lv.level}</Text>
          <P muted>{lv.into} / {lv.need} XP</P>
        </View>
        <Progress value={lv.progress} color={t.card} />
      </View>
      <P muted>{note}</P>
      <Btn label="Weiter" onPress={back} />
    </View>
  );
}
