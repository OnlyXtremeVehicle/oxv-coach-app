/**
 * CoachTabBar — barre d'onglets de l'espace coach (5 zones, cadrage COACH §1).
 *
 * Réplique AppTabBar (pilote) mais avec l'IDENTITÉ coach : actif = rouge doux
 * `#E2685A` (jamais le blanc pilote), inactif `#55555C`, labels JetBrains Mono
 * 8.5. **Aucun or sur la nav.** Overlay additif posé par `app/(coach)/_layout`
 * au-dessus du Stack (routes inchangées, zéro régression).
 */

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import {
  type CoachTabZone,
  COACH_TAB_LABEL,
  COACH_TAB_MAIN_ROUTE,
  COACH_TAB_ORDER,
} from '@/lib/coachNav';
import { theme } from '@/theme/v2';

// Identité coach : rouge doux actif (pas le blanc pilote). Nav sans or.
const ACTIVE = '#E2685A';
const INACTIVE = '#55555C';
const BG = 'rgba(5,5,5,0.9)';
const BORDER = '#1C1C20';

export function CoachTabBar({ activeZone }: { activeZone: CoachTabZone | null }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: BG,
        borderTopWidth: 1,
        borderTopColor: BORDER,
      }}
    >
      {COACH_TAB_ORDER.map((zone) => {
        const on = activeZone === zone;
        const color = on ? ACTIVE : INACTIVE;
        return (
          <Pressable
            key={zone}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={COACH_TAB_LABEL[zone]}
            onPress={() => router.navigate(COACH_TAB_MAIN_ROUTE[zone] as never)}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', gap: 5 }}
          >
            <TabIcon zone={zone} color={color} />
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.mono, fontSize: 8.5, letterSpacing: 0.4, color }}
            >
              {COACH_TAB_LABEL[zone]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ zone, color }: { zone: CoachTabZone; color: string }) {
  const p = {
    stroke: color,
    strokeWidth: 1.65,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      {zone === 'live' ? (
        <>
          <Circle cx={12} cy={12} r={2.4} fill={color} stroke="none" />
          <Path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" {...p} />
        </>
      ) : null}
      {zone === 'pilotes' ? (
        <>
          <Circle cx={9} cy={8} r={3} {...p} />
          <Path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" {...p} />
          <Path d="M16 5.6a3 3 0 0 1 0 6" {...p} />
          <Path d="M15.5 14.6c2.8.2 4.5 2.4 4.5 5.4" {...p} />
        </>
      ) : null}
      {zone === 'messages' ? <Path d="M5 5.5h14v10H10l-4 3.5v-3.5H5z" {...p} /> : null}
      {zone === 'agenda' ? (
        <>
          <Rect x={4} y={5.5} width={16} height={14} rx={2} {...p} />
          <Path d="M4 9.5h16M8 3.5v3M16 3.5v3" {...p} />
        </>
      ) : null}
      {zone === 'moi' ? (
        <>
          <Circle cx={12} cy={8} r={3.2} {...p} />
          <Path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
