import React, { createContext, useContext } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOXES, levelInfo } from './engine';

export const light = {
  bg: '#EEF1EC',
  surface: '#FFFFFF',
  ink: '#1E2A2B',
  muted: '#5E6B68',
  line: '#D3DAD4',
  primary: '#1F5E4E', // Tafelgrün
  onPrimary: '#FFFFFF',
  card: '#F3C846', // Karteikarte
  onCard: '#2B2410',
  right: '#2E8B5E',
  rightBg: '#DDF1E5',
  wrong: '#C2413D',
  wrongBg: '#F8E0DE',
  // Abschnittsfarben: leicht, mittel, schwer
  lvl: ['#2E8B5E', '#B9770E', '#8E3B46'],
  onLvl: '#FFFFFF',
};

export const dark: typeof light = {
  bg: '#111917',
  surface: '#1A2522',
  ink: '#E7EEEA',
  muted: '#9AA9A4',
  line: '#2C3A36',
  primary: '#6CC2A4',
  onPrimary: '#0E1A16',
  card: '#E7BC3D',
  onCard: '#2B2410',
  right: '#6CCB97',
  rightBg: '#1E3A2C',
  wrong: '#EE7E78',
  wrongBg: '#41221F',
  lvl: ['#3E9E6E', '#C98A1E', '#A84B58'],
  onLvl: '#FFFFFF',
};

export type Theme = typeof light;
export const ThemeCtx = createContext<Theme>(light);
export const useTheme = () => useContext(ThemeCtx);

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.h1, { color: t.ink }]}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.h2, { color: t.ink }]}>{children}</Text>;
}

export function P({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: any }) {
  const t = useTheme();
  return <Text style={[s.p, { color: muted ? t.muted : t.ink }, style]}>{children}</Text>;
}

type BtnProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

export function Btn({ label, onPress, kind = 'primary', disabled, style }: BtnProps) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'secondary' ? t.surface : 'transparent';
  const fg = kind === 'primary' ? t.onPrimary : kind === 'danger' ? t.wrong : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: kind === 'secondary' ? t.line : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {props.label ? <Text style={[s.label, { color: t.muted }]}>{props.label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        {...props}
        style={[s.input, { color: t.ink, backgroundColor: t.surface, borderColor: t.line }, props.style]}
      />
    </View>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[s.panel, { backgroundColor: t.surface, borderColor: t.line }, style]}>{children}</View>;
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={s.topbar}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Zurück" hitSlop={12}>
          <Text style={[s.back, { color: t.primary }]}>‹ Zurück</Text>
        </Pressable>
      ) : (
        <View />
      )}
      {title ? <Text style={[s.topTitle, { color: t.muted }]} numberOfLines={1}>{title}</Text> : null}
      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={[s.track, { backgroundColor: t.line }]}>
      <View style={[s.fill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color ?? t.primary }]} />
    </View>
  );
}

// Der Karteikasten: Fach 0 (neu) + 5 Leitner-Fächer
export function CardBox({ counts, compact }: { counts: number[]; compact?: boolean }) {
  const t = useTheme();
  const max = Math.max(1, ...counts);
  const h = compact ? 34 : 86;
  const labels = ['Neu', '1', '2', '3', '4', '5'];
  return (
    <View accessibilityLabel={`Karteikasten: ${counts.map((c, i) => `${labels[i]}: ${c}`).join(', ')}`}>
      <View style={[s.box, { borderColor: t.ink, height: h + 10 }]}>
        {counts.map((c, i) => (
          <View key={i} style={[s.slot, { borderRightWidth: i < BOXES ? 1.5 : 0, borderColor: t.ink }]}>
            <View
              style={{
                height: c === 0 ? 0 : Math.max(4, (c / max) * h),
                backgroundColor: i === 0 ? t.line : t.card,
                marginHorizontal: compact ? 3 : 6,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          </View>
        ))}
      </View>
      {!compact && (
        <View style={{ flexDirection: 'row' }}>
          {counts.map((c, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingTop: 6 }}>
              <Text style={{ color: t.ink, fontWeight: '700', fontSize: 15 }}>{c}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>{i === 0 ? 'Neu' : `Fach ${labels[i]}`}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Kompakte Anzeige von Streak, XP und Level (z. B. in der Kursleiste)
export function StatPills({ streak, xp, freezes, boost, onInventory, hasItems }: { streak: number; xp: number; freezes: number; boost: number; onInventory?: () => void; hasItems?: boolean }) {
  const t = useTheme();
  const lv = levelInfo(xp);
  const pill = (children: React.ReactNode, label: string) => (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      {children}
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {pill(
        <>
          <Ionicons name="flame" size={15} color={streak > 0 ? '#E8742C' : t.muted} />
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 14 }}>{streak}</Text>
          {freezes > 0 && <Ionicons name="snow" size={13} color="#4A9BD9" />}
        </>,
        `${streak} Tage in Folge${freezes ? `, ${freezes} Streak-Schutz` : ''}`,
      )}
      {onInventory && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Inventar öffnen"
          onPress={onInventory}
          hitSlop={6}
          style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="bag-handle" size={16} color={t.ink} />
          {hasItems && <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#E8742C', borderWidth: 2, borderColor: t.surface }} />}
        </Pressable>
      )}
      {pill(
        <>
          <Ionicons name={boost > 0 ? 'rocket' : 'flash'} size={15} color="#D99A00" />
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 14 }}>{xp}</Text>
          <Text style={{ color: t.muted, fontWeight: '700', fontSize: 12 }}>· Lv {lv.level}</Text>
        </>,
        `${xp} XP, Level ${lv.level}${boost ? `, Booster für ${boost} Lektionen` : ''}`,
      )}
    </View>
  );
}

export function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onYes();
    return;
  }
  Alert.alert('Bestätigen', message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Ja', style: 'destructive', onPress: onYes },
  ]);
}

export function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Memoro', message);
}

const s = StyleSheet.create({
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 40 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, lineHeight: 26 },
  p: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 14, fontWeight: '600' },
  btn: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 17, fontWeight: '700' },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  panel: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 },
  back: { fontSize: 17, fontWeight: '600' },
  topTitle: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  box: { flexDirection: 'row', borderWidth: 2.5, borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: 'hidden' },
  slot: { flex: 1, justifyContent: 'flex-end', paddingBottom: 4 },
});
