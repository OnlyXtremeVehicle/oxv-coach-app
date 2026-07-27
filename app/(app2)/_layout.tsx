/**
 * Layout du groupe (app2) — l'arbre pilote ACTIF.
 *
 * Ce groupe n'est plus orphelin : depuis la bascule du lot L6, `app/index.tsx`
 * y envoie le pilote, et la garde de build qui le renvoyait vers la racine hors
 * développement a été retirée (voir le commentaire dans le corps, plus bas —
 * la conserver produirait une boucle de redirection en production).
 *
 * Quatre portes, déclarées dans TAB_ROUTES : Miroir, Data, Club, Vous.
 *
 * - garde d'auth : session expirée → login (même garde que app/(app)) ;
 * - GestureHandlerRootView racine (Sheet et PullToRefreshDial en dépendent) ;
 * - Stack sans header natif, animation 'none' : l'entrée d'écran est la
 *   porte (useDoorTransition), pas une transition de navigateur ;
 * - TabBar V2 custom posée en absolu au-dessus du contenu (fond blur) ;
 * - masquage pendant la capture — ce qui est couvert ici : l'état pilote v1
 *   (store, S6_roulage) et les segments v1 du flux capture via
 *   shouldShowTabBar (appMap, importée sans modification), PLUS les segments
 *   V2 listés dans V2_HIDDEN_SEGMENTS (/rec/<segment>, routes à venir au
 *   lot L2) — silence en piste.
 */

import { Redirect, Stack, router, usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { shouldShowTabBar } from '@/lib/appMap';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { HeroMorphProvider } from '@/ui/v2/motion';
import { TabBar } from '@/ui/v2/TabBar';
import { isV2CaptureFlowPath } from '@/ui/v2/centralButtonLogic';
import { colors } from '@/ui/v2/tokens';
import { useCentralButtonState } from '@/ui/v2/useCentralButtonState';
import type { TabKey } from '@/ui/v2/shellLogic';

/** Route racine de chaque porte (groupe expo-router inclus). */
const TAB_ROUTES: Record<TabKey, string> = {
  miroir: '/(app2)',
  data: '/(app2)/data',
  club: '/(app2)/club',
  vous: '/(app2)/vous',
};

/**
 * Porte active depuis le pathname (les groupes sont déjà retirés par
 * expo-router). Les écrans hors portes (rec, dev-galerie) retombent sur
 * 'miroir' — la porte d'accueil, jamais une barre sans état.
 */
function currentTabOf(pathname: string): TabKey {
  const segment = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  if (segment === 'data') return 'data';
  if (segment === 'club') return 'club';
  if (segment === 'vous') return 'vous';
  return 'miroir';
}

export default function App2Layout() {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const pilotState = useAppStateStore((s) => s.state);
  const central = useCentralButtonState();

  // Lot L6 — bascule faite. Le garde de build qui renvoyait ce groupe vers la
  // racine hors développement a été retiré : c'est désormais (app2) qui reçoit
  // le pilote depuis app/index.tsx. Le conserver produirait une boucle de
  // redirection en production (/ → /(app2) → / → …).

  // Si la session expire en cours d'usage, le store passe automatiquement en
  // 'unauthenticated' via onAuthStateChange → on renvoie au login (même
  // garde que app/(app)/_layout.tsx).
  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  // Silence en piste + flux capture : la barre s'efface. Couvert ici : état
  // v1 S6_roulage + segments v1 (shouldShowTabBar, appMap) ET segments V2
  // sous /rec/<segment> (isV2CaptureFlowPath — routes à venir au lot L2).
  const showTabBar = shouldShowTabBar(pathname, pilotState) && !isV2CaptureFlowPath(pathname);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Registre HeroMorph inter-écrans (lot L1) : les sources (héros de
          l'accueil, SessionCard) figent leur géométrie ici, l'écran Bilan la
          consomme au take. Hors provider, tout retombe sur la porte. */}
      <HeroMorphProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg.base },
            animation: 'none',
          }}
        />
      </HeroMorphProvider>
      {showTabBar ? (
        <TabBar
          current={currentTabOf(pathname)}
          onNavigate={(tab) => router.navigate(TAB_ROUTES[tab] as never)}
          central={{
            mode: central.mode,
            label: central.label,
            // Câblage provisoire (lot L0) : rec/countdown mènent à l'écran
            // capture ; « Réserver » ouvre la porte Club en attendant le
            // vrai flux de réservation (lot L4). navigate, pas push : taper
            // plusieurs fois le bouton n'empile pas de doublons.
            onPress: () =>
              router.navigate(
                (central.mode === 'reserve' ? '/(app2)/club' : '/(app2)/rec') as never
              ),
          }}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
});
