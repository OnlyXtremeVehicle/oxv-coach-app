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
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type CoachAvailabilitySlot,
  type CoachProfileDetail,
  getCoachProfile,
  requestBooking,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { formatDateTime } from '@/utils/format';

export default function CoachDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const coachId = params.id;

  const [profile, setProfile] = useState<CoachProfileDetail | null>(null);
  const [availability, setAvailability] = useState<CoachAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire de demande.
  const [formOpen, setFormOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    getCoachProfile(coachId)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setProfile(res.profile);
          setAvailability(res.availability);
        }
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
};
