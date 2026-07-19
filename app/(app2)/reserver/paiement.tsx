/**
 * RÉSERVER — paiement (V2-L4, mission D, flux A1, écran 3/3). Route NOUVELLE.
 *
 * Récap de la journée + offre choisie, puis méthodes de paiement — STRUCTURE
 * PRÊTE, boutons INERTES dans ce lot (Stripe PaymentSheet et IAP abonnement
 * branchés au lot A1-ON). Drapeau `app_payments` vérifié (useReserverPayment) :
 * OFF → écran « Réservations à l'ouverture ». Tunnel `reserve_funnel_3`.
 *
 * Mention légale CGV en attente de rédaction avocat (voir TODO ci-dessous).
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useReserverPayment } from '@/features/vous/useReserverPayment';
import { ReserverClosedView } from '@/features/vous/reserverUi';
import {
  OxvIcon,
  PressScale,
  StateView,
  colors,
  radius,
  space,
  tabBarSpace,
  typo,
  useDoorTransition,
  type OxvIconName,
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

/** Méthode de paiement — structure prête, INERTE dans ce lot (flag OFF). */
function MethodRow({ icon, label }: { icon: OxvIconName; label: string }) {
  return (
    <View style={styles.method} accessible accessibilityLabel={`${label}, bientôt disponible`}>
      <OxvIcon name={icon} size={20} color={colors.text.mid} />
      <Text style={styles.methodLabel}>{label}</Text>
      <Text style={styles.methodSoon}>Bientôt</Text>
    </View>
  );
}

export default function ReserverPaymentScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { sessionId, offer } = useLocalSearchParams<{ sessionId: string; offer: string }>();
  const { state } = useReserverPayment(sessionId, offer);

  const day = state.day;

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
        <Text style={styles.title}>PAIEMENT</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.phase === 'checking' ? (
        <View style={styles.body}>
          <StateView state="loading" shape="card" />
        </View>
      ) : state.phase === 'error' ? (
        <View style={styles.body}>
          <StateView state="error" errorMessage="Le récapitulatif n'a pas pu se charger." />
        </View>
      ) : state.access === 'closed' ? (
        <ReserverClosedView
          foundersCount={state.foundersCount}
          foundersEnabled={state.foundersEnabled}
        />
      ) : day === null ? (
        <View style={styles.body}>
          <StateView state="empty" emptyMessage="Journée introuvable." />
        </View>
      ) : state.offer === null ? (
        <View style={styles.body}>
          <StateView
            state="empty"
            emptyMessage="Cette offre n'est plus disponible pour cette journée."
          />
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: space.xl,
              paddingTop: space.md,
              paddingBottom: tabBarSpace(insets.bottom) + 112,
            }}
          >
            {/* Récap */}
            <Text style={styles.sectionEyebrow}>VOTRE JOURNÉE</Text>
            <View style={styles.recapCard}>
              <View style={styles.recapLine}>
                <Text style={styles.recapKey}>Circuit</Text>
                <Text style={styles.recapVal}>{day.circuitName ?? '—'}</Text>
              </View>
              <View style={[styles.recapLine, styles.recapDivider]}>
                <Text style={styles.recapKey}>Date</Text>
                <Text style={styles.recapVal}>{fullDayLabel(day.date)}</Text>
              </View>
              <View style={[styles.recapLine, styles.recapDivider]}>
                <Text style={styles.recapKey}>Offre</Text>
                <Text style={styles.recapVal}>{state.offer?.label ?? '—'}</Text>
              </View>
              <View style={[styles.recapLine, styles.recapDivider]}>
                <Text style={styles.recapKey}>Total TTC</Text>
                <Text style={styles.recapTotal}>{state.offer?.priceLabel ?? '—'}</Text>
              </View>
            </View>

            {/* Méthodes — structure prête, inertes */}
            <Text style={styles.sectionEyebrow}>MÉTHODE DE PAIEMENT</Text>
            <View style={styles.methodList}>
              <MethodRow icon="cle" label="Carte bancaire" />
              <MethodRow icon="cle" label="Apple Pay" />
            </View>

            {/* TODO_AVOCAT CGV — texte des Conditions générales de vente à rédiger. */}
            <Text style={styles.legal}>
              Le paiement en ligne ouvrira avec les réservations. En confirmant, vous accepterez les
              Conditions générales de vente d'OXV.
            </Text>
          </ScrollView>

          {/* CTA inerte (flag OFF) */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
            <View
              style={styles.payBtn}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Paiement disponible à l'ouverture"
            >
              <Text style={styles.payLabel}>Paiement à l'ouverture</Text>
            </View>
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

  sectionEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  recapCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  recapLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
  },
  recapDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
  },
  recapKey: { fontFamily: typo.body, fontSize: 14, color: colors.text.mid },
  recapVal: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
  recapTotal: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },

  methodList: { gap: space.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    opacity: 0.7,
  },
  methodLabel: { flex: 1, fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },
  methodSoon: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },

  legal: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xl,
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
  },
  payBtn: {
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
    opacity: 0.7,
  },
  payLabel: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.text.mid },
});
