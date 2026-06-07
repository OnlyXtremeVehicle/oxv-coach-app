/**
 * Écran Pilote — mes invitations aux roulages (§8 OXV Mirror).
 *
 * Liste les roulages auxquels le pilote est convié par un coach, avec la
 * possibilité d'accepter ou de décliner. Lecture factuelle : date, lieu,
 * statut. Aucun classement, aucune injonction.
 *
 * Doctrine : vouvoiement, sobre, le choix appartient au pilote.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { INVITATION_STATUS_LABELS } from '@/services/roulagesLogic';
import {
  type PilotInvitation,
  listMyInvitations,
  respondToInvitation,
} from '@/services/roulagesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateTime, formatPriceCents } from '@/utils/format';

export default function PilotRoulagesScreen() {
  const [items, setItems] = useState<PilotInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listMyInvitations();
    setItems(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().catch(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  async function respond(invitationId: string, accepted: boolean) {
    if (busyId) return;
    setBusyId(invitationId);
    await respondToInvitation(invitationId, accepted, new Date().toISOString());
    await load();
    setBusyId(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>ROULAGES</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Vos invitations.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : items.length === 0 ? (
          <View
            style={{
              padding: spacing.xxl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
            }}
          >
            <Text
              style={[typography.manifest, { color: colors.text.tertiary, textAlign: 'center' }]}
            >
              Aucune invitation pour l&apos;instant.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {items.map(({ invitation, roulage }) => {
              const pending = invitation.status === 'invited' && roulage.status === 'open';
              return (
                <View
                  key={invitation.id}
                  style={{
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    borderWidth: 0.5,
                    borderColor: colors.border.subtle,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.title,
                      fontWeight: fontWeight.light,
                    }}
                  >
                    {roulage.title}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.text.tertiary, marginTop: spacing.xs },
                    ]}
                  >
                    {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
                  </Text>
                  {roulage.location ? (
                    <Text
                      style={[typography.caption, { color: colors.text.tertiary, marginTop: 2 }]}
                    >
                      {roulage.location}
                    </Text>
                  ) : null}
                  {roulage.pricePerPilot != null ? (
                    <Text
                      style={{
                        color: colors.text.secondary,
                        fontSize: fontSize.caption,
                        marginTop: spacing.xs,
                      }}
                    >
                      {formatPriceCents(roulage.pricePerPilot)} par place
                    </Text>
                  ) : null}

                  {roulage.status === 'cancelled' ? (
                    <Text
                      style={{
                        color: colors.accent.red,
                        fontSize: fontSize.caption,
                        marginTop: spacing.md,
                      }}
                    >
                      Ce roulage a été annulé.
                    </Text>
                  ) : pending ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Accepter l'invitation"
                        disabled={busyId === invitation.id}
                        onPress={() => respond(invitation.id, true)}
                        style={({ pressed }) => ({
                          flex: 1,
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.accent.red,
                          alignItems: 'center',
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text
                          style={{
                            color: colors.background.primary,
                            fontSize: fontSize.caption,
                            fontWeight: fontWeight.medium,
                          }}
                        >
                          Accepter
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Décliner l'invitation"
                        disabled={busyId === invitation.id}
                        onPress={() => respond(invitation.id, false)}
                        style={({ pressed }) => ({
                          flex: 1,
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          borderWidth: 0.5,
                          borderColor: colors.border.medium,
                          alignItems: 'center',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
                          Décliner
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: colors.text.secondary,
                        fontSize: fontSize.caption,
                        marginTop: spacing.md,
                      }}
                    >
                      Votre réponse : {INVITATION_STATUS_LABELS[invitation.status]}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
