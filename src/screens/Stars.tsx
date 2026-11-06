import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Sternebewertung: 3 Sterne ab 95 %, 2 Sterne ab 80 %, sonst 1 Stern.
// (Jede geschaffte Lektion bringt mindestens einen Stern.) Grenzen hier ändern:
export const STAR_STEPS = { three: 95, two: 80 };
export const starsFor = (pct: number) => (pct >= STAR_STEPS.three ? 3 : pct >= STAR_STEPS.two ? 2 : 1);

const GOLD = '#F2B01E';
const EMPTY = 'rgba(120,120,120,0.35)';

// Kleine Sternreihe, z. B. auf der Lernpfad-Karte
export function Stars({ n, size = 16, gap = 2 }: { n: number; size?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      {[1, 2, 3].map((i) => (
        <Ionicons key={i} name="star" size={size} color={i <= n ? GOLD : EMPTY} />
      ))}
    </View>
  );
}

// Große Sternreihe auf dem Ergebnis-Bildschirm: die Sterne poppen nacheinander auf
export function StarsBurst({ n }: { n: number }) {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const native = Platform.OS !== 'web';
    Animated.stagger(
      260,
      vals.map((v, i) =>
        Animated.spring(v, { toValue: 1, friction: 4, tension: 120, useNativeDriver: native, delay: i === 0 ? 150 : 0 }),
      ),
    ).start();
  }, []);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10 }}>
      {[1, 2, 3].map((i, k) => {
        const on = i <= n;
        const size = i === 2 ? 74 : 56;
        return (
          <Animated.View
            key={i}
            style={{
              transform: [
                { rotate: i === 1 ? '-12deg' : i === 3 ? '12deg' : '0deg' },
                { scale: vals[k].interpolate({ inputRange: [0, 1], outputRange: [on ? 0.2 : 0.6, 1] }) },
              ],
              opacity: vals[k].interpolate({ inputRange: [0, 1], outputRange: [0, 1], easing: Easing.out(Easing.quad) }),
            }}
          >
            <Ionicons name="star" size={size} color={on ? GOLD : EMPTY} />
          </Animated.View>
        );
      })}
    </View>
  );
}
