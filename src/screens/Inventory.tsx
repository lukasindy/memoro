import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenProps } from '../nav';
import { Btn, H1, H2, P, Panel, Progress, TopBar, useTheme } from '../ui';
import { BOOST_LESSONS, MAX_FREEZES, levelInfo, upcomingRewards } from '../engine';

const FREEZE_BLUE = '#4A9BD9';
const BOOST_ORANGE = '#E8742C';

export function Inventory({ data, update, back }: ScreenProps) {
  const t = useTheme();
  const lv = levelInfo(data.xp);
  const rewards = upcomingRewards(lv.level, 5);
  const canActivate = data.boosters > 0 && data.boost === 0;

  const item = (opts: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    title: string;
    count: string;
    text: string;
    children?: React.ReactNode;
  }) => (
    <Panel style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: opts.color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={opts.icon} size={30} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: '800' }}>{opts.title}</Text>
          <Text style={{ color: opts.color, fontSize: 15, fontWeight: '800' }}>{opts.count}</Text>
        </View>
      </View>
      <P muted>{opts.text}</P>
      {opts.children}
    </Panel>
  );

  return (
    <View style={{ gap: 20 }}>
      <TopBar onBack={back} />
      <H1>Inventar</H1>

      {/* Level */}
      <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.onCard, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.card, fontSize: 24, fontWeight: '900' }}>{lv.level}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.onCard, fontSize: 20, fontWeight: '900' }}>Level {lv.level}</Text>
            <Text style={{ color: t.onCard, fontSize: 14 }}>
              Noch {lv.need - lv.into} XP bis Level {lv.level + 1}
            </Text>
          </View>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round(lv.progress * 100)}%`, backgroundColor: t.onCard }} />
        </View>
      </View>

      <H2>Deine Gegenstände</H2>

      {item({
        icon: 'snow',
        color: FREEZE_BLUE,
        title: 'Streak-Schutz',
        count: `${data.freezes} / ${MAX_FREEZES}`,
        text: 'Rettet deinen Streak, wenn du einen Tag nicht lernst. Wird automatisch eingesetzt. Du bekommst einen bei jedem Level-Aufstieg.',
        children: (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: MAX_FREEZES }, (_, k) => (
              <View
                key={k}
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: k < data.freezes ? FREEZE_BLUE : t.line,
                }}
              />
            ))}
          </View>
        ),
      })}

      {item({
        icon: 'rocket',
        color: BOOST_ORANGE,
        title: 'XP-Booster',
        count: data.boost > 0 ? `Aktiv · noch ${data.boost} ${data.boost === 1 ? 'Lektion' : 'Lektionen'}` : `${data.boosters} im Inventar`,
        text: `Doppelte XP für ${BOOST_LESSONS} Lektionen. Du bekommst einen alle 5 Level und entscheidest selbst, wann du ihn einsetzt.`,
        children:
          data.boost > 0 ? (
            <View style={{ gap: 6 }}>
              <Progress value={data.boost / BOOST_LESSONS} color={BOOST_ORANGE} />
              {data.boosters > 0 && <P muted style={{ fontSize: 13 }}>Weitere {data.boosters} im Inventar, einsetzbar sobald der aktuelle abgelaufen ist.</P>}
            </View>
          ) : (
            <Btn
              label={data.boosters > 0 ? 'Booster aktivieren' : 'Noch kein Booster'}
              disabled={!canActivate}
              onPress={() => update((d) => ({ ...d, boosters: d.boosters - 1, boost: BOOST_LESSONS }))}
            />
          ),
      })}

      <Panel style={{ gap: 12 }}>
        <H2>Nächste Belohnungen</H2>
        {rewards.map((r) => (
          <View key={r.level} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: t.ink, fontWeight: '900', fontSize: 14 }}>{r.level}</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="snow" size={16} color={FREEZE_BLUE} />
                <Text style={{ color: t.ink, fontSize: 14 }}>Streak-Schutz</Text>
              </View>
              {r.booster && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="rocket" size={16} color={BOOST_ORANGE} />
                  <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700' }}>XP-Booster</Text>
                </View>
              )}
            </View>
          </View>
        ))}
        <P muted style={{ fontSize: 13 }}>Ist der Streak-Schutz voll ({MAX_FREEZES}), verfällt der zusätzliche.</P>
      </Panel>
    </View>
  );
}
