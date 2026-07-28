/**
 * Vue Coach — détail d'un roulage (§8 OXV Mirror ; langage §12 handoff, proche du
 * canon « Séance de groupe » #7a : roster + briefing, se branchera sur le
 * multi-live le jour J). Pas de maquette dédiée : on applique le langage v2 de ses
 * écrans frères de l'Agenda (roulages/index, calendrier) — cohérence, pas fidélité
 * pixel.
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : un seul écran, deux
 * arrangements selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes — le ROSTER
 *     (invités + convier) en colonne principale, les détails (briefing, prix) et
 *     les actions de statut en colonne latérale. Le rail vertical est fourni par
 *     `_layout.tsx` (pas d'AppBar) ; un lien « Retour » ferme la vue.
 *   - COMPAGNON téléphone (< seuil) : AppBar + une colonne empilée.
 *
 * DONNÉES RÉELLES uniquement (`getRoulage`, `listRoulageInvitations`,
 * `listMyPilots`, zéro schéma nouveau) : titre, date/heure, circuit, lieu, statut,
 * prix par place (`price_per_pilot`), briefing (`notes`), invitations et statuts
 * de réponse tracent tous vers `coach_roulages` / `roulage_invitations`. Un champ
 * absent est masqué — jamais inventé.
 *
 * Sécurité : la RLS limite tout au coach propriétaire ET aux pilotes assignés
 * (coach_pilots actif). Logique inchangée (chargement, invitations, statut).
 *
 * Doctrine : lecture factuelle, DESCRIPTIF jamais prescriptif, aucun classement
 * entre pilotes, vouvoiement, zéro emoji. L'identité coach = rouge `#E23A4E` /
 * `#E2685A` (accents, retrait) ; aucun chrono ici → aucun or.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type CoachPilotRow, listMyPilots } from '@/services/coachService';
import {
  type Roulage,
  type RoulageInvitation,
  type RoulageStatus,
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
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

function pilotName(p: CoachPilotRow): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';
}

export default function RoulageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roulageId = Array.isArray(id) ? id[0] : id;

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [roulage, setRoulage] = useState<Roulage | null>(null);
  const [invitations, setInvitations] = useState<RoulageInvitation[]>([]);
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
      setError(false);
      load().catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    load().catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [load]);

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

  const onInvite = useCallback(
    async (pilotId: string) => {
      if (!roulageId || busy) return;
      setBusy(true);
      await invitePilot(roulageId, pilotId);
      await load();
      setBusy(false);
    },
    [roulageId, busy, load]
  );

  const onRemove = useCallback(
    async (invitationId: string) => {
      if (busy) return;
      setBusy(true);
      await removeInvitation(invitationId);
      await load();
      setBusy(false);
    },
    [busy, load]
  );

  const onStatus = useCallback(
    async (status: 'cancelled' | 'done') => {
      if (!roulageId || busy) return;
      setBusy(true);
      await setRoulageStatus(roulageId, status);
      await load();
      setBusy(false);
    },
    [roulageId, busy, load]
  );

  const places = roulage ? remainingPlaces(roulage, summary.accepted) : null;
  const isOpen = roulage?.status === 'open';

  const state: ScreenState = loading ? 'loading' : error ? 'error' : !roulage ? 'empty' : 'nominal';

  const stateWrapperProps = {
    state,
    skeletonLines: 5,
    emptyLabel: 'Roulage introuvable.',
    emptyMessage: 'Ce roulage est introuvable ou vous n’y avez pas accès.',
    emptySource: 'coach_roulages',
    errorCause: 'Ce roulage n’a pas pu être chargé.',
    onRetry: reload,
  } as const;

  // — Fragments réutilisés par les deux formats (rendus une seule fois) —

  const factsRow = (
    <View style={s.factsRow}>
      <Fact label="Présents" value={String(summary.accepted)} />
      <Fact label="En attente" value={String(summary.invited)} />
      <Fact label="Places libres" value={places == null ? '∞' : String(places)} />
    </View>
  );

  const detailsCard =
    roulage && (roulage.pricePerPilot != null || roulage.notes) ? (
      <Card style={{ gap: spacing.md }}>
        <SectionLabel>Détails</SectionLabel>
        {roulage.pricePerPilot != null ? (
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Prix par place</Text>
            <Text style={s.detailValue}>{formatPriceCents(roulage.pricePerPilot)}</Text>
          </View>
        ) : null}
        {roulage.notes ? (
          <View>
            <Text style={s.detailLabel}>Briefing</Text>
            <Text style={[s.notesText, { marginTop: spacing.xs }]}>{roulage.notes}</Text>
          </View>
        ) : null}
      </Card>
    ) : null;

  const invitedSection = (
    <View>
      <SectionLabel>{`Invités (${invitations.length})`}</SectionLabel>
      {invitations.length === 0 ? (
        <Text style={[s.calm, { marginTop: spacing.md }]}>Personne n&apos;est encore convié.</Text>
      ) : (
        <View style={s.list}>
          {invitations.map((inv) => {
            const p = pilotById.get(inv.pilotId);
            return (
              <InvitationRow
                key={inv.id}
                inv={inv}
                name={p ? pilotName(p) : 'Pilote'}
                isOpen={!!isOpen}
                busy={busy}
                onRemove={onRemove}
              />
            );
          })}
        </View>
      )}
    </View>
  );

  const convierSection = isOpen ? (
    <View>
      <SectionLabel>Convier un pilote</SectionLabel>
      {invitablePilots.length === 0 ? (
        <Text style={[s.calm, { marginTop: spacing.md }]}>Tous vos pilotes sont déjà conviés.</Text>
      ) : (
        <View style={s.list}>
          {invitablePilots.map((p) => (
            <ConvierRow
              key={p.pilotId}
              name={pilotName(p)}
              busy={busy}
              onInvite={() => onInvite(p.pilotId)}
            />
          ))}
        </View>
      )}
    </View>
  ) : null;

  const actionsSection = isOpen ? (
    <View style={{ gap: spacing.md }}>
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
        style={({ pressed }) => [s.dangerBtn, { opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}
      >
        <Text style={s.dangerTxt}>Annuler le roulage</Text>
      </Pressable>
    </View>
  ) : null;

  const backLink = (
    <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={theme.hitSlop}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={s.back}>Retour</Text>
      </Pressable>
    </View>
  );

  // ————————————————————————————————————————————————————————————————
  // CONSOLE TABLETTE — 2 colonnes (roster / détails + actions)
  // ————————————————————————————————————————————————————————————————
  if (isConsole) {
    const hasSide = detailsCard != null || actionsSection != null;
    return (
      <Screen>
        <View style={s.consolePad}>
          <HeaderBlock isConsole roulage={roulage} />
          <View style={{ marginTop: spacing.xl }}>
            <StateWrapper {...stateWrapperProps}>
              {roulage ? (
                <>
                  {factsRow}
                  <View style={s.columns}>
                    <View style={s.colMain}>
                      {invitedSection}
                      {convierSection}
                    </View>
                    {hasSide ? (
                      <View style={s.colSide}>
                        {detailsCard}
                        {actionsSection}
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
            </StateWrapper>
          </View>
          {backLink}
        </View>
      </Screen>
    );
  }

  // ————————————————————————————————————————————————————————————————
  // COMPAGNON TÉLÉPHONE — 1 colonne
  // ————————————————————————————————————————————————————————————————
  return (
    <Screen>
      <AppBar title="ROULAGE" onBack={() => router.back()} />
      <View style={s.companionPad}>
        <HeaderBlock isConsole={false} roulage={roulage} />
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper {...stateWrapperProps}>
            {roulage ? (
              <View style={{ gap: spacing.xxl }}>
                {factsRow}
                {detailsCard}
                {invitedSection}
                {convierSection}
                {actionsSection}
              </View>
            ) : null}
          </StateWrapper>
        </View>
        {backLink}
      </View>
    </Screen>
  );
}

// ===========================================================================
// Sous-composants
// ===========================================================================

function HeaderBlock({ isConsole, roulage }: { isConsole: boolean; roulage: Roulage | null }) {
  const meta = roulage
    ? [formatDateTime(roulage.startsAt), roulage.circuitName, roulage.location]
        .filter(Boolean)
        .join(' · ')
    : null;
  const showStatus = roulage != null && roulage.status !== 'open';

  if (isConsole) {
    return (
      <View style={s.consoleHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ROULAGE</Text>
          {roulage ? (
            <Text
              style={[s.title, { marginTop: spacing.sm }]}
              accessibilityRole="header"
              numberOfLines={2}
            >
              {roulage.title}
            </Text>
          ) : null}
          {meta ? <Text style={[s.meta, { marginTop: spacing.xs }]}>{meta}</Text> : null}
        </View>
        {showStatus ? <StatusPill status={roulage.status} /> : null}
      </View>
    );
  }

  return (
    <>
      <View style={{ marginBottom: spacing.md }}>
        <RoleBadge role="coach" />
      </View>
      <Text style={s.eyebrow}>COACH OXV</Text>
      {roulage ? (
        <Text
          style={[s.title, { marginTop: spacing.sm }]}
          accessibilityRole="header"
          numberOfLines={2}
        >
          {roulage.title}
        </Text>
      ) : null}
      {meta || showStatus ? (
        <View style={s.metaRow}>
          {meta ? <Text style={s.meta}>{meta}</Text> : null}
          {showStatus ? <StatusPill status={roulage.status} /> : null}
        </View>
      ) : null}
    </>
  );
}

/** Micro-badge de statut (mot) : annulé en alerte douce coach, passé en gris. */
function StatusPill({ status }: { status: RoulageStatus }) {
  const cancelled = status === 'cancelled';
  return (
    <Text style={[s.statusPill, cancelled ? s.statusCancelled : s.statusDone]}>
      {ROULAGE_STATUS_LABELS[status]}
    </Text>
  );
}

/** Ligne de roster : nom du pilote + statut de réponse (constat, jamais un rang). */
function InvitationRow({
  inv,
  name,
  isOpen,
  busy,
  onRemove,
}: {
  inv: RoulageInvitation;
  name: string;
  isOpen: boolean;
  busy: boolean;
  onRemove: (invitationId: string) => void;
}) {
  const accepted = inv.status === 'accepted';
  return (
    <Card style={s.rosterCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.rosterName}>{name}</Text>
        <View style={s.statusRow}>
          <View
            style={[s.statusDot, { backgroundColor: accepted ? palette.green : palette.faint }]}
          />
          <Text style={[s.rosterStatus, accepted && { color: palette.green }]}>
            {INVITATION_STATUS_LABELS[inv.status]}
          </Text>
        </View>
      </View>
      {isOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${name}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => onRemove(inv.id)}
          hitSlop={theme.hitSlop}
          style={s.rowAction}
        >
          <Text style={s.removeAction}>Retirer</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Carte d'invitation : convie un pilote suivi non encore invité. */
function ConvierRow({
  name,
  busy,
  onInvite,
}: {
  name: string;
  busy: boolean;
  onInvite: () => void;
}) {
  return (
    <Card
      onPress={onInvite}
      disabled={busy}
      accessibilityLabel={`Convier ${name}`}
      style={s.convierCard}
    >
      <Text style={s.rosterName}>{name}</Text>
      <Text style={s.convierAction}>Convier</Text>
    </Card>
  );
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },

  // En-tête
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // Récapitulatif (3 faits)
  factsRow: { flexDirection: 'row', gap: spacing.sm },

  // Deux colonnes (console)
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xxl,
  },
  colMain: { flex: 1, gap: spacing.xxl },
  colSide: { width: 320, gap: spacing.lg },

  // Listes de roster
  list: { marginTop: spacing.md, gap: spacing.sm },

  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rosterName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rosterStatus: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  // Cible tactile de l'action de ligne (≥ 44 px).
  rowAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  // « Retirer » = retrait d'accès → alerte douce coach (token dédié).
  removeAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.coachAlert,
  },

  convierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // « Convier » = action d'identité coach (accent rouge).
  convierAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.coachAccent,
  },

  // Carte de détails (briefing / prix)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  detailValue: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  notesText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.55,
  },

  // Statut (mot) : sobre, tracké.
  statusPill: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusCancelled: { color: palette.coachAlert },
  statusDone: { color: palette.creamMute },

  // Action destructive (annuler) — bord alerte douce coach, jamais plein.
  dangerBtn: {
    minHeight: 48,
    paddingVertical: spacing.lg - 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.coachAlert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.coachAlert,
  },

  // Message calme (roster vide)
  calm: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // Lien de retour (interactif) — corps, pas mono.
  back: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.creamMute,
  },
});
