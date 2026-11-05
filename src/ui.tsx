import React, { createContext, useContext } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, Alert } from 'react-native';
import { BOXES } from './engine';

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
