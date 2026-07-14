/**
 * Coach — Éditeur d'un repère de virage (§12 handoff · coach/08-reperes),
 * RESKIN refonte-v2 RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13).
 *
 * Le coach pose, pour CE virage, un point de freinage repère (rouge de donnée)
 * et une vitesse d'apex repère (bleu). Un seul jeu par coach et par virage
 * (coach_corner_reference, clé coach_id + corner_index) : il se superpose chez
 * TOUS ses pilotes consentis et leur apparaît ATTRIBUÉ à lui — « Repère de votre
 * coach », jamais une consigne de l'app (doctrine miroir, §12 garde-fous). On
 * pose des repères, on n'écrit pas quoi faire : vocabulaire « repère », jamais
 * « consigne ».
 *
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/08-reperes) : deux colonnes — à gauche « Les deux repères » (saisie
 *     freinage + apex + trajectoire + enregistrer), à droite « Aperçu côté
 *     pilote » (bande rouge attribuée) suivi du rappel doctrinal.
 *   - COMPAGNON téléphone : une colonne, les mêmes blocs empilés.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Le canevas « glisse pour positionner » de la maquette est ici représenté par
 * des champs numériques : le modèle de donnée est scalaire (brakingPointM en
 * mètres, targetSpeedKmh) — pas de géométrie de tracé à inventer, donc aucun
 * contrôle mort. Couleurs QDI fixes : freinage = rouge de donnée (#F65B5B),
 * apex/trajectoire = bleu (#4F9DF7) ; identité coach = rouge d'accent (#E23A4E) ;
 * aucun or (pas de chrono ici). Données réelles : listMyCornerReferences /
 * upsertCornerReference (RLS) ; un champ vide reste « — ». Logique de chargement,
 * validation et upsert inchangée.
 */

import { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';

import { getCorner, type CornerTopology } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { validateCornerReference } from '@/services/coachReferenceLogic';
import { listMyCornerReferences, upsertCornerReference } from '@/services/coachReferenceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

/** Descripteur factuel du profil de virage (topologie réelle, jamais une consigne). */
function paceLabel(pace: CornerTopology['pace']): string {
  return pace === 'slow' ? 'Épingle' : pace === 'fast' ? 'Courbe rapide' : 'Virage moyen';
}

/** Parse une saisie FR (virgule ou point) → nombre, ou null si vide/invalide. */
function parseNum(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/** Formatage FR : virgule décimale, moins typographique (U+2212). */
function fr(n: number): string {
  return String(n).replace('-', '−').replace('.', ',');
}

export default function RepereEditorScreen() {
  const params = useLocalSearchParams<{ index?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);
  const padded = String(cornerIndex).padStart(2, '0');

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [brakingPoint, setBrakingPoint] = useState('');
  const [targetSpeed, setTargetSpeed] = useState('');
  const [trajectoryNote, setTrajectoryNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyCornerReferences().then((rows) => {
      if (cancelled) return;
      const existing = rows.find((r) => r.cornerIndex === cornerIndex);
      if (existing) {
        setBrakingPoint(existing.brakingPointM != null ? String(existing.brakingPointM) : '');
        setTargetSpeed(existing.targetSpeedKmh != null ? String(existing.targetSpeedKmh) : '');
        setTrajectoryNote(existing.trajectoryNote ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cornerIndex]);

  // Toute édition invalide la confirmation précédente et efface l'erreur en cours
  // (la logique de sauvegarde reste identique — ce n'est qu'un rafraîchissement
  // de l'état de retour visuel).
  function edit(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      if (saved) setSaved(false);
      if (error) setError(null);
    };
  }

  async function onSave() {
    if (saving) return;
    const input = {
      brakingPointM: parseNum(brakingPoint),
      targetSpeedKmh: parseNum(targetSpeed),
      trajectoryNote: trajectoryNote.trim() || null,
    };
    const validationError = validateCornerReference(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    const result = await upsertCornerReference(cornerIndex, input);
    setSaving(false);
    if (result) setSaved(true);
    else setError("L'enregistrement a échoué. Réessayez dans un instant.");
  }

  const formState: ScreenState = loading ? 'loading' : 'nominal';

  // — Fragments partagés par les deux formats (une seule source de vérité) —

  const form = (
    <View>
      <View style={s.markRow}>
        <View style={[s.markDot, { backgroundColor: dataColors.brake }]} />
        <Text style={[s.markLabel, { color: dataColors.brake }]}>FREINAGE</Text>
      </View>
      <Field
        label="Point de freinage repère"
        value={brakingPoint}
        onChangeText={edit(setBrakingPoint)}
        placeholder="110"
        keyboardType="numeric"
        unit="m"
        maxLength={12}
        helper="La distance repère avant la corde."
      />

      <View style={s.markRow}>
        <View style={[s.markDot, { backgroundColor: dataColors.trajectory }]} />
        <Text style={[s.markLabel, { color: dataColors.trajectory }]}>APEX</Text>
      </View>
      <Field
        label="Vitesse d'apex repère"
        value={targetSpeed}
        onChangeText={edit(setTargetSpeed)}
        placeholder="90"
        keyboardType="numeric"
        unit="km/h"
        maxLength={12}
        helper="La vitesse repère à la corde."
      />

      <Field
        label="Trajectoire"
        optional
        value={trajectoryNote}
        onChangeText={edit(setTrajectoryNote)}
        placeholder="Corde tardive, large à la sortie…"
        multiline
        maxLength={280}
        showCounter
        helper="Un mot sur la ligne, si besoin."
      />

      {error ? (
        <Text style={[s.errorTxt, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {saved ? (
        <Text style={[s.savedTxt, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">
          Repère enregistré.
        </Text>
      ) : null}

      <Button label="Enregistrer le repère" onPress={onSave} loading={saving} disabled={saving} />
    </View>
  );

  const preview = (
    <PreviewPanel
      padded={padded}
      brakingPointM={parseNum(brakingPoint)}
      targetSpeedKmh={parseNum(targetSpeed)}
      trajectoryNote={trajectoryNote.trim()}
    />
  );

  const doctrine = (
    <Card style={s.doctrineCard}>
      <Text style={s.doctrineTxt}>
        Des repères, pas une obligation. Vos pilotes restent libres de leur conduite.
      </Text>
    </Card>
  );

  const backLink = (
    <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={theme.hitSlop}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={s.backLink}>Retour</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen scroll={false}>
      <AppBar title="REPÈRE" subtitle={`VIRAGE ${padded}`} onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isConsole ? spacing.xl : spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>

          {/* En-tête : contexte virage + intention ; « superposés » à droite sur console. */}
          <View style={isConsole ? s.headerRow : undefined}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>REPÈRE · VIRAGE {padded}</Text>
              <Text style={s.title} accessibilityRole="header">
                {corner?.name ?? `Virage ${cornerIndex}`}
              </Text>
              {corner ? <Text style={s.meta}>{paceLabel(corner.pace)}</Text> : null}
              <Text style={s.manifest}>
                Un point de freinage, une vitesse d&apos;apex. Ils se superposent chez vos pilotes
                consentis, attribués à vous. Des repères, jamais des consignes.
              </Text>
            </View>
            {isConsole ? (
              <Text style={s.superposed} accessibilityRole="text">
                SUPERPOSÉS CHEZ LE PILOTE
              </Text>
            ) : null}
          </View>

          <StateWrapper state={formState} skeletonLines={5}>
            {isConsole ? (
              <View style={s.columns}>
                <View style={s.colLeft}>
                  <SectionLabel>LES DEUX REPÈRES</SectionLabel>
                  <View style={{ marginTop: spacing.md }}>{form}</View>
                </View>
                <View style={s.colRight}>
                  <SectionLabel>APERÇU CÔTÉ PILOTE</SectionLabel>
                  <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
                    {preview}
                    {doctrine}
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.lg }}>
                <SectionLabel>LES DEUX REPÈRES</SectionLabel>
                <View style={{ marginTop: spacing.md }}>{form}</View>
                <View style={{ marginTop: spacing.xxl }}>
                  <SectionLabel>APERÇU CÔTÉ PILOTE</SectionLabel>
                  <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
                    {preview}
                    {doctrine}
                  </View>
                </View>
              </View>
            )}
          </StateWrapper>

          {backLink}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Aperçu côté pilote — reflète FIDÈLEMENT la section « Repère de votre coach » du
 * virage sur le bilan du pilote : voix ATTRIBUÉE (bande rouge §12), les deux
 * valeurs dans leur couleur QDI (freinage rouge, apex bleu) et le mot de
 * trajectoire. Chaque valeur trace vers un champ réel ; un champ vide n'apparaît
 * pas (pas de valeur inventée).
 */
function PreviewPanel({
  padded,
  brakingPointM,
  targetSpeedKmh,
  trajectoryNote,
}: {
  padded: string;
  brakingPointM: number | null;
  targetSpeedKmh: number | null;
  trajectoryNote: string;
}) {
  const empty = brakingPointM == null && targetSpeedKmh == null && trajectoryNote.length === 0;

  return (
    <Card>
      <Text style={s.previewLabel}>SON BILAN · SECTION COACH</Text>
      {empty ? (
        <Text style={s.previewEmpty}>
          Renseignez un repère pour prévisualiser ce que le pilote verra sur son bilan.
        </Text>
      ) : (
        <View style={s.attributed}>
          <Text style={s.attributedEyebrow}>REPÈRE DE VOTRE COACH · VIRAGE {padded}</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {brakingPointM != null ? (
              <PreviewValue
                color={dataColors.brake}
                label="Point de freinage"
                value={fr(brakingPointM)}
                caption="m avant la corde"
              />
            ) : null}
            {targetSpeedKmh != null ? (
              <PreviewValue
                color={dataColors.trajectory}
                label="Vitesse d'apex"
                value={fr(targetSpeedKmh)}
                caption="km/h"
              />
            ) : null}
          </View>
          {trajectoryNote.length > 0 ? (
            <Text style={s.attributedNote}>« {trajectoryNote} »</Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}

/** Une valeur repère : pastille + intitulé, puis le chiffre en mono coloré + unité. */
function PreviewValue({
  color,
  label,
  value,
  caption,
}: {
  color: string;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <View>
      <View style={s.previewValueHead}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[s.previewDot, { backgroundColor: color }]}
        />
        <Text style={s.previewValueLabel}>{label}</Text>
      </View>
      <Text style={s.previewValueNum}>
        <Text style={{ color }}>{value}</Text>
        <Text style={s.previewValueUnit}> {caption}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  // — En-tête —
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
    maxWidth: 520,
  },
  superposed: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginTop: spacing.sm,
  },

  // — Colonnes console —
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  colLeft: { flex: 1.15 },
  colRight: { flex: 1 },

  // — Marqueur de type (pastille + intitulé QDI) au-dessus d'un champ —
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  markDot: { width: 8, height: 8, borderRadius: 4 },
  markLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // — États de saisie —
  errorTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.red,
  },
  savedTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.green,
  },

  // — Aperçu côté pilote —
  previewLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  previewEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  // Bande attribuée = liseré rouge coach à gauche (§12 « voix attribuée »).
  attributed: {
    marginTop: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.06)',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  attributedEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.coachAccent,
  },
  previewValueHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  previewDot: { width: 7, height: 7, borderRadius: 4 },
  previewValueLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  previewValueNum: {
    fontFamily: fonts.king,
    fontSize: fontSize.value,
    letterSpacing: -0.5,
  },
  previewValueUnit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  attributedNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    lineHeight: fontSize.small * 1.5,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },

  // Rappel doctrinal — liseré gauche à l'identité coach (couleur de rôle §5),
  // jamais l'or de la maquette (réservé au chrono).
  doctrineCard: {
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
  },
  doctrineTxt: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.55,
  },

  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
});
