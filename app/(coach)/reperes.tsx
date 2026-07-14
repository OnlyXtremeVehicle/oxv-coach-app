/**
 * Coach — Repères de virage. Reskin refonte-v2 §12, RESPONSIVE deux formats.
 *
 * Le coach pose, virage par virage, un point de freinage repère (rouge) et une
 * vitesse d'apex repère (bleu). Ces repères sont superposés chez ses pilotes
 * consentis et ATTRIBUÉS à lui — jamais une consigne de l'app (doctrine miroir,
 * §12 garde-fous). Cet écran est la LISTE d'entrée : chaque virage ouvre
 * l'éditeur (repere/[index]) où le repère se saisit et s'enregistre. La saisie
 * (sliders de la maquette) vit dans l'éditeur ; ici, aucun contrôle mort.
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/08-reperes) : deux colonnes — la file des virages à gauche, un
 *     panneau latéral (nature des repères + rappel doctrinal) à droite.
 *   - COMPAGNON téléphone : une colonne, la file puis le rappel. Même matière.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Couleurs QDI fixes : freinage = rouge de donnée (#F65B5B), apex/trajectoire =
 * bleu (#4F9DF7). Identité coach = rouge d'accent (#E23A4E). Aucun or (réservé
 * au chrono/record). Données réelles : listMyCornerReferences (RLS) ; les
 * chiffres de la maquette sont des exemples, un virage sans repère affiche « — ».
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type CoachCornerReference, referenceHasContent } from '@/services/coachReferenceLogic';
import { listMyCornerReferences } from '@/services/coachReferenceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, dataColors, fonts, fontSize, spacing } = theme;

export default function CoachReperesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [byIndex, setByIndex] = useState<Map<number, CoachCornerReference>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listMyCornerReferences()
      .then((rows) => {
        if (!cancelled) {
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
  }, []);

  useFocusEffect(load);

  const listState: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  // La file des virages : chaque carte ouvre l'éditeur du repère (route réelle).
  const list = (
    <StateWrapper
      state={listState}
      skeletonLines={5}
      errorCause="Vos repères n'ont pas pu être chargés."
      onRetry={load}
    >
      <View style={{ gap: spacing.md }}>
        {BELTOISE_CORNERS.map((corner) => {
          const ref = byIndex.get(corner.index);
          const filled = ref ? referenceHasContent(ref) : false;
          return (
            <Card
              key={corner.index}
              onPress={() =>
                router.push({
                  pathname: '/(coach)/repere/[index]',
                  params: { index: String(corner.index) },
                } as never)
              }
              accessibilityLabel={`${corner.name}, repère ${filled ? 'à modifier' : 'à ajouter'}`}
              style={[s.cornerCard, { borderColor: filled ? palette.coachAccent : palette.line }]}
            >
              <View style={s.cornerMain}>
                <View style={s.cornerHead}>
                  <Text style={s.cornerNum}>{String(corner.index).padStart(2, '0')}</Text>
                  <Text style={s.cornerName} numberOfLines={1}>
                    {corner.name}
                  </Text>
                </View>
                {filled && ref ? (
                  <ReferenceChips reference={ref} />
                ) : (
                  <Text style={s.cornerEmpty}>Aucun repère posé</Text>
                )}
              </View>
              <Text style={[s.action, { color: filled ? palette.coachAccent : palette.creamMute }]}>
                {filled ? 'Modifier' : 'Ajouter'}
              </Text>
            </Card>
          );
        })}
      </View>
    </StateWrapper>
  );

  const aside = <ReperesAside />;

  return (
    <Screen>
      <AppBar title="REPÈRES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={isConsole ? s.headerRow : undefined}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.eyebrow}>MES REPÈRES</Text>
            <Text style={s.title} accessibilityRole="header">
              Vos repères.
            </Text>
            <Text style={s.manifest}>
              Un point de freinage, une vitesse d&apos;apex — posés virage par virage, superposés
              chez vos pilotes et attribués à vous. Des repères, jamais des consignes.
            </Text>
          </View>
          {isConsole ? (
            <Text style={s.superposed} accessibilityRole="text">
              SUPERPOSÉS CHEZ LE PILOTE
            </Text>
          ) : null}
        </View>

        {isConsole ? (
          <View style={s.consoleRow}>
            <View style={{ flex: 1.4 }}>{list}</View>
            <View style={{ flex: 1 }}>{aside}</View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xxl, gap: spacing.xxl }}>
            {list}
            {aside}
          </View>
        )}
      </View>
    </Screen>
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

/**
 * Panneau latéral : ce qu'est un repère (légende des deux types + trajectoire)
 * et le rappel doctrinal de la maquette. Descriptif — aucun contrôle.
 */
function ReperesAside() {
  return (
    <View style={{ gap: spacing.lg }}>
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

  // File des virages
  cornerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cornerMain: {
    flex: 1,
    paddingRight: spacing.md,
  },
  cornerHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  // Numéro de virage = repère neutre (label), en mono — l'or reste au chrono.
  cornerNum: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
    color: palette.creamMute,
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
