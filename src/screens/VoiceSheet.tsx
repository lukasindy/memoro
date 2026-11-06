import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Btn, useTheme } from '../ui';
import { VoiceOption, chooseVoice, listVoices, savedVoice, speak, ttsLang } from '../platform';

const SAMPLE: Record<string, string> = { de: 'Guten Tag, wie geht es dir?', en: 'Good morning, how are you?', es: 'Buenos días, ¿cómo estás?', fr: 'Bonjour, comment allez-vous ?', it: 'Buongiorno, come stai?' };

// Stimme auswählen und anhören
export function VoiceSheet({ visible, langName, onClose }: { visible: boolean; langName: string; onClose: () => void }) {
  const t = useTheme();
  const [list, setList] = useState<VoiceOption[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const code = ttsLang(langName) ?? '';
  useEffect(() => {
    if (!visible) return;
    setSel(savedVoice(code));
    listVoices(langName).then(setList);
  }, [visible]);
  const sample = SAMPLE[code.slice(0, 2)] ?? 'Hello';
  const pick = (id: string | null) => {
    setSel(id);
    chooseVoice(langName, id);
    speak(sample, langName);
  };
  const row = (key: string, title: string, sub: string, on: boolean, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.rightBg : t.surface }}>
      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? t.primary : t.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{sub}</Text>
      </View>
      <Ionicons name="volume-medium" size={20} color={t.muted} />
    </Pressable>
  );
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 620, maxHeight: '85%', backgroundColor: t.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, gap: 12 }}>
          <Text style={{ color: t.ink, fontSize: 22, fontWeight: '900' }}>Stimme wählen</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {row('auto', 'Automatisch', 'Memoro nimmt die beste Stimme', sel === null, () => pick(null))}
            {list.map((v) => row(v.id, v.name, `${v.tag}${v.best ? ' · empfohlen' : ''}`, sel === v.id, () => pick(v.id)))}
            {list.length === 0 && <Text style={{ color: t.muted, fontSize: 14 }}>Auf diesem Gerät meldet der Browser keine Stimmen.</Text>}
            <View style={{ backgroundColor: t.bg, borderRadius: 14, padding: 14, marginTop: 6 }}>
              <Text style={{ color: t.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 }}>Klingt es roboterhaft?</Text>
              <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
                {Platform.OS === 'web'
                  ? 'Am iPhone nutzt Memoro die Stimmen des Geräts. Lade eine bessere herunter: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Sprache wählen → eine Stimme mit „Verbessert“ oder „Premium“ laden. Danach hier auswählen.'
                  : 'Memoro nutzt die Stimmen deines Geräts. Bessere Stimmen kannst du in den Systemeinstellungen laden.'}
              </Text>
            </View>
          </ScrollView>
          <Btn label="Fertig" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
