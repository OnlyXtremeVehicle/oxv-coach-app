/**
 * AppTabBar — barre d'onglets 5 zones (OXV Platform, PR 1).
 *
 * Specs canon (`docs/refonte-app/04_DESIGN_CANON.md §4`) : hauteur 88 + safe-area,
 * fond `rgba(5,5,5,0.92)`, border-top `#1C1C20`, icônes 21 stroke 1.65, label
 * Geist Mono 8.5. Actif `#F8F9FA`, inactif `#54545C`. **AUCUN or sur la nav.**
 *
 * Barre additive posée par `app/(app)/_layout.tsx` au-dessus du Stack (le Stack
 * reste inchangé → zéro régression de navigation). Compte n'est PAS ici (icône
 * haut-droite). Masquée en piste / flux capture via `shouldShowTabBar`.
 */

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { type TabZone, type Zone, TAB_MAIN_ROUTE, TAB_ORDER } from '@/lib/appMap';
import { theme } from '@/theme/v2';

// Valeurs canon exactes (le réalignement global de v2.ts vient en PR 7).
const ACTIVE = '#F8F9FA';
const INACTIVE = '#54545C';
const BG = 'rgba(5,5,5,0.92)';
const BORDER = '#1C1C20';

const LABELS: Record<TabZone, string> = {
  paddock: 'PADDOCK',
  session: 'SESSION',
  bilan: 'BILAN',
  progression: 'PROGRESSION',
  club: 'CLUB',
};

export function AppTabBar({ activeZone }: { activeZone: Zone | null }) {
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
      {TAB_ORDER.map((zone) => {
        const on = activeZone === zone;
        const color = on ? ACTIVE : INACTIVE;
        return (
          <Pressable
            key={zone}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={LABELS[zone]}
            onPress={() => router.navigate(TAB_MAIN_ROUTE[zone] as never)}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', gap: 5 }}
          >
            <TabIcon zone={zone} color={color} />
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.mono, fontSize: 8.5, letterSpacing: 0.4, color }}
            >
              {LABELS[zone]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ zone, color }: { zone: TabZone; color: string }) {
  const p = {
    stroke: color,
    strokeWidth: 1.65,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      {zone === 'paddock' ? (
        <>
          <Path d="M6 21V3.5" {...p} />
          <Path d="M6 4.5h11l-2.5 3.5L17 11H6" {...p} />
        </>
      ) : null}
      {zone === 'session' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M10.3 8.4l5 3.6-5 3.6z" {...p} />
        </>
      ) : null}
      {zone === 'bilan' ? (
        <>
          <Path d="M4.5 17a8 8 0 1 1 15 0" {...p} />
          <Path d="M12 12.5l3.6-2.6" {...p} />
        </>
      ) : null}
      {zone === 'progression' ? (
        <>
          <Path d="M4 17l5-5 4 3 7-8" {...p} />
          <Path d="M20 7v4M20 7h-4" {...p} />
        </>
      ) : null}
      {zone === 'club' ? (
        <>
          <Circle cx={9} cy={8} r={3} {...p} />
          <Path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" {...p} />
          <Path d="M16 5.6a3 3 0 0 1 0 6" {...p} />
          <Path d="M15.5 14.6c2.8.2 4.5 2.4 4.5 5.4" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
