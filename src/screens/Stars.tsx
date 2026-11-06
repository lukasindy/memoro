import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Sternebewertung: 3 Sterne ab 95 %, 2 Sterne ab 80 %, sonst 1 Stern.
// (Jede geschaffte Lektion bringt mindestens einen Stern.) Grenzen hier ändern:
export const STAR_STEPS = { three: 95, two: 80 };
export const starsFor = (pct: number) => (pct >= STAR_STEPS.three ? 3 : pct >= STAR_STEPS.two ? 2 : 1);

const GOLD = '#F2B01E';
const INK = '#5A4A1E';
const EMPTY = 'rgba(120,120,120,0.35)';

// Kleine Sternreihe. Mit "stamp": wie mit Stift/Stempel auf die Karteikarte gesetzt
// (leicht schief, mittlerer Stern höher, dunkle Kontur, kein Hintergrund)
export function Stars({ n, size = 16, gap = 2, stamp }: { n: number; size?: number; gap?: number; stamp?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap }}>
      {[1, 2, 3].map((i) => {
        const on = i <= n;
        const star = (
          <View style={{ width: size, height: size }}>
            {stamp && on && (
              <Ionicons name="star" size={size + 3} color={INK} style={{ position: 'absolute', left: -1.5, top: -1.5 }} />
            )}
            <Ionicons name="star" size={size} color={on ? GOLD : stamp ? 'rgba(90,80,60,0.28)' : EMPTY} style={{ position: 'absolute', left: 0, top: 0 }} />
          </View>
        );
        if (!stamp) return <View key={i}>{star}</View>;
        return (
          <View key={i} style={{ transform: [{ translateY: i === 2 ? -5 : 0 }, { rotate: i === 1 ? '-14deg' : i === 3 ? '14deg' : '3deg' }] }}>
            {star}
          </View>
        );
      })}
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
