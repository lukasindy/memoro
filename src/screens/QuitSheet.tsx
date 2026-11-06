import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Text } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { Btn, useTheme } from '../ui';

// Freundlicher Abbruch-Dialog: weiterlernen, Stand speichern oder verwerfen
export function QuitSheet({
  visible,
  canSave,
  onContinue,
  onSave,
  onDiscard,
}: {
  visible: boolean;
  canSave: boolean;
  onContinue: () => void;
  onSave?: () => void;
  onDiscard: () => void;
}) {
  const t = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onContinue}>
      <Pressable onPress={onContinue} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable
          onPress={() => {}}
          style={{ width: '100%', maxWidth: 620, backgroundColor: t.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 34, gap: 14, alignItems: 'center' }}
        >
          <View
            style={{
              width: 96,
              height: 70,
              borderRadius: 6,
              backgroundColor: '#FBF7EA',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-4deg' }],
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              overflow: 'hidden',
            }}
          >
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, backgroundColor: t.card }} />
            <View style={{ position: 'absolute', top: 22, left: 0, right: 0, height: 2, backgroundColor: '#E2605A', opacity: 0.7 }} />
            <Ionicons name="cafe" size={30} color="#7A5C3A" style={{ marginTop: 14 }} />
          </View>
          <Text style={{ color: t.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' }}>Kurze Pause?</Text>
          <Text style={{ color: t.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' }}>
            {canSave
              ? 'Speichere deinen Stand und mach später genau hier weiter. Deine Serie und die bisher verdienten XP bleiben erhalten.'
              : 'Wenn du jetzt aufhörst, geht der Fortschritt dieser Lektion verloren.'}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
            <Btn label="Weiterlernen" onPress={onContinue} />
            {canSave && onSave ? <Btn kind="secondary" label="Speichern und später fortsetzen" onPress={onSave} /> : null}
          </View>
          <Pressable accessibilityRole="button" onPress={onDiscard} hitSlop={8} style={{ paddingVertical: 6 }}>
            <Text style={{ color: t.wrong, fontSize: 15, fontWeight: '700' }}>Beenden ohne Speichern</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
