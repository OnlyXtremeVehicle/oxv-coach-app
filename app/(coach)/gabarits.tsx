/**
 * Coach — Gabarits de commentaire (handoff §12 `coach/10-gabarits`), RESPONSIVE
 * DEUX FORMATS (décision fondateur 2026-07-13).
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : fidèle à la maquette
 *    coach/10-gabarits — en-tête (eyebrow GABARITS + titre) avec bouton « + Nouveau »
 *    rouge à droite, puis une GRILLE 2 colonnes de cartes-gabarits + une carte
 *    pointillée « + Créer un gabarit ». Le rail (CoachRail) vient de `_layout.tsx`.
 *  - COMPAGNON téléphone (< seuil) : AppBar + une colonne compacte de cartes.
 *
 * Refonte « plus intuitif » (retour fondateur build 23) :
 *  - CRÉATION GUIDÉE : le composer s'ouvre en expansion douce (LayoutAnimation),
 *    placeholders parlants, compteur réel (Field showCounter), et AMORCES DE
 *    STRUCTURE — des boutons qui INSÈRENT un squelette de texte ÉDITABLE dans le
 *    champ (« Observation / Ressenti / À creuser »…). Du texte inséré, pas une
 *    nouvelle donnée ; formulations descriptives, jamais prescriptives.
 *  - LISIBILITÉ : chaque carte montre un aperçu du body (2 lignes) + des
 *    métadonnées RÉELLES portées par la table : longueur du texte
 *    (`body.length`) et date (`updated_at`, seule date de la migration 0039).
 *    Recherche client (nom + contenu, insensible aux accents) dès 6 gabarits,
 *    avec compteur de résultats réel.
 *  - ANIMATIONS : cartes en cascade (FadeInSection), création/suppression en
 *    LayoutAnimation, bannière de confirmation animée + haptique de réussite.
 *    Tout respecte useReduceMotion.
 *
 * Adaptations « données réelles » (ZÉRO nouvelle table/colonne) :
 *  - La maquette tague chaque gabarit d'une COULEUR QDI. La table
 *    `coach_annotation_template` ne porte que `label` + `body` + `updated_at` —
 *    aucune branche ni couleur QDI. Les puces restent donc NEUTRES (une couleur
 *    = une donnée, jamais décoratif).
 *  - Aucun `updateTemplate` côté service ; l'action réelle est la suppression →
 *    pas de contrôle mort, seulement « Supprimer ».
 *  - PAS de bouton « Utiliser » par carte : `annoter.tsx` n'accepte AUCUN param
 *    texte (seulement pilotId/cornerIndex/sessionId, et sans pilotId l'écran ne
 *    peut rien enregistrer) → un tel bouton serait mort. Le chemin réel existe
 *    déjà DANS annoter : chaque gabarit y est proposé à l'insertion
 *    (TemplateChips). L'écran le dit en clair au lieu de le simuler.
 *
 * Identité coach = rouge #E23A4E sur les CTA (jamais l'or, réservé au chrono —
 * absent ici). Vert = état validé uniquement (bannière de création, cf.
 * ShareToggle ON). Vouvoiement, zéro emoji, descriptif jamais prescriptif.
 * Logique (templates, validation, CRUD) et RLS coach-only inchangées.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { FadeInSection, useReduceMotion } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import * as haptics from '@/lib/haptics';
import { type CoachAnnotationTemplate, validateTemplate } from '@/services/coachCurationLogic';
import { createTemplate, deleteTemplate, listMyTemplates } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

// LayoutAnimation (expansion du composer, création/suppression de cartes) —
// l'ancienne architecture Android exige l'activation explicite ; sans effet ailleurs.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Limite réelle du corps de gabarit (validateTemplate + maxLength du champ). */
const BODY_MAX = 1000;

/** Seuil d'apparition de la recherche client (retour fondateur : dès 6 gabarits). */
const SEARCH_THRESHOLD = 6;

/**
 * Amorces de structure : du TEXTE INSÉRÉ ÉDITABLE dans le champ, jamais une
 * nouvelle donnée. Formulations descriptives/ouvertes (doctrine : le coach
 * interprète, l'app décrit — aucune consigne).
 */
const STARTERS: { key: string; label: string; skeleton: string }[] = [
  {
    key: 'observation',
    label: 'Observation · Ressenti · À creuser',
    skeleton: 'Observation : \nRessenti : \nÀ creuser : ',
  },
  {
    key: 'phases',
    label: 'Entrée · Milieu · Sortie',
    skeleton: 'À l’entrée : \nAu milieu : \nÀ la sortie : ',
  },
  {
    key: 'constat',
    label: 'Constat · Question ouverte',
    skeleton: 'Ce que je vois : \nLa question que je vous pose : ',
  },
];

/** Normalisation de recherche : minuscules, sans accents (client-side). */
function normalizeSearch(input: string): string {
  const COMBINING_MARKS = /[\u0300-\u036f]/g;
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

export default function CoachGabaritsScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;
  const reduceMotion = useReduceMotion();

  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [justCreated, setJustCreated] = useState<string | null>(null);

  /** Anime le prochain changement de layout (ouverture composer, cartes). */
  const animateLayout = useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        220,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
  }, [reduceMotion]);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await listMyTemplates();
      setTemplates(rows);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const openForm = useCallback(() => {
    animateLayout();
    setError(null);
    setShowForm(true);
  }, [animateLayout]);

  const closeForm = useCallback(() => {
    animateLayout();
    setError(null);
    setShowForm(false);
  }, [animateLayout]);

  const dismissCreated = useCallback(() => setJustCreated(null), []);

  /** Insère une amorce (squelette éditable) à la suite du texte existant. */
  function insertStarter(skeleton: string) {
    const trimmedEnd = body.replace(/\s+$/, '');
    const next = trimmedEnd.length > 0 ? `${trimmedEnd}\n${skeleton}` : skeleton;
    if (next.length > BODY_MAX) {
      setError('Plus assez de place pour insérer cette amorce (1000 caractères maximum).');
      return;
    }
    setError(null);
    haptics.tap();
    setBody(next);
  }

  async function onCreate() {
    const input = { label, body };
    const validationError = validateTemplate(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    const created = await createTemplate(input);
    setSaving(false);
    if (!created) {
      setError('Le gabarit n’a pas pu être enregistré. Vérifiez votre connexion et réessayez.');
      return;
    }
    // Confirmation réelle : la ligne retournée par l'insert, pas une promesse.
    haptics.success();
    animateLayout();
    setLabel('');
    setBody('');
    setShowForm(false);
    setTemplates((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label, 'fr')));
    setJustCreated(created.label);
  }

  async function onDelete(id: string) {
    const ok = await deleteTemplate(id);
    if (ok) {
      haptics.tap();
      animateLayout();
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } else {
      await reload();
    }
  }

  // — Recherche client (dès SEARCH_THRESHOLD gabarits) —
  const searchable = templates.length >= SEARCH_THRESHOLD;
  const normalizedQuery = searchable ? normalizeSearch(query) : '';
  const visibleTemplates = useMemo(() => {
    if (!normalizedQuery) return templates;
    return templates.filter(
      (t) =>
        normalizeSearch(t.label).includes(normalizedQuery) ||
        normalizeSearch(t.body).includes(normalizedQuery)
    );
  }, [templates, normalizedQuery]);

  const listState: ScreenState = loading
    ? 'loading'
    : loadError
      ? 'error'
      : templates.length === 0
        ? 'empty'
        : 'nominal';

  // — En-tête —
  const header = isConsole ? (
    <View style={s.consoleHead}>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>GABARITS</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos phrases prêtes à l'emploi.
        </Text>
      </View>
      {showForm ? null : <CoachButton label="+ Nouveau" onPress={openForm} />}
    </View>
  ) : (
    <View>
      <View style={{ marginBottom: spacing.md }}>
        <RoleBadge role="coach" />
      </View>
      <Text style={s.eyebrow}>GABARITS</Text>
      <Text style={s.title} accessibilityRole="header">
        Vos phrases prêtes à l'emploi.
      </Text>
      <Text style={s.manifest}>
        Des modèles réutilisables pour annoter plus vite. Vous gardez la main sur chaque mot.
      </Text>
      {showForm ? null : (
        <View style={s.companionCta}>
          <CoachButton label="+ Nouveau" onPress={openForm} />
        </View>
      )}
    </View>
  );

  return (
    <Screen scroll={false}>
      {isConsole ? null : <AppBar title="GABARITS" onBack={() => router.back()} />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={isConsole ? s.consolePad : s.companionPad}
          keyboardShouldPersistTaps="handled"
        >
          {header}

          {justCreated ? (
            <CreatedBanner key={justCreated} label={justCreated} onDone={dismissCreated} />
          ) : null}

          {showForm ? (
            <View style={s.formWrap}>
              <NewTemplateForm
                label={label}
                body={body}
                error={error}
                saving={saving}
                onChangeLabel={setLabel}
                onChangeBody={setBody}
                onInsertStarter={insertStarter}
                onCancel={closeForm}
                onSubmit={onCreate}
              />
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl }}>
            <StateWrapper
              state={listState}
              skeletonLines={5}
              emptyLabel="Aucun gabarit"
              emptyMessage="Aucun gabarit pour l'instant. Créez-en un pour annoter plus vite."
              emptySource="coach_annotation_template"
              errorCause="La liste des gabarits n'a pas pu être chargée."
              onRetry={reload}
            >
              <View>
                <View style={s.libHead}>
                  <Text style={s.libEyebrow}>VOTRE BIBLIOTHÈQUE</Text>
                  <View
                    style={s.countChip}
                    accessibilityLabel={
                      normalizedQuery
                        ? `${visibleTemplates.length} gabarits sur ${templates.length}`
                        : `${templates.length} gabarits`
                    }
                  >
                    <Text style={s.countChipTxt}>
                      {normalizedQuery
                        ? `${visibleTemplates.length} / ${templates.length}`
                        : `${templates.length}`}
                    </Text>
                  </View>
                </View>

                {searchable ? (
                  <Field
                    label="Rechercher un gabarit"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Nom ou contenu"
                    autoCorrect={false}
                  />
                ) : null}

                {visibleTemplates.length === 0 && normalizedQuery ? (
                  <Text style={s.noMatch}>Aucun gabarit ne correspond à votre recherche.</Text>
                ) : (
                  <View style={s.grid}>
                    {visibleTemplates.map((t, i) => (
                      <FadeInSection
                        key={t.id}
                        delay={Math.min(i, 8) * 45}
                        disabled={normalizedQuery.length > 0}
                        style={isConsole ? s.gridCell : s.fullCell}
                      >
                        <TemplateCard template={t} onDelete={onDelete} />
                      </FadeInSection>
                    ))}
                    {showForm || normalizedQuery ? null : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Créer un gabarit"
                        onPress={openForm}
                        style={({ pressed }) => [
                          s.createCard,
                          isConsole ? s.gridCell : s.fullCell,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={s.createTxt}>+ Créer un gabarit</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </StateWrapper>
          </View>

          <Text style={s.doctrine}>
            Vos gabarits vous sont proposés à l'insertion au moment d'annoter un virage. Chaque mot
            reste le vôtre, attribué à vous.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDelete,
}: {
  template: CoachAnnotationTemplate;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={s.tplCard}>
      <View style={s.tplTop}>
        {/* Puce NEUTRE = libellé du gabarit (pas une branche QDI : la table ne
            porte aucune couleur — cf. en-tête de fichier). */}
        <View style={s.chip}>
          <Text style={s.chipTxt} numberOfLines={1}>
            {template.label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Supprimer le gabarit ${template.label}`}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => onDelete(template.id)}
          style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.deleteTxt}>Supprimer</Text>
        </Pressable>
      </View>
      {/* Aperçu 2 lignes — le texte complet est proposé à l'insertion dans Annoter. */}
      <Text style={s.tplBody} numberOfLines={2}>
        « {template.body} »
      </Text>
      {/* Métadonnées RÉELLES : longueur du texte + date portée par la table. */}
      <Text style={s.tplMetaTxt}>
        {`${template.body.length} caractères · ${formatDateShort(template.updatedAt)}`}
      </Text>
    </View>
  );
}

function NewTemplateForm({
  label,
  body,
  error,
  saving,
  onChangeLabel,
  onChangeBody,
  onInsertStarter,
  onCancel,
  onSubmit,
}: {
  label: string;
  body: string;
  error: string | null;
  saving: boolean;
  onChangeLabel: (v: string) => void;
  onChangeBody: (v: string) => void;
  onInsertStarter: (skeleton: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={s.formCard}>
      <Text style={s.formLabel}>NOUVEAU GABARIT</Text>
      <Field
        label="Nom du gabarit"
        value={label}
        onChangeText={onChangeLabel}
        placeholder="Sortie de virage, freinage tardif…"
        helper="Le nom sous lequel ce gabarit vous sera proposé au moment d'annoter."
        maxLength={60}
      />

      {/* Amorces : squelettes INSÉRÉS dans le champ, éditables — pas une donnée. */}
      <View style={s.starterBlock}>
        <Text style={s.starterEyebrow}>AMORCES DE STRUCTURE</Text>
        <View style={s.starterRow}>
          {STARTERS.map((st) => (
            <Pressable
              key={st.key}
              accessibilityRole="button"
              accessibilityLabel={`Insérer l'amorce ${st.label}`}
              hitSlop={theme.hitSlop}
              onPress={() => onInsertStarter(st.skeleton)}
              style={({ pressed }) => [s.starterChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.starterChipTxt}>+ {st.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.starterHint}>
          Un squelette inséré dans votre texte, à remanier librement.
        </Text>
      </View>

      <Field
        label="Texte du gabarit"
        value={body}
        onChangeText={onChangeBody}
        placeholder="Ce que vous observez, formulé une fois pour toutes. Sobre, descriptif, ouvert."
        multiline
        numberOfLines={5}
        maxLength={BODY_MAX}
        showCounter
      />
      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      <View style={s.formActions}>
        <CoachButton label="Annuler" tone="ghost" onPress={onCancel} disabled={saving} />
        <CoachButton
          label={saving ? 'Ajout…' : 'Ajouter le gabarit'}
          onPress={onSubmit}
          disabled={saving}
        />
      </View>
    </View>
  );
}

/**
 * Bannière de confirmation de création — n'apparaît QUE sur une ligne réellement
 * insérée (retour de createTemplate). Vert = état validé (cf. ShareToggle ON),
 * fondu entrée/sortie, retrait automatique. Statique sous reduce motion.
 */
function CreatedBanner({ label, onDone }: { label: string; onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      const id = setTimeout(onDone, 2000);
      return () => clearTimeout(id);
    }
    const seq = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(progress, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    seq.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => seq.stop();
  }, [onDone, progress, reduceMotion]);

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        s.banner,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
            },
          ],
        },
      ]}
    >
      <View style={s.bannerRing} />
      <Text style={s.bannerTxt}>{`Gabarit « ${label} » ajouté.`}</Text>
    </Animated.View>
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

  // Bannière de confirmation (création réelle)
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.green,
    backgroundColor: 'rgba(79,201,138,0.08)',
  },
  bannerRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: palette.green,
  },
  bannerTxt: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.green,
  },

  // Bibliothèque (tête de liste + compteur réel)
  libHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  libEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  countChip: {
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  countChipTxt: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: palette.creamSoft,
  },
  noMatch: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    paddingVertical: spacing.md,
  },

  // Grille de gabarits
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridCell: { flexBasis: '47%', flexGrow: 1, minWidth: 240 },
  fullCell: { width: '100%' },

  tplCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
    minHeight: 104,
  },
  tplTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chip: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.line,
  },
  chipTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  deleteBtn: { paddingVertical: 2 },
  deleteTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.coachAlert,
  },
  tplBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    marginTop: spacing.md,
    lineHeight: fontSize.small * 1.55,
  },
  tplMetaTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.md,
  },

  // Carte pointillée de création
  createCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.lg,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  createTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },

  // Formulaire (composer coach : liseré rouge d'accent à gauche, §5)
  formWrap: { marginTop: spacing.xl },
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

  // Amorces de structure
  starterBlock: { marginBottom: spacing.lg },
  starterEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  starterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  starterChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  starterChipTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.creamSoft,
  },
  starterHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.4,
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

  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
});
