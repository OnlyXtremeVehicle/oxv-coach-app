/**
 * Écran #— Fiche coach + demande de séance (Phase 1 marketplace).
 *
 * Affiche la fiche d'un coach publié (bio, palmarès, circuits, spécialités,
 * tarif indicatif) puis, à la demande, un formulaire sobre : choix d'un créneau
 * ouvert (ou prise de contact libre) + un mot. À l'envoi → `requestBooking` →
 * Toast de confirmation. AUCUN paiement (Phase 2).
 *
 * Doctrine : premium, vouvoiement, aucun emoji, aucune note/aucun classement.
 * Un seul chiffre dominant : le tarif indicatif. Accent coach = `palette.coach`.
 * Réutilise le kit (Screen, AppBar, Card, Field, Button).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type CoachAvailabilitySlot,
  type CoachProfileDetail,
  type CoachReview,
  type CoachReviewsSummary,
  getCoachProfile,
  listCoachReviews,
  requestBooking,
} from '@/services/coachMarketplaceService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { formatDateShort, formatDateTime } from '@/utils/format';

export default function CoachDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const coachId = params.id;

  const pilotFirstName = useAuthStore((st) => st.profile?.first_name ?? null);

  const [profile, setProfile] = useState<CoachProfileDetail | null>(null);
  const [availability, setAvailability] = useState<CoachAvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [reviewsSummary, setReviewsSummary] = useState<CoachReviewsSummary>({
    average: null,
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  // Formulaire de demande.
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    Promise.all([getCoachProfile(coachId), listCoachReviews(coachId)])
      .then(([res, rev]) => {
        if (cancelled) return;
        if (res) {
          setProfile(res.profile);
          setAvailability(res.availability);
        }
        setReviews(rev.reviews);
        setReviewsSummary(rev.summary);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coachId]);

  async function onSubmit() {
    if (!coachId) return;
    setSending(true);
    const slot = availability.find((a) => a.id === selectedSlotId) ?? null;
    const result = await requestBooking({
      coachId,
      availabilityId: slot?.id ?? null,
      requestedStartsAt: slot?.startsAt ?? null,
      circuitName: slot?.circuitName ?? null,
      message,
      pilotFirstName,
    });
    setSending(false);

    if (!result.ok) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'Demande envoyée.',
      text2: 'Le coach vous répondra prochainement.',
    });
    setFormOpen(false);
    setSelectedSlotId(null);
    setMessage('');
  }

  if (loading) {
    return (
      <Screen>
        <AppBar title="COACH" onBack={() => router.back()} />
        <View style={{ paddingVertical: theme.spacing.xxl * 2, alignItems: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <AppBar title="COACH" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl }}>
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>Fiche indisponible.</Text>
            <Text style={s.emptyHint}>Ce coach n&apos;est plus publié.</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  const tariff = profile.seasonPriceEur !== null ? `${Math.round(profile.seasonPriceEur)} €` : null;

  return (
    <Screen>
      <AppBar title="COACH" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>COACH OXV</Text>
        <Text style={s.title}>{profile.headline ?? 'Coach OXV'}</Text>

        {/* Tarif indicatif — chiffre dominant unique de l'écran. */}
        {tariff ? (
          <View style={s.tariffBlock}>
            <Text style={s.tariffValue}>{tariff}</Text>
            <Text style={s.tariffLabel}>Tarif indicatif · réglé hors application</Text>
          </View>
        ) : null}

        {profile.bio ? (
          <Section label="Présentation">
            <Text style={s.body}>{profile.bio}</Text>
          </Section>
        ) : null}

        {profile.palmares ? (
          <Section label="Palmarès">
            <Text style={s.body}>{profile.palmares}</Text>
          </Section>
        ) : null}

        {profile.circuits.length > 0 ? (
          <Section label="Circuits">
            <Text style={s.meta}>{profile.circuits.join(' · ')}</Text>
          </Section>
        ) : null}

        {profile.specialties.length > 0 ? (
          <Section label="Spécialités">
            <Text style={s.meta}>{profile.specialties.join(' · ')}</Text>
          </Section>
        ) : null}

        {/* Réseaux du coach — le pilote peut le retrouver hors application. */}
        {profile.websiteUrl || profile.instagramUrl || profile.youtubeUrl ? (
          <Section label="Liens">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(
                [
                  ['Site web', profile.websiteUrl],
                  ['Instagram', profile.instagramUrl],
                  ['YouTube', profile.youtubeUrl],
                ] as const
              ).map(([label, url]) =>
                url ? (
                  <Pressable
                    key={label}
                    accessibilityRole="link"
                    accessibilityLabel={label}
                    onPress={() => Linking.openURL(url).catch(() => undefined)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      paddingHorizontal: theme.spacing.lg,
                      justifyContent: 'center',
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: theme.palette.edge,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: theme.fonts.mono,
                        fontSize: 11,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase' as const,
                        color: theme.palette.creamMute,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ) : null
              )}
            </View>
          </Section>
        ) : null}

        {/* Avis — agrégat de CE coach uniquement, jamais un classement. */}
        <ReviewsSection reviews={reviews} summary={reviewsSummary} />

        {/* Demande de séance. */}
        <View style={{ marginTop: theme.spacing.xxl }}>
          {!formOpen ? (
            <Button label="Demander une séance" onPress={() => setFormOpen(true)} />
          ) : (
            <Card>
              <Text style={s.formTitle}>Votre demande</Text>

              {availability.length > 0 ? (
                <>
                  <Text style={s.formHint}>
                    Choisissez un créneau, ou laissez vide pour une prise de contact libre.
                  </Text>
                  <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                    {availability.map((slot) => {
                      const on = slot.id === selectedSlotId;
                      return (
                        <Pressable
                          key={slot.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          onPress={() => setSelectedSlotId(on ? null : slot.id)}
                          style={({ pressed }) => [
                            s.slot,
                            on && s.slotOn,
                            { opacity: pressed ? 0.85 : 1 },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.slotDate}>{formatDateTime(slot.startsAt)}</Text>
                            <Text style={s.slotMeta}>{slot.circuitName}</Text>
                          </View>
                          {on ? <Text style={s.slotCheck}>✓</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={s.formHint}>
                  Aucun créneau ouvert publié. Votre demande vaudra prise de contact.
                </Text>
              )}

              <View style={{ marginTop: theme.spacing.lg }}>
                <Field
                  label="Votre message"
                  optional
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Votre niveau, vos attentes, vos disponibilités…"
                  multiline
                  maxLength={600}
                  showCounter
                />
              </View>

              <Button label="Envoyer la demande" loading={sending} onPress={onSubmit} />

              <View style={{ marginTop: theme.spacing.lg, alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFormOpen(false)}
                  disabled={sending}
                >
                  <Text style={s.cancel}>Annuler</Text>
                </Pressable>
              </View>
            </Card>
          )}
        </View>
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Note rendue en pastilles (PAS d'étoiles emoji) : `count` pastilles pleines sur
 * 5, doublées d'un libellé chiffré porté à côté. Décoratif et muet pour les
 * lecteurs d'écran — le sens passe par le texte « n sur 5 ».
 */
function RatingDots({ value }: { value: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(value)));
  return (
    <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no">
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[s.dot, i <= filled ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );
}

/**
 * Section « Avis » : moyenne /5 (fait sobre, chiffre + libellé), nombre d'avis,
 * et la liste des témoignages (prénom · note · texte · date). État vide honnête.
 * Aucun classement inter-coachs : seulement l'agrégat de CE coach.
 */
function ReviewsSection({
  reviews,
  summary,
}: {
  reviews: CoachReview[];
  summary: CoachReviewsSummary;
}) {
  const countLabel =
    summary.count === 0 ? 'Aucun avis' : summary.count === 1 ? '1 avis' : `${summary.count} avis`;

  return (
    <Section label="Avis">
      {summary.average === null ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Text style={s.emptyTitle}>Aucun avis pour l&apos;instant.</Text>
          <Text style={s.emptyHint}>
            Les pilotes accompagnés par ce coach pourront partager leur retour ici.
          </Text>
        </Card>
      ) : (
        <>
          <View style={s.avgBlock}>
            <View style={s.avgRow}>
              <Text style={s.avgValue}>
                {summary.average.toLocaleString('fr-FR', { minimumFractionDigits: 1 })}
              </Text>
              <Text style={s.avgScale}>sur 5</Text>
            </View>
            <RatingDots value={summary.average} />
            <Text style={s.avgCount}>{countLabel}</Text>
          </View>

          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            {reviews.map((r) => (
              <Card key={r.id}>
                <View style={s.reviewHead}>
                  <Text style={[s.reviewName, { flex: 1 }]} numberOfLines={1}>
                    {r.pilotFirstName?.trim() || 'Pilote'}
                  </Text>
                  {/* Note = fait de l'avis : chiffre (mono) doublé d'un libellé. */}
                  <Text style={s.reviewRating} accessibilityLabel={`Note ${r.rating} sur 5`}>
                    {r.rating}
                    <Text style={s.reviewRatingScale}>/5</Text>
                  </Text>
                </View>
                {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
                <Text style={s.reviewDate}>{formatDateShort(r.createdAt)}</Text>
              </Card>
            ))}
          </View>
        </>
      )}
    </Section>
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
  tariffBlock: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  tariffValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    letterSpacing: 0.5,
  },
  tariffLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.bodyLg * 1.6,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  formTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  formHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  slot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.card2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    minHeight: 52,
  },
  slotOn: { borderColor: theme.palette.coach, borderWidth: 1.5 },
  slotDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  slotMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: 3,
  },
  slotCheck: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.coach,
  },
  cancel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.micro,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  avgBlock: {
    marginTop: theme.spacing.sm,
  },
  avgRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  avgValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.palette.cream,
    letterSpacing: 0.5,
  },
  avgScale: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.sm,
    marginBottom: 4,
  },
  dots: {
    flexDirection: 'row' as const,
    gap: 5,
    marginTop: theme.spacing.sm,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dotOn: { backgroundColor: theme.palette.cream },
  dotOff: { backgroundColor: theme.palette.line },
  avgCount: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  reviewHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  reviewName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    letterSpacing: 0.2,
  },
  reviewRating: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    marginLeft: theme.spacing.sm,
  },
  reviewRatingScale: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  reviewComment: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.55,
    marginTop: theme.spacing.sm,
  },
  reviewDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.md,
  },
};
