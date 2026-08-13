/**
 * Coach — « Ma lecture » (§10.3c-D), RESKIN refonte-v2 §12, RESPONSIVE deux
 * formats (décision fondateur 2026-07-13, handoff coach/09-ma-lecture).
 *
 * Le coach pondère les sous-composantes DÉJÀ calculées par OXV (véhicule,
 * pilote, régularité, fluidité). L'app en dérive « La lecture de votre coach »,
 * présentée SÉPARÉMENT chez l'élève — jamais à la place de la marge OXV.
 *
 *  - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes fidèles
 *    à la maquette — l'éditeur de la grille (4 barres pondérées + note) à gauche,
 *    l'aperçu « votre grille » (où elle apparaît chez le pilote) à droite.
 *  - COMPAGNON téléphone : la même matière, empilée en une colonne.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Adaptation données réelles : la maquette étiquette ses barres avec des libellés
 * QDI (Trajectoire/Freinage/Accélération) — mais le modèle réel (coachReadingLogic)
 * pondère quatre composantes de MARGE : Véhicule · Pilote · Régularité · Fluidité.
 * On garde ces quatre-là. Régularité et Fluidité SONT des branches QDI → leur
 * couleur fixe (violet / jaune). Véhicule et Pilote ne sont pas des branches QDI
 * → ton neutre (jamais emprunter une couleur QDI qui appartient à une autre
 * donnée). Les barres montrent la PART NORMALISÉE de chaque poids (dérivée réelle
 * des saisies, même normalisation que computeCoachReading). L'aperçu ne fabrique
 * aucune note : sans breakdown pilote chargé ici, aucun pourcentage n'est inventé.
 *
 * Logique (pondérations, validation, upsert) inchangée. L'or reste au chrono ;
 * aucun ici. Descriptif, jamais prescriptif : le coach lit, l'app ne dirige pas.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { DEFAULT_READING_WEIGHTS, validateReadingWeights } from '@/services/coachReadingLogic';
import { getMyReadingWeights, upsertReadingWeights } from '@/services/coachReadingService';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, dataColors, spacing, fonts, fontSize, radius } = theme;

/** Poids saisi → nombre ≥ 0 (mêmes règles que computeCoachReading : NaN/<0 → 0). */
function toWeight(s: string): number {
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Part normalisée (0..100) de chaque poids, ou null si tout est nul. Purement
 *  dérivé des saisies — la même normalisation que la lecture du coach. */
function normalizedShares(values: string[]): (number | null)[] {
  const nums = values.map(toWeight);
  const total = nums.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => null);
  return nums.map((n) => Math.round((n / total) * 100));
}

export default function CoachLectureScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [vehicle, setVehicle] = useState(String(DEFAULT_READING_WEIGHTS.wVehicle));
  const [pilot, setPilot] = useState(String(DEFAULT_READING_WEIGHTS.wPilot));
  const [constance, setConstance] = useState(String(DEFAULT_READING_WEIGHTS.wConsistency));
  const [smoothness, setSmoothness] = useState(String(DEFAULT_READING_WEIGHTS.wSmoothness));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getMyReadingWeights()
      .then((w) => {
        if (cancelled) return;
        if (w) {
          setVehicle(String(w.wVehicle));
          setPilot(String(w.wPilot));
          setConstance(String(w.wConsistency));
          setSmoothness(String(w.wSmoothness));
          setNote(w.note ?? '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const state: ScreenState = loading ? 'loading' : loadError ? 'error' : 'nominal';

  function parseW(s: string): number {
    const n = Number(s.trim().replace(',', '.'));
    return Number.isNaN(n) ? -1 : n;
  }

  async function onSave() {
    const input = {
      wVehicle: parseW(vehicle),
      wPilot: parseW(pilot),
      wConsistency: parseW(constance),
      wSmoothness: parseW(smoothness),
      note: note.trim() || null,
    };
    const validationError = validateReadingWeights(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    const result = await upsertReadingWeights(input);
    setSaving(false);
    if (result) setSaved(true);
    else setError("L'enregistrement a échoué. Réessayez dans un instant.");
  }

  // Quatre composantes RÉELLES de la lecture (coachReadingLogic). Couleur = QDI
  // fixe si la composante est une branche QDI, neutre sinon (cf. en-tête).
  const shares = normalizedShares([vehicle, pilot, constance, smoothness]);

  /*
    LES QUATRE POIDS PORTENT LA MÊME TEINTE — corrigé le 14/08/2026.

    « Constance » prenait `dataColors.regularity` et « Fluidité »
    `dataColors.flow` : deux teintes de BRANCHES QDI, posées sur des
    sous-composantes de la MARGE qui ne sont pas ces branches.

    Le canon est explicite — « couleurs QDI = données uniquement » — et l'emprunt
    rejouait en couleur l'homonymie qu'on venait de retirer des mots : le violet
    de la branche `regularite` sur une constance qui vaut 0 quand la branche vaut
    34, sur la même séance.

    La couleur ne distinguait d'ailleurs rien de fiable : véhicule et pilote
    partageaient DÉJÀ `palette.secondary`. Deux rangs sur quatre teintés, deux
    non — ce n'était pas un code, c'était un reste.

    Ces quatre lignes sont des RÉGLAGES, pas des données. Le libellé et la valeur
    les distinguent, comme ils le faisaient déjà pour les deux premières.
  */
  const components = [
    {
      key: 'vehicle',
      label: 'Véhicule',
      value: vehicle,
      onChange: setVehicle,
      color: palette.secondary,
    },
    { key: 'pilot', label: 'Pilote', value: pilot, onChange: setPilot, color: palette.secondary },
    {
      // « Constance » et non « Régularité » : cette pondération porte sur
      // `margin_breakdown.consistency`, la dispersion des TEMPS au tour — pas
      // sur la branche QDI `regularite`, qui mesure autre chose et vaut un
      // autre chiffre sur la même séance. Le mot suit la mesure.
      key: 'consistency',
      label: 'Constance',
      value: constance,
      onChange: setConstance,
      color: palette.secondary,
    },
    {
      key: 'smoothness',
      label: 'Fluidité',
      value: smoothness,
      onChange: setSmoothness,
      color: palette.secondary,
    },
  ].map((c, i) => ({ ...c, share: shares[i] }));

  const editor = (
    <View>
      <View style={{ gap: spacing.sm }}>
        {components.map((c) => (
          <WeightRow
            key={c.key}
            label={c.label}
            value={c.value}
            onChange={(t) => {
              c.onChange(t);
              setSaved(false);
            }}
            color={c.color}
            share={c.share}
          />
        ))}
      </View>
      <Text style={s.groupHelper}>
        Poids relatifs, 0 ou plus. Les barres montrent la part de chaque composante dans votre
        lecture.
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <Field
          label="Note"
          optional
          value={note}
          onChangeText={(t) => {
            setNote(t);
            setSaved(false);
          }}
          placeholder="Ce que votre lecture met en avant."
          multiline
          maxLength={280}
          showCounter
        />
      </View>

      {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      {saved ? <Text style={s.savedTxt}>Lecture enregistrée.</Text> : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button label="Enregistrer" onPress={onSave} loading={saving} />
      </View>
    </View>
  );

  const preview = <PreviewPanel note={note} />;

  return (
    <Screen scroll={false}>
      <AppBar title="LECTURE" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>
          <Text style={s.eyebrow}>Ma lecture</Text>
          <Text style={s.title} accessibilityRole="header">
            Comment vous pondérez votre grille.
          </Text>
          <Text style={s.subtitle}>Affichée séparément, en plus du QDI neutre.</Text>

          <StateWrapper
            state={state}
            skeletonLines={5}
            errorCause="Votre grille de lecture n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {isConsole ? (
              // Console : éditeur à gauche, aperçu de la grille à droite.
              <View style={s.consoleRow}>
                <View style={{ flex: 1.4 }}>{editor}</View>
                <View style={{ flex: 1 }}>{preview}</View>
              </View>
            ) : (
              // Compagnon : une colonne, l'aperçu sous l'éditeur.
              <View style={{ gap: spacing.xl }}>
                {editor}
                {preview}
              </View>
            )}
          </StateWrapper>

          <Text style={s.doctrine}>
            Votre grille éclaire la marge OXV, à côté du QDI neutre. Elle ne la remplace pas.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── Barre pondérée éditable : dot + libellé + saisie du poids, part en dessous ──

function WeightRow({
  label,
  value,
  onChange,
  color,
  share,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  color: string;
  share: number | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.weightCard}>
      <View style={s.weightTop}>
        <View style={s.dotLabel}>
          <View style={[s.dot, { backgroundColor: color }]} />
          <Text style={s.compLabel}>{label}</Text>
        </View>
        <View style={[s.inputWrap, { borderColor: focused ? palette.gold : palette.line }]}>
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType="numeric"
            maxLength={5}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={`Poids ${label}`}
            placeholderTextColor={palette.faint}
            style={s.input}
          />
        </View>
      </View>
      <View
        style={s.barRow}
        accessible
        accessibilityLabel={
          share != null ? `${label} : ${share} % de votre lecture` : `${label} : part non définie`
        }
      >
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${share ?? 0}%`, backgroundColor: color }]} />
        </View>
        <Text style={[s.share, { color: share != null ? color : palette.creamMute }]}>
          {share != null ? `${share} %` : '—'}
        </Text>
      </View>
    </View>
  );
}

// ── Aperçu : où la grille apparaît chez le pilote (aucun grade fabriqué) ───────

function PreviewPanel({ note }: { note: string }) {
  const trimmed = note.trim();
  return (
    <CockpitPanel plain style={s.previewPanel}>
      <Text style={s.previewLabel}>Votre grille</Text>
      <Text style={s.previewBody}>
        « La lecture de votre coach » apparaît sur le bilan de chaque pilote consenti, à côté du QDI
        neutre — jamais à sa place.
      </Text>
      {trimmed ? (
        <Text style={s.previewNote}>« {trimmed} »</Text>
      ) : (
        <Text style={s.previewPlaceholder}>
          Une note dira à vos pilotes ce que votre lecture met en avant.
        </Text>
      )}
      <Text style={s.previewMeta}>
        Le résultat est un pourcentage, dérivé de vos poids pour chaque pilote.
      </Text>
    </CockpitPanel>
  );
}

const s = StyleSheet.create({
  // En-tête
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },

  // Layout console
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },

  // Barre pondérée
  weightCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  weightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
    minHeight: 44,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.mono,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.surface3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  share: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    minWidth: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  groupHelper: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
  },

  // Messages de sauvegarde
  errorTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.red,
    marginTop: spacing.md,
  },
  savedTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: dataColors.accel,
    marginTop: spacing.md,
  },

  // Aperçu de la grille
  previewPanel: {
    gap: spacing.md,
  },
  previewLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  previewBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.55,
  },
  previewNote: {
    fontFamily: fonts.serifItalic,
    fontStyle: 'italic',
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    lineHeight: fontSize.bodyLg * 1.5,
  },
  previewPlaceholder: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  previewMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.eyebrow,
    lineHeight: 16,
  },

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
