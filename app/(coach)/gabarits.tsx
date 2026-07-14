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
 * Modèles de texte réutilisables pour accélérer la saisie des annotations du
 * coach. Confort de saisie côté coach ; les annotations restent cadrées par la
 * doctrine au moment où elles sont écrites, et la voix du coach reste attribuée.
 *
 * Adaptations « données réelles » (ZÉRO nouvelle table/colonne) :
 *  - La maquette tague chaque gabarit d'une COULEUR QDI. La table
 *    `coach_annotation_template` (migration 0039) ne porte que `label` + `body` —
 *    aucune branche ni couleur QDI. Les puces restent donc NEUTRES : elles
 *    affichent le libellé du gabarit, pas une donnée QDI (une couleur = une
 *    donnée, jamais décoratif).
 *  - La maquette montre une icône « crayon » (édition). Aucun `updateTemplate`
 *    n'existe côté service ; l'action réelle est la suppression → pas de contrôle
 *    mort, seulement « Supprimer ».
 *  - « + Nouveau » / « + Créer un gabarit » révèlent le formulaire de création
 *    réel (createTemplate). Les textes/couleurs du PNG sont des EXEMPLES ; l'écran
 *    n'affiche que les gabarits réels du coach.
 *
 * Identité coach = rouge #E23A4E sur les CTA (jamais l'or, réservé au chrono —
 * absent ici). Vouvoiement, zéro emoji, descriptif jamais prescriptif. Logique
 * (templates, validation, CRUD) et RLS coach-only inchangées.
 */

import { useCallback, useState } from 'react';
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
import { type CoachAnnotationTemplate, validateTemplate } from '@/services/coachCurationLogic';
import { createTemplate, deleteTemplate, listMyTemplates } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing, radius } = theme;

export default function CoachGabaritsScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
    setError(null);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setError(null);
    setShowForm(false);
  }, []);

  async function onCreate() {
    const input = { label, body };
    const validationError = validateTemplate(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createTemplate(input);
    setSaving(false);
    if (result) {
      setLabel('');
      setBody('');
      setShowForm(false);
      await reload();
    }
  }

  async function onDelete(id: string) {
    await deleteTemplate(id);
    await reload();
  }

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
        <ScrollView contentContainerStyle={isConsole ? s.consolePad : s.companionPad}>
          {header}

          {showForm ? (
            <View style={s.formWrap}>
              <NewTemplateForm
                label={label}
                body={body}
                error={error}
                saving={saving}
                onChangeLabel={setLabel}
                onChangeBody={setBody}
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
              <View style={s.grid}>
                {templates.map((t) => (
                  <TemplateCard key={t.id} template={t} isConsole={isConsole} onDelete={onDelete} />
                ))}
                {showForm ? null : (
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
            </StateWrapper>
          </View>

          <Text style={s.doctrine}>
            Vos gabarits accélèrent la saisie. Chaque mot reste le vôtre, attribué à vous.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isConsole,
  onDelete,
}: {
  template: CoachAnnotationTemplate;
  isConsole: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={[s.tplCard, isConsole ? s.gridCell : s.fullCell]}>
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
      <Text style={s.tplBody}>« {template.body} »</Text>
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
  onCancel,
  onSubmit,
}: {
  label: string;
  body: string;
  error: string | null;
  saving: boolean;
  onChangeLabel: (v: string) => void;
  onChangeBody: (v: string) => void;
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
        placeholder="Sortie de virage"
        maxLength={60}
      />
      <Field
        label="Texte du gabarit"
        value={body}
        onChangeText={onChangeBody}
        placeholder="Le texte du gabarit, sobre et descriptif."
        multiline
        maxLength={1000}
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
