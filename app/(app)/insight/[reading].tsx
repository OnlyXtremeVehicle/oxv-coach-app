/**
 * Détail d'une lecture approfondie — gabarit commun aux six insights.
 *
 * Spec : docs/specs-bundle-v4/02_moteur_insights.md
 * Maquettes : maquette_insight_N2-1_anatomie / gg_refondu / N3-1_dispersion.
 *
 * Lit le paramètre `reading` (clé de /(app)/insight/<clé>), récupère la lecture
 * dans le catalogue, et rend toujours la même structure : marqueur DÉMO,
 * eyebrow + titre Geist, la visualisation, la phrase de lecture factuelle, le
 * tag « un constat, pas une consigne », et la ligne de traçabilité (Source).
 *
 * Le `switch(reading)` choisit la viz. Pass A livre 3 viz réelles (anatomie,
 * gg, dispersion) ; les 3 autres (tour-ideal, flow, transfert) affichent un
 * placeholder sobre « Lecture en préparation. » que Pass B remplacera — sans
 * toucher au reste de ce gabarit.
 *
 * ÉTAT (§5) : telemetry_frames vide → tout est en DÉMO jusqu'à Valence.
 * Doctrine : un constat, jamais une consigne. Couleur QDI de la dimension,
 * aucune couleur heritage. Source toujours montrée (pas de boîte noire).
 */

import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { AnatomieViz } from '@/components/insights/AnatomieViz';
import { DispersionViz } from '@/components/insights/DispersionViz';
import { FlowViz } from '@/components/insights/FlowViz';
import { GGViz } from '@/components/insights/GGViz';
import { TourIdealViz } from '@/components/insights/TourIdealViz';
import { TransfertViz } from '@/components/insights/TransfertViz';
import { ConstatTag, DemoBanner } from '@/components/insights/InsightCard';
import { dimensionColor, getReading, type ReadingKey } from '@/components/insights/catalogue';
import { FadeInSection } from '@/components/motion';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function InsightDetailScreen() {
  const { reading } = useLocalSearchParams<{ reading: string }>();
  const def = getReading(reading);

  if (!def) {
    return (
      <Screen scroll={false}>
        <AppBar title="LECTURE" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Lecture introuvable.</Text>
        </View>
      </Screen>
    );
  }

  const color = dimensionColor(def.dimension);

  return (
    <Screen>
      <AppBar title="LECTURE APPROFONDIE" onBack={() => router.back()} />
      <View style={styles.body}>
        {/* En-tête révélé en premier : marqueur DÉMO + eyebrow + titre. */}
        <FadeInSection>
          {/* Marqueur DÉMO — donnée réelle dès Valence (§5). */}
          <DemoBanner />

          {/* Eyebrow mono + titre Geist de la lecture. */}
          <View style={styles.head}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowTick} />
              <Text style={styles.eyebrow}>{def.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{def.name}</Text>
          </View>
        </FadeInSection>

        {/* Visualisation (réelle ou placeholder) — révélée après l'en-tête.
            Les viz n'animent pas leur tracé à l'entrée (seul un point de statut
            respire) : un fondu de conteneur n'entre donc pas en conflit. */}
        <FadeInSection delay={100} style={styles.viz}>
          <ReadingViz reading={def.key} />
        </FadeInSection>

        {/* Lecture factuelle + traçabilité — révélées en dernier (constat). */}
        <FadeInSection delay={200}>
          {/* Lecture factuelle — barre QDI, constat (jamais consigne). */}
          <View style={[styles.reading, { borderLeftColor: color }]}>
            <Text style={styles.readingText}>{def.reading}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <ConstatTag />
            </View>
          </View>

          {/* Traçabilité — d'où vient la donnée (pas de boîte noire). */}
          <View style={styles.source}>
            <Text style={styles.sourceIcon}>⊙</Text>
            <Text style={styles.sourceText}>
              <Text style={styles.sourceLabel}>Source : </Text>
              {def.source}
            </Text>
          </View>
        </FadeInSection>

        {/* Pied doctrinal. */}
        <View style={styles.doctrine}>
          <Text style={styles.doctrineText}>
            L’app vous montre ce que vous avez roulé. Elle ne vous dit pas comment le rouler.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Choisit la visualisation par clé. Les six lectures ont désormais leur viz
 * réelle (Pass A : anatomie, gg, dispersion ; Pass B : tour-ideal, flow,
 * transfert). Le placeholder reste comme garde par défaut, jamais atteint
 * tant que les clés du catalogue sont couvertes.
 */
function ReadingViz({ reading }: { reading: ReadingKey }) {
  switch (reading) {
    case 'anatomie':
      return <AnatomieViz />;
    case 'gg':
      return <GGViz />;
    case 'dispersion':
      return <DispersionViz />;
    case 'tour-ideal':
      return <TourIdealViz />;
    case 'flow':
      return <FlowViz />;
    case 'transfert':
      return <TransfertViz />;
    default:
      return <ReadingPlaceholder />;
  }
}

/** Garde par défaut (clé non couverte) — sobre, sans donnée inventée. */
function ReadingPlaceholder() {
  return (
    <Card style={styles.placeholder}>
      <Text style={styles.placeholderText}>Lecture en préparation.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  head: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  eyebrowTick: {
    width: 24,
    height: 1,
    backgroundColor: theme.palette.edge,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: -0.2,
    color: theme.palette.cream,
  },
  viz: {
    marginBottom: theme.spacing.lg,
  },
  reading: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderLeftWidth: 2,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  readingText: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: 14,
    lineHeight: 14 * 1.65,
    color: theme.palette.creamSoft,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  sourceIcon: {
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    color: theme.palette.creamMute,
    marginTop: 1,
  },
  sourceText: {
    flex: 1,
    fontFamily: theme.fonts.bodyLight,
    fontSize: 11,
    lineHeight: 11 * 1.45,
    color: theme.palette.creamMute,
  },
  sourceLabel: {
    fontFamily: theme.fonts.body,
    color: theme.palette.creamSoft,
  },
  doctrine: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  doctrineText: {
    fontFamily: theme.fonts.bodyLight,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 12 * 1.6,
    textAlign: 'center',
    color: theme.palette.creamMute,
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  placeholderText: {
    fontFamily: theme.fonts.bodyLight,
    fontStyle: 'italic',
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.creamMute,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontFamily: theme.fonts.bodyLight,
    fontStyle: 'italic',
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.creamMute,
  },
});
