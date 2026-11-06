import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, H1, P, Panel, Progress, TopBar, confirm, useTheme } from '../ui';
import { COMBO_BONUS, COMBO_STEP, GOAL_BONUS, Exercise, PASS, SKIP_PASS, applyResults, gainXp, levelInfo, levelTitle, settleXp, buildExam, buildMixed, buildPath, buildReview, buildTest, markProgress, nextStreak, oldWordsFor, scaledMix, similarity, todayKey, wordsByIds } from '../engine';
import { canSpeak, speak } from '../platform';
import { clozeFor } from '../data/generate';
import { ClozeCard } from './ClozeCard';
import { QuitSheet } from './QuitSheet';
import { StarsBurst, starsFor } from './Stars';
import type { Word } from '../store';
import { LessonKind, LessonRef } from '../nav';
import { Ionicons } from '@expo/vector-icons';
import type { Extra, LevelUp } from '../engine';

type Item = Exercise & { retry?: boolean };

function build(c: NonNullable<ScreenProps['data']['courses'][number]>, node?: LessonRef): Exercise[] {
  if (!node) return buildReview(c);
  const words = wordsByIds(c, node.wordIds);
  if (node.kind === 'lesson') {
    const oldCount = Math.min(3, Math.max(1, Math.round(words.length / 4)));
    return buildMixed(c, words, scaledMix(c.mix, words.length), {
      canListen: canSpeak(c.langA),
      cloze: (w) => clozeFor(c, w),
      old: oldWordsFor(c, words, oldCount),
    });
  }
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
  const nodeKey = node?.key ?? 'review';
  const resume = c?.paused && c.paused.key === nodeKey ? c.paused : null;
  const initial = useMemo<Item[]>(() => (c ? (resume ? resume.queue : build(c, node)) : []), []);
  const [queue, setQueue] = useState<Item[]>(initial);
  const [pos, setPos] = useState(resume ? Math.min(resume.pos, Math.max(0, initial.length - 1)) : 0);
  const [quitOpen, setQuitOpen] = useState(false);
  // Serie ohne Fehler: gilt über Übungen und Lektionen hinweg
  const [combo, setCombo] = useState(data.combo ?? 0);
  const [shieldsLeft, setShieldsLeft] = useState(data.shields ?? 0);
  const bestRun = useRef(data.combo ?? 0);
  const sessionBest = useRef(0);
  const shieldsUsed = useRef(0);
  const pairsFailed = useRef(-1);
  const [flash, setFlash] = useState<{ icon: keyof typeof Ionicons.glyphMap; text: string; color: string } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(id);
  }, [flash]);
  const [picked, setPicked] = useState<string | null>(null);
  const [pairsDone, setPairsDone] = useState(false);
  const results = useRef(new Map<string, boolean>(resume ? resume.results : []));
  // xp: erst ab dem Fortsetzen gezählt (frühere XP wurden beim Speichern schon gutgeschrieben)
  const score = useRef({ firstTry: resume ? resume.firstTry : 0, xp: 0 });

  // Neue Wörter vor der Lektion spielerisch kennenlernen
  const introWords = useMemo(
    () => (c && !resume && node?.kind === 'lesson' ? wordsByIds(c, node.wordIds).filter((w) => !w.lp && w.right + w.wrong === 0) : []),
    [],
  );
  const [intro, setIntro] = useState(introWords.length > 0);

  if (!c || initial.length === 0) return <TopBar onBack={back} />;
  if (intro) {
    return (
      <>
        <IntroView
          words={introWords}
          langA={c.langA}
          langB={c.langB}
          onDone={() => setIntro(false)}
          onQuit={() => setQuitOpen(true)}
        />
        <QuitSheet visible={quitOpen} canSave={false} onContinue={() => setQuitOpen(false)} onDiscard={() => { setQuitOpen(false); back(); }} />
      </>
    );
  }

  const ex = queue[pos];
  const total = resume ? resume.total : initial.length;
  const progress = Math.min(1, pos / queue.length);

  const mark = (wordId: string, ok: boolean) => {
    if (!results.current.has(wordId)) results.current.set(wordId, ok);
    else if (!ok) results.current.set(wordId, false);
  };

  // Combo-Stand in die Daten übernehmen (beim Abschluss, Speichern und Beenden)
  const comboPatch = (d: typeof data) => ({
    combo,
    bestCombo: Math.max(d.bestCombo ?? 0, bestRun.current),
    shields: Math.max(0, (d.shields ?? 0) - shieldsUsed.current),
  });

  // Richtig/Falsch in die Serie einrechnen
  const hit = (ok: boolean) => {
    if (ok) {
      const n = combo + 1;
      setCombo(n);
      bestRun.current = Math.max(bestRun.current, n);
      sessionBest.current = Math.max(sessionBest.current, n);
      if (n % COMBO_STEP === 0) {
        score.current.xp += COMBO_BONUS;
        setFlash({ icon: 'flash', text: `${n} in Folge! +${COMBO_BONUS} XP`, color: '#F2B01E' });
      }
    } else if (combo >= COMBO_STEP && shieldsLeft > 0) {
      setShieldsLeft(shieldsLeft - 1);
      shieldsUsed.current++;
      setFlash({ icon: 'shield-checkmark', text: `Combo-Schutz rettet deine ${combo}er Serie`, color: '#4A9BD9' });
    } else {
      setCombo(0);
    }
  };

  const finish = () => {
    const errors = total - score.current.firstTry;
    const pct = Math.round(((total - errors) / total) * 100);
    const need = kind === 'skip' ? SKIP_PASS : PASS;
    const passed = !isTest || pct >= need;
    const base = score.current.xp + (errors === 0 ? 10 : 0) + (isTest && passed ? (kind === 'unitTest' ? 20 : 50) : 0);
    const s0 = settleXp(data, base);
    const g = s0.g;
    update((d) => {
      const s1 = settleXp(d, base);
      return {
        ...d,
        ...s1.patch,
        ...comboPatch(d),
        shields: Math.max(0, s1.patch.shields - shieldsUsed.current),
        courses: d.courses.map((x) => {
          if (x.id !== id) return x;
          const updated = applyResults({ ...x, paused: undefined }, results.current);
          return node ? markProgress(updated, node.kind, node.wordIds, pct, node.kind === 'skip' ? undefined : node.key) : updated;
        }),
      };
    });
    const extra: Extra = { goal: s0.reached, reward: s0.reward, combo: sessionBest.current };
    replace({ name: 'result', id, total, errors, xp: g.gained, kind, passed, boosted: g.boosted, up: g.up, extra });
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
    const ok = ex.kind === 'build' ? opt.trim().toLowerCase() === ex.answer.toLowerCase() : opt === ex.answer;
    mark(ex.word.id, ok);
    hit(ok);
    if (ok && !ex.retry) {
      score.current.firstTry++;
      score.current.xp += 10;
    }
    if (!ok && !ex.retry) setQueue((q) => [...q, { ...ex, retry: true }]);
  };

  const quit = () => setQuitOpen(true);

  // Stand speichern: bisher verdiente XP gutschreiben, Serie fortschreiben, Lektion später fortsetzen
  const saveAndLeave = () => {
    const done = picked !== null || pairsDone ? pos + 1 : pos;
    if (done >= queue.length) {
      setQuitOpen(false);
      finish();
      return;
    }
    const xpNow = score.current.xp;
    const snapshot = {
      key: nodeKey,
      queue: JSON.parse(JSON.stringify(queue)),
      pos: done,
      total,
      results: Array.from(results.current.entries()) as [string, boolean][],
      firstTry: score.current.firstTry,
      savedAt: Date.now(),
    };
    update((d) => {
      const s1 = settleXp(d, xpNow);
      return {
        ...d,
        ...s1.patch,
        courses: d.courses.map((x) => (x.id === id ? { ...x, paused: snapshot } : x)),
        ...comboPatch(d),
        shields: Math.max(0, s1.patch.shields - shieldsUsed.current),
      };
    });
    setQuitOpen(false);
    back();
  };

  // Ohne Speichern beenden: auch einen alten Zwischenstand verwerfen
  const discard = () => {
    setQuitOpen(false);
    update((d) => ({
      ...d,
      ...comboPatch(d),
      courses: resume ? d.courses.map((x) => (x.id === id ? { ...x, paused: undefined } : x)) : d.courses,
    }));
    back();
  };

  const correct = picked !== null && ex.kind !== 'pairs' && (ex.kind === 'build' ? picked.trim().toLowerCase() === ex.answer.toLowerCase() : picked === ex.answer);

  return (
    <View style={{ gap: 22, flex: 1 }}>
      <QuitSheet visible={quitOpen} canSave onContinue={() => setQuitOpen(false)} onSave={saveAndLeave} onDiscard={discard} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={quit} accessibilityRole="button" accessibilityLabel="Lektion abbrechen" hitSlop={12}>
          <Text style={{ color: t.muted, fontSize: 26, fontWeight: '600' }}>×</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <LessonBar value={progress} hot={combo >= COMBO_STEP} />
        </View>
        <ComboBadge n={combo} shield={shieldsLeft > 0 && combo >= COMBO_STEP} />
      </View>
      {flash && (
        <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface, borderWidth: 2, borderColor: flash.color, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Ionicons name={flash.icon} size={20} color={flash.color} />
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: '900' }}>{flash.text}</Text>
        </View>
      )}

      {ex.kind === 'pairs' ? (
        <PairsView
          key={pos}
          ex={ex}
          onMistake={(wid) => {
            mark(wid, false);
            if (pairsFailed.current !== pos) {
              pairsFailed.current = pos;
              hit(false);
            }
          }}
          onDone={(clean) => {
            ex.words.forEach((w) => mark(w.id, true));
            if (clean) hit(true);
            if (clean) score.current.firstTry++;
            score.current.xp += clean ? 10 : 5;
            setPairsDone(true);
          }}
        />
      ) : ex.kind === 'build' ? (
        <BuildView key={pos} ex={ex} langA={c.langA} picked={picked} onSubmit={answer} retry={!!ex.retry} />
      ) : (
        <View style={{ gap: 22 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {ex.kind === 'choice' && ex.old && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Ionicons name="refresh" size={12} color={t.muted} />
                  <Text style={{ color: t.muted, fontSize: 12, fontWeight: '800' }}>Wiederholung</Text>
                </View>
              )}
              <Instruction style={{ flex: 1 }} small={isTest && pos === 0}>
                {ex.retry
                  ? 'Noch einmal'
                  : isTest && pos === 0
                    ? `${kind === 'unitTest' ? 'Mini-Prüfung' : kind === 'skip' ? 'Einstufungsprüfung' : 'Abschlussprüfung'}: ${total} Fragen, bestanden ab ${kind === 'skip' ? SKIP_PASS : PASS} %.`
                    : ex.kind === 'spelling'
                      ? `Wie schreibt man das auf ${c.langA}?`
                      : ex.kind === 'listen'
                        ? `Hör genau hin. Was bedeutet das auf ${c.langB}?`
                        : ex.kind === 'cloze'
                          ? 'Vervollständige den Satz.'
                          : ex.dir === 'ab'
                            ? ex.isNew ? `Neues Wort. Was heißt das auf ${c.langB}?` : `Was heißt das auf ${c.langB}?`
                            : `Was heißt das auf ${c.langA}?`}
              </Instruction>
            </View>
            {ex.kind === 'listen' ? (
              <ListenCard key={pos} text={ex.prompt} lang={c.langA} reveal={!!picked} />
            ) : ex.kind === 'cloze' ? (
<ClozeCard ex={ex} picked={!!picked} t={t} />
) : (
              /* Die Karteikarte */
              <View style={{ backgroundColor: t.card, borderRadius: 6, paddingVertical: 34, paddingHorizontal: 20, alignItems: 'center', transform: [{ rotate: '-1deg' }] }}>
                <Text style={{ color: t.onCard, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>{ex.prompt}</Text>
              </View>
            )}
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
              {ex.kind === 'spelling' || ex.kind === 'build'
                ? `Richtig: ${ex.kind === 'build' ? ex.prefix : ''}${ex.answer}`
                : ex.kind === 'cloze'
                  ? `Richtig: ${ex.before}${ex.answer}${ex.after}`
                  : `${ex.prompt} = ${ex.answer}`}
              {'\n'}Das Wort kommt am Ende noch einmal.
            </P>
          )}
          <Btn label={pos + 1 >= queue.length ? 'Lektion abschließen' : 'Weiter'} onPress={next} />
        </Panel>
      )}
    </View>
  );
}

// Aufgabentext: groß und deutlich, nicht zu übersehen
function Instruction({ children, style, small }: { children: React.ReactNode; style?: any; small?: boolean }) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.ink, fontSize: small ? 17 : 23, lineHeight: small ? 24 : 29, fontWeight: '900', letterSpacing: -0.4 }, style]}>{children}</Text>
  );
}

// Fortschrittsbalken: dick, weich animiert, mit Glanzlicht; golden, solange die Serie läuft
function LessonBar({ value, hot }: { value: number; hot: boolean }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, value)), duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);
  const w = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const color = hot ? '#F2B01E' : t.primary;
  return (
    <View style={{ height: 22, borderRadius: 11, backgroundColor: t.line, overflow: 'hidden', padding: 3 }}>
      <Animated.View style={{ height: '100%', width: w, minWidth: 16, borderRadius: 8, backgroundColor: color, justifyContent: 'center' }}>
        <View style={{ marginHorizontal: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)', marginBottom: 4 }} />
      </Animated.View>
    </View>
  );
}

// Serien-Anzeige: eigenes Blitz-Symbol, poppt bei jeder richtigen Antwort
function ComboBadge({ n, shield }: { n: number; shield: boolean }) {
  const t = useTheme();
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (n === 0) return;
    pop.setValue(1.35);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [n]);
  const on = n >= 2;
  const hot = n >= COMBO_STEP;
  const bg = hot ? '#F2B01E' : on ? t.card : t.surface;
  const fg = on ? '#2B2410' : t.muted;
  return (
    <Animated.View
      accessibilityLabel={`${n} richtige Antworten in Folge`}
      style={{ transform: [{ scale: pop }], flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: bg, borderRadius: 999, borderWidth: 2, borderColor: on ? 'transparent' : t.line, paddingHorizontal: 10, paddingVertical: 4 }}
    >
      <Ionicons name="flash" size={16} color={fg} />
      <Text style={{ color: fg, fontSize: 16, fontWeight: '900' }}>{n}</Text>
      {shield && <Ionicons name="shield-checkmark" size={14} color="#2F7FC0" />}
    </Animated.View>
  );
}

// Hörübung: Lautsprecher-Karte, spielt das Wort beim Öffnen und auf Tippen ab
function ListenCard({ text, lang, reveal }: { text: string; lang: string; reveal: boolean }) {
  const t = useTheme();
  useEffect(() => {
    const id = setTimeout(() => speak(text, lang), 250);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nochmal anhören"
      onPress={() => speak(text, lang)}
      style={({ pressed }) => ({ backgroundColor: t.card, borderRadius: 6, paddingVertical: 26, alignItems: 'center', gap: 8, transform: [{ rotate: '-1deg' }, { scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.onCard, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="volume-high" size={36} color={t.card} />
      </View>
      <Text style={{ color: t.onCard, fontSize: reveal ? 24 : 14, fontWeight: reveal ? '800' : '700' }}>{reveal ? text : 'Tippen zum Anhören'}</Text>
    </Pressable>
  );
}

// Buchstaben-Puzzle: Wort aus Kacheln zusammensetzen
function BuildView({ ex, langA, picked, onSubmit, retry }: { ex: Extract<Exercise, { kind: 'build' }>; langA: string; picked: string | null; onSubmit: (s: string) => void; retry: boolean }) {
  const t = useTheme();
  const [used, setUsed] = useState<number[]>([]);
  const typed = used.map((i) => ex.tiles[i]).join('');
  const done = picked !== null;
  const ok = done && picked!.trim().toLowerCase() === ex.answer.toLowerCase();
  const tap = (i: number) => {
    if (done || used.includes(i)) return;
    const nu = [...used, i];
    setUsed(nu);
    if (nu.length === ex.tiles.length) onSubmit(nu.map((k) => ex.tiles[k]).join(''));
  };
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 8 }}>
        <Instruction>{retry ? 'Noch einmal' : `Setz das Wort auf ${langA} zusammen.`}</Instruction>
        <View style={{ backgroundColor: t.card, borderRadius: 6, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', transform: [{ rotate: '-1deg' }] }}>
          <Text style={{ color: t.onCard, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>{ex.prompt}</Text>
        </View>
      </View>
      <View
        style={{
          minHeight: 58,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: done ? (ok ? t.right : t.wrong) : t.line,
          backgroundColor: done ? (ok ? t.rightBg : t.wrongBg) : t.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 8,
        }}
      >
        {ex.prefix ? <Text style={{ color: t.muted, fontSize: 22, fontWeight: '700' }}>{ex.prefix.trim()}</Text> : null}
        <Text style={{ flex: 1, color: t.ink, fontSize: 24, fontWeight: '800', letterSpacing: 2 }}>{typed || ' '}</Text>
        {!done && used.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Letzten Buchstaben löschen" hitSlop={10} onPress={() => setUsed(used.slice(0, -1))}>
            <Ionicons name="backspace-outline" size={26} color={t.muted} />
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {ex.tiles.map((ch, i) => {
          const isUsed = used.includes(i);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={ch === ' ' ? 'Leerzeichen' : ch}
              onPress={() => tap(i)}
              disabled={isUsed || done}
              style={({ pressed }) => ({
                width: 46,
                height: 52,
                borderRadius: 12,
                borderWidth: 2,
                borderBottomWidth: 5,
                borderColor: t.line,
                backgroundColor: t.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isUsed ? 0.2 : 1,
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{ch === ' ' ? '␣' : ch}</Text>
            </Pressable>
          );
        })}
      </View>
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
      <Instruction>Finde die Paare.</Instruction>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 10 }}>{ex.words.map((w) => tile(w.a, w.id, 'l'))}</View>
        <View style={{ flex: 1, gap: 10 }}>{right.map((w) => tile(w.b, w.id, 'r'))}</View>
      </View>
    </View>
  );
}

export function Result({ total, errors, xp, back, kind, passed, boosted, up, extra, data }: ScreenProps & { id: string; total: number; errors: number; xp: number; kind: LessonKind; passed: boolean; boosted?: boolean; up?: LevelUp | null; extra?: Extra }) {
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
      {passed && <StarsBurst n={starsFor(pct)} />}
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
      {extra && extra.combo >= 2 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="flash" size={18} color="#D99A00" />
          <P>Längste Serie in dieser Lektion: {extra.combo} richtige Antworten in Folge.</P>
        </View>
      )}
      {extra?.goal && (
        <View style={{ backgroundColor: t.rightBg, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="flag" size={30} color={t.right} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.right, fontSize: 18, fontWeight: '900' }}>Tagesziel erreicht!</Text>
            <Text style={{ color: t.ink, fontSize: 14 }}>+{GOAL_BONUS} Bonus-XP für heute.</Text>
          </View>
        </View>
      )}
      {extra?.reward && (
        <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, gap: 8, alignItems: 'center' }}>
          <Ionicons name="flame" size={40} color="#C4531A" />
          <Text style={{ color: t.onCard, fontSize: 22, fontWeight: '900' }}>{extra.reward.days} Tage in Folge!</Text>
          <Text style={{ color: t.onCard, fontSize: 15, fontWeight: '700' }}>Deine Serien-Belohnung:</Text>
          {extra.reward.minutes > 0 && <Text style={{ color: t.onCard, fontSize: 15 }}>+{extra.reward.minutes} Minuten Social-Media-Zeit</Text>}
          {extra.reward.boosters > 0 && <Text style={{ color: t.onCard, fontSize: 15 }}>+{extra.reward.boosters} XP-Booster</Text>}
          {extra.reward.freezes > 0 && <Text style={{ color: t.onCard, fontSize: 15 }}>+{extra.reward.freezes} Streak-Schutz</Text>}
          {extra.reward.shields > 0 && <Text style={{ color: t.onCard, fontSize: 15 }}>+{extra.reward.shields} Combo-Schutz</Text>}
        </View>
      )}
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
          {up.minutes > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="phone-portrait" size={18} color={t.onCard} />
              <Text style={{ color: t.onCard, fontSize: 15, fontWeight: '800' }}>+{up.minutes} Minuten Social-Media-Zeit</Text>
            </View>
          )}
          {up.shields > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={18} color={t.onCard} />
              <Text style={{ color: t.onCard, fontSize: 15 }}>+{up.shields} Combo-Schutz (rettet deine Serie bei einem Fehler)</Text>
            </View>
          )}
          {up.title && <Text style={{ color: t.onCard, fontSize: 16, fontWeight: '900' }}>Neuer Titel: {up.title}</Text>}
          {up.freezes === 0 && <Text style={{ color: t.onCard, fontSize: 13, opacity: 0.8 }}>Streak-Schutz ist schon voll (max. 3).</Text>}
        </View>
      )}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>Level {lv.level} · {levelTitle(lv.level)}</Text>
          <P muted>{lv.into} / {lv.need} XP</P>
        </View>
        <Progress value={lv.progress} color={t.card} />
      </View>
      <P muted>{note}</P>
      <Btn label="Weiter" onPress={back} />
    </View>
  );
}
