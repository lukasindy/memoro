import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, CardBox, Field, H1, H2, P, Panel, Progress, TopBar, confirm, useTheme } from '../ui';
import { MIN_WORDS, boxCounts, dueCount, effective, estimateDifficulty, levels } from '../engine';
import { Course as CourseT } from '../store';

function useCourse(data: ScreenProps['data'], id: string) {
  return data.courses.find((c) => c.id === id);
}

export function Course({ data, go, back, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = useCourse(data, id);
  if (!c) return <TopBar onBack={back} />;
  const due = dueCount(c);
  const fresh = c.words.filter((w) => w.box === 0).length;
  const canLearn = c.words.length >= MIN_WORDS;

  const hint = !canLearn
    ? `Füge mindestens ${MIN_WORDS} Wörter hinzu, um zu starten.`
    : due > 0
      ? `${due} ${due === 1 ? 'Wort wartet' : 'Wörter warten'} auf Wiederholung${fresh ? `, dazu kommen neue Wörter` : ''}.`
      : fresh > 0
        ? `Als Nächstes lernst du neue Wörter, die leichtesten zuerst.`
        : 'Alles wiederholt. Eine Extra-Lektion übt deine unsichersten Wörter.';

  return (
    <View style={{ gap: 22 }}>
      <TopBar onBack={back} title={`${c.langA} – ${c.langB}`} />
      <H1>{c.name}</H1>

      <Panel>
        <H2>Karteikasten</H2>
        <CardBox counts={boxCounts(c)} />
        <P muted>Richtig beantwortete Wörter rutschen ein Fach weiter und kommen seltener dran. Fehler schicken sie zurück in Fach 1.</P>
      </Panel>

      <View style={{ gap: 10 }}>
        <Btn label="Lektion starten" onPress={() => go({ name: 'lesson', id })} disabled={!canLearn} />
        <P muted style={{ textAlign: 'center' }}>{hint}</P>
      </View>

      {c.words.length > 0 && (
        <Panel>
          <H2>Stufen</H2>
          {levels(c).map((l) => (
            <View key={l.name} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{l.name}</Text>
                <P muted>{l.learned} von {l.words.length} sicher</P>
              </View>
              <Progress value={l.words.length ? l.learned / l.words.length : 0} />
            </View>
          ))}
        </Panel>
      )}

      <View style={{ gap: 10 }}>
        <Btn kind="secondary" label="Wörter hinzufügen" onPress={() => go({ name: 'add', id })} />
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
