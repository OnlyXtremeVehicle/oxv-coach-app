/**
 * RÉSERVER — détail & choix d'offre (V2-L4, mission D, flux A1, écran 2/3).
 * Route NOUVELLE.
 *
 * Héros circuit plein, programme de la journée (timeline hairline), sélection
 * d'offre en cartes radio (prix TTC mono), récap. Drapeau `app_payments`
 * vérifié (useReserverDay) : OFF → écran « Réservations à l'ouverture ». Tunnel
 * `reserve_funnel_2`. Données SITE (SELECT only) ; prix absent → « — ».
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useReserverDay } from '@/features/vous/useReserverDay';
import { CircuitFallback, ReserverClosedView } from '@/features/vous/reserverUi';
import { type AvailableDay, type AvailableOffer } from '@/services/bookingCatalogService';
import { type OfferKey } from '@/services/bookingCatalogLogic';
import {
  HeroPhoto,
  PressScale,
  StateView,
  colors,
  radius,
  space,
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

function fullDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** « 09:00 » depuis un time SQL « 09:00:00 » (ou tel quel si déjà court). */
function shortTime(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

function ProgrammeTimeline({ day }: { day: AvailableDay }) {
  const start = shortTime(day.startTime);
  const end = shortTime(day.endTime);
  const rows: { time: string | null; label: string }[] = [];
  if (start) rows.push({ time: start, label: 'Accueil au paddock' });
  rows.push({ time: null, label: 'Roulage' });
  if (end) rows.push({ time: end, label: 'Fin de journée' });

  if (!start && !end) {
    return <Text style={styles.programmeFallback}>Le programme est communiqué au paddock.</Text>;
  }
  return (
    <View style={styles.timeline}>
      {rows.map((r, i) => (
        <View key={i} style={[styles.timelineRow, i < rows.length - 1 && styles.timelineDivider]}>
          <Text style={styles.timelineTime}>{r.time ?? '—'}</Text>
          <Text style={styles.timelineLabel}>{r.label}</Text>
        </View>
      ))}
    </View>
  );
}

function OfferOption({
  offer,
  selected,
  onPress,
}: {
  offer: AvailableOffer;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel={`Offre ${offer.label}, ${offer.priceLabel}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.offer, selected && styles.offerSelected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <Text style={styles.offerLabel}>{offer.label}</Text>
      <Text style={styles.offerPrice}>{offer.priceLabel}</Text>
    </PressScale>
  );
}

export default function ReserverDayScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { state, selectOffer } = useReserverDay(sessionId);

  const day = state.day;
  const selected: AvailableOffer | null =
    day?.offers.find((o) => o.key === state.selectedOffer) ?? day?.offers[0] ?? null;

  function goToPayment() {
    if (!day || !selected) return;
    router.push({
      pathname: '/(app2)/reserver/paiement',
      params: { sessionId: day.sessionId, offer: selected.key },
    } as never);
  }

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
        <Text style={styles.title}>JOURNÉE</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.phase === 'checking' ? (
        <View style={styles.body}>
          <StateView state="loading" shape="card" />
        </View>
      ) : state.phase === 'error' ? (
        <View style={styles.body}>
          <StateView state="error" errorMessage="Cette journée n'a pas pu se charger." />
        </View>
      ) : state.access === 'closed' ? (
        <ReserverClosedView foundersCount={state.foundersCount} />
      ) : day === null ? (
        <View style={styles.body}>
          <StateView state="empty" emptyMessage="Journée introuvable." />
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: space.xl,
              paddingTop: space.md,
              paddingBottom: tabBarSpace(insets.bottom) + 96,
            }}
          >
            <HeroPhoto uri={undefined} height={180} fallback={<CircuitFallback />}>
              <Text style={styles.heroEyebrow} numberOfLines={1}>
                {(day.circuitName ?? 'Circuit').toUpperCase()}
              </Text>
              <Text style={styles.heroDate}>{fullDayLabel(day.date)}</Text>
            </HeroPhoto>

            <Text style={styles.sectionEyebrow}>PROGRAMME</Text>
            <ProgrammeTimeline day={day} />

            <Text style={styles.sectionEyebrow}>VOTRE OFFRE</Text>
            {day.offers.length === 0 ? (
              <Text style={styles.programmeFallback}>
                Les offres de cette journée seront précisées prochainement.
              </Text>
            ) : (
              <View style={styles.offerList}>
                {day.offers.map((o) => (
                  <OfferOption
                    key={o.key}
                    offer={o}
                    selected={selected?.key === o.key}
                    onPress={() => selectOffer(o.key as OfferKey)}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Récap collant + CTA */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.recap}>
              <Text style={styles.recapLabel}>Total TTC</Text>
              <Text style={styles.recapPrice}>{selected?.priceLabel ?? '—'}</Text>
            </View>
            <PressScale
              onPress={goToPayment}
              disabled={selected === null}
              accessibilityLabel="Continuer vers le paiement"
              containerStyle={styles.ctaContainer}
              style={[styles.ctaBtn, selected === null && styles.ctaDisabled]}
            >
              <Text style={styles.ctaLabel}>Continuer</Text>
            </PressScale>
          </View>
        </>
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

  heroEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.text.hi,
    marginBottom: space.xs,
  },
  heroDate: { fontFamily: typo.bodySemi, fontSize: 18, color: colors.text.hi },

  sectionEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  programmeFallback: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },

  timeline: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
  },
  timelineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  timelineTime: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.hi,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  timelineLabel: { fontFamily: typo.body, fontSize: 14, color: colors.text.mid },

  offerList: { gap: space.sm },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  offerSelected: { borderColor: colors.accent },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  offerLabel: { flex: 1, fontFamily: typo.bodySemi, fontSize: 16, color: colors.text.hi },
  offerPrice: {
    fontFamily: typo.monoSemi,
    fontSize: 16,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.card,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  recap: { flex: 1 },
  recapLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  recapPrice: {
    fontFamily: typo.monoSemi,
    fontSize: 20,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  ctaContainer: {},
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.text.hi },
});
