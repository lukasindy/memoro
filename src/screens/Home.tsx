import React, { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { ScreenProps } from '../nav';
import { Btn, CardBox, Field, H1, H2, P, Panel, TopBar, confirm, notify, useTheme } from '../ui';
import { boxCounts, dueCount } from '../engine';
import { DEFAULT_MIX, DEFAULT_WORDS_PER_LESSON, FREE_COURSE_LIMIT, isValidBackup, emptyData, migrate, uid } from '../store';
import { ensureUnits } from '../engine';
import { exportBackup, pickBackupFile } from '../platform';
import { Platform } from 'react-native';

export function Home({ data, go }: ScreenProps) {
  const t = useTheme();
  return (
    <View style={{ gap: 22 }}>
      <TopBar right={<Btn kind="ghost" label="Einstellungen" onPress={() => go({ name: 'settings' })} style={{ minHeight: 40, paddingHorizontal: 4 }} />} />
      <View style={{ gap: 6 }}>
        <H1>Memoro</H1>
        <P muted>Deine Wörter, deine Lektionen.</P>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Panel style={{ flex: 1, gap: 2, padding: 14 }}>
          <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{data.streak.count}</Text>
          <P muted>{data.streak.count === 1 ? 'Tag in Folge' : 'Tage in Folge'}</P>
        </Panel>
        <Panel style={{ flex: 1, gap: 2, padding: 14 }}>
          <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{data.xp}</Text>
          <P muted>XP gesamt</P>
        </Panel>
      </View>

      {data.courses.length === 0 ? (
        <Panel>
          <H2>Leg deinen ersten Kurs an</H2>
          <P muted>Ein Kurs ist eine Sammlung von Wörtern, z. B. „Latein Kapitel 1–5“ oder „Englisch Business“. Danach fügst du deine Liste ein, Memoro baut daraus die Lektionen.</P>
          <Btn label="Kurs anlegen" onPress={() => go({ name: 'newCourse' })} />
        </Panel>
      ) : (
        <View style={{ gap: 12 }}>
          {data.courses.map((c) => {
            const due = dueCount(c);
            const fresh = c.words.filter((w) => w.box === 0).length;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => go({ name: 'course', id: c.id })}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Panel>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <H2>{c.name}</H2>
                    <P muted>{c.langA} – {c.langB}</P>
                  </View>
                  <CardBox counts={boxCounts(c)} compact />
                  <P muted>
                    {c.words.length} Wörter
                    {due > 0 ? `, ${due} zur Wiederholung` : ''}
                    {fresh > 0 ? `, ${fresh} neu` : ''}
                  </P>
                </Panel>
              </Pressable>
            );
          })}
          <Btn kind="secondary" label="Neuen Kurs anlegen" onPress={() => go({ name: 'newCourse' })} />
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
      replace({ name: 'premium', reason: `In der Gratis-Version sind ${FREE_COURSE_LIMIT} Kurse möglich.` });
      return;
    }
    const id = uid();
    update((d) => ({
      ...d,
      courses: [...d.courses, { id, name: name.trim(), langA: langA.trim() || 'Fremdsprache', langB: langB.trim() || 'Deutsch', words: [], units: [], mix: { ...DEFAULT_MIX }, wordsPerLesson: DEFAULT_WORDS_PER_LESSON, lessons: 0, createdAt: Date.now() }],
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
        update(() => { const m = migrate(parsed); return { ...m, courses: m.courses.map(ensureUnits) }; });
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
            onValueChange={(v) => update((d) => ({ ...d, premium: v }))}
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
      <P muted style={{ textAlign: 'center', fontSize: 13 }}>Memoro 0.2 – Testversion</P>
    </View>
  );
}

export function Premium({ back, update, data, reason }: ScreenProps & { reason: string }) {
  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <H1>Memoro Premium</H1>
      <P>{reason}</P>
      <Panel>
        <P>• Wörter per Foto erfassen</P>
        <P>• Unbegrenzt viele Kurse</P>
        <P>• Statistik mit deinen schwierigsten Wörtern</P>
      </Panel>
      <P muted>In der Testversion gibt es noch keinen Kauf. Du kannst Premium hier zum Testen aktivieren.</P>
      <Btn
        label={data.premium ? 'Premium ist aktiv' : 'Premium testen'}
        disabled={data.premium}
        onPress={() => {
          update((d) => ({ ...d, premium: true }));
          back();
        }}
      />
    </View>
  );
}
