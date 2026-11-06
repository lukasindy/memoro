import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenProps } from '../nav';
import { Btn, H1, H2, P, Panel, Progress, TopBar, useTheme } from '../ui';
import { BOOST_LESSONS, MAX_FREEZES, MAX_SHIELDS, STREAK_REWARDS, levelInfo, levelTitle, upcomingRewards } from '../engine';

const FREEZE_BLUE = '#4A9BD9';
const BOOST_ORANGE = '#E8742C';
const SOCIAL_PINK = '#D6457A';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function Inventory({ data, update, back }: ScreenProps) {
  const t = useTheme();
  const lv = levelInfo(data.xp);
  const rewards = upcomingRewards(lv.level, 8);
  const canActivate = data.boosters > 0 && data.boost === 0;
  const [view, setView] = useState<'items' | 'rewards'>('items');
  const [filter, setFilter] = useState<'all' | 'level' | 'streak'>('all');

  // Countdown für eingelöste Social-Media-Zeit
  const [now, setNow] = useState(Date.now());
  const running = data.screenUntil > now;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const redeem = (min: number) =>
    update((d) => {
      const take = Math.min(min, d.screenMinutes);
      const start = Math.max(Date.now(), d.screenUntil);
      return { ...d, screenMinutes: d.screenMinutes - take, screenUntil: start + take * 60000 };
    });

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
            <Text style={{ color: t.onCard, fontSize: 20, fontWeight: '900' }}>Level {lv.level} · {levelTitle(lv.level)}</Text>
            <Text style={{ color: t.onCard, fontSize: 14 }}>
              Noch {lv.need - lv.into} XP bis Level {lv.level + 1}
            </Text>
          </View>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round(lv.progress * 100)}%`, backgroundColor: t.onCard }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Belohnungen ansehen"
          onPress={() => setView('rewards')}
          style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.onCard, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 16 }}>🎁</Text>
          <Text style={{ color: t.card, fontSize: 15, fontWeight: '900' }}>Belohnungen ansehen</Text>
        </Pressable>
      </View>

      {/* Auswahl per Emoji */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(
          [
            ['items', '🎒', 'Gegenstände'],
            ['rewards', '🎁', 'Belohnungen'],
          ] as const
        ).map(([k, e, l]) => {
          const on = view === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setView(k)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primary : t.surface }}
            >
              <Text style={{ fontSize: 20 }}>{e}</Text>
              <Text style={{ color: on ? t.onPrimary : t.ink, fontSize: 15, fontWeight: '800' }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>

      {view === 'items' && <H2>Deine Gegenstände</H2>}

      {view === 'items' && (
        <>
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
        icon: 'shield-checkmark',
        color: '#2F7FC0',
        title: 'Combo-Schutz',
        count: `${data.shields ?? 0} / ${MAX_SHIELDS}`,
        text: `Rettet deine Serie ohne Fehler, wenn du ab 5 richtigen Antworten in Folge einen Fehler machst. Wird automatisch eingesetzt. Du bekommst einen bei jedem 2. Level und bei Serien-Meilensteinen. Deine längste Serie: ${data.bestCombo ?? 0}.`,
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

      {item({
        icon: 'phone-portrait',
        color: SOCIAL_PINK,
        title: 'Social-Media-Zeit',
        count: running ? `Läuft · noch ${fmt(data.screenUntil - now)} · ${data.screenMinutes} Min. übrig` : `${data.screenMinutes} Minuten Guthaben`,
        text: 'Zeit für TikTok, Instagram & Co., die du dir mit Lernen verdienst: +5 Minuten pro Level, +10 bei jedem 5. Level, +30 bei jedem 10. Level.',
        children: (
          <View style={{ gap: 10 }}>
            {running && <Progress value={Math.min(1, (data.screenUntil - now) / (30 * 60000))} color={SOCIAL_PINK} />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[5, 10, 15, 30].map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={`${m} Minuten einlösen`}
                  disabled={data.screenMinutes < m}
                  onPress={() => redeem(m)}
                  style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 2, borderColor: SOCIAL_PINK, opacity: data.screenMinutes < m ? 0.35 : pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: SOCIAL_PINK, fontWeight: '800', fontSize: 14 }}>{m} Min.</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Alles einlösen"
                disabled={data.screenMinutes === 0}
                onPress={() => redeem(data.screenMinutes)}
                style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: SOCIAL_PINK, opacity: data.screenMinutes === 0 ? 0.35 : pressed ? 0.8 : 1 })}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Alles</Text>
              </Pressable>
            </View>
            {running && (
              <Pressable accessibilityRole="button" onPress={() => update((d) => ({ ...d, screenUntil: 0 }))} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: t.muted, fontSize: 14 }}>Timer beenden (Restzeit verfällt)</Text>
              </Pressable>
            )}
            <P muted style={{ fontSize: 13 }}>
              In der Web-Version ist das ein Timer zur Selbstkontrolle. In der App-Version für iPhone und Android soll er deine Bildschirmzeit-Sperre für die gewählten Apps direkt freischalten.
            </P>
          </View>
        ),
      })}

        </>
      )}

      {view === 'rewards' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['all', '🎁', 'Alle'],
                ['level', '⭐', 'Level'],
                ['streak', '🔥', 'Serie'],
              ] as const
            ).map(([k, e, l]) => {
              const on = filter === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={l}
                  accessibilityState={{ selected: on }}
                  onPress={() => setFilter(k)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 2, borderColor: on ? t.primary : t.line, backgroundColor: on ? t.primary : 'transparent' }}
                >
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                  {on && <Text style={{ color: t.onPrimary, fontSize: 14, fontWeight: '800' }}>{l}</Text>}
                </Pressable>
              );
            })}
          </View>

          {(filter === 'all' || filter === 'streak') && (
            <Panel style={{ gap: 12 }}>
              <H2>🔥 Serien-Belohnungen</H2>
              <P muted style={{ fontSize: 13 }}>Lerne an aufeinanderfolgenden Tagen. Aktuell: {data.streak.count} {data.streak.count === 1 ? 'Tag' : 'Tage'}.</P>
              {STREAK_REWARDS.map((r) => {
                const got = data.streak.count >= r.days;
                return (
                  <View key={r.days} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: got ? 0.55 : 1 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: got ? '#2E8B5E' : 'transparent', borderWidth: got ? 0 : 2, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
                      {got ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : <Ionicons name="flame" size={18} color="#E8742C" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.ink, fontSize: 15, fontWeight: '800' }}>{r.days} Tage</Text>
                      <Text style={{ color: t.muted, fontSize: 13 }}>
                        {[r.minutes ? `+${r.minutes} Min.` : '', r.boosters ? `${r.boosters} Booster` : '', r.freezes ? `${r.freezes} Streak-Schutz` : '', r.shields ? `${r.shields} Combo-Schutz` : ''].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Panel>
          )}

          {(filter === 'all' || filter === 'level') && (
            <Panel style={{ gap: 12 }}>
              <H2>⭐ Level-Belohnungen</H2>
              <P muted style={{ fontSize: 13 }}>Die nächsten Level-Aufstiege. Aktuell: Level {lv.level}.</P>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="phone-portrait" size={16} color={SOCIAL_PINK} />
                      <Text style={{ color: t.ink, fontSize: 14, fontWeight: r.minutes > 5 ? '800' : '400' }}>+{r.minutes} Min.</Text>
                    </View>
                    {r.shield && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="shield-checkmark" size={16} color="#2F7FC0" />
                        <Text style={{ color: t.ink, fontSize: 14 }}>Combo-Schutz</Text>
                      </View>
                    )}
                    {r.title && <Text style={{ color: t.ink, fontSize: 14, fontWeight: '900' }}>Titel: {r.title}</Text>}
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
          )}
        </>
      )}
    </View>
  );
}
