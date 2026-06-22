/**
 * Écran Pilote — mes invitations aux roulages (§8 OXV Mirror).
 *
 * Liste les roulages auxquels le pilote est convié par un coach, avec la
 * possibilité d'accepter ou de décliner. Lecture factuelle : date, lieu,
 * statut. Aucun classement, aucune injonction.
 *
 * Doctrine : vouvoiement, sobre, le choix appartient au pilote.
 * Reskin V2 : Screen + AppBar, Card/Button, logique inchangée.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { INVITATION_STATUS_LABELS } from '@/services/roulagesLogic';
import {
  type PilotInvitation,
  listMyInvitations,
  respondToInvitation,
} from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
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
    <Screen>
      <AppBar title="ROULAGES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Vos invitations.</Text>

        {loading ? (
          <ActivityIndicator color={theme.palette.creamMute} />
        ) : items.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.empty}>Aucune invitation pour l&apos;instant.</Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {items.map(({ invitation, roulage }) => {
              const pending = invitation.status === 'invited' && roulage.status === 'open';
              return (
                <Card key={invitation.id}>
                  <Text style={s.cardTitle}>{roulage.title}</Text>
                  <Text style={s.meta}>
                    {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
                  </Text>
                  {roulage.location ? <Text style={s.meta}>{roulage.location}</Text> : null}
                  {roulage.pricePerPilot != null ? (
                    <Text style={s.price}>{formatPriceCents(roulage.pricePerPilot)} par place</Text>
                  ) : null}

                  {roulage.status === 'cancelled' ? (
                    <Text style={s.cancelled}>Ce roulage a été annulé.</Text>
                  ) : pending ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: theme.spacing.sm,
                        marginTop: theme.spacing.md,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Accepter"
                          onPress={() => respond(invitation.id, true)}
                          disabled={busyId === invitation.id}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Décliner"
                          variant="ghost"
                          onPress={() => respond(invitation.id, false)}
                          disabled={busyId === invitation.id}
                        />
                      </View>
                    </View>
                  ) : (
                    <Text style={s.response}>
                      Votre réponse : {INVITATION_STATUS_LABELS[invitation.status]}
                    </Text>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  empty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  cardTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  price: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
  },
  cancelled: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.md,
  },
  response: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.md,
  },
};
