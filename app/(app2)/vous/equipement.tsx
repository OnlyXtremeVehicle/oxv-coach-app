/**
 * ÉQUIPEMENT — porte VOUS, écran 5/8 du lot V2-L4. Route `vous/equipement`.
 *
 * NE PAS confondre avec `app/(app2)/rec/equipement.tsx` (flux de capture BLE :
 * scan, appairage, placement). ICI c'est l'écran d'ÉTAT de l'équipement du
 * pilote — pas de scan :
 *   - Carte BOÎTIER : visuel trait (device générique, marque neutralisée),
 *     pastille d'état, batterie en CADRAN Dial « s » (LE cadran de l'écran —
 *     un seul, l'arc accent = l'UNIQUE accent de la zone), n° de série mono,
 *     dernier contact (deviceHealthService) ;
 *   - Carte CEINTURE (coachés) : « gérée au paddock » ;
 *   - Carte APPLE WATCH (iOS only) : statut HealthKit + bouton « Autoriser »
 *     gaté (consentement biométrie + drapeau + iOS) — sinon renvoi vers les
 *     Réglages consentements. Android : carte absente (Platform).
 *
 * Données RÉELLES (useEquipement) : batterie/état/série viennent du boîtier
 * affecté ; absent → « — » / pastille inconnue, jamais fabriqué. Garde Watch
 * fail-closed. Skia natif (dev-client), pas d'Expo Go.
 */

import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  Dial,
  haptic,
  OxvIcon,
  PressScale,
  radius,
  SectionHeader,
  space,
  Stagger,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import {
  devicePastille,
  deviceHealthLabel,
  watchCardVisible,
  watchShowAuthorizeButton,
  watchStatusLabel,
  type DevicePastille,
} from '@/features/vous/equipementLogic';
import { useEquipement } from '@/features/vous/useEquipement';

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

function contactLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Teinte de la pastille — tonale, JAMAIS rouge (l'accent unique = l'arc du cadran). */
function pastilleColor(p: DevicePastille): string {
  switch (p) {
    case 'ok':
      return colors.text.mid;
    case 'attention':
      return colors.text.hi;
    default:
      return colors.text.dim;
  }
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function EquipementScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const equip = useEquipement(profile?.id ?? null);

  const onAuthorizeWatch = async () => {
    haptic('tap');
    const allowed = await equip.requestWatchAuthorization();
    // Garde fermée (consentement/drapeau/iOS) → vers les Réglages consentements.
    if (!allowed) router.push('/(app2)/vous/reglages' as never);
  };

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe nu de 20 pt : hitSlop 12 porte la cible à 44 × 44.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          ÉQUIPEMENT
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xl,
        }}
      >
        {equip.status === 'loading' ? (
          <StateView state="loading" shape="list" />
        ) : equip.status === 'error' ? (
          <StateView
            state="error"
            errorMessage="Votre équipement n'a pas pu se charger."
            onRetry={equip.reload}
          />
        ) : (
          <Stagger step={45}>
            <DeviceCard equip={equip} />
            <BeltCard />
            {watchCardVisible(equip.isIOS) ? (
              <WatchCard equip={equip} onAuthorize={onAuthorizeWatch} />
            ) : null}
          </Stagger>
        )}
      </Animated.ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Carte boîtier — LE cadran (batterie)
// ---------------------------------------------------------------------------

function DeviceCard({ equip }: { equip: ReturnType<typeof useEquipement> }) {
  const { device } = equip;

  if (device === null) {
    return (
      <View style={styles.card}>
        <SectionHeader eyebrow="BOÎTIER" />
        <StateView
          state="empty"
          emptyMessage="Aucun boîtier affecté. Il vous est remis au paddock."
          style={styles.cardEmpty}
        />
      </View>
    );
  }

  const pastille = devicePastille(equip.healthStatus);
  const deviceName = device.alias ?? device.label;

  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="BOÎTIER" />
      <View style={styles.deviceTop}>
        <View style={styles.deviceGlyphWrap}>
          <DeviceGlyph />
          <View style={styles.deviceNameBlock}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {deviceName}
            </Text>
            <View style={styles.stateRow}>
              <View style={[styles.pastille, { backgroundColor: pastilleColor(pastille) }]} />
              <Text style={styles.stateLabel}>{deviceHealthLabel(equip.healthStatus)}</Text>
            </View>
          </View>
        </View>
        {/* Le CADRAN de l'écran : batterie (arc accent = accent unique). */}
        <Dial value={equip.batteryPercent} max={100} unit="%" label="Batterie" size="s" />
      </View>

      <View style={styles.metaList}>
        <MetaRow label="N° de série" value={device.serial ?? '—'} />
        <MetaRow label="Dernier contact" value={contactLabel(equip.lastContactAt)} />
      </View>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    // Libellé et valeur sont deux Text frères : groupés, ils se lisent d'un bloc.
    <View style={styles.metaRow} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Carte ceinture (coachés)
// ---------------------------------------------------------------------------

function BeltCard() {
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="CEINTURE CARDIO" />
      <View style={styles.simpleRow}>
        <OxvIcon name="ceinture" size={22} color={colors.text.mid} />
        <View style={styles.simpleBody}>
          <Text style={styles.simpleTitle}>Ceinture cardio</Text>
          <Text style={styles.simpleSub}>
            Réservée aux pilotes coachés — gérée au paddock par le staff.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Carte Apple Watch (iOS only)
// ---------------------------------------------------------------------------

function WatchCard({
  equip,
  onAuthorize,
}: {
  equip: ReturnType<typeof useEquipement>;
  onAuthorize: () => void;
}) {
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="APPLE WATCH" />
      <View style={styles.simpleRow}>
        <OxvIcon name="montre" size={22} color={colors.text.mid} />
        <View style={styles.simpleBody}>
          <Text style={styles.simpleTitle}>Fréquence cardiaque</Text>
          <Text style={styles.simpleSub}>
            Autorisation santé : {watchStatusLabel(equip.watchStatus)}
          </Text>
        </View>
      </View>
      {watchShowAuthorizeButton(equip.watchStatus) ? (
        <PressScale
          onPress={onAuthorize}
          accessibilityLabel="Autoriser l'accès à la fréquence cardiaque"
          containerStyle={styles.authBtnContainer}
          style={styles.authBtn}
        >
          <Text style={styles.authBtnLabel}>AUTORISER</Text>
        </PressScale>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glyphes
// ---------------------------------------------------------------------------

/** Boîtier générique au trait (marque neutralisée, doctrine brand-neutral). */
function DeviceGlyph() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Rect
        x={8}
        y={12}
        width={28}
        height={20}
        rx={4}
        stroke={colors.text.mid}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M14 22 L18 22 L20 18 L24 26 L26 22 L30 22"
        stroke={colors.text.mid}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  card: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
    gap: space.md,
  },
  cardEmpty: { marginTop: space.sm },

  deviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  deviceGlyphWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  deviceNameBlock: { flex: 1, gap: 4 },
  deviceName: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pastille: { width: 7, height: 7, borderRadius: 4 },
  stateLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.low,
  },

  metaList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.sm,
    gap: space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  metaLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.dim,
  },
  metaValue: {
    flexShrink: 1,
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
    textAlign: 'right',
  },

  simpleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  simpleBody: { flex: 1, gap: 3 },
  simpleTitle: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  simpleSub: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },

  authBtnContainer: { alignSelf: 'flex-start' },
  // CTA NEUTRE : l'accent rouge UNIQUE de l'écran est l'arc du cadran batterie.
  authBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text.mid,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  authBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
});
