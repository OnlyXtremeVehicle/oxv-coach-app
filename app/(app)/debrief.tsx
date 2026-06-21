/**
 * Écran #19 — Debrief J+1.
 *
 * Le plus littéraire de tous. Envoyé en notification push 24h après la
 * session. Structure en 3 actes :
 *
 *   Acte 1 — Récit         : narration de la session par OpenAI
 *   Acte 2 — Méta-analyse  : où en êtes-vous dans le temps long
 *   Acte 3 — Préparation   : invitation pour la prochaine fois
 *
 * Signature de fermeture : "L'app se taira jusqu'à la veille de votre
 * prochaine session. Profitez de cette pause."
 *
 * V1 : contenu généré côté Edge Function Supabase `generate_debrief`
 * (à créer sem 13). En attendant, on lit `app_session_analyses.debrief_text`
 * et on fallback sur un état pédagogique si pas encore rédigé.
 *
 * Reskin V2 : Screen + AppBar + Card, titres Syncopate, typo/couleurs
 * @/theme/v2. STRUCTURE PRÉSERVÉE : 3 actes + cascade FadeInSection,
 * provenance « RÉCIT GÉNÉRÉ AUTOMATIQUEMENT », signature de fermeture.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

interface DebriefData {
  sessionId: string;
  circuitName: string;
  startedAt: string;
  marginGlobal: number;
  recit: string;
  meta: string;
  preparation: string;
  generated: boolean;
}

export default function DebriefScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [data, setData] = useState<DebriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      // Trouver la session cible
      let sessionId = params.sessionId;
      if (!sessionId) {
        const { data: row } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sessionId = row?.id;
      }
      if (!sessionId || cancelled) {
        setLoading(false);
        return;
      }

      const { data: session } = await supabase
        .from('telemetry_sessions')
        .select('id, circuit_name, started_at')
        .eq('id', sessionId)
        .maybeSingle();

      const analysis = await getAnalysisForSession(sessionId);
      if (cancelled) return;

      if (!session || !analysis) {
        setLoading(false);
        return;
      }

      const debriefText = analysis.debriefText ?? '';
      const parsed = parseDebrief(debriefText);

      setData({
        sessionId,
        circuitName: session.circuit_name ?? 'Beltoise',
        startedAt: session.started_at ?? '',
        marginGlobal: analysis.marginGlobal,
        recit: parsed.recit || fallbackRecit(analysis.marginGlobal, profile.first_name),
        meta: parsed.meta || fallbackMeta(),
        preparation: parsed.preparation || fallbackPreparation(),
        generated: Boolean(debriefText),
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="DÉBRIEF" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return <DebriefEmpty />;
  }

  return (
    <Screen>
      <AppBar title="DÉBRIEF" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>
          {formatDateLong(data.startedAt)} — {data.circuitName}
        </Text>

        {/* Provenance du texte (charte 11, T4) : un récit rédigé par un modèle de
            langage est annoncé comme tel. Pas de voix d'auteur masquée. */}
        {data.generated ? (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.palette.line,
              backgroundColor: theme.palette.card2,
              marginBottom: theme.spacing.xl,
            }}
          >
            <Text style={s.provenance}>RÉCIT GÉNÉRÉ AUTOMATIQUEMENT À PARTIR DE VOTRE SÉANCE</Text>
          </View>
        ) : null}

        <FadeInSection delay={0}>
          <Acte numero="1" titre="Récit" body={data.recit} />
        </FadeInSection>
        <FadeInSection delay={250}>
          <Acte numero="2" titre="Méta-analyse" body={data.meta} />
        </FadeInSection>
        <FadeInSection delay={500}>
          <Acte numero="3" titre="Préparation" body={data.preparation} />
        </FadeInSection>

        <FadeInSection delay={800} style={{ marginTop: theme.spacing.xxl }}>
          <Card style={{ paddingVertical: theme.spacing.xl }}>
            <Text style={s.closing}>
              L'app se taira jusqu'à la veille de votre prochaine session. Profitez de cette pause.
            </Text>
            <Text style={s.signature}>— OXV MIRROR</Text>
          </Card>
        </FadeInSection>

        {!data.generated ? (
          <Text style={s.pending}>Le debrief littéraire personnalisé arrive sous 24 h.</Text>
        ) : null}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            onPressIn={() => haptics.tap()}
            onPress={() => router.back()}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function Acte({ numero, titre, body }: { numero: string; titre: string; body: string }) {
  return (
    <View style={{ marginTop: theme.spacing.xxl }}>
      <Text style={s.acteLabel}>
        ACTE {numero} · {titre.toUpperCase()}
      </Text>
      <Text style={s.acteBody}>{body}</Text>
    </View>
  );
}

function DebriefEmpty() {
  return (
    <Screen scroll={false}>
      <AppBar title="DÉBRIEF" onBack={() => router.back()} />
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ marginBottom: theme.spacing.md }}>
          <SectionLabel>Débrief</SectionLabel>
        </View>
        <Text style={[s.title, { textAlign: 'center', marginBottom: theme.spacing.xl }]}>
          Pas encore de session à raconter.
        </Text>
        <Text style={[s.emptyManifest, { textAlign: 'center' }]}>
          Le récit viendra après votre première sortie.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginTop: theme.spacing.xxl }}
        >
          <Text style={s.backLink}>Retour</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function parseDebrief(text: string): { recit: string; meta: string; preparation: string } {
  // Format conventionnel : 3 paragraphes séparés par "---" ou double saut de ligne.
  const parts = text
    .split(/\n\s*---\s*\n|\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    recit: parts[0] ?? '',
    meta: parts[1] ?? '',
    preparation: parts[2] ?? '',
  };
}

function fallbackRecit(marginGlobal: number, firstName: string | null | undefined): string {
  const opening = firstName ? `Hier, ${firstName}, ` : 'Hier, ';
  if (marginGlobal >= 30) {
    return `${opening}vous avez piloté avec aisance. La marge restait confortable, le geste était posé. Une séance qu'on aimerait reproduire.`;
  }
  if (marginGlobal >= 15) {
    return `${opening}vous avez exploré. La marge était travaillée, présente sans être inconfortable. Quelque chose a bougé dans certains virages.`;
  }
  return `${opening}vous avez touché vos limites. La marge s'est rétractée. Une séance dense, à digérer avant de revenir.`;
}

function fallbackMeta(): string {
  return "La progression se construit dans le temps long. Ce que vous avez senti hier s'ajoute à ce qui vient avant. Continuez à regarder.";
}

function fallbackPreparation(): string {
  return 'La prochaine fois, vous pourrez peut-être explorer une seule zone, à votre rythme. Une invitation, pas une consigne.';
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    lineHeight: theme.fontSize.h2 * 1.25,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  provenance: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    color: theme.palette.creamMute,
  },
  acteLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
  },
  acteBody: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.7,
    color: theme.palette.cream,
  },
  closing: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  signature: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.lg,
  },
  pending: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  emptyManifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
