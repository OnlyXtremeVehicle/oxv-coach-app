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
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Fact/Button. Logique
 * inchangée (chargement, invitations, changement de statut).
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
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
      <Screen scroll={false}>
        <AppBar title="ROULAGE" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  if (!roulage) {
    return (
      <Screen scroll={false}>
        <AppBar title="ROULAGE" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text style={[s.manifest, { textAlign: 'center' }]} accessibilityRole="header">
            Ce roulage est introuvable.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            hitSlop={theme.hitSlop}
            style={{ marginTop: theme.spacing.xl }}
          >
            <Text style={s.action}>Retour</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const places = remainingPlaces(roulage, summary.accepted);
  const isOpen = roulage.status === 'open';

  return (
    <Screen>
      <AppBar title="ROULAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ROULAGE</Text>
        <Text style={s.title} accessibilityRole="header">
          {roulage.title}
        </Text>
        <Text style={[s.caption, { marginTop: theme.spacing.sm }]}>
          {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
          {roulage.status !== 'open' ? ` · ${ROULAGE_STATUS_LABELS[roulage.status]}` : ''}
        </Text>

        {roulage.location ? (
          <Text style={[s.body, { marginTop: theme.spacing.md }]}>{roulage.location}</Text>
        ) : null}
        {roulage.pricePerPilot != null ? (
          <Text style={[s.body, { marginTop: theme.spacing.xs }]}>
            {formatPriceCents(roulage.pricePerPilot)} par place
          </Text>
        ) : null}
        {roulage.notes ? (
          <Text style={[s.caption, { marginTop: theme.spacing.sm }]}>{roulage.notes}</Text>
        ) : null}

        {/* Récapitulatif des réponses */}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          <Fact label="Présents" value={String(summary.accepted)} />
          <Fact label="En attente" value={String(summary.invited)} />
          <Fact label="Places libres" value={places == null ? '∞' : String(places)} />
        </View>

        {/* Pilotes invités */}
        <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.md }}>
          <SectionLabel>{`Invités (${invitations.length})`}</SectionLabel>
        </View>
        {invitations.length === 0 ? (
          <Text style={[s.caption, { fontStyle: 'italic' }]}>
            Personne n&apos;est encore convié.
          </Text>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {invitations.map((inv) => {
              const p = pilotById.get(inv.pilotId);
              return (
                <Card
                  key={inv.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.body}>{p ? pilotName(p) : 'Pilote'}</Text>
                    <Text style={[s.caption, { marginTop: 2 }]}>
                      {INVITATION_STATUS_LABELS[inv.status]}
                    </Text>
                  </View>
                  {isOpen ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${p ? pilotName(p) : 'ce pilote'}`}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => onRemove(inv.id)}
                      hitSlop={theme.hitSlop}
                    >
                      <Text style={s.mutedAction}>Retirer</Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}

        {/* Sélecteur de pilotes à inviter (seulement si ouvert) */}
        {isOpen ? (
          <>
            <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.md }}>
              <SectionLabel>Convier un pilote</SectionLabel>
            </View>
            {invitablePilots.length === 0 ? (
              <Text style={[s.caption, { fontStyle: 'italic' }]}>
                Tous vos pilotes sont déjà conviés.
              </Text>
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {invitablePilots.map((p) => (
                  <Pressable
                    key={p.pilotId}
                    accessibilityRole="button"
                    accessibilityLabel={`Convier ${pilotName(p)}`}
                    disabled={busy}
                    onPress={() => onInvite(p.pilotId)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Card
                      style={{
                        borderColor: theme.palette.coach,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={s.body}>{pilotName(p)}</Text>
                      <Text style={s.action}>Convier</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}

        {/* Actions roulage */}
        {isOpen ? (
          <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.md }}>
            <Button
              label="Clôturer le roulage"
              variant="ghost"
              loading={busy}
              onPress={() => onStatus('done')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler le roulage"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => onStatus('cancelled')}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.palette.red,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              })}
            >
              <Text style={s.dangerAction}>Annuler le roulage</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            hitSlop={theme.hitSlop}
          >
            <Text style={s.mutedAction}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
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
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  // Actions = libellés (mots), donc pas en mono. Affordances sobres et trackées.
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.coach,
  },
  mutedAction: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  dangerAction: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.red,
  },
};
