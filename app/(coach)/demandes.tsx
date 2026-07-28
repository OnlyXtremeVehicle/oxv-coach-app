/**
 * Coach — Demandes reçues (handoff §12 `coach/21-demandes`, sur `coaching_bookings`).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : le MÊME écran
 * s'adapte selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : en-tête (eyebrow DEMANDES +
 *     titre « N nouvelles demandes ») puis les cartes de demande, actions en
 *     RANGÉE (Accepter · Proposer un créneau · Décliner) — fidèle à la maquette.
 *     Le rail (CoachRail) est fourni par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : AppBar + une colonne, actions EMPILÉES.
 *
 * Données réelles (RLS `coaching_bookings_coach_select`) : les demandes
 * `pending` passent en tête (une décision y est attendue) et portent le PRÉNOM
 * dénormalisé du pilote (`pilot_first_name`, Phase 2) — jamais la ligne `users`.
 * Absent → repli « Pilote ». Accepter / Décliner sont réels
 * (`coaching_bookings_coach_respond`). Les demandes traitées affichent leur
 * statut, TOUJOURS doublé d'un libellé humain (jamais une couleur seule).
 *
 * Adaptations notées (aucune table/colonne ajoutée) :
 *   - Le liseré d'accent de la maquette est un bleu hors-token (#2D4066). On
 *     applique l'identité COACH sanctionnée (`coachAccent` #E23A4E), comme les
 *     rangées actives de la File de lecture — le bleu reste réservé à la
 *     comparaison (« une couleur = une donnée »).
 *   - « Proposer un créneau » n'a pas d'action serveur propre : il ouvre l'écran
 *     Disponibilités (capacité RÉELLE d'ouvrir un créneau), jamais un contrôle
 *     mort. La séance se convient de gré à gré, hors application.
 *   - L'avatar porte l'INITIALE du prénom réel (une seule lettre : on n'a pas le
 *     nom de famille — aucune fabrication).
 *
 * Doctrine : vouvoiement, aucun emoji, descriptif jamais prescriptif, aucun
 * classement. Or réservé au chrono (absent ici). Réutilise le kit (Screen,
 * AppBar, Card, SectionLabel, StateWrapper).
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  bookingStatusLabel,
  type CoachBooking,
  listCoachBookings,
  respondToBooking,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort, formatDateTime } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

const AVATAR = 40;

export default function CoachDemandesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Identifiant de la demande en cours de réponse (verrouille SES boutons).
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await listCoachBookings();
    setBookings(rows);
    setLoading(false);
  }, []);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listCoachBookings()
      .then((rows) => {
        if (!cancelled) {
          setBookings(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);

  const pending = bookings.filter((b) => b.status === 'pending');
  const treated = bookings.filter((b) => b.status !== 'pending');

  const listState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : bookings.length === 0
        ? 'empty'
        : 'nominal';

  async function onRespond(id: string, status: 'accepted' | 'declined') {
    setBusyId(id);
    const result = await respondToBooking(id, status);
    setBusyId(null);

    if (!result.ok) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }
    Toast.show({
      type: 'success',
      text1: status === 'accepted' ? 'Demande acceptée.' : 'Demande déclinée.',
    });
    // Recharge pour refléter le nouveau statut (et sortir de « en attente »).
    await reload();
  }

  // « Proposer un créneau » = ouvrir l'écran Disponibilités (action réelle du
  // coach). La demande n'y est pas liée en base : la séance se convient de gré
  // à gré, hors application. Jamais un contrôle mort.
  const onPropose = useCallback(() => {
    router.push('/(coach)/disponibilites' as never);
  }, []);

  return (
    <Screen>
      {isConsole ? null : <AppBar title="DEMANDES" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          <>
            <Text style={s.eyebrow}>DEMANDES</Text>
            <Text style={s.title} accessibilityRole="header">
              {titleFor(pending.length)}
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>ACCOMPAGNEMENT</Text>
            <Text style={s.title} accessibilityRole="header">
              {titleFor(pending.length)}
            </Text>
            <Text style={s.intro}>
              Les pilotes vous écrivent ici. La séance et son règlement se conviennent de gré à gré,
              hors application.
            </Text>
          </>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <StateWrapper
            state={listState}
            skeletonLines={4}
            emptyLabel="Aucune demande"
            emptyMessage="Les pilotes qui consultent votre fiche peuvent vous adresser une demande. Elle apparaîtra ici."
            emptySource="coaching_bookings"
            errorCause="Vos demandes n'ont pas pu être chargées."
            onRetry={load}
          >
            {pending.length > 0 ? (
              <Section title="En attente">
                {pending.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    isConsole={isConsole}
                    busy={busyId === b.id}
                    onAccept={() => onRespond(b.id, 'accepted')}
                    onDecline={() => onRespond(b.id, 'declined')}
                    onPropose={onPropose}
                  />
                ))}
              </Section>
            ) : null}

            {treated.length > 0 ? (
              <Section title="Traitées">
                {treated.map((b) => (
                  <BookingCard key={b.id} booking={b} isConsole={isConsole} muted />
                ))}
              </Section>
            ) : null}
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  isConsole,
  busy,
  muted,
  onAccept,
  onDecline,
  onPropose,
}: {
  booking: CoachBooking;
  isConsole: boolean;
  busy?: boolean;
  muted?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onPropose?: () => void;
}) {
  const name = pilotName(booking);
  const subtitle = subtitleFor(booking);
  const received = receivedLabel(booking.createdAt);
  const statusText = bookingStatusLabel(booking.status);

  return (
    <Card style={[s.cardCommon, muted ? s.cardMuted : s.cardPending]}>
      <View style={s.headRow}>
        <View style={s.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={s.avatarTxt}>{initialOf(name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Text style={s.timestamp} accessibilityLabel={`Reçue ${received}`}>
          {received}
        </Text>
      </View>

      {muted ? (
        // Traitée : statut doublé d'un libellé humain (jamais couleur-seule).
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>{statusText}</Text>
        </View>
      ) : (
        <>
          {/* Le message porte la décision : mis en avant. */}
          {booking.message ? (
            <Text style={s.message}>{`« ${booking.message} »`}</Text>
          ) : (
            <Text style={s.messageEmpty}>Sans message — prise de contact.</Text>
          )}

          {booking.requestedStartsAt ? (
            <View style={s.factRow}>
              <Text style={s.factLabel}>Créneau souhaité</Text>
              <Text style={s.factValue}>{formatDateTime(booking.requestedStartsAt)}</Text>
            </View>
          ) : null}

          {isConsole ? (
            <View style={s.actionsRow}>
              <View style={{ flex: 1 }}>
                <CoachBtn label="Accepter" variant="primary" loading={busy} onPress={onAccept} />
              </View>
              <CoachBtn
                label="Proposer un créneau"
                variant="ghost"
                disabled={busy}
                onPress={onPropose}
              />
              <CoachBtn label="Décliner" variant="ghost" disabled={busy} onPress={onDecline} />
            </View>
          ) : (
            <View style={s.actionsStack}>
              <CoachBtn label="Accepter" variant="primary" loading={busy} onPress={onAccept} />
              <View style={s.actionsStackRow}>
                <View style={{ flex: 1 }}>
                  <CoachBtn
                    label="Proposer un créneau"
                    variant="ghost"
                    disabled={busy}
                    onPress={onPropose}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CoachBtn label="Décliner" variant="ghost" disabled={busy} onPress={onDecline} />
                </View>
              </View>
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <View style={{ marginBottom: spacing.md }}>
        <SectionLabel>{title}</SectionLabel>
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

/**
 * CTA coach — bouton local à l'identité rouge (`coachAccent`), au canon des
 * autres écrans coach (cf. `index.tsx`, `gabarits.tsx`) : le kit partagé
 * `Button` ne propose que le crème/ghost et n'est pas modifiable ici. Libellés
 * en sentence-case (Hanken), fidèles à la maquette.
 */
function CoachBtn({
  label,
  variant = 'primary',
  loading,
  disabled,
  onPress,
}: {
  label: string;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const ghost = variant === 'ghost';
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }): StyleProp<ViewStyle> => [
        s.btn,
        ghost ? s.btnGhost : s.btnPrimary,
        disabled && !loading ? s.btnDim : null,
        pressed && !inert ? s.btnPressed : null,
      ]}
    >
      <View style={s.btnContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.btnTxt, ghost ? s.btnTxtGhost : s.btnTxtPrimary]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// Helpers (purs, affichage seulement — dérivés de données réelles)
// ============================================================================

function pilotName(booking: CoachBooking): string {
  const first = booking.pilotFirstName?.trim();
  return first && first.length > 0 ? first : 'Pilote';
}

/** Initiale du prénom réel. Une seule lettre : le nom de famille n'est pas
 *  connu (on ne lit jamais `users`), on n'en fabrique pas. */
function initialOf(name: string): string {
  const c = name.trim()[0];
  return c ? c.toUpperCase() : '·';
}

/** Sous-titre factuel : le circuit demandé s'il est fourni, sinon une prise de
 *  contact. Le type (séance/journée) n'existe pas en base — on ne l'invente pas. */
function subtitleFor(booking: CoachBooking): string {
  const circuit = booking.circuitName?.trim();
  return circuit && circuit.length > 0 ? circuit : 'Prise de contact';
}

/** Titre dynamique : compte les demandes EN ATTENTE (« nouvelles »). */
function titleFor(pendingCount: number): string {
  if (pendingCount === 0) return 'Aucune nouvelle demande.';
  const plural = pendingCount > 1 ? 's' : '';
  return `${pendingCount} nouvelle${plural} demande${plural}.`;
}

/** Ancienneté lisible de la demande, dérivée de `created_at` (horodatage réel
 *  de réception). Repli sur la date courte au-delà d'une semaine. */
function receivedLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  if (diffMs < 0) return formatDateShort(iso);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 2) return 'hier';
  if (d < 7) return `il y a ${d} j`;
  return formatDateShort(iso);
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },

  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
    marginTop: spacing.sm,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.6,
    marginTop: spacing.md,
  },

  // Carte de demande
  cardCommon: { padding: spacing.lg },
  // En attente : liseré d'accent COACH (rouge sanctionné), une décision attendue.
  cardPending: { borderLeftWidth: 2, borderLeftColor: palette.coachAccent },
  cardMuted: { opacity: 0.85 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0.5, color: palette.creamSoft },
  name: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.h3,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  timestamp: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
    marginLeft: spacing.sm,
  },

  // Statut (carte traitée)
  statusRow: { flexDirection: 'row', marginTop: spacing.md },
  statusLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // Message
  message: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.creamSoft,
    lineHeight: fontSize.bodyLg * 1.5,
    marginTop: spacing.md,
  },
  messageEmpty: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.md,
  },

  // Fait (créneau souhaité)
  factRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md },
  factLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  factValue: { fontFamily: fonts.body, fontSize: fontSize.small, color: palette.creamSoft },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionsStack: { marginTop: spacing.lg, gap: spacing.sm },
  actionsStackRow: { flexDirection: 'row', gap: spacing.sm },

  // CTA coach (local — le kit partagé ne fait pas le rouge)
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  btnPrimary: { backgroundColor: palette.coachAccent },
  btnGhost: {
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  btnDim: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  btnTxt: { fontFamily: fonts.bodySemi, fontSize: fontSize.body, letterSpacing: 0.2 },
  btnTxtPrimary: { color: palette.cream },
  btnTxtGhost: { color: palette.creamSoft },
});
