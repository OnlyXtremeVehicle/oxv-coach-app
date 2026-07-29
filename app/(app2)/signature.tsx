/**
 * SIGNATURE — écran 3/3 du lot V2-L1 (porte Miroir), route NOUVELLE.
 *
 * Le grand radar QDI (RadarQdi l, entrée théâtrale du composant : tracé
 * 600 ms + sommets qui claquent) porte les libellés Cap · Trajectoire ·
 * Visée · Plongée · Anticipation — mapping SÉMANTIQUE intérimaire documenté
 * dans signatureLogic (TODO_ARBITRAGE fondateur) : « Trajectoire » désigne la
 * branche trajectoire, comme sur l'accueil et le Bilan — un mot = une donnée.
 * Branches nulles masquées + mention « x/5 axes mesurés ». En dessous,
 * l'Empreinte : mini-radars mensuels (listMonthlyQdi) en FlashList
 * horizontale ; toucher un mois = le grand radar se MORPHE vers les valeurs
 * du mois (interpolation lerpRadar des 5 sommets, spring maison) ; second
 * toucher = retour à la fenêtre 30 jours.
 *
 * VOIE DU MORPH (documentée, décision L1 + correctif V2-L1) : ÉTAT RE-RENDU
 * piloté par withSpring. RadarQdi consomme une prop `values` en JS pur
 * (useMemo → radarLayout) : une valeur animée Reanimated ne peut pas la
 * traverser sans re-rendu. On anime donc une progression 0 → 1 en withSpring
 * (motionTokens.spring — le spring maison) sur l'UI thread, et
 * useAnimatedReaction → runOnJS ré-applique lerpRadar(from, to, p) dans un
 * état LOCAL au composant MorphingRadar : seuls le petit canvas Skia et ses
 * 5 sommets re-rendent. Correctif V2-L1 : le pont UI → JS est ÉCHANTILLONNÉ
 * à ~30 Hz (pas de progression MORPH_JS_STEP, ~12 re-rendus par morph au lieu
 * de ~24-40 à la cadence brute du spring) — le claquement final reste exact
 * (p = 1 traverse toujours, jamais une valeur approchée). L'overshoot du
 * spring est écrêté par lerpRadar (t borné [0,1]). Limite assumée : la preuve
 * profiler sur appareil (release, Android milieu de gamme) reste due avant la
 * fermeture du lot ; si insuffisant, piste suivante = sommets en SharedValues
 * consommées par Skia sans re-rendu React (interop Reanimated-Skia).
 *
 * Pilier physiologique BIO-4 : section GATÉE drapeau 'biometry' + consentement
 * + ≥ 3 séances avec données (fail-closed, useSignature) — OFF aujourd'hui,
 * rend null, zéro teasing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { QdiBranches } from '@/services/qdiLogic';
import type { MonthlyQdi } from '@/services/qdiService';
import {
  CondensingHeaderBar,
  ListRow,
  PillarBar,
  PressScale,
  RadarQdi,
  SectionHeader,
  StateView,
  colors,
  motionTokens,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';
import {
  branchesEqual,
  branchesToRadarValues,
  defaultSelection,
  formatMeasuredAxes,
  lerpRadar,
  measuredAxesCount,
  PHYSIO_PILLAR_LABEL,
  selectionBranches,
  selectionCaption,
  SIGNATURE_LABEL_BY_BRANCH,
  toggleMonth,
  type SignatureSelection,
} from '@/features/miroir/signatureLogic';
import { useSignature } from '@/features/miroir/useSignature';

/** Hauteur de la bande Empreinte (mini-radar + libellé + padding carte). */
const MONTH_STRIP_HEIGHT = 212;

// ---------------------------------------------------------------------------
// MorphingRadar — le grand radar vivant (voie « état re-rendu », cf. en-tête)
// ---------------------------------------------------------------------------

/**
 * Pas minimal de progression entre deux traversées runOnJS : ~12 pas sur un
 * morph ≈ 400 ms, soit ~30 Hz de re-rendus JS au lieu de la cadence brute du
 * spring (~60 im/s). Le claquement final (p = 1) traverse toujours, exact.
 */
const MORPH_JS_STEP = 1 / 12;

function MorphingRadar({ target }: { target: QdiBranches }) {
  const reduce = useReduceMotion();
  // displayed est initialisé sur la PREMIÈRE cible réelle : l'entrée
  // théâtrale de RadarQdi (600 ms + claquements) joue sur les vraies valeurs.
  const [displayed, setDisplayed] = useState<QdiBranches>(target);
  const displayedRef = useRef(target);
  const fromRef = useRef(target);
  const toRef = useRef(target);
  const progress = useSharedValue(1);
  // Dernière progression traversée vers JS (échantillonnage, cf. reaction).
  const lastSent = useSharedValue(1);

  const applyProgress = useCallback((p: number) => {
    const next = lerpRadar(fromRef.current, toRef.current, p);
    displayedRef.current = next;
    setDisplayed(next);
  }, []);

  useEffect(() => {
    if (branchesEqual(toRef.current, target)) return;
    fromRef.current = displayedRef.current;
    toRef.current = target;
    if (reduce) {
      // Reduce-motion : état final immédiat, aucun vol.
      cancelAnimation(progress);
      progress.value = 1;
      lastSent.value = 1;
      applyProgress(1);
      return;
    }
    lastSent.value = -1;
    progress.value = 0;
    progress.value = withSpring(1, motionTokens.spring);
  }, [target, reduce, applyProgress, progress, lastSent]);

  // Hygiène unmount (correctif V2-L1) : stoppe le spring orphelin — le
  // setState post-unmount est déjà un no-op React 18, mais on ne laisse pas
  // l'UI thread animer à vide.
  useEffect(() => () => cancelAnimation(progress), [progress]);

  // Échantillonnage ~30 Hz du pont UI → JS (correctif V2-L1, cf. en-tête) :
  // on ne traverse runOnJS (setState + radarLayout + redraw Skia) que tous les
  // MORPH_JS_STEP de progression. p ≥ 1 traverse TOUJOURS, avec exactement 1
  // (claquement final exact) ; après lui, les oscillations de settle du spring
  // (clampées à 1 ou repassant sous 1) ne re-traversent plus — pas de
  // tremblement rétrograde après l'arrivée.
  useAnimatedReaction(
    () => progress.value,
    (p) => {
      const clamped = p >= 1 ? 1 : p <= 0 ? 0 : p;
      if (clamped === lastSent.value) return;
      if (clamped !== 1 && clamped - lastSent.value < MORPH_JS_STEP) return;
      lastSent.value = clamped;
      runOnJS(applyProgress)(clamped);
    },
    [applyProgress]
  );

  return (
    <RadarQdi
      size="l"
      values={branchesToRadarValues(displayed)}
      labels={SIGNATURE_LABEL_BY_BRANCH}
    />
  );
}

// ---------------------------------------------------------------------------
// Chevron retour (aucune flèche dans le registre d'icônes — trait local 24×24)
// ---------------------------------------------------------------------------

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function SignatureScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { scrollHandler, headerStyle, condensedStyle, titleStyle } = useCondensingHeader();
  const { status, baseline, monthly, physioVisible, reload } = useSignature();

  const [selection, setSelection] = useState<SignatureSelection | null>(null);
  const hasBaseline = baseline !== null;
  const effectiveSelection = selection ?? defaultSelection(hasBaseline, monthly);
  const target = selectionBranches(effectiveSelection, baseline?.branches ?? null, monthly);
  const axes = measuredAxesCount(target);
  const hasContent = hasBaseline || monthly.length > 0;

  // Toucher un mois morphe le grand radar et change sa légende, plus HAUT
  // dans l'écran : le focus reste sur la cellule du mois et rien n'est perçu.
  // On annonce la légende RÉELLE, celle qui s'affiche — aucun texte ajouté.
  const legende = selectionCaption(effectiveSelection, monthly);
  const premiereLegende = useRef(true);
  useEffect(() => {
    if (premiereLegende.current) {
      premiereLegende.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(legende);
  }, [legende]);

  const onMonthPress = useCallback(
    (monthKey: string) => {
      setSelection((prev) =>
        toggleMonth(prev ?? defaultSelection(hasBaseline, monthly), monthKey, hasBaseline)
      );
    },
    [hasBaseline, monthly]
  );

  const renderMonth = useCallback(
    ({ item, index }: { item: MonthlyQdi; index: number }) => {
      const selected =
        effectiveSelection.kind === 'month' && effectiveSelection.monthKey === item.monthKey;
      return (
        <Animated.View entering={staggerEntering(index)} style={styles.monthCell}>
          <PressScale
            onPress={() => onMonthPress(item.monthKey)}
            accessibilityLabel={`Signature de ${item.monthLabel}`}
            accessibilityState={{ selected }}
            style={[styles.monthCard, selected && styles.monthCardSelected]}
          >
            <RadarQdi size="s" values={branchesToRadarValues(item.branches)} />
            {/* UN accent rouge par zone : le mois sélectionné, rien d'autre. */}
            <Text style={[styles.monthLabel, selected && styles.monthLabelSelected]}>
              {item.monthLabel}
            </Text>
          </PressScale>
        </Animated.View>
      );
    },
    [effectiveSelection, onMonthPress]
  );

  return (
    <Animated.View style={[styles.root, door]}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header déployé — s'efface au défilement (patron Airbnb). */}
        <Animated.View style={[styles.header, headerStyle]}>
          <Animated.Text style={[styles.title, titleStyle]} accessibilityRole="header">
            SIGNATURE
          </Animated.Text>
        </Animated.View>

        {status === 'loading' ? (
          // Le squelette n'est que du Shimmer, masqué aux lecteurs d'écran :
          // sans ce libellé, l'écran est annoncé vide, sans dire qu'il charge.
          <View
            style={styles.body}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Chargement de votre signature"
          >
            <StateView state="loading" shape="radar" />
            <StateView state="loading" shape="card" style={styles.sectionGap} />
          </View>
        ) : status === 'error' ? (
          <View style={styles.body}>
            <StateView
              state="error"
              errorMessage="Votre signature n'a pas pu être chargée."
              onRetry={reload}
            />
          </View>
        ) : !hasContent ? (
          <View style={styles.body}>
            <StateView
              state="empty"
              emptyMessage="Votre signature se dessine à partir de vos tours. Elle apparaîtra après votre premier roulage analysé."
            />
          </View>
        ) : (
          <View style={styles.body}>
            {/* Le grand radar — plein largeur, entrée théâtrale, morph vivant. */}
            <View style={styles.radarZone}>
              <MorphingRadar target={target} />
              {/* Même chaîne que l'annonce : ce qui est lu est ce qui est écrit. */}
              <Text style={styles.caption}>{legende}</Text>
              {axes < 5 ? <Text style={styles.axesNote}>{formatMeasuredAxes(axes)}</Text> : null}
            </View>

            {/* EMPREINTE — mini-radars mensuels, morph du grand radar au toucher. */}
            {monthly.length > 0 ? (
              <View style={styles.sectionGap}>
                <SectionHeader eyebrow="EMPREINTE" count={monthly.length} />
                <View style={styles.monthStrip}>
                  <FlashList
                    horizontal
                    data={monthly}
                    keyExtractor={(m) => m.monthKey}
                    renderItem={renderMonth}
                    showsHorizontalScrollIndicator={false}
                    extraData={effectiveSelection}
                    contentContainerStyle={styles.monthStripContent}
                  />
                </View>
              </View>
            ) : null}

            {/* Pilier physiologique BIO-4 — gaté fail-closed (useSignature),
                OFF aujourd'hui : rien n'est rendu, zéro teasing. La valeur du
                pilier n'est pas encore calculée → « — », jamais inventée. */}
            {physioVisible ? (
              <View style={styles.sectionGap}>
                <SectionHeader eyebrow="PILIER PHYSIOLOGIQUE" />
                <PillarBar label={PHYSIO_PILLAR_LABEL} value={null} style={styles.pillar} />
              </View>
            ) : null}

            {/* Saison complète — la cible est DÉFINITIVE depuis la fusion du
                jalon 4 : « le hub Data devient la Saison, data/saison fusionne
                et disparaît ». Ce n'est plus un renvoi provisoire. */}
            <View style={styles.sectionGap}>
              <ListRow
                icon="data"
                label="Voir la saison complète"
                onPress={() => router.navigate('/(app2)/data' as never)}
                divider={false}
              />
            </View>
          </View>
        )}
      </Animated.ScrollView>

      {/* Barre condensée (blur) — prend le relais au défilement. */}
      <CondensingHeaderBar condensedStyle={condensedStyle} height={insets.top + 52}>
        <View style={{ paddingTop: insets.top }}>
          {/* Titre condensé ANNONCÉ (cf. app/(app2)/index.tsx) : sur iOS,
              VoiceOver ignore les vues d'opacité nulle, donc le grand titre fondu
              n'est plus lu — masquer celui-ci laisserait l'écran sans titre. */}
          <Text style={styles.condensedTitle} accessibilityRole="header">
            SIGNATURE
          </Text>
        </View>
      </CondensingHeaderBar>

      {/* Retour — au-dessus de la barre condensée, toujours accessible. */}
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        containerStyle={[styles.back, { top: insets.top + space.md }]}
        // Chevron 22 × 22 : hitSlop 11 porte la cible à 44 × 44.
        hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
      >
        <BackChevron />
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  condensedTitle: {
    fontFamily: typo.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  back: {
    position: 'absolute',
    left: space.lg,
    zIndex: 20,
  },
  body: {
    paddingHorizontal: space.xl,
  },
  radarZone: {
    alignItems: 'center',
  },
  caption: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text.mid,
    textAlign: 'center',
    marginTop: space.md,
  },
  axesNote: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.low,
    textAlign: 'center',
    marginTop: space.xs,
  },
  sectionGap: {
    marginTop: space.xxl,
  },
  monthStrip: {
    height: MONTH_STRIP_HEIGHT,
    marginTop: space.md,
    // La bande déborde du padding d'écran pour défiler bord à bord.
    marginHorizontal: -space.xl,
  },
  monthStripContent: {
    paddingHorizontal: space.xl,
  },
  monthCell: {
    marginRight: space.md,
  },
  monthCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: space.md,
    alignItems: 'center',
    gap: space.sm,
  },
  monthCardSelected: {
    borderColor: colors.accent,
  },
  monthLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.mid,
  },
  monthLabelSelected: {
    color: colors.accent,
  },
  pillar: {
    marginTop: space.md,
  },
});
