/**
 * Coach — Repères de virage MULTI-CIRCUIT. Reskin refonte-v2 §12, RESPONSIVE
 * deux formats. Demande fondateur build 23 : « choisir le circuit avant, page
 * personnalisée selon le circuit — 14 virages ou 7 ».
 *
 * Le coach choisit d'abord le CIRCUIT (sélecteur en tête : cartes avec
 * mini-tracé réel), puis pose, virage par virage, un point de freinage repère
 * (rouge) et une vitesse d'apex repère (bleu). Ces repères appartiennent à CE
 * circuit (coach_corner_reference, clé coach + circuit + virage — migration
 * 20260716180000) : ils se superposent chez ses pilotes consentis, ATTRIBUÉS
 * à lui — jamais une consigne de l'app (doctrine miroir, §12 garde-fous).
 *
 * Les virages affichés sont RÉELS, personnalisés par circuit
 * (src/circuit/circuitCorners) :
 *   - Haute Saintonge → 7 virages NOMMÉS (topologie Beltoise existante) ;
 *   - autre circuit  → virages dérivés du tracé réel en base (détection de
 *     courbure), libellés « Virage N (gauche/droite) » — Valence en sort 14 ;
 *   - pas de centerline → EmptyState honnête, aucun virage inventé.
 * Le compteur « X repères posés sur N virages » est un compteur RÉEL par
 * circuit (repères enregistrés croisés avec les virages listés).
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : sélecteur en
 *     tête pleine largeur, puis deux colonnes — la file des virages à gauche,
 *     un panneau latéral (circuit choisi + nature des repères + rappel
 *     doctrinal) à droite.
 *   - COMPAGNON téléphone : une colonne, sélecteur puis file puis rappel.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Couleurs QDI fixes : freinage = rouge de donnée (#F65B5B), apex/trajectoire
 * = bleu (#4F9DF7). Identité coach = rouge d'accent (#E23A4E). Aucun or
 * (réservé au chrono/record). Transitions : LayoutAnimation au changement de
 * circuit + fondu (FadeInSection) sur la nouvelle file. Données réelles :
 * fetchCircuits / cornersForCircuit / listMyCornerReferences (RLS) ; un virage
 * sans repère affiche « Aucun repère posé ».
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import Svg, { Path } from 'react-native-svg';

import { type CircuitCorner, cornersForCircuit } from '@/circuit/circuitCorners';
import { EmptyState } from '@/components/instruments';
import { FadeInSection } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type Circuit, fetchCircuits } from '@/services/circuitsService';
import {
  type CoachCornerReference,
  countCornersWithReference,
  referenceHasContent,
} from '@/services/coachReferenceLogic';
import { listMyCornerReferences } from '@/services/coachReferenceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

// LayoutAnimation (changement de circuit) — même pattern que bilan/index.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Transition sobre du corps de l'écran quand le circuit change. */
function animateCircuitSwitch() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      220,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
}

/**
 * Circuit par défaut du sélecteur — même préférence que getDefaultCircuit
 * (le défaut explicite, sinon l'officiel principal hors « BACKUP »).
 */
function pickDefaultCircuitId(circuits: Circuit[]): string | null {
  const preferred =
    circuits.find((c) => c.isDefault) ??
    circuits.find((c) => !c.name.toUpperCase().includes('BACKUP')) ??
    circuits[0] ??
    null;
  return preferred ? preferred.id : null;
}

/** Sous-titre factuel d'un circuit (longueur · virages officiels). Réel ou rien. */
function circuitMeta(circuit: Circuit): string {
  const parts: string[] = [];
  if (circuit.lengthKm != null) parts.push(`${circuit.lengthKm} km`.replace('.', ','));
  if (circuit.turnsCount != null) parts.push(`${circuit.turnsCount} virages`);
  return parts.join(' · ');
}

/** « X repères posés sur N virages » — accords réels, jamais un compte gonflé. */
function placedLabel(placed: number, total: number): string {
  const left = placed > 1 ? `${placed} repères posés` : `${placed} repère posé`;
  return `${left} sur ${total} virage${total > 1 ? 's' : ''}`;
}

export default function CoachReperesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  // — Sélecteur de circuit (annuaire réel) —
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [circuitsLoading, setCircuitsLoading] = useState(true);
  const [circuitsError, setCircuitsError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // — File des virages + repères du circuit choisi —
  const [corners, setCorners] = useState<CircuitCorner[]>([]);
  const [byIndex, setByIndex] = useState<Map<number, CoachCornerReference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadCircuits = useCallback(() => {
    let cancelled = false;
    setCircuitsLoading(true);
    setCircuitsError(false);
    fetchCircuits()
      .then((all) => {
        if (cancelled) return;
        const officials = all.filter((c) => c.isOfficial);
        setCircuits(officials);
        setSelectedId((prev) =>
          prev && officials.some((c) => c.id === prev) ? prev : pickDefaultCircuitId(officials)
        );
        setCircuitsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCircuitsError(true);
          setCircuitsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(loadCircuits);

  const selected = useMemo(
    () => circuits.find((c) => c.id === selectedId) ?? null,
    [circuits, selectedId]
  );

  // Virages + repères du circuit choisi. Se recharge au retour de l'éditeur
  // (le focus rafraîchit l'annuaire, donc l'identité de `selected`).
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([cornersForCircuit(selected), listMyCornerReferences(selected.id)])
      .then(([circuitCorners, rows]) => {
        if (!cancelled) {
          setCorners(circuitCorners);
          setByIndex(new Map(rows.map((r) => [r.cornerIndex, r])));
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
  }, [selected]);

  const onSelectCircuit = useCallback((id: string) => {
    animateCircuitSwitch();
    setSelectedId(id);
  }, []);

  const placed = useMemo(
    () =>
      countCornersWithReference(
        Array.from(byIndex.values()),
        corners.map((c) => c.index)
      ),
    [byIndex, corners]
  );

  const circuitsState: ScreenState = circuitsLoading
    ? 'loading'
    : circuitsError
      ? 'error'
      : 'nominal';
  const listState: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  // — Sélecteur de circuit : cartes avec mini-tracé réel —
  const selector = (
    <StateWrapper
      state={circuitsState}
      skeletonLines={2}
      errorCause="L'annuaire des circuits n'a pas pu être chargé."
      onRetry={loadCircuits}
    >
      {circuits.length === 0 ? (
        <EmptyState
          label="Aucun circuit"
          message="Les circuits référencés apparaîtront ici."
          source="circuits"
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm + 2, paddingVertical: 2 }}
        >
          {circuits.map((circuit) => (
            <CircuitChoice
              key={circuit.id}
              circuit={circuit}
              selected={circuit.id === selectedId}
              onPress={() => onSelectCircuit(circuit.id)}
            />
          ))}
        </ScrollView>
      )}
    </StateWrapper>
  );

  // — Compteur réel + file des virages du circuit choisi —
  const list = selected ? (
    <StateWrapper
      state={listState}
      skeletonLines={5}
      errorCause="Vos repères n'ont pas pu être chargés."
      onRetry={loadCircuits}
    >
      <FadeInSection key={selected.id}>
        {corners.length === 0 ? (
          <EmptyState
            label="En attente"
            message="Tracé du circuit indisponible. Ses virages apparaîtront dès que sa géométrie sera enregistrée."
            source="circuits.centerline_latlon"
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            <PlacedCounter placed={placed} total={corners.length} />
            {corners.map((corner) => {
              const reference = byIndex.get(corner.index);
              const filled = reference ? referenceHasContent(reference) : false;
              return (
                <Card
                  key={corner.index}
                  onPress={() =>
                    router.push({
                      pathname: '/(coach)/repere/[index]',
                      params: { index: String(corner.index), circuitId: selected.id },
                    } as never)
                  }
                  accessibilityLabel={`${corner.name}, repère ${filled ? 'à modifier' : 'à ajouter'}`}
                  style={[
                    s.cornerCard,
                    { borderColor: filled ? palette.coachAccent : palette.line },
                  ]}
                >
                  <View
                    style={[s.cornerBadge, filled && s.cornerBadgeFilled]}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    <Text style={[s.cornerNum, filled && { color: palette.coachAccent }]}>
                      {String(corner.index).padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={s.cornerMain}>
                    <Text style={s.cornerName} numberOfLines={1}>
                      {corner.name}
                    </Text>
                    {filled && reference ? (
                      <ReferenceChips reference={reference} />
                    ) : (
                      <Text style={s.cornerEmpty}>Aucun repère posé</Text>
                    )}
                  </View>
                  <Text
                    style={[s.action, { color: filled ? palette.coachAccent : palette.creamMute }]}
                  >
                    {filled ? 'Modifier' : 'Ajouter'}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}
      </FadeInSection>
    </StateWrapper>
  ) : null;

  const aside = (
    <ReperesAside
      circuit={selected}
      placed={placed}
      total={corners.length}
      ready={!loading && !error}
    />
  );

  return (
    <Screen>
      <AppBar title="REPÈRES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={isConsole ? s.headerRow : undefined}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.eyebrow}>MES REPÈRES</Text>
            <Text style={s.title} accessibilityRole="header">
              Vos repères, circuit par circuit.
            </Text>
            <Text style={s.manifest}>
              Choisissez le circuit, puis posez un point de freinage et une vitesse d&apos;apex
              virage par virage — superposés chez vos pilotes et attribués à vous. Des repères,
              jamais des consignes.
            </Text>
          </View>
          {isConsole ? (
            <Text style={s.superposed} accessibilityRole="text">
              SUPERPOSÉS CHEZ LE PILOTE
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={s.selectorLabel}>LE CIRCUIT</Text>
          {selector}
        </View>

        {isConsole ? (
          <View style={s.consoleRow}>
            <View style={{ flex: 1.4 }}>{list}</View>
            <View style={{ flex: 1 }}>{aside}</View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.xxl }}>
            {list}
            {aside}
          </View>
        )}
      </View>
    </Screen>
  );
}

/**
 * Carte de circuit du sélecteur : mini-tracé réel (track_svg_path, viewBox
 * 0..1000 — même convention que l'écran Circuits), nom, méta factuelle.
 * Sélection à l'identité coach (rouge d'accent) — jamais l'or.
 */
function CircuitChoice({
  circuit,
  selected,
  onPress,
}: {
  circuit: Circuit;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = circuitMeta(circuit);
  const stroke = selected ? palette.coachAccent : palette.creamMute;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Circuit ${circuit.name}${selected ? ', sélectionné' : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        selected && s.choiceSelected,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={s.choiceThumb}>
        {circuit.trackSvgPath ? (
          <Svg width={40} height={40} viewBox="0 0 1000 1000">
            <Path
              d={circuit.trackSvgPath}
              fill="none"
              stroke={stroke}
              strokeWidth={42}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <View style={[s.choiceRing, { borderColor: stroke }]} />
        )}
      </View>
      <Text style={[s.choiceName, selected && { color: palette.cream }]} numberOfLines={2}>
        {circuit.name}
      </Text>
      {meta ? <Text style={s.choiceMeta}>{meta}</Text> : null}
    </Pressable>
  );
}

/**
 * Compteur RÉEL de repères posés sur le circuit choisi + barre de progression
 * (identité coach). Chaque nombre trace vers les repères enregistrés et les
 * virages effectivement listés.
 */
function PlacedCounter({ placed, total }: { placed: number; total: number }) {
  const ratio = total > 0 ? placed / total : 0;
  return (
    <View
      style={s.counter}
      accessibilityRole="text"
      accessibilityLabel={placedLabel(placed, total)}
    >
      <View style={s.counterHead}>
        <Text style={s.counterEyebrow}>REPÈRES POSÉS</Text>
        <Text style={s.counterValue}>
          <Text style={{ color: palette.coachAccent }}>{placed}</Text>
          <Text style={s.counterTotal}> / {total} virages</Text>
        </Text>
      </View>
      <View style={s.counterTrack} accessibilityElementsHidden importantForAccessibility="no">
        <View style={[s.counterFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

/**
 * Panneau latéral : le circuit choisi (tracé réel en grand, rappel visuel),
 * ce qu'est un repère (légende des deux types + trajectoire) et le rappel
 * doctrinal de la maquette. Descriptif — aucun contrôle.
 */
function ReperesAside({
  circuit,
  placed,
  total,
  ready,
}: {
  circuit: Circuit | null;
  placed: number;
  total: number;
  ready: boolean;
}) {
  return (
    <View style={{ gap: spacing.lg }}>
      {circuit && circuit.trackSvgPath ? (
        <View style={s.asideBlock}>
          <Text style={s.asideLabel}>LE CIRCUIT CHOISI</Text>
          <View style={s.asideTraceWrap}>
            <Svg
              width="100%"
              height={120}
              viewBox="0 0 1000 1000"
              preserveAspectRatio="xMidYMid meet"
            >
              <Path
                d={circuit.trackSvgPath}
                fill="none"
                stroke={palette.creamMute}
                strokeWidth={22}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={s.asideCircuitName}>{circuit.name}</Text>
          {ready && total > 0 ? (
            <Text style={s.asideCircuitMeta}>{placedLabel(placed, total)}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={s.asideBlock}>
        <Text style={s.asideLabel}>CE QU&apos;EST UN REPÈRE</Text>
        <LegendRow
          color={dataColors.brake}
          title="Point de freinage"
          hint="La distance repère avant la corde."
        />
        <LegendRow
          color={dataColors.trajectory}
          title="Vitesse d'apex"
          hint="La vitesse repère à la corde."
        />
        <LegendRow
          color={palette.secondary}
          title="Trajectoire"
          hint="Un mot sur la ligne, si besoin."
          last
        />
      </View>
      <Card style={s.doctrineCard}>
        <Text style={s.doctrineTxt}>
          Des repères, pas une obligation. Vos pilotes restent libres de leur conduite.
        </Text>
      </Card>
    </View>
  );
}

/**
 * Résumé coloré d'un repère posé : freinage (rouge de donnée) + vitesse d'apex
 * (bleu), plus la note de trajectoire si elle existe. Chaque valeur trace vers
 * un champ réel (brakingPointM / targetSpeedKmh / trajectoryNote).
 */
function ReferenceChips({ reference }: { reference: CoachCornerReference }) {
  const chips: { key: string; label: string; color: string }[] = [];
  if (reference.brakingPointM != null) {
    chips.push({
      key: 'brake',
      label: `Freinage ${Math.round(reference.brakingPointM)} m`,
      color: dataColors.brake,
    });
  }
  if (reference.targetSpeedKmh != null) {
    chips.push({
      key: 'speed',
      label: `Apex ${Math.round(reference.targetSpeedKmh)} km/h`,
      color: dataColors.trajectory,
    });
  }
  return (
    <View style={s.summary}>
      {chips.length > 0 ? (
        <View style={s.chipsWrap}>
          {chips.map((c) => (
            <View key={c.key} style={s.chip}>
              <View style={[s.chipDot, { backgroundColor: c.color }]} />
              <Text style={[s.chipTxt, { color: c.color }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {reference.trajectoryNote ? (
        <Text style={s.noteTxt} numberOfLines={2}>
          {reference.trajectoryNote}
        </Text>
      ) : null}
    </View>
  );
}

function LegendRow({
  color,
  title,
  hint,
  last,
}: {
  color: string;
  title: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <View style={[s.legendRow, last ? null : s.legendRowBorder]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={[s.legendDot, { backgroundColor: color }]}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.legendTitle}>{title}</Text>
        <Text style={s.legendHint}>{hint}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },

  // En-tête — identité coach en rouge d'accent (le neutre « coach » de la
  // palette était crème, pas la marque : on porte bien l'identité rôle ici).
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
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

  // — Sélecteur de circuit —
  selectorLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: spacing.md,
  },
  choice: {
    width: 150,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  choiceSelected: {
    borderColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.06)',
  },
  choiceThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  choiceRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  choiceName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.body,
    letterSpacing: 0.2,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.25,
  },
  choiceMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },

  // — Compteur réel de repères posés —
  counter: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  counterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  counterEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  counterValue: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.body,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  counterTotal: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  counterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.surface3,
    overflow: 'hidden',
  },
  counterFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: palette.coachAccent,
  },

  // File des virages
  cornerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Insigne du numéro de virage : case mono neutre, l'identité coach quand un
  // repère est posé (rappel visuel demandé) — l'or reste au chrono.
  cornerBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBadgeFilled: {
    borderColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.08)',
  },
  cornerNum: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.5,
    color: palette.creamMute,
  },
  cornerMain: {
    flex: 1,
    paddingRight: spacing.md,
  },
  cornerName: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  cornerEmpty: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.eyebrow,
    marginTop: spacing.sm,
  },
  action: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Résumé (chips colorés + note)
  summary: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surface3,
    borderRadius: theme.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  noteTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.4,
    marginTop: 2,
  },

  // Panneau latéral
  asideBlock: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: theme.radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  asideLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: spacing.sm,
  },
  asideTraceWrap: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  asideCircuitName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.body,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  asideCircuitMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  legendRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
  },
  legendTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  legendHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.4,
    marginTop: 2,
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
});
