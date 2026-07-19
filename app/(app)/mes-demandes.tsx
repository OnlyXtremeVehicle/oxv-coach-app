/**
 * Écran Pilote — mes demandes de séance (marketplace, boucle de réponse + avis).
 *
 * Liste les `coaching_bookings` du pilote courant (RLS
 * `coaching_bookings_pilot_select`) : coach, créneau souhaité, statut. Le statut
 * est TOUJOURS doublé d'un libellé humain (doctrine + a11y). Sur une demande en
 * attente, le pilote peut l'annuler (RLS `coaching_bookings_pilot_cancel`, qui
 * n'autorise QUE la transition vers `cancelled`).
 *
 * Sur une demande `accepted` ou `completed`, le pilote peut laisser un
 * TÉMOIGNAGE (texte seul, AUCUNE note) — ou le modifier s'il en a déjà un
 * (pré-rempli). Un seul témoignage par coach (`coach_testimonials`, UPSERT sur
 * `coach_id,author_user_id`). On fournit son PRÉNOM (depuis `useAuthStore`) à la
 * création, dénormalisé — la moitié « auteur » de la citation.
 *
 * Le coach est résolu via `coach_profiles` (fiche publiée), jamais via `users`.
 * Si la fiche n'est plus publiée, on retombe sur un libellé générique.
 *
 * Doctrine : vouvoiement, aucun emoji, sobre/premium. Un témoignage est un PROPOS,
 * pas un score : ni note, ni étoile, ni classement de personnes. Réutilise le kit
 * (Screen, AppBar, Card, Button, Field, SectionLabel).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  bookingStatusLabel,
  cancelBooking,
  createTestimonial,
  getMyTestimonialFor,
  listMyBookings,
  type MyBooking,
  type MyTestimonial,
} from '@/services/coachMarketplaceService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatDateTime } from '@/utils/format';

/** Une demande est « notable » quand une séance a eu lieu / été actée. */
function isReviewable(status: MyBooking['status']): boolean {
  return status === 'accepted' || status === 'completed';
}

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
                  <BookingCard key={b.id} booking={b} muted onReviewed={reload} />
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
  onReviewed,
}: {
  booking: MyBooking;
  busy?: boolean;
  muted?: boolean;
  onCancel?: () => void;
  onReviewed?: () => void;
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

      {/* Phase 2 : sur une séance actée, le pilote peut laisser/modifier un avis. */}
      {isReviewable(booking.status) && onReviewed ? (
        <ReviewBlock coachId={booking.coachId} onDone={onReviewed} />
      ) : null}
    </Card>
  );
}

/** Bloc « laisser / modifier un témoignage » sur une demande actée. La séance
 *  acceptée/complétée est vérifiée côté RLS (author_write) — pas besoin du booking. */
function ReviewBlock({ coachId, onDone }: { coachId: string; onDone: () => void }) {
  const firstName = useAuthStore((st) => st.profile?.first_name ?? null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<MyTestimonial | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function openForm() {
    if (!loaded) {
      const mine = await getMyTestimonialFor(coachId);
      setExisting(mine);
      if (mine) setComment(mine.body);
      setLoaded(true);
    }
    setOpen(true);
  }

  async function submit() {
    const body = comment.trim();
    if (body.length === 0) {
      Toast.show({ type: 'error', text1: 'Écrivez quelques mots avant de publier.' });
      return;
    }
    setBusy(true);
    // Témoignage = propos + auteur, AUCUNE note. La RLS author_write vérifie qu'une
    // séance acceptée/complétée existe (le bookingId n'a plus besoin d'être stocké).
    const res = await createTestimonial({ coachId, body, authorFirstName: firstName });
    setBusy(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Témoignage enregistré.' });
    setExisting({ id: existing?.id ?? '', body });
    setOpen(false);
    onDone();
  }

  if (!open) {
    return (
      <View style={{ marginTop: theme.spacing.md }}>
        <Button
          label={existing ? 'Modifier mon avis' : 'Laisser un avis'}
          variant="ghost"
          onPress={openForm}
        />
      </View>
    );
  }

  return (
    <View style={s.reviewForm}>
      <Field
        label="Votre témoignage"
        value={comment}
        onChangeText={setComment}
        placeholder="En quelques mots, ce que cette séance vous a apporté…"
        multiline
        maxLength={500}
        showCounter
      />

      <View style={s.reviewActions}>
        <View style={{ flex: 1 }}>
          <Button label="Publier" loading={busy} onPress={submit} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" variant="ghost" onPress={() => setOpen(false)} />
        </View>
      </View>
    </View>
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
  reviewForm: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    gap: theme.spacing.md,
  },
  reviewActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
};
