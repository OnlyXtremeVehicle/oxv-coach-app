/**
 * AppTabBar — barre d'onglets 5 zones (maquettes Claude Design refonte-v2 §5).
 *
 * Zones : Miroir · Data Lab · Carnet · Découverte · Compte (Compte EST un onglet
 * dans les maquettes — décision fondateur 2026-07-12).
 *
 * Specs canon (`docs/refonte-app/04_DESIGN_CANON.md §4`) : hauteur 88 + safe-area,
 * fond `rgba(5,5,5,0.9)`, border-top `#1C1C20`, icônes 21 stroke 1.65, label
 * Geist Mono 8.5. Actif `#F8F9FA`, inactif `#54545C`. **AUCUN or sur la nav.**
 *
 * Flou de fond (canon « flouté ») : reporté — il n'a d'effet qu'avec une barre
 * posée EN OVERLAY au-dessus du contenu scrollable (donc inset manuel sur chaque
 * écran). L'archi actuelle (barre dans la colonne flex du `_layout`) garantit un
 * inset automatique sans calcul ; le flou se branchera au build (BlurView), pas
 * à l'aveugle. Voir `roadmap/rapports/pr-07-polish.md`.
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

// Valeurs canon exactes (v2.ts réaligné en PR 7 ; couleurs nav codées en dur ici
// pour rester indépendantes du thème — la nav ne porte jamais d'or).
const ACTIVE = '#F8F9FA';
const INACTIVE = '#54545C';
const BG = 'rgba(5,5,5,0.9)';
const BORDER = '#1C1C20';

const LABELS: Record<TabZone, string> = {
  miroir: 'MIROIR',
  datalab: 'DATA LAB',
  carnet: 'CARNET',
  decouverte: 'DÉCOUVERTE',
  compte: 'COMPTE',
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
      {/* Miroir — la lecture de soi : cercle traversé d'une ligne de reflet. */}
      {zone === 'miroir' ? (
        <>
          <Circle cx={12} cy={12} r={8.2} {...p} />
          <Path d="M4 12h16" {...p} />
        </>
      ) : null}
      {/* Data Lab — l'analyse : axes + courbe. */}
      {zone === 'datalab' ? (
        <>
          <Path d="M4.5 4.5V20h15" {...p} />
          <Path d="M7.5 15.5l3-4 3 2 4-6" {...p} />
        </>
      ) : null}
      {/* Carnet — espace perso : carnet à reliure. */}
      {zone === 'carnet' ? (
        <>
          <Path d="M6.5 4.5h11v15h-11z" {...p} />
          <Path d="M9.5 4.5V19.5M12.5 9h3.5M12.5 13h3.5" {...p} />
        </>
      ) : null}
      {/* Découverte — marketplace/social : boussole. */}
      {zone === 'decouverte' ? (
        <>
          <Circle cx={12} cy={12} r={8.2} {...p} />
          <Path d="M14.8 9.2l-1.8 4.2-4.2 1.8 1.8-4.2z" {...p} />
        </>
      ) : null}
      {/* Compte — réglages : silhouette. */}
      {zone === 'compte' ? (
        <>
          <Circle cx={12} cy={8} r={3.2} {...p} />
          <Path d="M5.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" {...p} />
        </>
      ) : null}
    </Svg>
  );
}
