/**
 * Écran Pilote — Roulages : invitations reçues des coachs (§8 OXV Mirror).
 * Reskin fidèle à la maquette refonte-v2 §7bis (screens/31-roulages.png).
 *
 * Maquette : eyebrow mono « Invitation reçue » · carte à LISERÉ HAUT ROUGE
 * coach (`palette.coachAccent`) : avatar initiales + « {Coach} vous invite /
 * votre coach », rangées factuelles (date, lieu, places, tarif), boutons
 * « Accepter » (plein rouge coach) / « Décliner » (bordé sombre) · dessous,
 * l'historique en rangées compactes avec chip de statut.
 *
 * Données RÉELLES uniquement :
 *  - invitations + roulages : roulagesService (RLS : le pilote ne voit que
 *    les siennes) ; nom du coach : pilotConsentService.listMyCoaches()
 *    (coach_pilots → users). Coach non résolu → la carte s'ouvre sur le
 *    titre réel du roulage, sans nom inventé.
 *  - « places » = capacité réelle (max_pilots). Les « places RESTANTES » de
 *    la maquette sont incalculables côté pilote (RLS) → libellé honnête.
 *  - le « roulage libre / DISPO » de la maquette n'a aucune source (le
 *    pilote ne voit que les roulages où il est invité) → DROP net.
 *
 * NB duplication : la Découverte (app/(app)/coachs.tsx, onglet Roulages)
 * affiche les mêmes invitations — même langage v2 (liseré rouge, metas mono).
 *
 * Doctrine : vouvoiement, zéro emoji, descriptif. Le choix appartient au
 * pilote. Logique/service/états inchangés (respondToInvitation, busyId).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { type MyCoachAssignment, listMyCoaches } from '@/services/pilotConsentService';
import { INVITATION_STATUS_LABELS, ROULAGE_STATUS_LABELS } from '@/services/roulagesLogic';
import {
  type PilotInvitation,
  listMyInvitations,
  respondToInvitation,
} from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Nom affichable du coach (donnée réelle, fallback email — comme Mon coach). */
function coachFullName(a: MyCoachAssignment): string {
  return [a.coachFirstName, a.coachLastName].filter(Boolean).join(' ') || a.coachEmail;
}

/** Initiales pour l'avatar (prénom + nom réels, fallback email). */
function coachInitials(a: MyCoachAssignment): string {
  const letters = [a.coachFirstName, a.coachLastName]
    .map((p) => (p ?? '').trim().charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();
  return letters || a.coachEmail.trim().charAt(0).toUpperCase() || 'C';
}

/**
 * « 26 juil. 2026, 09:00 – 17:00 » : début via formatDateTime, fin réelle
 * (ends_at) ajoutée seulement si elle existe et se parse.
 */
function dateRangeLabel(startsAt: string, endsAt: string | null): string {
  const start = formatDateTime(startsAt);
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) return start;
  try {
    const end = new Date(endsAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} – ${end}`;
  } catch {
    return start;
  }
}

/**
 * Libellé de statut d'une entrée d'historique. Priorité : roulage annulé,
 * puis réponse du pilote, sinon roulage passé sans réponse.
 */
function historyLabel({ invitation, roulage }: PilotInvitation): string {
  if (roulage.status === 'cancelled') return ROULAGE_STATUS_LABELS.cancelled;
  if (invitation.status !== 'invited') return INVITATION_STATUS_LABELS[invitation.status];
  return ROULAGE_STATUS_LABELS.done;
}

/** Rangée factuelle « micro-label mono · valeur » (langage v2). */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

export default function PilotRoulagesScreen() {
  const [items, setItems] = useState<PilotInvitation[]>([]);
  const [coachById, setCoachById] = useState<Map<string, MyCoachAssignment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rows, coaches] = await Promise.all([listMyInvitations(), listMyCoaches()]);
    setItems(rows);
    setCoachById(new Map(coaches.map((c) => [c.coachId, c])));
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

  // En attente = invitation sans réponse sur un roulage ouvert (logique V1
  // inchangée). Le reste part dans l'historique avec un chip de statut.
  const pending = items.filter(
    ({ invitation, roulage }) => invitation.status === 'invited' && roulage.status === 'open'
  );
  const history = items.filter(
    ({ invitation, roulage }) => !(invitation.status === 'invited' && roulage.status === 'open')
  );

  return (
    <Screen>
      <AppBar title="Roulages" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        {loading ? (
          <View style={{ paddingVertical: spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : items.length === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              label="À venir"
              message="Vos invitations aux roulages apparaîtront ici."
              source="roulage_invitations"
            />
          </View>
        ) : (
          <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
            {pending.length > 0 ? (
              <View>
                <Text style={s.sectionEyebrow}>
                  {pending.length > 1 ? 'Invitations reçues' : 'Invitation reçue'}
                </Text>
                <View style={{ gap: spacing.md }}>
                  {pending.map(({ invitation, roulage }) => {
                    const coach = coachById.get(roulage.coachId) ?? null;
                    const busy = busyId === invitation.id;
                    return (
                      <Card key={invitation.id} style={s.inviteCard}>
                        {/* En-tête — coach réel si résolu, sinon le titre réel. */}
                        <View style={s.inviteHead}>
                          {coach ? (
                            <View style={s.avatar}>
                              <Text style={s.avatarT}>{coachInitials(coach)}</Text>
                            </View>
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text style={s.inviteTitle} numberOfLines={1}>
                              {coach ? `${coachFullName(coach)} vous invite` : roulage.title}
                            </Text>
                            <Text style={s.inviteSub}>
                              {coach ? 'votre coach' : 'invitation reçue'}
                            </Text>
                          </View>
                        </View>

                        {/* Faits du roulage — chaque valeur trace vers coach_roulages. */}
                        <View style={s.metaBlock}>
                          {coach ? <Text style={s.roulageTitle}>{roulage.title}</Text> : null}
                          <MetaRow
                            label="date"
                            value={dateRangeLabel(roulage.startsAt, roulage.endsAt)}
                          />
                          <MetaRow
                            label="lieu"
                            value={[roulage.circuitName, roulage.location]
                              .filter(Boolean)
                              .join(' · ')}
                          />
                          {roulage.maxPilots != null ? (
                            <MetaRow
                              label="places"
                              value={`${roulage.maxPilots} place${roulage.maxPilots > 1 ? 's' : ''}`}
                            />
                          ) : null}
                          {roulage.pricePerPilot != null ? (
                            <MetaRow
                              label="tarif"
                              value={`${formatPriceCents(roulage.pricePerPilot)} par place`}
                            />
                          ) : null}
                        </View>

                        {/* Accepter (rouge coach) / Décliner — actions réelles. */}
                        <View style={s.actions}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Accepter l'invitation — ${roulage.title}`}
                            accessibilityState={{ disabled: busyId != null, busy }}
                            disabled={busyId != null}
                            onPress={() => respond(invitation.id, true)}
                            style={({ pressed }) => [
                              s.btnAccept,
                              pressed && busyId == null && { opacity: 0.85 },
                            ]}
                          >
                            {busy ? (
                              <ActivityIndicator
                                size="small"
                                color={palette.cream}
                                style={{ marginRight: spacing.sm }}
                                accessibilityElementsHidden
                                importantForAccessibility="no"
                              />
                            ) : null}
                            <Text style={s.btnAcceptT}>Accepter</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Décliner l'invitation — ${roulage.title}`}
                            accessibilityState={{ disabled: busyId != null }}
                            disabled={busyId != null}
                            onPress={() => respond(invitation.id, false)}
                            style={({ pressed }) => [
                              s.btnDecline,
                              pressed && busyId == null && { opacity: 0.85 },
                            ]}
                          >
                            <Text style={s.btnDeclineT}>Décliner</Text>
                          </Pressable>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {history.length > 0 ? (
              <View>
                <Text style={s.sectionEyebrow}>Historique</Text>
                <View style={{ gap: spacing.sm }}>
                  {history.map((item) => {
                    const { invitation, roulage } = item;
                    const label = historyLabel(item);
                    const positive =
                      roulage.status !== 'cancelled' && invitation.status === 'accepted';
                    return (
                      <Card key={invitation.id} style={s.historyCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.historyTitle} numberOfLines={1}>
                            {roulage.title}
                          </Text>
                          <Text style={s.historyMeta} numberOfLines={1}>
                            {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
                          </Text>
                        </View>
                        <View
                          style={[s.chip, positive ? s.chipGreen : s.chipNeutral]}
                          accessibilityLabel={`Statut : ${label}`}
                        >
                          <Text style={[s.chipT, positive ? s.chipGreenT : s.chipNeutralT]}>
                            {label}
                          </Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 : liseré haut 2 px rouge coach,         */
/* eyebrows mono, hairlines, chips factuels. Cibles tactiles ≥ 44 px.  */
/* ------------------------------------------------------------------ */

const s = {
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginBottom: spacing.md,
  },

  // — Carte invitation (liseré haut rouge coach, maquette 31) —
  inviteCard: {
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    padding: spacing.lg,
  },
  inviteHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarT: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  inviteTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  inviteSub: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginTop: 2,
  },
  metaBlock: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  roulageTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  metaLabel: {
    width: 52,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    paddingTop: 2,
  },
  metaValue: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btnAccept: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    backgroundColor: palette.coachAccent,
  },
  btnAcceptT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.cream,
  },
  btnDecline: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  btnDeclineT: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.creamSoft,
  },

  // — Historique (rangées compactes + chip de statut) —
  historyCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
  historyTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  historyMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 3,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipT: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Vert = état validé (présence confirmée), cf. palette.green.
  chipGreen: {
    backgroundColor: 'rgba(79,201,138,0.10)',
    borderColor: 'rgba(79,201,138,0.35)',
  },
  chipGreenT: { color: palette.green },
  chipNeutral: {
    backgroundColor: palette.card2,
    borderColor: palette.line,
  },
  chipNeutralT: { color: palette.creamMute },
};
