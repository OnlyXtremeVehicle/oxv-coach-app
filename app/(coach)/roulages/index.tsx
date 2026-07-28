/**
 * Vue Coach — mes roulages (§8 OXV Mirror ; langage §12 handoff).
 *
 * Liste les roulages organisés par le coach (à venir / passés), avec un accès à
 * la création et au détail (invitations). Pas de maquette dédiée : on applique le
 * langage v2 de ses écrans frères de l'Agenda (calendrier, business) — cohérence,
 * pas fidélité pixel.
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : un seul écran, deux
 * arrangements selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes — « À venir »
 *     (colonne principale) et « Passés » (colonne latérale, atténuée) ; l'action
 *     « Créer un roulage » vit dans l'en-tête, à droite. Le rail vertical est
 *     fourni par `_layout.tsx` (pas d'AppBar).
 *   - COMPAGNON téléphone (< seuil) : AppBar + une colonne (bouton de création,
 *     puis les sections empilées).
 *
 * Gating : permission modulaire `manage_own_sessions` (§8.1). Si elle n'est pas
 * activée par l'admin, l'écran l'indique sobrement sans rien exposer ni proposer.
 *
 * DONNÉES RÉELLES uniquement (`listMyRoulages`, zéro schéma nouveau) : titre,
 * date/heure, circuit, lieu, statut, capacité (`max_pilots`) et prix par place
 * (`price_per_pilot`) tracent tous vers la table `coach_roulages`. Un champ absent
 * est masqué — jamais inventé. L'or reste réservé au chrono (aucun chrono ici →
 * aucun or) ; l'identité coach = rouge `#E23A4E` (liseré des roulages à venir).
 *
 * Doctrine : lecture factuelle, aucun classement, DESCRIPTIF jamais prescriptif,
 * vouvoiement, zéro emoji.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type Roulage, ROULAGE_STATUS_LABELS, splitRoulagesByTime } from '@/services/roulagesLogic';
import { listMyRoulages } from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

export default function CoachRoulagesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const { permissions, loading: permLoading } = useCoachPermissions();
  const [roulages, setRoulages] = useState<Roulage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    listMyRoulages()
      .then((rows) => {
        setRoulages(rows);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(false);
      listMyRoulages()
        .then((rows) => {
          if (!cancelled) {
            setRoulages(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const goCreate = useCallback(() => {
    router.push('/(coach)/roulages/nouveau' as never);
  }, []);

  // Chrome partagé : pas d'AppBar en console (le rail porte la navigation).
  const frame = (children: ReactNode) => (
    <Screen>
      {isConsole ? null : <AppBar title="ROULAGES" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>{children}</View>
    </Screen>
  );

  if (permLoading) {
    return frame(
      <>
        <HeaderBlock isConsole={isConsole} />
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper state="loading" skeletonLines={5}>
            {null}
          </StateWrapper>
        </View>
      </>
    );
  }

  // Feature gardée : permission non accordée → message sobre, aucune donnée,
  // aucune action de création (pas de contrôle mort).
  if (!permissions.canManageOwnSessions) {
    return frame(
      <>
        <HeaderBlock isConsole={isConsole} />
        <Card style={{ marginTop: spacing.xl }}>
          <Text style={s.manifest}>
            La gestion des roulages n&apos;est pas activée sur votre compte.
          </Text>
          <Text style={s.caption}>
            Cette fonctionnalité est ouverte au cas par cas par l&apos;équipe OXV.
          </Text>
        </Card>
      </>
    );
  }

  const { upcoming, past } = splitRoulagesByTime(roulages, new Date().toISOString());

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : roulages.length === 0
        ? 'empty'
        : 'nominal';

  const stateWrapperProps = {
    state,
    skeletonLines: 5,
    emptyLabel: "Aucun roulage pour l'instant.",
    emptyMessage: 'Créez-en un pour convier vos pilotes.',
    emptySource: 'coach_roulages',
    errorCause: "La liste de vos roulages n'a pas pu être chargée.",
    onRetry: reload,
  } as const;

  // ---- CONSOLE (tablette) : deux colonnes ---------------------------------
  if (isConsole) {
    return frame(
      <>
        <HeaderBlock isConsole onCreate={goCreate} />
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper {...stateWrapperProps}>
            <View style={s.twoCol}>
              <View style={s.mainCol}>
                <Section
                  title="À venir"
                  roulages={upcoming}
                  emptyNote="Aucun roulage à venir. Créez-en un pour convier vos pilotes."
                />
              </View>
              <View style={s.sideCol}>
                <Section title="Passés" roulages={past} muted emptyNote="Aucun roulage passé." />
              </View>
            </View>
          </StateWrapper>
        </View>
      </>
    );
  }

  // ---- COMPAGNON (téléphone) : une colonne --------------------------------
  return frame(
    <>
      <HeaderBlock isConsole={false} />
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <Button label="Créer un roulage" onPress={goCreate} />
      </View>
      <StateWrapper {...stateWrapperProps}>
        <View style={{ gap: spacing.xxl }}>
          {upcoming.length > 0 ? (
            <Section title="À venir" roulages={upcoming} emptyNote="" />
          ) : null}
          {past.length > 0 ? <Section title="Passés" roulages={past} muted emptyNote="" /> : null}
        </View>
      </StateWrapper>
    </>
  );
}

// ===========================================================================
// Sous-composants
// ===========================================================================

function HeaderBlock({ isConsole, onCreate }: { isConsole: boolean; onCreate?: () => void }) {
  if (isConsole) {
    return (
      <View style={s.consoleHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ROULAGES</Text>
          <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
            Vos roulages
          </Text>
        </View>
        {onCreate ? <Button label="Créer un roulage" onPress={onCreate} /> : null}
      </View>
    );
  }
  return (
    <>
      <View style={{ marginBottom: spacing.md }}>
        <RoleBadge role="coach" />
      </View>
      <Text style={s.eyebrow}>COACH OXV</Text>
      <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
        Vos roulages.
      </Text>
    </>
  );
}

function Section({
  title,
  roulages,
  muted,
  emptyNote,
}: {
  title: string;
  roulages: Roulage[];
  muted?: boolean;
  emptyNote: string;
}) {
  return (
    <View>
      <SectionLabel>{title}</SectionLabel>
      <View style={s.list}>
        {roulages.length === 0 ? (
          emptyNote ? (
            <Text style={s.calm}>{emptyNote}</Text>
          ) : null
        ) : (
          roulages.map((r) => <RoulageCard key={r.id} roulage={r} muted={muted} />)
        )}
      </View>
    </View>
  );
}

function RoulageCard({ roulage, muted }: { roulage: Roulage; muted?: boolean }) {
  const showStatus = roulage.status !== 'open';
  const isCancelled = roulage.status === 'cancelled';

  const meta = [formatDateTime(roulage.startsAt), roulage.circuitName, roulage.location]
    .filter(Boolean)
    .join(' · ');

  const hasCapacity = roulage.maxPilots != null && roulage.maxPilots > 0;
  const hasPrice = roulage.pricePerPilot != null;
  const capacityText = hasCapacity
    ? `${roulage.maxPilots} place${roulage.maxPilots! > 1 ? 's' : ''}`
    : null;
  const priceText = hasPrice ? `${formatPriceCents(roulage.pricePerPilot!)} / place` : null;

  const a11yParts = [roulage.title, meta];
  if (showStatus) a11yParts.push(ROULAGE_STATUS_LABELS[roulage.status]);
  if (capacityText) a11yParts.push(capacityText);
  if (priceText) a11yParts.push(`${formatPriceCents(roulage.pricePerPilot!)} par place`);

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/(coach)/roulages/[id]', params: { id: roulage.id } } as never)
      }
      accessibilityLabel={`${a11yParts.join('. ')}.`}
      style={[s.card, muted ? s.cardMuted : s.cardActive]}
    >
      <View style={s.cardHeaderRow}>
        <Text style={s.cardTitle} numberOfLines={2}>
          {roulage.title}
        </Text>
        {showStatus ? (
          <Text style={[s.statusPill, isCancelled ? s.statusCancelled : s.statusDone]}>
            {ROULAGE_STATUS_LABELS[roulage.status]}
          </Text>
        ) : null}
      </View>

      <Text style={s.meta} numberOfLines={2}>
        {meta}
      </Text>

      {capacityText || priceText ? (
        <View style={s.chipsRow}>
          {capacityText ? (
            <View style={s.chip}>
              <Text style={s.chipTxt}>{capacityText}</Text>
            </View>
          ) : null}
          {priceText ? (
            <View style={s.chip}>
              <Text style={s.chipTxt}>{priceText}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
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

  // Deux colonnes (console)
  twoCol: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1 },
  sideCol: { width: 320 },

  // Liste
  list: { marginTop: spacing.md, gap: spacing.sm },

  // Carte roulage
  card: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  // À venir = liseré rouge d'identité coach (pas l'or, réservé au chrono).
  cardActive: { borderLeftWidth: 2, borderLeftColor: palette.coachAccent },
  // Passé = atténué, sans accent.
  cardMuted: { opacity: 0.66 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  // Statut = libellé (mot) : micro-badge sobre, tracké. Annulé en alerte douce
  // coach ; passé/clôturé en gris neutre.
  statusPill: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusCancelled: { color: palette.coachAlert },
  statusDone: { color: palette.creamMute },
  meta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.xs,
  },

  // Chips capacité / prix (faits de la table, jamais inventés)
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  chipTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.creamSoft,
  },

  // Textes calmes / messages
  calm: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
});
