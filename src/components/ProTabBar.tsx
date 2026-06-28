/**
 * ProTabBar — barre d'onglets de l'espace Pilote Pro (PR-78).
 *
 * Mêmes specs canon que la barre pilote (`AppTabBar`) : hauteur + safe-area, fond
 * `rgba(5,5,5,0.9)`, border-top `#1C1C20`, icônes 21 stroke 1.65, label Geist Mono
 * 8.5. Actif `#F8F9FA`, inactif `#54545C`. **AUCUN or sur la nav.** Compte n'est
 * PAS ici (icône haut-droite via AccountButton). Cinq onglets métier.
 */

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import {
  type ProTabZone,
  type ProZone,
  PRO_TAB_LABEL,
  PRO_TAB_MAIN_ROUTE,
  PRO_TAB_ORDER,
} from '@/lib/proNav';
import { theme } from '@/theme/v2';

const ACTIVE = '#F8F9FA';
const INACTIVE = '#54545C';
const BG = 'rgba(5,5,5,0.9)';
const BORDER = '#1C1C20';

export function ProTabBar({ activeZone }: { activeZone: ProZone | null }) {
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
      {PRO_TAB_ORDER.map((zone) => {
        const on = activeZone === zone;
        const color = on ? ACTIVE : INACTIVE;
        return (
          <Pressable
            key={zone}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={PRO_TAB_LABEL[zone]}
            onPress={() => router.navigate(PRO_TAB_MAIN_ROUTE[zone] as never)}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', gap: 5 }}
          >
            <ProTabIcon zone={zone} color={color} />
            <Text
              numberOfLines={1}
              style={{ fontFamily: theme.fonts.mono, fontSize: 8.5, letterSpacing: 0.4, color }}
            >
              {PRO_TAB_LABEL[zone]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProTabIcon({ zone, color }: { zone: ProTabZone; color: string }) {
  const p = {
    stroke: color,
    strokeWidth: 1.65,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24">
      {zone === 'pro-paddock' ? (
        <>
          <Path d="M6 21V3.5" {...p} />
          <Path d="M6 4.5h11l-2.5 3.5L17 11H6" {...p} />
        </>
      ) : null}
      {/* Performance = lecture comparée (deux barres côte à côte, descriptif, pas une courbe ascendante). */}
      {zone === 'pro-performance' ? (
        <>
          <Path d="M4 20V11" {...p} />
          <Path d="M10 20V5" {...p} />
          <Path d="M16 20v-7" {...p} />
          <Path d="M3 20h18" {...p} />
        </>
      ) : null}
      {/* Média = cadre + déclencheur. */}
      {zone === 'pro-media' ? (
        <>
          <Rect x={3.5} y={5.5} width={17} height={13} rx={2} {...p} />
          <Circle cx={12} cy={12} r={3} {...p} />
        </>
      ) : null}
      {/* Équipe = entourage. */}
      {zone === 'pro-equipe' ? (
        <>
          <Circle cx={9} cy={8} r={3} {...p} />
          <Path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" {...p} />
          <Path d="M16 5.6a3 3 0 0 1 0 6" {...p} />
          <Path d="M15.5 14.6c2.8.2 4.5 2.4 4.5 5.4" {...p} />
        </>
      ) : null}
      {/* Partage = lien maillé. */}
      {zone === 'pro-partage' ? (
        <>
          <Circle cx={6} cy={12} r={2.5} {...p} />
          <Circle cx={17} cy={6} r={2.5} {...p} />
          <Circle cx={17} cy={18} r={2.5} {...p} />
          <Path d="M8.2 10.9l6.6-3.6M8.2 13.1l6.6 3.6" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
