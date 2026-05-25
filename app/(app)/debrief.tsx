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
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return <DebriefEmpty />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>DEBRIEF</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          {formatDateLong(data.startedAt)} — {data.circuitName}
        </Text>

        <FadeInSection delay={0}>
          <Acte numero="1" titre="Récit" body={data.recit} />
        </FadeInSection>
        <FadeInSection delay={250}>
          <Acte numero="2" titre="Méta-analyse" body={data.meta} />
        </FadeInSection>
        <FadeInSection delay={500}>
          <Acte numero="3" titre="Préparation" body={data.preparation} />
        </FadeInSection>

        <FadeInSection
          delay={800}
          style={{
            marginTop: spacing.huge,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            backgroundColor: colors.background.secondary,
          }}
        >
          <Text
            style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}
          >
            L'app se taira jusqu'à la veille de votre prochaine session. Profitez de cette pause.
          </Text>
          <Text
            style={{
              fontFamily: 'Menlo',
              fontSize: fontSize.eyebrow,
              color: colors.text.tertiary,
              textAlign: 'center',
              marginTop: spacing.lg,
              letterSpacing: 2.5,
            }}
          >
            — OXV COACH
          </Text>
        </FadeInSection>

        {!data.generated ? (
          <Text
            style={[
              typography.caption,
              { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xl },
            ]}
          >
            Le debrief littéraire personnalisé arrive sous 24 h.
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            onPressIn={() => haptics.tap()}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Acte({ numero, titre, body }: { numero: string; titre: string; body: string }) {
  return (
    <View style={{ marginBottom: spacing.xxxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.sm, color: colors.text.tertiary }]}>
        ACTE {numero} · {titre.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.bodyLarge,
          fontWeight: fontWeight.light,
          fontStyle: 'italic',
          lineHeight: fontSize.bodyLarge * 1.7,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

function DebriefEmpty() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View
        style={{
          flex: 1,
          padding: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>DEBRIEF</Text>
        <Text style={[typography.screenTitle, { textAlign: 'center', marginBottom: spacing.xl }]}>
          Pas encore de session à raconter.
        </Text>
        <Text style={[typography.manifest, { textAlign: 'center' }]}>
          Le récit viendra après votre première sortie.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.xxxl }}>
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
