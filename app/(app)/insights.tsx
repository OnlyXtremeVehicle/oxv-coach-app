/**
 * Insights — constats qualitatifs de la séance + galerie des six lectures.
 *
 * Reskin refonte-v2 §7bis (maquette 23-insights.png) : cartes de constat à
 * LISERÉ GAUCHE 2 px couleur QDI (Régularité violet / Freinage rouge /
 * Accélération vert / Fluidité jaune), eyebrow mono à pastille, phrase
 * descriptive — des constats, jamais des consignes.
 *
 * DONNÉES RÉELLES CÂBLÉES (règle fondateur) — chaque carte trace vers du réel :
 *  - Régularité : `laps` (fetchSessionLaps) → computeRegularity (amplitude et
 *    écart-type des tours valides, formatés via formatLapTime).
 *  - Freinage / Accélération / Fluidité : branches QDI persistées
 *    (`app_session_analyses.qdi`, getOrComputeQdiForSession — recalcul
 *    paresseux canonique, comme le Paddock et la Signature). Le gating offre
 *    est RESPECTÉ (getQdiAccessLevel : Access = pas de détail chiffré, comme
 *    le Bilan). Branche absente → carte masquée ; rien du tout → ligne vide
 *    honnête. Les chiffres de la maquette ne sont que des exemples.
 *
 * Le marqueur DÉMO (honnêteté pré-Valence, §5 du moteur) est CONSERVÉ,
 * restylé v2 en ligne d'état à pastille NEUTRE (le composant partagé
 * DemoBanner, utilisé par les détails, n'est pas modifié — besoin noté).
 *
 * Héritage GARDÉ : les six lectures du catalogue (routes /(app)/insight/<clé>
 * inchangées), transparence T5 et pied doctrinal. Héritage DROP : le héros
 * eyebrow+H1 (absent de la maquette).
 *
 * Motion (kit src/components/motion, courbes et durées du kit) : intro et
 * ligne d'état en fondu, cartes de constats en cascade (Stagger), grille des
 * six lectures cascadée par palier, transparence et pied en fondus décalés.
 * Le toucher des cartes de lecture vit dans InsightCard (composant partagé).
 * Reduce-motion : rendu direct, géré par le kit.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { InsightCard } from '@/components/insights/InsightCard';
import {
  DEMO_NOTICE,
  DOCTRINE_FOOTER,
  READINGS,
  TIERS,
  type InsightTier,
} from '@/components/insights/catalogue';
import { Sparkline } from '@/components/insights/sparklines';
import { BlindspotsBlock } from '@/components/InsightTransparency';
import { FadeInSection, Stagger } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import {
  getOrComputeQdiForSession,
  getQdiAccessLevel,
  type QdiRecord,
} from '@/services/qdiService';
import { computeRegularity, type RegularityProfile } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { formatLapTime } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

/* ------------------------------------------------------------------ */
/* Constats réels — dérivés des tours et des branches QDI de la séance */
/* ------------------------------------------------------------------ */

interface Constat {
  key: string;
  /** Eyebrow de la carte (RÉGULARITÉ, FREINAGE…), couleur QDI. */
  label: string;
  color: string;
  /** Constat descriptif ; le segment **…** sort en mono coloré. */
  fact: string;
}

/**
 * Assemble les constats disponibles (ordre maquette : régularité, freinage,
 * accélération, puis fluidité). Une donnée absente = pas de carte — jamais
 * une valeur inventée. `qdi` arrive déjà filtré par le gating offre.
 */
function buildConstats(reg: RegularityProfile, qdi: QdiRecord | null): Constat[] {
  const out: Constat[] = [];
  if (reg.lapCount >= 3 && reg.spreadSeconds !== null && reg.stdDevSeconds !== null) {
    out.push({
      key: 'regularite',
      label: 'Régularité',
      color: dataColors.regularity,
      fact: `Vos ${reg.lapCount} tours valides tiennent dans **${formatLapTime(
        reg.spreadSeconds
      )}**. Écart-type de la séance : ±${formatLapTime(reg.stdDevSeconds)}.`,
    });
  }
  if (qdi && qdi.freinage !== null) {
    out.push({
      key: 'freinage',
      label: 'Freinage',
      color: dataColors.brake,
      fact: `Progressivité de vos freinages : **${qdi.freinage}/100**, mesurée sur chaque phase de décélération.`,
    });
  }
  if (qdi && qdi.acceleration !== null) {
    out.push({
      key: 'acceleration',
      label: 'Accélération',
      color: dataColors.accel,
      fact: `Vos remises de gaz : **${qdi.acceleration}/100** de progressivité en sortie.`,
    });
  }
  if (qdi && qdi.fluidite !== null) {
    out.push({
      key: 'fluidite',
      label: 'Fluidité',
      color: dataColors.flow,
      fact: `Douceur de vos transitions latérales : **${qdi.fluidite}/100** sur la séance.`,
    });
  }
  return out;
}

/** Carte de constat (maquette) : liseré gauche 2 px + eyebrow à pastille. */
function ConstatCard({ constat }: { constat: Constat }) {
  const plain = constat.fact.split('**').join('');
  return (
    <View
      style={[styles.constatCard, { borderLeftColor: constat.color }]}
      accessibilityRole="text"
      accessibilityLabel={`${constat.label}. ${plain}`}
    >
      <View style={styles.constatHead}>
        <View style={[styles.constatDot, { backgroundColor: constat.color }]} />
        <Text style={[styles.constatLabel, { color: constat.color }]}>{constat.label}</Text>
      </View>
      <Text style={styles.constatText}>
        {constat.fact.split('**').map((part, i) =>
          i % 2 === 1 ? (
            <Text key={`n${i}`} style={[styles.constatNum, { color: constat.color }]}>
              {part}
            </Text>
          ) : (
            <Text key={`t${i}`}>{part}</Text>
          )
        )}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const profileId = useAuthStore((s) => s.profile)?.id;
  const params = useLocalSearchParams<{ sessionId?: string }>();

  // null = chargement en cours ; [] = rien à constater (honnête).
  const [constats, setConstats] = useState<Constat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Séance ciblée (param du Data Lab), sinon la dernière séance complétée.
      let sid = params.sessionId;
      if (!sid && profileId) {
        const { data } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profileId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sid = (data as { id?: string } | null)?.id;
      }
      if (!sid) {
        if (!cancelled) setConstats([]);
        return;
      }

      // Gating offre identique au Bilan : Access = pas de détail de branche.
      const [laps, access] = await Promise.all([
        fetchSessionLaps(sid),
        profileId ? getQdiAccessLevel(profileId) : Promise.resolve('full' as const),
      ]);
      const qdi = access === 'full' ? await getOrComputeQdiForSession(sid).catch(() => null) : null;
      if (cancelled) return;

      const reg = computeRegularity(
        laps
          .filter((l) => !l.is_outlap && !l.is_inlap)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      );
      setConstats(buildConstats(reg, qdi));
    })().catch(() => {
      if (!cancelled) setConstats([]);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, profileId]);

  return (
    <Screen>
      <AppBar title="Insights" onBack={() => router.back()} />
      <View style={styles.body}>
        {/* Intro (maquette, vouvoyée) + marqueur DÉMO en ligne d'état v2. */}
        <FadeInSection>
          <Text style={styles.intro}>
            Ce que la donnée raconte de votre séance — des constats, pas des consignes.
          </Text>
          <View style={styles.stateRow} accessibilityRole="text" accessibilityLabel={DEMO_NOTICE}>
            <View style={styles.stateDot} />
            <Text style={styles.stateText}>{DEMO_NOTICE}</Text>
          </View>
        </FadeInSection>

        {/* Constats de la séance — réels, une carte par dimension mesurable. */}
        <FadeInSection delay={80}>
          <SectionRule label="Constats · votre séance" />
          {constats === null ? null : constats.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun constat pour l’instant — les constats apparaissent à partir de trois tours
              valides captés par le boîtier.
            </Text>
          ) : (
            <>
              {/* Cartes en cascade courte (Stagger) — elles montent à
                  l'arrivée des données réelles, jamais avant. */}
              <Stagger style={styles.constatList} interval={60} maxDelay={600}>
                {constats.map((c) => (
                  <ConstatCard key={c.key} constat={c} />
                ))}
              </Stagger>
              {/* Honnêteté capteurs (QDI, bloc méthode obligatoire) : des
                  accélérations subies, jamais des gestes. */}
              <Text style={styles.methodNote}>
                Dérivés de vos temps au tour et des accélérations subies (GPS + centrale inertielle)
                — jamais de vos gestes.
              </Text>
            </>
          )}
        </FadeInSection>

        {/* Les six lectures approfondies — héritage gardé, routes inchangées. */}
        <FadeInSection delay={160}>
          <Text style={styles.lecturesLead}>
            Six lectures, du constat direct à la signature de votre voiture. Chacune montre un fait
            — jamais une consigne.
          </Text>
        </FadeInSection>
        {TIERS.map((tier, ti) => {
          // Cadence du palier — la grille des six lectures cascade : le palier
          // entre en fondu, puis ses cartes se suivent (Stagger synchronisé).
          const tierDelay = Math.min(ti + 3, 4) * 80;
          return (
            <FadeInSection key={tier.id} delay={tierDelay}>
              <SectionRule label={tier.label} />
              <Stagger
                style={styles.constatList}
                interval={60}
                initialDelay={tierDelay}
                maxDelay={800}
              >
                {READINGS.filter((r) => r.tier === (tier.id as InsightTier)).map((r) => (
                  <InsightCard
                    key={r.key}
                    name={r.name}
                    badge={r.badge}
                    dimension={r.dimension}
                    fact={r.fact}
                    onPress={() => router.push(`/(app)/insight/${r.key}` as never)}
                  >
                    <Sparkline reading={r.key} />
                  </InsightCard>
                ))}
              </Stagger>
            </FadeInSection>
          );
        })}

        {/* Transparence T5 (charte 11, obligatoire) : les limites explicites. */}
        <FadeInSection delay={400}>
          <BlindspotsBlock
            items={[
              'Ces lectures décrivent vos données. Elles ne vous disent pas quoi faire.',
              'L’app ignore vos intentions et la trajectoire que vous visiez.',
              'Aucune lecture n’est une note, un score ni un classement.',
            ]}
          />
        </FadeInSection>

        {/* Pied doctrinal — un miroir, pas un directeur. */}
        <FadeInSection delay={400}>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{DOCTRINE_FOOTER}</Text>
          </View>
        </FadeInSection>
      </View>
    </Screen>
  );
}

/** Libellé de section mono (eyebrow v2) avec filet hairline à droite. */
function SectionRule({ label }: { label: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleText}>{label}</Text>
      <View style={styles.ruleLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    fontFamily: fonts.bodyLight,
    fontSize: 13.5,
    lineHeight: 13.5 * 1.55,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  // Ligne d'état DÉMO (v2) : pastille neutre + texte muted, sans encadré.
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 20,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.faint,
  },
  stateText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  ruleText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  ruleLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },
  constatList: {
    gap: spacing.md,
  },
  // Carte de constat (maquette 23-insights) : surface v2, liseré gauche 2 px.
  constatCard: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  constatHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  constatDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  constatLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  constatText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 13.5 * 1.5,
    color: palette.creamSoft,
  },
  constatNum: {
    fontFamily: fonts.monoMedium,
  },
  methodNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 10 * 1.6,
    color: palette.eyebrow,
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
  },
  lecturesLead: {
    fontFamily: fonts.bodyLight,
    fontSize: 13.5,
    lineHeight: 13.5 * 1.55,
    color: palette.creamMute,
    marginTop: spacing.xl,
  },
  footer: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.bodyLight,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 12 * 1.6,
    textAlign: 'center',
    color: palette.creamMute,
  },
});
