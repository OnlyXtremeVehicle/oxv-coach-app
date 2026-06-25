/**
 * Écran Débrief présentiel — vue riche post-séance branchée sur les contrats réels.
 *
 * Composant porté du design « DebriefMirror » (livraison Gabin, 2026-06-21).
 * DISTINCT du Debrief J+1 (`debrief.tsx`, écran #19, récit littéraire async
 * livré en push). Ici : le débrief « présentiel », à montrer en séance — il
 * reprend les 3 actes du `debrief_text` MAIS les enrichit du tour de référence,
 * des 4 piliers, et des modules RaceBox (throttle_brake / flow_coherence /
 * gg_envelope / load_transfer) lus depuis `session_insights`. Tant qu'il n'y a
 * pas de frames RaceBox, ces modules affichent un état d'attente honnête ; les
 * sections live restent pleines.
 *
 * Doctrine préservée : faits côté pilote, section coach séparée (cuivre).
 * Comme les autres sous-écrans du bilan, on résout la séance soi-même :
 * param `sessionId` (query) sinon la dernière séance du pilote.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import DebriefMirror, {
  type Analysis,
  type Coach,
  type Insights,
  type Meta,
} from '@/components/DebriefMirror';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

function deriveCondition(w?: string | null): string | undefined {
  if (!w) return undefined;
  const s = String(w).toLowerCase();
  if (/(pluie|humid|wet|mouill)/.test(s)) return 'humide';
  return 'sec';
}

function frDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function DebriefPresentielScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const profile = useAuthStore((s) => s.profile);

  const [meta, setMeta] = useState<Meta | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Résout la séance : param explicite, sinon la dernière du pilote.
        let sessionId = params.sessionId ?? null;
        if (!sessionId && profile?.id) {
          const { data: last } = await supabase
            .from('telemetry_sessions')
            .select('id')
            .eq('user_id', profile.id)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          sessionId = (last as { id?: string } | null)?.id ?? null;
        }
        if (!sessionId) {
          if (alive) setLoading(false);
          return;
        }

        const aReq = supabase
          .from('app_session_analyses')
          .select(
            'margin_global, margin_zone, margin_vehicle, margin_pilot, margin_breakdown, next_focus_corner_index, next_focus_phrase, debrief_text, algo_version'
          )
          .eq('telemetry_session_id', sessionId)
          .maybeSingle();
        const iReq = supabase
          .from('session_insights')
          .select(
            'anatomy, reference_laps, ideal_lap, data_quality, throttle_brake, flow_coherence, gg_envelope, load_transfer, n_laps, n_frames, condition'
          )
          .eq('telemetry_session_id', sessionId)
          .maybeSingle();
        const sReq = supabase
          .from('telemetry_sessions')
          .select('circuit_name, custom_name, name, started_at, weather, vehicle_label')
          .eq('id', sessionId)
          .maybeSingle();

        const [aRes, iRes, sRes] = await Promise.all([aReq, iReq, sReq]);
        if (!alive) return;

        const a = (aRes.data as Analysis | null) ?? null;
        const i = (iRes.data as Insights | null) ?? null;
        const srow = sRes.data as Record<string, unknown> | null;
        const dq = i?.data_quality;

        setMeta({
          circuit:
            (srow?.custom_name as string) ||
            (srow?.circuit_name as string) ||
            (srow?.name as string) ||
            'Séance',
          date: frDate(srow?.started_at as string | undefined),
          condition: deriveCondition(srow?.weather as string | undefined),
          vehicle: (srow?.vehicle_label as string) || undefined,
          laps: dq?.laps_valid ?? i?.n_laps ?? undefined,
        });
        setAnalysis(a);
        setInsights(i);
        // Section coach : focus issu de next_focus (donnée). Nom/rôle laissés
        // génériques tant qu'aucune annotation coach n'est exposée ici.
        setCoach({
          focus: {
            corner: a?.next_focus_corner_index ?? null,
            phrase: a?.next_focus_phrase ?? null,
          },
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.sessionId, profile?.id]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.palette.night,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator
          color={theme.palette.creamMute}
          accessibilityLabel="Préparation du débrief"
        />
      </SafeAreaView>
    );
  }

  if (!meta) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.palette.night,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: theme.fonts.bodyLight,
            fontSize: theme.fontSize.bodyLg,
            fontStyle: 'italic',
            color: theme.palette.creamSoft,
            textAlign: 'center',
          }}
        >
          Aucune séance à débriefer pour le moment.
        </Text>
        <Text
          style={{
            marginTop: theme.spacing.md,
            color: theme.palette.creamMute,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.small,
            textAlign: 'center',
          }}
        >
          Votre première séance ouvrira le débrief.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.palette.night }} edges={['top']}>
      <DebriefMirror meta={meta} analysis={analysis} insights={insights} coach={coach} />
    </SafeAreaView>
  );
}
