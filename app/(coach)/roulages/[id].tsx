/**
 * Vue Coach — détail d'un roulage (§8 OXV Mirror).
 *
 * Affiche les informations du roulage, le récapitulatif des réponses, la
 * liste des pilotes invités (avec leur statut) et un sélecteur pour convier
 * de nouveaux pilotes parmi ceux que le coach suit (et qui ne sont pas déjà
 * invités). Le coach peut retirer une invitation, annuler ou clôturer.
 *
 * Sécurité : la RLS limite tout au coach propriétaire ET aux pilotes
 * assignés (coach_pilots actif).
 *
 * Doctrine : factuel, vouvoiement, aucun classement entre pilotes.
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { type CoachPilotRow, listMyPilots } from '@/services/coachService';
import {
  type Roulage,
  type RoulageInvitation,
  INVITATION_STATUS_LABELS,
  ROULAGE_STATUS_LABELS,
  remainingPlaces,
  summarizeInvitations,
} from '@/services/roulagesLogic';
import {
  getRoulage,
  invitePilot,
  listRoulageInvitations,
  removeInvitation,
  setRoulageStatus,
} from '@/services/roulagesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateTime, formatPriceCents } from '@/utils/format';

function pilotName(p: CoachPilotRow): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';
}

export default function RoulageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roulageId = Array.isArray(id) ? id[0] : id;

  const [roulage, setRoulage] = useState<Roulage | null>(null);
  const [invitations, setInvitations] = useState<RoulageInvitation[]>([]);
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!roulageId) return;
    const [r, invs, ps] = await Promise.all([
      getRoulage(roulageId),
      listRoulageInvitations(roulageId),
      listMyPilots(),
    ]);
    setRoulage(r);
    setInvitations(invs);
    setPilots(ps);
    setLoading(false);
  }, [roulageId]);

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

  const pilotById = useMemo(() => {
    const map = new Map<string, CoachPilotRow>();
    for (const p of pilots) map.set(p.pilotId, p);
    return map;
  }, [pilots]);

  const invitedIds = useMemo(() => new Set(invitations.map((i) => i.pilotId)), [invitations]);
  const invitablePilots = useMemo(
    () => pilots.filter((p) => !invitedIds.has(p.pilotId)),
    [pilots, invitedIds]
  );

  const summary = useMemo(() => summarizeInvitations(invitations), [invitations]);

  async function onInvite(pilotId: string) {
    if (!roulageId || busy) return;
    setBusy(true);
    await invitePilot(roulageId, pilotId);
    await load();
    setBusy(false);
  }

  async function onRemove(invitationId: string) {
    if (busy) return;
    setBusy(true);
    await removeInvitation(invitationId);
    await load();
    setBusy(false);
  }

  async function onStatus(status: 'cancelled' | 'done') {
    if (!roulageId || busy) return;
    setBusy(true);
    await setRoulageStatus(roulageId, status);
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  if (!roulage) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.manifest, { color: colors.text.tertiary, textAlign: 'center' }]}>
          Ce roulage est introuvable.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginTop: spacing.xl }}
        >
          <Text style={{ color: colors.accent.coach, fontSize: fontSize.body }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const places = remainingPlaces(roulage, summary.accepted);
  const isOpen = roulage.status === 'open';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>ROULAGE</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>{roulage.title}</Text>
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
          {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
          {roulage.status !== 'open' ? ` · ${ROULAGE_STATUS_LABELS[roulage.status]}` : ''}
        </Text>

        {roulage.location ? (
          <Text
            style={{ color: colors.text.secondary, fontSize: fontSize.body, marginTop: spacing.md }}
          >
            {roulage.location}
          </Text>
        ) : null}
        {roulage.pricePerPilot != null ? (
          <Text
            style={{ color: colors.text.secondary, fontSize: fontSize.body, marginTop: spacing.xs }}
          >
            {formatPriceCents(roulage.pricePerPilot)} par place
          </Text>
        ) : null}
        {roulage.notes ? (
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.caption,
              marginTop: spacing.sm,
              lineHeight: fontSize.caption * 1.5,
            }}
          >
            {roulage.notes}
          </Text>
        ) : null}

        {/* Récapitulatif des réponses */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xl }}>
          <Stat value={summary.accepted} label="présents" />
          <Stat value={summary.invited} label="en attente" />
          <Stat value={places == null ? '∞' : places} label="places libres" />
        </View>

        {/* Pilotes invités */}
        <Text
          style={[
            typography.eyebrow,
            { color: colors.accent.coach, marginTop: spacing.xxl, marginBottom: spacing.md },
          ]}
        >
          INVITÉS ({invitations.length})
        </Text>
        {invitations.length === 0 ? (
          <Text style={[typography.caption, { color: colors.text.tertiary, fontStyle: 'italic' }]}>
            Personne n&apos;est encore convié.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {invitations.map((inv) => {
              const p = pilotById.get(inv.pilotId);
              return (
                <View
                  key={inv.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor: colors.border.subtle,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                      {p ? pilotName(p) : 'Pilote'}
                    </Text>
                    <Text
                      style={[typography.caption, { color: colors.text.tertiary, marginTop: 2 }]}
                    >
                      {INVITATION_STATUS_LABELS[inv.status]}
                    </Text>
                  </View>
                  {isOpen ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${p ? pilotName(p) : 'ce pilote'}`}
                      onPress={() => onRemove(inv.id)}
                    >
                      <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                        Retirer
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Sélecteur de pilotes à inviter (seulement si ouvert) */}
        {isOpen ? (
          <>
            <Text
              style={[
                typography.eyebrow,
                { color: colors.accent.coach, marginTop: spacing.xxl, marginBottom: spacing.md },
              ]}
            >
              CONVIER UN PILOTE
            </Text>
            {invitablePilots.length === 0 ? (
              <Text
                style={[typography.caption, { color: colors.text.tertiary, fontStyle: 'italic' }]}
              >
                Tous vos pilotes sont déjà conviés.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {invitablePilots.map((p) => (
                  <Pressable
                    key={p.pilotId}
                    accessibilityRole="button"
                    accessibilityLabel={`Convier ${pilotName(p)}`}
                    disabled={busy}
                    onPress={() => onInvite(p.pilotId)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      borderWidth: 0.5,
                      borderColor: colors.accent.coach,
                      backgroundColor: colors.background.secondary,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                      {pilotName(p)}
                    </Text>
                    <Text
                      style={{
                        color: colors.accent.coach,
                        fontSize: fontSize.caption,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      Convier
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}

        {/* Actions roulage */}
        {isOpen ? (
          <View style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onStatus('done')}
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.border.medium,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
                Clôturer le roulage
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => onStatus('cancelled')}
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.accent.red,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.accent.red, fontSize: fontSize.caption }}>
                Annuler le roulage
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
      <Text
        style={[
          typography.eyebrow,
          { color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center' },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
