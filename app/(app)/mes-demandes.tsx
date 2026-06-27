/**
 * Écran Pilote — mes demandes de séance (marketplace, boucle de réponse + avis).
 *
 * Liste les `coaching_bookings` du pilote courant (RLS
 * `coaching_bookings_pilot_select`) : coach, créneau souhaité, statut. Le statut
 * est TOUJOURS doublé d'un libellé humain (doctrine + a11y). Sur une demande en
 * attente, le pilote peut l'annuler (RLS `coaching_bookings_pilot_cancel`, qui
 * n'autorise QUE la transition vers `cancelled`).
 *
 * Phase 2 : sur une demande `accepted` ou `completed`, le pilote peut laisser un
 * avis (note 1-5 + texte) — ou le modifier s'il en a déjà un (pré-rempli). Un
 * seul avis par coach (`coach_reviews`, UPSERT sur `coach_id,pilot_id`). On
 * fournit son PRÉNOM (depuis `useAuthStore`) à la création, dénormalisé.
 *
 * Le coach est résolu via `coach_profiles` (fiche publiée), jamais via `users`.
 * Si la fiche n'est plus publiée, on retombe sur un libellé générique.
 *
 * Doctrine : vouvoiement, aucun emoji (note en chiffres/pastilles, pas d'étoiles),
 * sobre/premium, la note est un fait de l'avis et jamais un classement de
 * personnes. Réutilise le kit (Screen, AppBar, Card, Button, Field, SectionLabel).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  bookingStatusLabel,
  cancelBooking,
  createReview,
  getMyReviewFor,
  listMyBookings,
  type MyBooking,
  type MyReview,
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
        <ReviewBlock coachId={booking.coachId} bookingId={booking.id} onDone={onReviewed} />
      ) : null}
    </Card>
  );
}

/** Bloc « laisser / modifier un avis » sur une demande actée (Phase 2). */
function ReviewBlock({
  coachId,
  bookingId,
  onDone,
}: {
  coachId: string;
  bookingId: string;
  onDone: () => void;
}) {
  const firstName = useAuthStore((st) => st.profile?.first_name ?? null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<MyReview | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function openForm() {
    if (!loaded) {
      const mine = await getMyReviewFor(coachId);
      setExisting(mine);
      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment ?? '');
      }
      setLoaded(true);
    }
    setOpen(true);
  }

  async function submit() {
    if (rating < 1) {
      Toast.show({ type: 'error', text1: 'Choisissez une note de 1 à 5.' });
      return;
    }
    setBusy(true);
    const res = await createReview({
      coachId,
      bookingId,
      rating,
      comment,
      pilotFirstName: firstName,
    });
    setBusy(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Avis enregistré.' });
    setExisting({ id: existing?.id ?? '', rating, comment: comment.trim() || null });
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
      <Text style={s.reviewLabel}>Votre note</Text>
      <View style={s.ratingRow} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= rating;
          return (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: rating === n }}
              accessibilityLabel={`${n} sur 5`}
              hitSlop={6}
              style={[s.ratingDot, on ? s.ratingDotOn : null]}
            >
              <Text style={[s.ratingNum, on ? s.ratingNumOn : null]}>{n}</Text>
            </Pressable>
          );
        })}
        <Text style={s.ratingScale}>sur 5</Text>
      </View>

      <Field
        label="Votre avis"
        optional
        value={comment}
        onChangeText={setComment}
        placeholder="Quelques mots sur la séance…"
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
  reviewLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  ratingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  ratingDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ratingDotOn: {
    borderColor: theme.palette.gold,
    backgroundColor: 'rgba(255,183,3,0.12)',
  },
  ratingNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  ratingNumOn: {
    color: theme.palette.gold,
  },
  ratingScale: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.xs,
  },
  reviewActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
};
