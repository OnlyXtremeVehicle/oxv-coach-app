/**
 * Coach — Programmes adaptatifs (handoff §12 `coach/14-programmes`), RESPONSIVE
 * DEUX FORMATS (décision fondateur 2026-07-13).
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : fidèle à la maquette
 *    coach/14-programmes — en-tête (eyebrow PROGRAMMES · <pilote> + titre) avec
 *    eyebrow « qualitatif · niveau programme » et CTA rouge à droite ; sélecteur
 *    de pilote (chips) ; puis DEUX COLONNES : à gauche la liste des programmes en
 *    lignes d'étapes (pastille + titre + statut + progression réelle), à droite un
 *    récapitulatif chiffré + la note doctrinale. Le rail (CoachRail) vient de
 *    `_layout.tsx`.
 *  - COMPAGNON téléphone (< seuil) : AppBar + une seule colonne compacte.
 *
 * Un programme = un cycle qualitatif que LE COACH authore pour un pilote (niveau
 * 'programme' requis) et fait évoluer. L'app NE génère NI n'adapte jamais : elle
 * conserve et affiche, le coach ajuste. Aucun score chiffré, aucune note qui
 * monte — seulement des étapes franchies.
 *
 * Adaptations « données réelles » (ZÉRO nouvelle table/colonne) :
 *  - La maquette montre UN programme et ses étapes ; cet écran est la LISTE des
 *    programmes du pilote sélectionné. La progression « 2/4 étapes franchies » de
 *    la maquette est portée PAR LIGNE : elle est calculée en lisant `cycle_steps`
 *    (listSteps, RLS coach) — atteintes / total. Aucune valeur inventée : un
 *    programme sans étape affiche « Aucune étape ».
 *  - Le récapitulatif de droite (nombre de programmes, actifs, partagés) est
 *    dérivé des programmes réellement chargés.
 *  - La barre de progression est NEUTRE (crème sur trait) : elle ne porte pas de
 *    couleur QDI (une couleur = une donnée ; un programme n'est pas une branche).
 *    Le vert = « partagé » (état consenti/actif, sémantique OXV), l'or est absent
 *    (réservé au chrono/record). Identité coach = rouge #E23A4E sur les CTA.
 *
 * Vouvoiement, zéro emoji, descriptif jamais prescriptif. Logique de sélection /
 * création et RLS coach-only (garde « niveau programme ») inchangées.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type CoachPilotRow, listMyPilots } from '@/services/coachService';
import {
  type DevelopmentCycle,
  createCycle,
  listMyCycles,
  listSteps,
} from '@/services/developmentCycleService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Programme enrichi de sa progression réelle (lue dans cycle_steps). */
type ProgramRow = DevelopmentCycle & { total: number; reached: number };

const pilotName = (p: CoachPilotRow) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';

export default function CoachCyclesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [cycles, setCycles] = useState<ProgramRow[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [cyclesError, setCyclesError] = useState(false);

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [intention, setIntention] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // — Pilotes consentis (chargés une fois) —
  useEffect(() => {
    let cancelled = false;
    listMyPilots().then((rows) => {
      if (!cancelled) setPilots(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // — Programmes du pilote + progression réelle. Rechargé au focus (retour depuis
  //   le détail où les étapes ont pu évoluer) et au changement de pilote. —
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!pilotId) {
          setCycles([]);
          return;
        }
        setLoadingCycles(true);
        setCyclesError(false);
        try {
          const rows = await listMyCycles(pilotId);
          const withProgress = await Promise.all(
            rows.map(async (c) => {
              const steps = await listSteps(c.id);
              return {
                ...c,
                total: steps.length,
                reached: steps.filter((st) => st.status === 'atteint').length,
              };
            })
          );
          if (!cancelled) setCycles(withProgress);
        } catch {
          if (!cancelled) setCyclesError(true);
        } finally {
          if (!cancelled) setLoadingCycles(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [pilotId])
  );

  const reloadCycles = useCallback(async () => {
    if (!pilotId) return;
    setLoadingCycles(true);
    setCyclesError(false);
    try {
      const rows = await listMyCycles(pilotId);
      const withProgress = await Promise.all(
        rows.map(async (c) => {
          const steps = await listSteps(c.id);
          return {
            ...c,
            total: steps.length,
            reached: steps.filter((st) => st.status === 'atteint').length,
          };
        })
      );
      setCycles(withProgress);
    } catch {
      setCyclesError(true);
    } finally {
      setLoadingCycles(false);
    }
  }, [pilotId]);

  function onSelectPilot(id: string) {
    setPilotId(id);
    setComposing(false);
    setError(null);
  }

  function openForm() {
    setError(null);
    setComposing(true);
  }

  function closeForm() {
    setError(null);
    setComposing(false);
  }

  async function onCreate() {
    if (!pilotId || saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createCycle({ pilotId, title, intention: intention || undefined });
    setSaving(false);
    if (res.ok) {
      setComposing(false);
      setTitle('');
      setIntention('');
      reloadCycles();
    } else {
      setError(
        res.error?.includes('row-level') || res.error?.includes('policy')
          ? 'Ce pilote ne vous a pas accordé le niveau « programme ».'
          : (res.error ?? 'Création impossible.')
      );
    }
  }

  const selectedPilot = pilots.find((p) => p.pilotId === pilotId) ?? null;

  const recap = useMemo(
    () => ({
      total: cycles.length,
      active: cycles.filter((c) => c.status === 'active').length,
      shared: cycles.filter((c) => c.isShared).length,
    }),
    [cycles]
  );

  const listState: ScreenState = loadingCycles
    ? 'loading'
    : cyclesError
      ? 'error'
      : cycles.length === 0
        ? 'empty'
        : 'nominal';

  // — Sélecteur de pilote (chips, s'enroule) —
  const pilotSelector = (
    <View style={s.pilotBlock}>
      <Text style={s.sectionLabel}>PILOTE</Text>
      {pilots.length === 0 ? (
        <Text style={s.muted}>Aucun pilote suivi consentant.</Text>
      ) : (
        <View style={s.chipsWrap}>
          {pilots.map((p) => {
            const selected = pilotId === p.pilotId;
            return (
              <Pressable
                key={p.pilotId}
                accessibilityRole="button"
                accessibilityLabel={pilotName(p)}
                accessibilityState={{ selected }}
                onPress={() => onSelectPilot(p.pilotId)}
                style={({ pressed }) => [
                  s.pilotChip,
                  selected && s.pilotChipOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[s.pilotChipTxt, selected && s.pilotChipTxtOn]} numberOfLines={1}>
                  {pilotName(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  // — Liste des programmes (colonne principale) —
  const programList = !pilotId ? (
    <View style={s.hintCard}>
      <Text style={s.hintTxt}>Choisissez un pilote pour afficher ses programmes.</Text>
    </View>
  ) : composing ? (
    <NewProgramForm
      title={title}
      intention={intention}
      error={error}
      saving={saving}
      onChangeTitle={setTitle}
      onChangeIntention={setIntention}
      onCancel={closeForm}
      onSubmit={onCreate}
    />
  ) : (
    <View style={{ gap: spacing.sm }}>
      <Text style={s.sectionLabel}>{`PROGRAMMES · ${cycles.length}`}</Text>
      <StateWrapper
        state={listState}
        skeletonLines={4}
        emptyLabel="Aucun programme"
        emptyMessage="Aucun programme pour ce pilote. Créez-en un pour poser un cycle qualitatif."
        emptySource="pilot_development_cycles"
        errorCause="La liste des programmes n'a pas pu être chargée."
        onRetry={reloadCycles}
      >
        <View style={{ gap: spacing.sm }}>
          {cycles.map((c) => (
            <ProgramCard key={c.id} cycle={c} />
          ))}
        </View>
      </StateWrapper>
    </View>
  );

  // — Colonne latérale (console) / bloc de bas de page (téléphone) —
  const aside = (
    <>
      {pilotId ? (
        <RecapCard total={recap.total} active={recap.active} shared={recap.shared} />
      ) : null}
      <View style={s.doctrineCard}>
        <Text style={s.doctrineTxt}>
          Un programme est qualitatif : des étapes franchies, jamais une note qui monte.
        </Text>
      </View>
    </>
  );

  // ── CONSOLE ────────────────────────────────────────────────────────────────
  if (isConsole) {
    return (
      <Screen scroll={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.consolePad}>
            <View style={s.consoleHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>
                  {selectedPilot
                    ? `PROGRAMMES · ${pilotName(selectedPilot).toUpperCase()}`
                    : 'PROGRAMMES'}
                </Text>
                <Text style={s.title} accessibilityRole="header">
                  Vos programmes.
                </Text>
              </View>
              <View style={s.headRight}>
                <Text style={s.headEyebrow}>qualitatif · niveau programme</Text>
                {pilotId && !composing ? (
                  <CoachButton label="Créer un programme" onPress={openForm} />
                ) : null}
              </View>
            </View>

            <View style={{ marginTop: spacing.xl }}>{pilotSelector}</View>

            <View style={s.consoleBody}>
              <View style={s.mainCol}>{programList}</View>
              <View style={s.sideCol}>{aside}</View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ── COMPAGNON TÉLÉPHONE ──────────────────────────────────────────────────────
  return (
    <Screen scroll={false}>
      <AppBar title="PROGRAMMES" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.companionPad}>
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>
          <Text style={s.eyebrow}>PROGRAMMES</Text>
          <Text style={s.title} accessibilityRole="header">
            Vos programmes.
          </Text>
          <Text style={s.manifest}>
            Un cycle qualitatif que vous façonnez dans le temps. L&apos;app conserve et affiche —
            c&apos;est vous qui l&apos;ajustez.
          </Text>

          <View style={{ marginTop: spacing.xl }}>{pilotSelector}</View>

          {pilotId && !composing ? (
            <View style={s.companionCta}>
              <CoachButton label="Créer un programme" onPress={openForm} />
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>{programList}</View>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>{aside}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Ligne de programme, style « étape » du handoff : pastille de statut + titre +
 *  état de partage + progression réelle (étapes franchies / total). */
function ProgramCard({ cycle }: { cycle: ProgramRow }) {
  const active = cycle.status === 'active';
  const pct = cycle.total > 0 ? Math.round((cycle.reached / cycle.total) * 100) : 0;
  const progressA11y =
    cycle.total > 0 ? `${cycle.reached} étapes franchies sur ${cycle.total}` : 'Aucune étape';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cycle.title}. ${active ? 'Actif' : 'Clôturé'}. ${progressA11y}.`}
      onPress={() => router.push(`/(coach)/cycles/${cycle.id}` as never)}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.9, borderColor: palette.edge }]}
    >
      <View style={[s.rowDot, { backgroundColor: active ? palette.coachAccent : palette.faint }]} />
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {cycle.title}
          </Text>
          <View style={s.statusChip}>
            <Text style={[s.statusTxt, active ? s.statusTxtActive : s.statusTxtClosed]}>
              {active ? 'ACTIF' : 'CLÔTURÉ'}
            </Text>
          </View>
        </View>

        <View style={s.shareRow}>
          <View
            style={[
              s.shareDot,
              { backgroundColor: cycle.isShared ? palette.green : palette.faint },
            ]}
          />
          <Text style={s.shareTxt}>{cycle.isShared ? 'Partagé au pilote' : 'Privé'}</Text>
        </View>

        {cycle.total > 0 ? (
          <View style={s.progWrap}>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.progTxt}>
              <Text style={s.progNum}>
                {cycle.reached}/{cycle.total}
              </Text>{' '}
              étapes franchies
            </Text>
          </View>
        ) : (
          <Text style={s.progEmpty}>Aucune étape</Text>
        )}
      </View>
    </Pressable>
  );
}

/** Récapitulatif chiffré du pilote (dérivé des programmes chargés). Chiffre
 *  dominant = nombre de programmes ; sous-lignes = actifs / partagés. */
function RecapCard({ total, active, shared }: { total: number; active: number; shared: number }) {
  return (
    <View style={s.recapCard}>
      <Text style={s.recapEyebrow}>RÉCAPITULATIF</Text>
      <Text style={s.recapNum} accessibilityLabel={`${total} programmes`}>
        {total}
      </Text>
      <Text style={s.recapUnit}>{total > 1 ? 'programmes' : 'programme'}</Text>
      <View style={s.recapDivider} />
      <View style={s.recapLine}>
        <Text style={s.recapLineLabel}>Actifs</Text>
        <Text style={s.recapLineVal}>{active}</Text>
      </View>
      <View style={s.recapLine}>
        <Text style={s.recapLineLabel}>Partagés</Text>
        <Text style={s.recapLineVal}>{shared}</Text>
      </View>
    </View>
  );
}

/** Composer coach : liseré rouge d'accent à gauche (§5), titre + intention. */
function NewProgramForm({
  title,
  intention,
  error,
  saving,
  onChangeTitle,
  onChangeIntention,
  onCancel,
  onSubmit,
}: {
  title: string;
  intention: string;
  error: string | null;
  saving: boolean;
  onChangeTitle: (v: string) => void;
  onChangeIntention: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={s.formCard}>
      <Text style={s.formLabel}>NOUVEAU PROGRAMME</Text>
      <Field
        label="Titre"
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Régularité — cycle de 4 séances"
        maxLength={120}
        helper="Une intention, pas un ordre."
      />
      <Field
        label="Intention"
        optional
        value={intention}
        onChangeText={onChangeIntention}
        placeholder="Ce que ce cycle cherche à observer."
        multiline
        maxLength={1000}
        showCounter
      />
      {error ? (
        <Text style={s.errorTxt} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={s.formActions}>
        <CoachButton label="Annuler" tone="ghost" onPress={onCancel} disabled={saving} />
        <CoachButton
          label={saving ? 'Création…' : 'Créer'}
          onPress={onSubmit}
          disabled={saving || !title.trim()}
        />
      </View>
    </View>
  );
}

/** CTA coach : rempli rouge d'accent (primary) ou bordé (ghost). Cible ≥ 44 px. */
function CoachButton({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const ghost = tone === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        ghost ? s.btnGhost : s.btnPrimary,
        disabled && s.btnDisabled,
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      <Text style={[s.btnTxt, ghost ? s.btnTxtGhost : s.btnTxtPrimary]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // En-tête
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headRight: { alignItems: 'flex-end', gap: spacing.md },
  headEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.2,
    color: palette.eyebrow,
  },
  companionCta: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: spacing.sm,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },

  // Deux colonnes (console)
  consoleBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  mainCol: { flex: 1.6, minWidth: 320 },
  sideCol: { width: 288, gap: spacing.md },

  // Sélecteur de pilote
  pilotBlock: { gap: spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pilotChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  pilotChipOn: {
    borderColor: palette.coachAccent,
    borderWidth: 1.5,
    backgroundColor: palette.card2,
  },
  pilotChipTxt: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  pilotChipTxtOn: { color: palette.cream },

  // Indication « choisir un pilote »
  hintCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  hintTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // Ligne de programme (style « étape »)
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 44,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  rowDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.line,
  },
  statusTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusTxtActive: { color: palette.coachAccent },
  statusTxtClosed: { color: palette.creamMute },

  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  shareDot: { width: 6, height: 6, borderRadius: 3 },
  shareTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },

  progWrap: { marginTop: spacing.md, gap: spacing.xs + 2 },
  barTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.line,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: radius.pill, backgroundColor: palette.secondary },
  progTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  progNum: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
  progEmpty: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.faint,
    marginTop: spacing.md,
  },

  // Récapitulatif
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
  recapNum: {
    fontFamily: fonts.king,
    fontSize: 40,
    letterSpacing: -1,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  recapUnit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  recapDivider: {
    height: 1,
    backgroundColor: palette.separator,
    marginVertical: spacing.md,
  },
  recapLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  recapLineLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  recapLineVal: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },

  // Note doctrinale
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

  // Composer
  formCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  formLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: spacing.lg,
  },
  errorTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.red,
    marginBottom: spacing.md,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
  },

  // CTA coach
  btn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: palette.coachAccent },
  btnGhost: {
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    letterSpacing: 0.2,
  },
  btnTxtPrimary: { color: palette.cream },
  btnTxtGhost: { color: palette.creamSoft },
});
