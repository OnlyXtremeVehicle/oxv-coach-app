/**
 * Écran Pilote — mes demandes de séance (Phase 1 marketplace, boucle de réponse).
 *
 * Liste les `coaching_bookings` du pilote courant (RLS
 * `coaching_bookings_pilot_select`) : coach, créneau souhaité, statut. Le statut
 * est TOUJOURS doublé d'un libellé humain (doctrine + a11y). Sur une demande en
 * attente, le pilote peut l'annuler (RLS `coaching_bookings_pilot_cancel`, qui
 * n'autorise QUE la transition vers `cancelled`).
 *
 * Le coach est résolu via `coach_profiles` (fiche publiée), jamais via `users`.
 * Si la fiche n'est plus publiée, on retombe sur un libellé générique.
 *
 * Doctrine : vouvoiement, aucun emoji, sobre/premium, aucun classement ni note.
 * Réutilise le kit (Screen, AppBar, Card, Button, SectionLabel).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  bookingStatusLabel,
  cancelBooking,
  listMyBookings,
  type MyBooking,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatDateTime } from '@/utils/format';

export default function MesDemandesScreen() {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  // Identifiant de la demande en cours d'annulation (verrouille SON bouton).
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await listMyBookings();
    setBookings(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyBookings()
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

  async function onCancel(id: string) {
    setBusyId(id);
    const result = await cancelBooking(id);
    setBusyId(null);

    if (!result.ok) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Demande annulée.' });
    await reload();
  }

  const pending = bookings.filter((b) => b.status === 'pending');
  const treated = bookings.filter((b) => b.status !== 'pending');

  return (
    <Screen>
      <AppBar title="MES DEMANDES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ACCOMPAGNEMENT</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos demandes de séance.
        </Text>
        <Text style={s.intro}>
          Le suivi de vos demandes aux coachs OXV. La séance et son règlement se conviennent de gré
          à gré, hors application.
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
                    onCancel={() => onCancel(b.id)}
                  />
                ))}
              </Section>
            ) : null}

            {treated.length > 0 ? (
              <Section title="Historique">
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

function coachName(booking: MyBooking): string {
  const headline = booking.coach?.headline?.trim();
  return headline && headline.length > 0 ? headline : 'Coach OXV';
}

function BookingCard({
  booking,
  busy,
  muted,
  onCancel,
}: {
  booking: MyBooking;
  busy?: boolean;
  muted?: boolean;
  onCancel?: () => void;
}) {
  const name = coachName(booking);
  const statusText = bookingStatusLabel(booking.status);
  const slot = booking.requestedStartsAt ? formatDateTime(booking.requestedStartsAt) : null;

  return (
    <Card style={muted ? { opacity: 0.85 } : undefined}>
      <View style={s.headRow}>
        <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>
          {name}
        </Text>
        {/* Statut toujours visible et doublé d'un libellé humain. */}
        <Text style={s.statusLabel}>{statusText}</Text>
      </View>

      <Text style={s.sentMeta}>Envoyée le {formatDateShort(booking.createdAt)}</Text>

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

      {booking.message ? <Text style={s.message}>« {booking.message} »</Text> : null}

      {booking.status === 'pending' && onCancel ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label="Annuler la demande" variant="ghost" loading={busy} onPress={onCancel} />
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
        Depuis la fiche d&apos;un coach, vous pouvez demander une séance. Vous la suivrez ici.
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
    color: theme.palette.creamMute,
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
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.sm,
  },
  sentMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
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
  message: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.55,
    marginTop: theme.spacing.md,
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
