/**
 * Fiche coach publique — reskin refonte-v2 §7bis (`#8b`, 32-fiche-coach.png).
 *
 * Maquette : héros centré (avatar CERCLÉ ROUGE, nom, eyebrow rouge), rangée de
 * tuiles stats, bio en carte, ligne de disponibilité VERTE, CTA rouge
 * « Demander une séance ». Héritage GARDÉ et retravaillé au langage v2 :
 * palmarès, circuits, spécialités, liens, médias, avis, et le formulaire de
 * demande (`requestBooking`, Phase 1 marketplace, AUCUN paiement).
 *
 * Données RÉELLES uniquement (coachMarketplaceService, RLS `is_published`) :
 * - stats = nombre de circuits / spécialités EN BASE (l'« expérience » de la
 *   maquette n'existe pas en base → non affichée) ;
 * - prix héros = `session_price_eur` réel, À LA SESSION (décision fondateur
 *   2026-07-16, migration 20260716200000), registre tarif d'offre heritageGold
 *   (décision Gabin 2026-07-11 — l'or système reste au chrono) ; la saison
 *   (`season_price_eur`) passe en secondaire discret si renseignée ; un prix
 *   absent n'a pas de ligne (jamais inventé) ;
 * - dispo verte = créneaux `open` à venir réels (`coach_availability`) ;
 * - pastille de partage de la maquette : DROP (aucun flux de partage réel).
 *
 * Navigation : la Découverte pousse `demande=1` (bouton « Contacter ») → le
 * formulaire de demande s'ouvre directement à l'arrivée.
 *
 * Doctrine : vouvoiement, aucun emoji, aucune note/aucun classement inter-coachs.
 * Un seul chiffre dominant : le tarif indicatif. Accent contexte = rouge coach.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import { FadeInSection, PressableScale } from '@/components/motion';
import { ReportButton } from '@/components/ReportButton';
import {
  type AvailabilityStatus,
  availabilityStatusLabel,
  type CoachAvailabilitySlot,
  type CoachProfileDetail,
  type CoachTestimonial,
  getCoachProfile,
  listCoachTestimonials,
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

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Initiales pour l'avatar de repli (mêmes règles que la Découverte). */
function initialsOf(headline: string | null): string {
  const base = (headline ?? '').trim();
  if (!base) return 'OXV';
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'OXV';
}

export default function CoachDetailScreen() {
  const params = useLocalSearchParams<{ id: string; demande?: string }>();
  const coachId = params.id;

  const pilotFirstName = useAuthStore((st) => st.profile?.first_name ?? null);

  const [profile, setProfile] = useState<CoachProfileDetail | null>(null);
  const [availability, setAvailability] = useState<CoachAvailabilitySlot[]>([]);
  const [testimonials, setTestimonials] = useState<CoachTestimonial[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire de demande. `demande=1` (poussé par « Contacter » depuis la
  // Découverte) ouvre le formulaire directement à l'arrivée sur la fiche.
  const [formOpen, setFormOpen] = useState(params.demande === '1');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    Promise.all([getCoachProfile(coachId), listCoachTestimonials(coachId)])
      .then(([res, testis]) => {
        if (cancelled) return;
        if (res) {
          setProfile(res.profile);
          setAvailability(res.availability);
        }
        setTestimonials(testis);
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
        <AppBar title="Fiche coach" onBack={() => router.back()} />
        <View style={{ paddingVertical: spacing.xxl * 2, alignItems: 'center' }}>
          <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <AppBar title="Fiche coach" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <EmptyState
            label="Fiche indisponible"
            message="Ce coach n'est plus publié."
            source="coach_profiles"
          />
        </View>
      </Screen>
    );
  }

  const name = profile.headline ?? 'Coach OXV';

  // Tuiles stats — uniquement ce qui EXISTE en base (jamais de chiffre inventé).
  const circuitCount = profile.circuits.length;
  const specialtyCount = profile.specialties.length;
  // Prix héros À LA SESSION (fondateur 2026-07-16) ; saison en secondaire.
  const sessionPrice =
    profile.sessionPriceEur !== null
      ? `${Math.round(profile.sessionPriceEur).toLocaleString('fr-FR')} €`
      : null;
  const seasonPrice =
    profile.seasonPriceEur !== null
      ? `${Math.round(profile.seasonPriceEur).toLocaleString('fr-FR')} €`
      : null;
  const hasStats = circuitCount > 0 || specialtyCount > 0 || sessionPrice !== null;

  // Disponibilité réelle : créneaux `open` à venir (getCoachProfile ne lit que
  // les créneaux futurs `open`/`full` — RLS côté base).
  const openSlots = availability.filter((a) => a.status === 'open').length;
  const dispoLabel =
    openSlots > 0
      ? `Disponible — ${openSlots} créneau${openSlots > 1 ? 'x' : ''} ouvert${openSlots > 1 ? 's' : ''}`
      : 'Aucun créneau ouvert pour l’instant';

  return (
    <Screen>
      <AppBar title="Fiche coach" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        {/* Héros centré — avatar cerclé rouge, nom, eyebrow rouge (maquette).
            Entrée en fondu sobre (kit motion, reduce-motion respecté). */}
        <FadeInSection>
          <View style={s.hero}>
            <View style={s.avatarRing}>
              {profile.photoUrl ? (
                <Image
                  source={{ uri: profile.photoUrl }}
                  style={s.avatar}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitials}>{initialsOf(profile.headline)}</Text>
                </View>
              )}
            </View>
            <Text style={s.name}>{name}</Text>
            <Text style={s.roleEyebrow}>Coach OXV</Text>
          </View>
        </FadeInSection>

        {/* Stats réelles. L'« expérience » de la maquette n'est pas en base → absente. */}
        <FadeInSection delay={80}>
          {hasStats ? (
            <View style={s.statsRow}>
              {circuitCount > 0 ? (
                <View style={s.statTile}>
                  <Text style={s.statValue}>{circuitCount}</Text>
                  <Text style={s.statLabel}>circuit{circuitCount > 1 ? 's' : ''}</Text>
                </View>
              ) : null}
              {specialtyCount > 0 ? (
                <View style={s.statTile}>
                  <Text style={s.statValue}>{specialtyCount}</Text>
                  <Text style={s.statLabel}>spécialité{specialtyCount > 1 ? 's' : ''}</Text>
                </View>
              ) : null}
              {sessionPrice ? (
                // Chiffre dominant unique de l'écran : le prix À LA SESSION
                // (fondateur 2026-07-16). Registre tarif d'offre heritageGold
                // (décision Gabin 2026-07-11) — l'or système (#FFB703) reste
                // réservé au chrono/record.
                <View style={s.statTile} accessibilityLabel={`${sessionPrice} par session`}>
                  <Text style={[s.statValue, { color: palette.heritageGold }]}>{sessionPrice}</Text>
                  <Text style={s.statLabel}>la session</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {seasonPrice ? (
            // La saison, secondaire discret (si renseignée).
            <Text style={s.seasonNote} accessibilityLabel={`Tarif de saison ${seasonPrice}`}>
              Saison : {seasonPrice}
            </Text>
          ) : null}
          {sessionPrice || seasonPrice ? (
            <Text style={s.tariffNote}>Tarif indicatif · réglé hors application</Text>
          ) : null}
        </FadeInSection>

        {/* Bio réelle en carte (maquette). Absente = masquée. */}
        {profile.bio ? (
          <Card style={s.bioCard}>
            <Text style={s.body}>{profile.bio}</Text>
          </Card>
        ) : null}

        {/* Disponibilité verte réelle (coach_availability, créneaux ouverts à venir). */}
        <View style={s.dispoRow}>
          <View
            style={[s.dispoDot, { backgroundColor: openSlots > 0 ? palette.green : palette.faint }]}
          />
          <Text style={[s.dispoT, openSlots > 0 && { color: palette.green }]}>{dispoLabel}</Text>
        </View>

        {/* CTA rouge (maquette) → ouvre le formulaire réel de demande.
            PressableScale du kit : appui pesé, haptique légère. */}
        {!formOpen ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Demander une séance à ${name}`}
            haptic="tap"
            onPress={() => setFormOpen(true)}
            style={s.cta}
          >
            <Text style={s.ctaT}>Demander une séance</Text>
          </PressableScale>
        ) : (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={s.formTitle}>Votre demande</Text>

            {availability.length > 0 ? (
              <>
                <Text style={s.formHint}>
                  Choisissez un créneau, ou laissez vide pour une prise de contact libre.
                </Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {availability.map((slot) => {
                    // Seuls les créneaux `open` sont sélectionnables ; un `full`
                    // (complet) reste visible mais désactivé, doublé de son libellé
                    // factuel — le statut n'est jamais porté par la couleur seule.
                    const isOpen = slot.status === 'open';
                    const on = isOpen && slot.id === selectedSlotId;
                    return (
                      <Pressable
                        key={slot.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, disabled: !isOpen }}
                        disabled={!isOpen}
                        onPress={() => setSelectedSlotId(on ? null : slot.id)}
                        style={({ pressed }) => [
                          s.slot,
                          on && s.slotOn,
                          !isOpen && s.slotDisabled,
                          { opacity: !isOpen ? 0.6 : pressed ? 0.85 : 1 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.slotDate}>{formatDateTime(slot.startsAt)}</Text>
                          <Text style={s.slotMeta}>{slot.circuitName}</Text>
                        </View>
                        {on ? (
                          <Text style={s.slotCheck}>✓</Text>
                        ) : !isOpen ? (
                          <Text style={s.slotStatus}>
                            {availabilityStatusLabel(slot.status as AvailabilityStatus)}
                          </Text>
                        ) : null}
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

            <View style={{ marginTop: spacing.lg }}>
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

            <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Annuler la demande"
                hitSlop={theme.hitSlop}
                onPress={() => setFormOpen(false)}
                disabled={sending}
              >
                <Text style={s.cancel}>Annuler</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {/* — Héritage retravaillé v2 : le reste de la fiche. — */}

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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
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
                    style={({ pressed }) => [s.linkPill, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={s.linkPillT}>{label}</Text>
                  </Pressable>
                ) : null
              )}
            </View>
          </Section>
        ) : null}

        {/* Vitrine média du coach — visible par le pilote, jamais une donnée. */}
        {profile.media.length > 0 ? (
          <Section label="Médias">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {profile.media.map((m) =>
                m.type === 'photo' ? (
                  <Pressable
                    key={m.id}
                    accessibilityRole="image"
                    accessibilityLabel="Photo du coach"
                    onPress={() => Linking.openURL(m.url).catch(() => undefined)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  >
                    <Image source={{ uri: m.url }} resizeMode="cover" style={s.mediaTile} />
                  </Pressable>
                ) : (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir la vidéo"
                    onPress={() => Linking.openURL(m.url).catch(() => undefined)}
                    style={({ pressed }) => [
                      s.mediaTile,
                      s.mediaVideo,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={s.mediaVideoT}>Vidéo</Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          </Section>
        ) : null}

        {/* Témoignages — les propos des pilotes accompagnés, sans note ni
            moyenne. Jamais un classement. */}
        <TestimonialsSection testimonials={testimonials} />
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Section « Témoignages » : les propos des pilotes accompagnés (prénom · texte ·
 * date), SANS note, SANS moyenne, SANS échelle — la table `coach_testimonials`
 * ne porte aucun champ chiffré. État vide honnête. Jamais un classement.
 */
function TestimonialsSection({ testimonials }: { testimonials: CoachTestimonial[] }) {
  return (
    <Section label="Témoignages">
      {testimonials.length === 0 ? (
        <EmptyState
          label="Aucun témoignage"
          message="Les pilotes accompagnés par ce coach pourront partager leur retour ici."
          source="coach_testimonials"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {testimonials.map((t) => (
            <Card key={t.id}>
              <View style={s.reviewHead}>
                <Text style={[s.reviewName, { flex: 1 }]} numberOfLines={1}>
                  {t.authorFirstName?.trim() || 'Un pilote'}
                </Text>
              </View>
              {t.body ? <Text style={s.reviewComment}>{t.body}</Text> : null}
              <View style={s.reviewFooter}>
                <Text style={s.reviewDate}>{formatDateShort(t.createdAt)}</Text>
                {/* « coach_review » = catégorie de signalement (modération),
                    pas une note ; elle couvre désormais les témoignages. */}
                <ReportButton targetType="coach_review" targetId={t.id} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 : surfaces card/card2, hairlines,       */
/* eyebrows mono ls 1.6+, accent contexte rouge coach.                 */
/* ------------------------------------------------------------------ */

const s = {
  // — Héros centré —
  hero: {
    alignItems: 'center' as const,
    marginTop: spacing.md,
  },
  // Avatar cerclé rouge (maquette) : anneau 2 px coachAccent + respiration.
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: palette.coachAccent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.card2,
  },
  avatarFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatarInitials: {
    fontFamily: fonts.mono,
    fontSize: fontSize.h3,
    letterSpacing: 1,
    color: palette.creamSoft,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    textAlign: 'center' as const,
    marginTop: spacing.md,
  },
  roleEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.coachAccent,
    marginTop: spacing.xs,
  },

  // — Tuiles stats —
  statsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statTile: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  statValue: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginTop: spacing.xs,
  },
  // La saison en secondaire discret (fondateur 2026-07-16 : le héros est la session).
  seasonNote: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.md,
  },
  tariffNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },

  // — Bio —
  bioCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.creamSoft,
    lineHeight: fontSize.bodyLg * 1.6,
  },

  // — Disponibilité —
  dispoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  dispoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dispoT: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },

  // — CTA rouge coach —
  cta: {
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    backgroundColor: palette.coachAccent,
    marginTop: spacing.lg,
  },
  ctaT: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: palette.cream,
  },

  // — Sections héritage —
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginBottom: spacing.sm,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  linkPill: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  linkPillT: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  mediaTile: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  mediaVideo: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mediaVideoT: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },

  // — Formulaire de demande —
  formTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    color: palette.cream,
    marginBottom: spacing.sm,
  },
  formHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  slot: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  slotOn: { borderColor: palette.coachAccent, borderWidth: 1.5 },
  // Créneau non ouvert (complet / fermé) : bordure atténuée, non sélectionnable.
  slotDisabled: { borderColor: palette.separator, backgroundColor: palette.card },
  // Libellé factuel du statut (« Complet ») — texte, jamais couleur seule.
  slotStatus: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginLeft: spacing.sm,
  },
  slotDate: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  slotMeta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: 3,
  },
  slotCheck: {
    fontFamily: fonts.mono,
    fontSize: fontSize.bodyLg,
    color: palette.coachAccent,
  },
  cancel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 1,
    color: palette.creamMute,
  },

  // — Avis —
  avgBlock: {
    marginTop: spacing.sm,
  },
  avgRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  avgValue: {
    fontFamily: fonts.mono,
    // Chiffre secondaire : plafonné à h3 pour ne PAS rivaliser avec le tarif,
    // seul chiffre dominant de l'écran (heritageGold + mono).
    fontSize: fontSize.h3,
    color: palette.creamSoft,
    letterSpacing: 0.5,
  },
  avgScale: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: palette.creamMute,
    marginLeft: spacing.sm,
    marginBottom: 4,
  },
  dots: {
    flexDirection: 'row' as const,
    gap: 5,
    marginTop: spacing.sm,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dotOn: { backgroundColor: palette.cream },
  dotOff: { backgroundColor: palette.line },
  avgCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginTop: spacing.sm,
  },
  reviewHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  reviewName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    letterSpacing: 0.2,
  },
  reviewRating: {
    fontFamily: fonts.mono,
    fontSize: fontSize.h3,
    color: palette.cream,
    marginLeft: spacing.sm,
  },
  reviewRatingScale: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  reviewComment: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.55,
    marginTop: spacing.sm,
  },
  reviewDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  reviewFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: spacing.md,
  },
};
