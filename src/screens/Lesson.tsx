import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, H1, P, Panel, Progress, TopBar, confirm, useTheme } from '../ui';
import { Exercise, applyResults, buildLesson, nextStreak } from '../engine';

type Item = Exercise & { retry?: boolean };

export function Lesson({ data, update, back, replace, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = data.courses.find((x) => x.id === id)!;
  const initial = useMemo(() => buildLesson(c), []); // einmal pro Lektion
  const [queue, setQueue] = useState<Item[]>(initial);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [pairsDone, setPairsDone] = useState(false);
  const results = useRef(new Map<string, boolean>());
  const score = useRef({ firstTry: 0, xp: 0 });

  if (!c || initial.length === 0) return <TopBar onBack={back} />;

  const ex = queue[pos];
  const total = initial.length;
  const progress = Math.min(1, pos / queue.length);

  const mark = (wordId: string, ok: boolean) => {
    if (!results.current.has(wordId)) results.current.set(wordId, ok);
    else if (!ok) results.current.set(wordId, false);
  };

  const finish = () => {
    const errors = total - score.current.firstTry;
    const xp = score.current.xp + (errors === 0 ? 10 : 0);
    update((d) => ({
      ...d,
      xp: d.xp + xp,
      streak: nextStreak(d.streak),
      courses: d.courses.map((x) => (x.id === id ? applyResults(x, results.current) : x)),
    }));
    replace({ name: 'result', id, total, errors, xp });
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

export function Result({ total, errors, xp, back }: ScreenProps & { id: string; total: number; errors: number; xp: number }) {
  const t = useTheme();
  const pct = Math.round(((total - errors) / total) * 100);
  const title = pct === 100 ? 'Fehlerfrei' : pct >= 80 ? 'Stark' : pct >= 50 ? 'Gut dran' : 'Weiter üben';
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
      <P muted>
        {errors > 0
          ? 'Die falsch beantworteten Wörter liegen wieder in Fach 1 und kommen in der nächsten Lektion zuerst dran.'
          : 'Alle Wörter sind ein Fach weitergerutscht.'}
      </P>
      <Btn label="Zurück zum Kurs" onPress={back} />
    </View>
  );
}
