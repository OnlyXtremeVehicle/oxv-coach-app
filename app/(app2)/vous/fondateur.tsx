/**
 * MEMBRE FONDATEUR — candidature (app2), lot V2-L4 (Mission A, A2).
 *
 * Écran plein avec entrée porte. Insigne au trait qui SE DESSINE (Skia, 1,2 s),
 * manifeste « 30 membres. Jamais plus. », jauge x/30 réelle, motivation
 * (20-2000, compteur), code parrain optionnel (préchargé si `referrer` en
 * param). TRANSMETTRE → founderService.apply → état soumis + haptic('record').
 *
 * Flag 'founders' FAIL-CLOSED, vérifié SUR l'écran (leçon coach_billing) : OFF
 * → StateView vide, aucune écriture possible. Erreurs (validation, envoi)
 * affichées inline + haptic('warn'). Données réelles : jauge = founders_count(),
 * jamais un « 12/30 » codé en dur.
 *
 * DÉVIATION DOCTRINALE ASSUMÉE : l'insigne et la jauge sont rendus en tons
 * neutres (titane), PAS en or — `heritage.gold` reste exclusif au tier
 * Heritage (tokens.ts) ; l'unique accent de l'écran est le bouton TRANSMETTRE.
 */

import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  apply as applyFounder,
  getFoundersCount,
  getMyApplication,
} from '@/services/v2/founderService';
import {
  FOUNDER_MOTIVATION_MAX,
  founderStatusLabel,
  validateMotivation,
} from '@/services/v2/founderLogic';
import {
  colors,
  GlowStroke,
  haptic,
  OXV_ICONS,
  PressScale,
  radius,
  space,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';

import { foundersGauge, FOUNDERS_MAX } from '@/features/vous/vousHubLogic';

type FlagState = 'loading' | 'on' | 'off';

export default function FondateurScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const params = useLocalSearchParams<{ referrer?: string }>();
  const alive = useRef(true);

  const [flagState, setFlagState] = useState<FlagState>('loading');
  const [count, setCount] = useState<number | null>(null);
  const [motivation, setMotivation] = useState('');
  const [referrer, setReferrer] = useState(
    typeof params.referrer === 'string' ? params.referrer : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    alive.current = true;
    void (async () => {
      const [flagR, existingR, countR] = await Promise.allSettled([
        isFlagEnabled('founders'),
        getMyApplication(),
        getFoundersCount(),
      ]);
      if (!alive.current) return;
      // Fail-closed : toute panne de lecture du flag ferme l'écran.
      setFlagState(flagR.status === 'fulfilled' && flagR.value === true ? 'on' : 'off');
      // Compteur : null si inconnu (jauge masquée, jamais un « 0/30 » d'erreur).
      if (countR.status === 'fulfilled') setCount(countR.value);
      // Déjà candidat : on montre l'état terminal correspondant, jamais un
      // formulaire qui échouerait à l'insert (unicité par utilisateur) —
      //   pending/approved → « transmise » ; declined → « non retenue » (pas de
      //   re-candidature en impasse : l'insert unique 23505 échouerait).
      if (existingR.status === 'fulfilled' && existingR.value !== null) {
        const status = existingR.value.status;
        if (status === 'pending' || status === 'approved') setSubmitted(true);
        else if (status === 'declined') setDeclined(true);
      }
    })().catch(() => {
      if (alive.current) setFlagState('off');
    });
    return () => {
      alive.current = false;
    };
  }, []);

  const onSubmit = async () => {
    const check = validateMotivation(motivation);
    if (!check.ok) {
      setError(check.error ?? 'Votre motivation est invalide.');
      haptic('warn');
      return;
    }
    setError(null);
    setSubmitting(true);
    const ref = referrer.trim();
    const res = await applyFounder(motivation, ref.length > 0 ? ref : undefined);
    if (!alive.current) return;
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Votre candidature n'a pas pu être envoyée.");
      haptic('warn');
      return;
    }
    haptic('record');
    setSubmitted(true);
  };

  const gauge = count !== null ? foundersGauge(count) : null;

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top + space.sm }, door]}>
      <BackBar />

      {flagState === 'loading' ? (
        <View style={styles.centered}>
          <StateView state="loading" shape="list" />
        </View>
      ) : flagState === 'off' ? (
        <View style={styles.centered}>
          <StateView
            state="empty"
            emptyMessage="Les candidatures Membre Fondateur ouvriront prochainement."
          />
        </View>
      ) : declined ? (
        <View style={styles.centered}>
          <Insigne draw={false} />
          <Text style={styles.submittedTitle}>Candidature examinée.</Text>
          <Text style={styles.submittedBody}>{founderStatusLabel('declined')}</Text>
        </View>
      ) : submitted ? (
        <View style={styles.centered}>
          <Insigne draw={false} />
          <Text style={styles.submittedTitle}>Candidature transmise.</Text>
          <Text style={styles.submittedBody}>
            Votre candidature est en cours d&apos;examen. Vous serez tenu informé.
          </Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
            gap: space.lg,
          }}
        >
          <View style={styles.emblem}>
            <Insigne draw />
          </View>

          <Text style={styles.manifesto}>30 membres. Jamais plus.</Text>

          {/* Jauge seulement si le compteur est connu (jamais un « 0/30 » d'erreur). */}
          {gauge !== null ? (
            <View style={styles.gaugeBlock}>
              <View style={styles.gaugeTrack}>
                <View style={[styles.gaugeFill, { flex: gauge.filled }]} />
                <View style={{ flex: gauge.remaining }} />
              </View>
              <Text style={styles.gaugeLabel}>
                {`${gauge.filled}/${FOUNDERS_MAX} · ${gauge.remaining} place${
                  gauge.remaining > 1 ? 's' : ''
                } restante${gauge.remaining > 1 ? 's' : ''}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>VOTRE MOTIVATION</Text>
            <TextInput
              style={styles.input}
              value={motivation}
              onChangeText={setMotivation}
              placeholder="Pourquoi souhaitez-vous rejoindre les fondateurs ?"
              placeholderTextColor={colors.text.dim}
              multiline
              maxLength={FOUNDER_MOTIVATION_MAX}
              textAlignVertical="top"
              editable={!submitting}
              accessibilityLabel="Votre motivation"
            />
            <Text style={styles.counter}>
              {motivation.length}/{FOUNDER_MOTIVATION_MAX}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CODE PARRAIN (OPTIONNEL)</Text>
            <TextInput
              style={styles.inputSingle}
              value={referrer}
              onChangeText={setReferrer}
              placeholder="Si l'on vous a parrainé"
              placeholderTextColor={colors.text.dim}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!submitting}
              accessibilityLabel="Code parrain (optionnel)"
            />
          </View>

          {error !== null ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <PressScale
            onPress={onSubmit}
            disabled={submitting}
            accessibilityLabel="Transmettre votre candidature"
            containerStyle={styles.submitWrap}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            <Text style={styles.submitLabel}>{submitting ? 'ENVOI…' : 'TRANSMETTRE'}</Text>
          </PressScale>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Barre de retour — l'écran est poussé sur la pile (Stack sans header natif).
// ---------------------------------------------------------------------------

function BackBar() {
  return (
    <View style={styles.backBar}>
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        // La pill fait ~42 pt de haut : hitSlop 8 la porte au-delà de 44 × 44.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.backPill}
      >
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backLabel}>Retour</Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Insigne au trait — se dessine (GlowStroke Skia, progress 0→1 sur 1,2 s).
// Neutre (titane), jamais or : l'or reste exclusif au tier Heritage.
// ---------------------------------------------------------------------------

const INSIGNE_SIZE = 76;

function Insigne({ draw }: { draw: boolean }) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(draw && !reduce ? 0 : 1);

  useEffect(() => {
    if (!draw || reduce) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) });
  }, [draw, reduce, progress]);

  const scale = INSIGNE_SIZE / 24;

  return (
    <Canvas
      style={{ width: INSIGNE_SIZE, height: INSIGNE_SIZE }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Group transform={[{ scale }]}>
        {OXV_ICONS.insigne.map((d, i) => (
          <GlowStroke
            key={i}
            path={d}
            color={colors.text.hi}
            glowColor={colors.border.strong}
            strokeWidth={1.5}
            glowRadius={3}
            progress={progress}
          />
        ))}
      </Group>
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.lg,
  },

  // Barre de retour
  backBar: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
    paddingRight: space.md,
  },
  backChevron: {
    fontFamily: typo.body,
    fontSize: 22,
    color: colors.text.mid,
    marginTop: -2,
  },
  backLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.mid,
  },

  // Insigne + manifeste
  emblem: {
    alignItems: 'center',
    marginTop: space.lg,
  },
  manifesto: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 0.5,
    lineHeight: 30,
    color: colors.text.hi,
    textAlign: 'center',
  },

  // Jauge x/30
  gaugeBlock: {
    gap: space.sm,
    marginTop: space.sm,
  },
  gaugeTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bg.card2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  gaugeFill: {
    backgroundColor: colors.text.mid,
    borderRadius: radius.pill,
  },
  gaugeLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.text.mid,
    textAlign: 'center',
  },

  // Champs
  field: {
    gap: space.sm,
  },
  fieldLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  input: {
    minHeight: 128,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    padding: space.md,
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
  },
  inputSingle: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: typo.mono,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  counter: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.dim,
    textAlign: 'right',
  },

  error: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.hi,
  },

  // TRANSMETTRE — l'unique accent de l'écran
  submitWrap: {
    marginTop: space.sm,
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.55,
  },
  submitLabel: {
    fontFamily: typo.monoSemi,
    fontSize: 14,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },

  // État soumis
  submittedTitle: {
    fontFamily: typo.bodySemi,
    fontSize: 18,
    color: colors.text.hi,
    textAlign: 'center',
  },
  submittedBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    textAlign: 'center',
    maxWidth: 280,
  },
});
