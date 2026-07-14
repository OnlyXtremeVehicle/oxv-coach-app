/**
 * Coach — Détail d'un programme (C-2), reskin refonte-v2 §12, RESPONSIVE deux
 * formats. Maquette de référence : `coach/14-programmes.png` (partagée avec la
 * LISTE `(coach)/cycles.tsx`, qui fait autorité pour les décisions de couleur).
 *
 * Le coach façonne le programme : intitulé, intention (en observation), étapes
 * (franchies / en cours), statut du cycle (actif / clôturé) et partage au pilote.
 * L'app NE génère NI n'adapte jamais : elle conserve et affiche, le coach ajuste.
 * Le partage est opt-in ; un contenu prescriptif est refusé (garde app
 * isDoctrineSafe + trigger DB). Vouvoiement, zéro emoji, descriptif jamais
 * prescriptif.
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) — le rail/onglets
 * viennent de `(coach)/_layout` ; cet écran n'adapte que son corps :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : fidèle à la maquette
 *     — en-tête (eyebrow PROGRAMME · <pilote> + titre + statut) puis DEUX
 *     COLONNES : à gauche les étapes + le composeur + les actions de cycle ; à
 *     droite l'avancée chiffrée (reached/total), le partage et la note doctrinale.
 *   - COMPAGNON téléphone (< seuil) : AppBar + une seule colonne empilée.
 *
 * Décisions « données réelles » (ZÉRO nouvelle table/colonne) :
 *   - Étapes = `cycle_steps` (listSteps, RLS coach) ; deux statuts réels
 *     seulement : `en_cours` / `atteint` (le « à venir » de la maquette n'existe
 *     pas au schéma — non inventé). L'avancée « reached/total » est calculée, pas
 *     stockée.
 *   - COULEUR (coherence avec la LISTE `cycles.tsx`) : l'avancée est NEUTRE (crème
 *     + trait) — un programme n'est pas une branche QDI, donc pas de violet
 *     (une couleur = une donnée) ; le VERT marque l'état « atteint / partagé »
 *     (sémantique OXV validé/consenti, §7.11) ; l'OR est absent (chrono/record
 *     uniquement) ; l'identité coach (rouge d'accent #E23A4E) porte le CTA, le
 *     statut ACTIF et le liseré de la note. Pas de rouge d'alarme sur les étapes.
 *   - Le nom du pilote (eyebrow) vient de `coach_pilots_view` (listMyPilots) —
 *     jamais ses coordonnées (garde-fou §12). Absent → « PROGRAMME » seul.
 *
 * Logique, services, états et RLS coach-only inchangés.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { listMyPilots } from '@/services/coachService';
import {
  type CycleStep,
  type DevelopmentCycle,
  addStep,
  deleteCycle,
  deleteStep,
  getCycle,
  listSteps,
  updateCycle,
  updateStep,
} from '@/services/developmentCycleService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing, radius } = theme;

export default function CoachCycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [cycle, setCycle] = useState<DevelopmentCycle | null>(null);
  const [steps, setSteps] = useState<CycleStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [pilotName, setPilotName] = useState<string | null>(null);

  const [focus, setFocus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getCycle(id), listSteps(id)]).then(([c, st]) => {
      if (!cancelled) {
        setCycle(c);
        setSteps(st);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(reload);

  // Nom du pilote (affichage seul, jamais ses coordonnées — garde-fou §12).
  useEffect(() => {
    if (!cycle?.pilotId) return;
    let cancelled = false;
    listMyPilots()
      .then((rows) => {
        if (cancelled) return;
        const p = rows.find((r) => r.pilotId === cycle.pilotId);
        if (!p) return;
        const full =
          [p.firstName, p.lastName]
            .map((x) => x?.trim())
            .filter(Boolean)
            .join(' ') || null;
        setPilotName(full);
      })
      .catch(() => {
        /* nom facultatif : l'écran reste utilisable sans lui */
      });
    return () => {
      cancelled = true;
    };
  }, [cycle?.pilotId]);

  async function onToggleShare(next: boolean) {
    if (!cycle) return;
    setShareError(null);
    const res = await updateCycle(cycle.id, { isShared: next });
    if (res.ok) {
      setCycle({ ...cycle, isShared: next });
    } else {
      setShareError(
        next
          ? 'Partage refusé : une étape ou l’intention contient une formulation prescriptive.'
          : (res.error ?? 'Action impossible.')
      );
    }
  }

  async function onToggleStatus() {
    if (!cycle) return;
    const next = cycle.status === 'active' ? 'closed' : 'active';
    const res = await updateCycle(cycle.id, { status: next });
    if (res.ok) setCycle({ ...cycle, status: next });
  }

  async function onAddStep() {
    if (!id || saving || !focus.trim()) return;
    setSaving(true);
    setStepError(null);
    const res = await addStep(id, { focus, note: note || undefined, position: steps.length });
    setSaving(false);
    if (res.ok) {
      setFocus('');
      setNote('');
      reload();
    } else {
      setStepError(
        cycle?.isShared
          ? 'Cette étape contient une formulation prescriptive (programme partagé).'
          : (res.error ?? 'Ajout impossible.')
      );
    }
  }

  async function onToggleStepStatus(step: CycleStep) {
    const next = step.status === 'en_cours' ? 'atteint' : 'en_cours';
    setSteps((prev) => prev.map((s2) => (s2.id === step.id ? { ...s2, status: next } : s2)));
    const res = await updateStep(step.id, { status: next });
    if (!res.ok) reload();
  }

  function onDeleteStep(step: CycleStep) {
    Alert.alert('Supprimer cette étape', 'Cette étape sera effacée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteStep(step.id);
          if (res.ok) reload();
        },
      },
    ]);
  }

  function onDeleteCycle() {
    if (!cycle) return;
    Alert.alert('Supprimer le programme', 'Le programme et ses étapes seront effacés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteCycle(cycle.id);
          if (res.ok) router.back();
        },
      },
    ]);
  }

  // — Valeurs dérivées (données réelles) —
  const total = steps.length;
  const reached = steps.filter((st) => st.status === 'atteint').length;
  const pct = total > 0 ? Math.round((reached / total) * 100) : 0;
  const eyebrowText = pilotName ? `PROGRAMME · ${pilotName.toUpperCase()}` : 'PROGRAMME';
  const stepsState: ScreenState = total === 0 ? 'empty' : 'nominal';

  // ── Blocs partagés (rendus seulement quand le cycle est chargé) ─────────────
  const headerBlock = cycle ? (
    <View>
      <Text style={s.eyebrow}>{eyebrowText}</Text>
      <View style={s.titleRow}>
        <Text style={s.title} accessibilityRole="header">
          {cycle.title}
        </Text>
        <CycleStatusChip active={cycle.status === 'active'} />
      </View>
      {cycle.intention ? <Text style={s.intention}>{cycle.intention}</Text> : null}
    </View>
  ) : null;

  const recapCard = (
    <View
      style={s.recapCard}
      accessibilityRole="summary"
      accessibilityLabel={total > 0 ? `${reached} étapes franchies sur ${total}` : 'Aucune étape'}
    >
      <Text style={s.recapEyebrow}>AVANCÉE</Text>
      {total > 0 ? (
        <>
          <View style={s.recapNumRow}>
            <Text style={s.recapNum}>{reached}</Text>
            <Text style={s.recapNumTotal}>/{total}</Text>
          </View>
          <Text style={s.recapUnit}>étapes franchies</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </>
      ) : (
        <>
          <Text style={s.recapDash}>—</Text>
          <Text style={s.recapUnit}>Aucune étape pour l’instant</Text>
        </>
      )}
    </View>
  );

  const shareCard = cycle ? (
    <View style={s.card}>
      <View style={s.shareRow}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={s.rowLabel}>Partager au pilote</Text>
          <Text style={s.caption}>Le pilote ne voit le programme qu’une fois partagé.</Text>
        </View>
        <Switch
          value={cycle.isShared}
          onValueChange={onToggleShare}
          accessibilityRole="switch"
          accessibilityLabel="Partager le programme au pilote"
          accessibilityState={{ checked: cycle.isShared }}
          trackColor={{ false: palette.cardBorderProminent, true: palette.green }}
          thumbColor={palette.cream}
        />
      </View>
      {shareError ? (
        <Text style={s.errorTxt} accessibilityLiveRegion="polite">
          {shareError}
        </Text>
      ) : null}
    </View>
  ) : null;

  const stepsBlock = (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>{`ÉTAPES · ${total}`}</SectionLabel>
      <StateWrapper
        state={stepsState}
        emptyLabel="Aucune étape"
        emptyMessage="Aucune étape pour ce programme. Ajoutez-en une pour poser un premier jalon."
        emptySource="cycle_steps"
      >
        <View style={{ gap: spacing.sm }}>
          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              index={i}
              step={step}
              onToggle={() => onToggleStepStatus(step)}
              onDelete={() => onDeleteStep(step)}
            />
          ))}
        </View>
      </StateWrapper>
    </View>
  );

  const composerBlock = (
    <View style={s.composer}>
      <SectionLabel>NOUVELLE ÉTAPE</SectionLabel>
      <View style={{ marginTop: spacing.md }}>
        <Field
          label="Intitulé"
          value={focus}
          onChangeText={setFocus}
          placeholder="Ce que cette étape cherche à installer."
          maxLength={500}
        />
        <Field
          label="Note"
          optional
          value={note}
          onChangeText={setNote}
          placeholder="Un repère d’observation, jamais un ordre."
          multiline
          maxLength={1000}
          showCounter
        />
        {stepError ? (
          <Text style={s.errorTxt} accessibilityLiveRegion="polite">
            {stepError}
          </Text>
        ) : null}
        <CoachButton
          label={saving ? 'Ajout…' : 'Ajouter l’étape'}
          onPress={onAddStep}
          loading={saving}
          disabled={!focus.trim()}
        />
      </View>
    </View>
  );

  const dangerBlock = cycle ? (
    <View style={s.dangerBlock}>
      <CoachButton
        label={cycle.status === 'active' ? 'Clôturer le cycle' : 'Réactiver le cycle'}
        tone="ghost"
        onPress={onToggleStatus}
      />
      <CoachButton label="Supprimer le programme" tone="danger" onPress={onDeleteCycle} />
    </View>
  ) : null;

  const doctrineCard = (
    <View style={s.doctrineCard}>
      <Text style={s.doctrineTxt}>
        Un programme est qualitatif : des étapes franchies, jamais une note qui monte.
      </Text>
    </View>
  );

  return (
    <Screen scroll={false}>
      <AppBar title="PROGRAMME" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollPad}>
          {!cycle ? (
            <View style={{ marginTop: spacing.xl }}>
              <StateWrapper
                state={loading ? 'loading' : 'error'}
                skeletonLines={5}
                errorCause="Ce programme est introuvable ou n’est plus accessible."
                onRetry={reload}
              >
                <View />
              </StateWrapper>
            </View>
          ) : isConsole ? (
            <>
              {headerBlock}
              <View style={s.consoleRow}>
                <View style={s.mainCol}>
                  {stepsBlock}
                  {composerBlock}
                  {dangerBlock}
                </View>
                <View style={s.sideCol}>
                  {recapCard}
                  {shareCard}
                  {doctrineCard}
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={{ marginBottom: spacing.md }}>
                <RoleBadge role="coach" />
              </View>
              {headerBlock}
              <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
                {recapCard}
                {shareCard}
              </View>
              <View style={{ marginTop: spacing.xl }}>{stepsBlock}</View>
              <View style={{ marginTop: spacing.xl }}>{composerBlock}</View>
              {dangerBlock}
              <View style={{ marginTop: spacing.xl }}>{doctrineCard}</View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Ligne d'étape (maquette) : pastille numérotée + intitulé + note + statut, et
 *  actions d'édition (basculer le statut, supprimer). Vert = atteint (validé) ;
 *  en cours = neutre (aucun rouge d'alarme). */
function StepRow({
  index,
  step,
  onToggle,
  onDelete,
}: {
  index: number;
  step: CycleStep;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const reached = step.status === 'atteint';
  return (
    <View
      style={s.stepRow}
      accessibilityLabel={`Étape ${index + 1} : ${step.focus}. ${reached ? 'Atteinte' : 'En cours'}.`}
    >
      <View style={[s.stepDot, reached ? s.stepDotReached : s.stepDotOngoing]}>
        <Text style={[s.stepDotNum, reached ? s.stepDotNumReached : s.stepDotNumOngoing]}>
          {index + 1}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.stepTop}>
          <Text style={s.stepFocus}>{step.focus}</Text>
          <View style={[s.statusChip, reached ? s.statusChipReached : s.statusChipOngoing]}>
            <Text style={[s.statusTxt, reached ? s.statusTxtReached : s.statusTxtOngoing]}>
              {reached ? 'ATTEINTE' : 'EN COURS'}
            </Text>
          </View>
        </View>
        {step.note ? <Text style={s.stepNote}>{step.note}</Text> : null}
        <View style={s.stepActions}>
          <RowAction
            label={reached ? 'Remettre en cours' : 'Marquer atteinte'}
            onPress={onToggle}
          />
          <RowAction label="Supprimer" tone="danger" onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

/** Petite action textuelle d'édition (mono, sobre) — cible ≥ 44 px. */
function RowAction({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}
    >
      <Text style={[s.actionTxt, tone === 'danger' && { color: palette.coachAlert }]}>{label}</Text>
    </Pressable>
  );
}

/** Statut du cycle (identité coach : ACTIF rouge d'accent, CLÔTURÉ neutre). */
function CycleStatusChip({ active }: { active: boolean }) {
  return (
    <View style={s.cycleChip}>
      <Text style={[s.cycleChipTxt, active ? s.cycleChipTxtActive : s.cycleChipTxtClosed]}>
        {active ? 'ACTIF' : 'CLÔTURÉ'}
      </Text>
    </View>
  );
}

/** CTA coach : rempli rouge d'accent (primary), bordé (ghost) ou texte d'alerte
 *  douce (danger). Cible ≥ 48 px, état de chargement sans casser la cible. */
function CoachButton({
  label,
  onPress,
  tone = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const inert = disabled || loading;
  const danger = tone === 'danger';
  const ghost = tone === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inert}
      onPress={inert ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        danger ? s.btnDanger : ghost ? s.btnGhost : s.btnPrimary,
        disabled && s.btnDisabled,
        pressed && !inert && { opacity: 0.9 },
      ]}
    >
      <View style={s.btnContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.btnTxt, danger ? s.btnTxtDanger : ghost ? s.btnTxtGhost : s.btnTxtPrimary]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrollPad: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // En-tête
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  intention: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
    marginTop: spacing.md,
    maxWidth: 620,
  },

  // Deux colonnes (console)
  consoleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  mainCol: { flex: 1.6, minWidth: 320, gap: spacing.xl },
  sideCol: { flex: 1, minWidth: 260, gap: spacing.lg },

  // Carte générique
  card: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
    gap: spacing.md,
  },

  // Ligne d'étape
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepDotReached: { backgroundColor: palette.green },
  stepDotOngoing: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
  },
  stepDotNum: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
  },
  stepDotNumReached: { color: palette.night },
  stepDotNumOngoing: { color: palette.creamMute },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stepFocus: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.3,
  },
  stepNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
    marginTop: spacing.xs,
  },
  stepActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  action: { minHeight: 44, justifyContent: 'center' },
  actionTxt: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // Pastille de statut d'étape
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusChipReached: {
    backgroundColor: 'rgba(79,201,138,0.12)',
    borderColor: 'rgba(79,201,138,0.35)',
  },
  statusChipOngoing: { backgroundColor: palette.surface3, borderColor: palette.line },
  statusTxt: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusTxtReached: { color: palette.green },
  statusTxtOngoing: { color: palette.creamMute },

  // Statut du cycle (en-tête)
  cycleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.line,
  },
  cycleChipTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cycleChipTxtActive: { color: palette.coachAccent },
  cycleChipTxtClosed: { color: palette.creamMute },

  // Avancée (chiffre dominant, neutre — pas de branche QDI, pas d'or)
  recapCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  recapEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  recapNumRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm },
  recapNum: {
    fontFamily: fonts.king,
    fontSize: 40,
    letterSpacing: -1,
    color: palette.cream,
  },
  recapNumTotal: {
    fontFamily: fonts.mono,
    fontSize: fontSize.value,
    letterSpacing: -0.5,
    color: palette.creamMute,
    marginLeft: 2,
  },
  recapDash: {
    fontFamily: fonts.king,
    fontSize: 40,
    color: palette.faint,
    marginTop: spacing.sm,
  },
  recapUnit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  barTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: 4, borderRadius: radius.pill, backgroundColor: palette.secondary },

  // Partage
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
    marginTop: 2,
  },

  // Composeur
  composer: {
    borderWidth: 1,
    borderColor: palette.line,
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },

  // Actions de cycle
  dangerBlock: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },

  // Note doctrinale (liseré coach)
  doctrineCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  doctrineTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: palette.creamSoft,
  },

  errorTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.red,
    lineHeight: fontSize.small * 1.5,
    marginBottom: spacing.sm,
  },

  // CTA coach
  btn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  btnPrimary: { backgroundColor: palette.coachAccent },
  btnGhost: {
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
    marginTop: 0,
  },
  btnDanger: { backgroundColor: 'transparent', marginTop: 0 },
  btnDisabled: { opacity: 0.5 },
  btnTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    letterSpacing: 0.2,
  },
  btnTxtPrimary: { color: palette.cream },
  btnTxtGhost: { color: palette.creamSoft },
  btnTxtDanger: { color: palette.coachAlert },
});
