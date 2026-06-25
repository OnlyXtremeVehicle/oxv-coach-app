/**
 * Vue Coach — demandes de séance reçues (Phase 1 marketplace, boucle de réponse).
 *
 * Liste les `coaching_bookings` adressées au coach courant (RLS
 * `coaching_bookings_coach_select`). Les demandes en attente sont mises en tête :
 * c'est là qu'une décision est attendue. Sur une demande `pending`, le coach
 * peut Accepter ou Décliner (RLS `coaching_bookings_coach_respond`). Les autres
 * affichent leur statut, toujours DOUBLÉ d'un libellé humain — jamais une
 * couleur seule (doctrine + a11y).
 *
 * Identité du pilote : la RLS ne garantit pas la lecture de la ligne `users`
 * d'un pilote non affilié. Quand elle est masquée, on affiche « Pilote » et on
 * met le MESSAGE en avant : c'est lui qui porte le contexte de décision.
 *
 * Doctrine : vouvoiement, aucun emoji, sobre/premium, aucun classement ni note.
 * Accent coach = `palette.coach` (neutre, ni or ni rouge décoratifs). Réutilise
 * le kit (Screen, AppBar, Card, Button, SectionLabel).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  bookingStatusLabel,
  type CoachBooking,
  listCoachBookings,
  respondToBooking,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatDateTime } from '@/utils/format';

export default function CoachDemandesScreen() {
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [loading, setLoading] = useState(true);
  // Identifiant de la demande en cours de réponse (verrouille SES boutons).
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await listCoachBookings();
    setBookings(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listCoachBookings()
        .then((rows) => {
          if (!cancelled) {
            setBookings(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

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

  const pending = bookings.filter((b) => b.status === 'pending');
  const treated = bookings.filter((b) => b.status !== 'pending');

  return (
    <Screen>
      <AppBar title="DEMANDES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ACCOMPAGNEMENT</Text>
        <Text style={s.title} accessibilityRole="header">
          Les demandes reçues.
        </Text>
        <Text style={s.intro}>
          Les pilotes vous écrivent ici. La séance et son règlement se conviennent de gré à gré,
          hors application.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : bookings.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {pending.length > 0 ? (
              <Section title="En attente">
                {pending.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    busy={busyId === b.id}
                    onAccept={() => onRespond(b.id, 'accepted')}
                    onDecline={() => onRespond(b.id, 'declined')}
                  />
                ))}
              </Section>
            ) : null}

            {treated.length > 0 ? (
              <Section title="Traitées">
                {treated.map((b) => (
                  <BookingCard key={b.id} booking={b} muted />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function pilotName(booking: CoachBooking): string {
  if (!booking.pilot) return 'Pilote';
  const full = [booking.pilot.firstName, booking.pilot.lastName].filter(Boolean).join(' ').trim();
  return full || 'Pilote';
}

function BookingCard({
  booking,
  busy,
  muted,
  onAccept,
  onDecline,
}: {
  booking: CoachBooking;
  busy?: boolean;
  muted?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const name = pilotName(booking);
  const statusText = bookingStatusLabel(booking.status);
  const slot = booking.requestedStartsAt ? formatDateTime(booking.requestedStartsAt) : null;

  return (
    <Card style={muted ? { opacity: 0.85 } : { borderColor: theme.palette.coach }}>
      <View style={s.headRow}>
        <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>
          {name}
        </Text>
        {/* Statut toujours doublé d'un libellé (jamais couleur-seule). En
            attente, l'acte est sous les boutons : pas de badge redondant. */}
        {booking.status !== 'pending' ? <Text style={s.statusLabel}>{statusText}</Text> : null}
      </View>

      <Text style={s.receivedMeta}>Reçue le {formatDateShort(booking.createdAt)}</Text>

      {/* Le message porte la décision : il est mis en avant. */}
      {booking.message ? (
        <Text style={s.message}>{booking.message}</Text>
      ) : (
        <Text style={s.messageEmpty}>Sans message — prise de contact.</Text>
      )}

      {slot || booking.circuitName ? (
        <View style={s.factRow}>
          {slot ? (
            <View style={s.fact}>
              <Text style={s.factLabel}>Créneau souhaité</Text>
              <Text style={s.factValue}>{slot}</Text>
            </View>
          ) : null}
          {booking.circuitName ? (
            <View style={s.fact}>
              <Text style={s.factLabel}>Circuit</Text>
              <Text style={s.factValue}>{booking.circuitName}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {booking.status === 'pending' && onAccept && onDecline ? (
        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button label="Accepter" loading={busy} onPress={onAccept} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Décliner" variant="ghost" disabled={busy} onPress={onDecline} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <View style={{ marginBottom: theme.spacing.md }}>
        <SectionLabel>{title}</SectionLabel>
      </View>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}

function EmptyState() {
  return (
    <Card
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        marginTop: theme.spacing.xl,
      }}
    >
      <Text style={s.emptyTitle} accessibilityRole="header">
        Aucune demande pour l&apos;instant.
      </Text>
      <Text style={s.emptyHint}>
        Les pilotes qui consultent votre fiche peuvent vous adresser une demande. Elle apparaîtra
        ici.
      </Text>
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  // Statut = un mot, jamais en mono ; sobre, tracké, doublé du sens par le texte.
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.sm,
  },
  receivedMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
  message: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.bodyLg * 1.55,
    marginTop: theme.spacing.md,
  },
  messageEmpty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  factRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  fact: { minWidth: 120 },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginBottom: 3,
  },
  factValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
