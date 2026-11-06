import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

// Lückensatz-Karte: Wörter, die noch nicht gelernt sind, sind unterstrichen.
// Antippen zeigt die Bedeutung.
const clean = (s: string) => s.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();

function Words({ text, gloss, onTap }: { text: string; gloss: Record<string, string>; onTap: (w: string, m: string) => void }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) => {
        const key = clean(p);
        const m = key ? gloss[key] : undefined;
        if (!m) return <Text key={i}>{p}</Text>;
        return (
          <Text
            key={i}
            onPress={() => onTap(p.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ''), m)}
            style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}
          >
            {p}
          </Text>
        );
      })}
    </>
  );
}

export function ClozeCard({ ex, picked, t }: { ex: any; picked: boolean; t: any }) {
  const [tip, setTip] = useState<{ w: string; m: string } | null>(null);
  useEffect(() => setTip(null), [ex]);
  const gloss: Record<string, string> = ex.gloss ?? {};
  const hasGloss = Object.keys(gloss).length > 0;
  return (
    <View
      style={{
        backgroundColor: t.card,
        borderRadius: 6,
        paddingVertical: 26,
        paddingHorizontal: 20,
        gap: 10,
        transform: [{ rotate: '-1deg' }],
      }}
    >
      <Text style={{ color: t.onCard, fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 34 }}>
        <Words text={ex.before} gloss={gloss} onTap={(w, m) => setTip({ w, m })} />
        <Text style={{ textDecorationLine: picked ? 'none' : 'underline' }}>{picked ? ex.answer : ' _______ '}</Text>
        <Words text={ex.after} gloss={gloss} onTap={(w, m) => setTip({ w, m })} />
      </Text>
      <Text style={{ color: t.onCard, opacity: 0.75, fontSize: 15, textAlign: 'center' }}>{ex.translation}</Text>
      {tip ? (
        <Text style={{ color: t.onCard, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
          {tip.w} = {tip.m}
        </Text>
      ) : hasGloss ? (
        <Text style={{ color: t.onCard, opacity: 0.6, fontSize: 12, textAlign: 'center' }}>
          Unterstrichene Wörter kennst du noch nicht – tippe darauf für die Bedeutung.
        </Text>
      ) : null}
    </View>
  );
}
