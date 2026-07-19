/**
 * RÉSERVER — catalogue (V2-L4, mission D, flux A1, écran 1/3). Route NOUVELLE.
 *
 * FlashList de cartes journée (patron checkout Uber Eats) : HeroPhoto circuit
 * 120, date pleine, offres en Chip, jauge de places 20 segments (la rareté se
 * voit) ; complet → « LISTE D'ATTENTE ». Données SITE via bookingCatalogService
 * (SELECT only). Drapeau `app_payments` vérifié en amont (useReserverCatalog) :
 * OFF → écran « Réservations à l'ouverture ». Tunnel `reserve_funnel_1` émis
 * une fois l'accès résolu, ouvert OU fermé.
 *
 * Données réelles : aucune journée → StateView vide ; panne → StateView erreur ;
 * jamais une carte fabriquée.
 */

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { type AvailableDay } from '@/services/bookingCatalogService';
import { useReserverCatalog } from '@/features/vous/useReserverCatalog';
import {
  CircuitFallback,
  OfferChips,
  PlacesGaugeBar,
  ReserverClosedView,
} from '@/features/vous/reserverUi';
import {
  HeroPhoto,
  PressScale,
  StateView,
  colors,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** « Vendredi 17 juillet » depuis une date ISO courte « YYYY-MM-DD ». */
function fullDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function DayCard({
  day,
  index,
  onPress,
}: {
  day: AvailableDay;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={staggerEntering(index)} style={styles.cardWrap}>
      <PressScale
        onPress={onPress}
        accessibilityLabel={`${fullDayLabel(day.date)}${
          day.circuitName ? `, ${day.circuitName}` : ''
        }`}
      >
        <HeroPhoto uri={undefined} height={120} fallback={<CircuitFallback />}>
          <Text style={styles.cardEyebrow} numberOfLines={1}>
            {(day.circuitName ?? 'Circuit').toUpperCase()}
          </Text>
          <Text style={styles.cardDate} numberOfLines={1}>
            {fullDayLabel(day.date)}
          </Text>
        </HeroPhoto>
        <View style={styles.cardFooter}>
          <OfferChips labels={day.offers.map((o) => o.label)} />
          <PlacesGaugeBar gauge={day.places} />
        </View>
      </PressScale>
    </Animated.View>
  );
}

export default function ReserverCatalogScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { state, refresh } = useReserverCatalog();

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.backDisc}>
            <BackChevron />
          </View>
        </PressScale>
        <Text style={styles.title}>RÉSERVER</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.phase === 'checking' ? (
        <View style={styles.body}>
          <StateView state="loading" shape="card" />
        </View>
      ) : state.phase === 'error' ? (
        <View style={styles.body}>
          <StateView
            state="error"
            errorMessage="Le catalogue n'a pas pu se charger."
            onRetry={refresh}
          />
        </View>
      ) : state.access === 'closed' ? (
        <ReserverClosedView
          foundersCount={state.foundersCount}
          foundersEnabled={state.foundersEnabled}
        />
      ) : (
        <FlashList
          data={state.days}
          keyExtractor={(d) => d.sessionId}
          estimatedItemSize={210}
          showsVerticalScrollIndicator={false}
          refreshing={state.refreshing}
          onRefresh={refresh}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          }}
          ListEmptyComponent={
            <StateView state="empty" emptyMessage="Aucune journée ouverte pour l'instant." />
          }
          renderItem={({ item, index }) => (
            <DayCard
              day={item}
              index={index}
              onPress={() => router.push(`/(app2)/reserver/${item.sessionId}` as never)}
            />
          )}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: { fontFamily: typo.display, fontSize: 18, letterSpacing: 2, color: colors.text.hi },
  body: { paddingHorizontal: space.xl, paddingTop: space.lg, flex: 1 },

  cardWrap: {
    marginBottom: space.lg,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  cardEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.text.hi,
    marginBottom: space.xs,
  },
  cardDate: { fontFamily: typo.bodySemi, fontSize: 16, color: colors.text.hi },
  cardFooter: { padding: space.lg, gap: space.md },
});
