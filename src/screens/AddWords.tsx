import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text, TextInput } from '../i18n';
import { ScreenProps } from '../nav';
import { Btn, Field, H1, H2, P, Panel, Progress, TopBar, notify, useTheme } from '../ui';
import { Pair, parseList } from '../parser';
import { freeSlots, newWord } from '../engine';
import { FREE_WORD_LIMIT } from '../store';
import { ocrAvailable, ocrLanguages, pickImage, recognizeText } from '../platform';

const EXAMPLE = 'amicus ; der Freund\naqua – das Wasser\nporta = die Tür';

export function AddWords({ data, update, back, go, id }: ScreenProps & { id: string }) {
  const t = useTheme();
  const c = data.courses.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [info, setInfo] = useState('');
  const [ocr, setOcr] = useState<{ busy: boolean; progress: number }>({ busy: false, progress: 0 });
  if (!c) return <TopBar onBack={back} />;

  const recognize = () => {
    const r = parseList(text);
    setPairs(r.pairs);
    const parts = [`Erkannt: ${r.pairs.length} Paare, getrennt durch ${r.separator === 'Zeilenweise' ? 'abwechselnde Zeilen' : r.separator === 'Gemischt' ? 'verschiedene Trennzeichen' : r.separator.length > 2 ? r.separator : `„${r.separator}“`}.`];
    if (r.skipped.length) parts.push(`${r.skipped.length} Zeilen ohne Trennzeichen übersprungen.`);
    setInfo(parts.join(' '));
  };

  const fromPhoto = async (camera: boolean) => {
    if (!data.premium) {
      go({ name: 'premium', reason: 'Vokabellisten mit der Kamera zu erfassen ist Teil von Premium.' });
      return;
    }
    try {
      const uri = await pickImage(camera);
      if (!uri) return;
      setOcr({ busy: true, progress: 0 });
      const raw = await recognizeText(uri, ocrLanguages(c.langA, c.langB), (p) => setOcr({ busy: true, progress: p }));
      setText((prev) => (prev.trim() ? prev.trim() + '\n' : '') + raw.trim());
      setPairs(null);
      setInfo('Text erkannt. Prüfe ihn kurz und tippe dann auf „Liste erkennen“.');
    } catch (e: any) {
      notify(e?.message ?? 'Das Foto konnte nicht gelesen werden.');
    } finally {
      setOcr({ busy: false, progress: 0 });
    }
  };

  const save = () => {
    if (!pairs) return;
    const existing = new Set(c.words.map((w) => (w.a + '|' + w.b).toLowerCase()));
    const fresh = pairs
      .map((p) => ({ ...p, a: p.a.trim(), b: p.b.trim() }))
      .filter((p) => p.a && p.b && !existing.has((p.a + '|' + p.b).toLowerCase()))
      .map(newWord);
    // Gratis-Limit: bis genau 1000 übernehmen, den Rest parken
    const slots = freeSlots(data);
    const keep = slots === Infinity ? fresh : fresh.slice(0, slots);
    const parked = fresh.slice(keep.length).map((w) => ({ a: w.a, b: w.b }));
    update((d) => ({
      ...d,
      courses: d.courses.map((x) => {
        if (x.id !== id) return x;
        const known = new Set((x.pending ?? []).map((p) => (p.a + '|' + p.b).toLowerCase()));
        const morePending = parked.filter((p) => !known.has((p.a + '|' + p.b).toLowerCase()));
        return { ...x, words: [...x.words, ...keep], pending: [...(x.pending ?? []), ...morePending] };
      }),
    }));
    const dupes = pairs.length - fresh.length;
    const parts = [`${keep.length} ${keep.length === 1 ? 'Wort' : 'Wörter'} gespeichert und nach Schwierigkeit einsortiert.`];
    if (dupes > 0) parts.push(`${dupes} ${dupes === 1 ? 'war' : 'waren'} schon im Kurs.`);
    if (parked.length > 0) {
      parts.push(
        `${parked.length} ${parked.length === 1 ? 'Wort wurde' : 'Wörter wurden'} nicht hinzugefügt, weil die Gratis-Version auf ${FREE_WORD_LIMIT} Wörter begrenzt ist. ${parked.length === 1 ? 'Es wartet' : 'Sie warten'} unter „Vokabeln“, mit Premium ${parked.length === 1 ? 'kommt es' : 'kommen sie'} automatisch dazu.`,
      );
    }
    notify(parts.join(' '));
    back();
  };

  const edit = (i: number, field: 'a' | 'b', v: string) =>
    setPairs((ps) => ps!.map((p, j) => (j === i ? { ...p, [field]: v } : p)));

  if (pairs) {
    return (
      <View style={{ gap: 18 }}>
        <TopBar onBack={() => setPairs(null)} title={c.name} />
        <H1>Vorschau</H1>
        <P muted>{info}</P>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={{ flex: 1, color: t.muted, fontWeight: '700' }}>{c.langA}</Text>
          <Text style={{ flex: 1, color: t.muted, fontWeight: '700' }}>{c.langB}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ gap: 8 }}>
          {pairs.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {(['a', 'b'] as const).map((f) => (
                <TextInput
                  key={f}
                  value={p[f]}
                  onChangeText={(v) => edit(i, f, v)}
                  accessibilityLabel={f === 'a' ? c.langA : c.langB}
                  style={{ flex: 1, minWidth: 0, width: 0, color: t.ink, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zeile entfernen"
                hitSlop={8}
                onPress={() => setPairs((ps) => ps!.filter((_, j) => j !== i))}
                style={{ width: 32, alignItems: 'center' }}
              >
                <Text style={{ color: t.wrong, fontSize: 22, fontWeight: '700' }}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Btn kind="secondary" label="Spalten tauschen" onPress={() => setPairs((ps) => ps!.map((p) => ({ a: p.b, b: p.a })))} />
        <Btn label={`${pairs.length} Wörter speichern`} onPress={save} disabled={pairs.length === 0} />
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      <TopBar onBack={back} title={c.name} />
      <H1>Wörter hinzufügen</H1>

      <Panel>
        <H2>Liste einfügen</H2>
        <P muted>Eine Zeile pro Wort, das Format ist egal: Semikolon, Bindestrich, Gleichheitszeichen, Tab oder einfach Wort und Übersetzung in abwechselnden Zeilen. Mit Semikolon kannst du optional einen Beispielsatz und dessen Übersetzung anhängen, daraus werden Lückensätze: „amicus ; der Freund ; Amicus meus venit. ; Mein Freund kommt.“</P>
        <Field
          value={text}
          onChangeText={setText}
          placeholder={EXAMPLE}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          style={{ minHeight: 180, fontSize: 15 }}
        />
        <Btn label="Liste erkennen" onPress={recognize} disabled={!text.trim() || ocr.busy} />
      </Panel>

      <Panel>
        <H2>Per Kamera{data.premium ? '' : ' (Premium)'}</H2>
        <P muted>Fotografiere eine Vokabelliste aus Buch oder Heft. Der erkannte Text landet oben im Feld, dort kannst du ihn noch korrigieren.</P>
        {ocr.busy ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={t.primary} />
              <P>Text wird erkannt …</P>
            </View>
            <Progress value={ocr.progress} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn kind="secondary" label="Foto aufnehmen" style={{ flex: 1 }} onPress={() => fromPhoto(true)} />
            <Btn kind="secondary" label="Bild wählen" style={{ flex: 1 }} onPress={() => fromPhoto(false)} />
          </View>
        )}
        {!ocrAvailable && <P muted>In dieser Version noch nicht verfügbar.</P>}
      </Panel>
    </View>
  );
}
