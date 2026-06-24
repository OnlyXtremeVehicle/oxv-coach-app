/**
 * Écran « Carte trophée de partage » (maquette
 * docs/refonte-app/maquette_partage_refondu.html, archétype 12).
 *
 * Prend `?sessionId=`, charge la séance + ses tours comme le bilan, en tire le
 * meilleur tour (computeRegularity → bestSeconds, repli best_lap_seconds) et la
 * géométrie du tracé, puis rend <TrophyCard> (4:5, capturable) suivi de deux
 * actions :
 *   — « Partager » (or, primaire) : capture la carte en image
 *     (react-native-view-shot) → feuille de partage OS (expo-sharing). La
 *     feuille système couvre Story et Enregistrer.
 *   — « Lien » (ghost) : Share.share() natif avec une URL simple du site.
 *
 * Doctrine : le meilleur tour est un fait, pas un classement. Aucun partage
 * RGPD (sharesService) ici — c'est une image, pas une exposition de données.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Share, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { TrophyCard } from '@/components/TrophyCard';
import type { LatLon } from '@/circuit/circuitGenerator';
import { fetchSessionCircuitCenterline } from '@/services/circuitsService';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { supabase } from '@/lib/supabase';
import type { TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StatusLine, cockpitHalo } from '@/ui/Cockpit';
import { formatDateShort, formatLapTime } from '@/utils/format';

const SITE_URL = 'https://oxvehicle.fr';

interface CardData {
  bestLapLabel: string;
  circuitName: string;
  dateLabel: string;
  subLabel: string;
  tracePoints: LatLon[] | null;
}

export default function CarteTropheeScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const cardRef = useRef<View>(null);

  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const sessionId = params.sessionId;
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: row } = await supabase
        .from('telemetry_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
      const session = (row as TelemetrySession | null) ?? null;
      if (cancelled) return;
      if (!session) {
        setLoading(false);
        return;
      }

      // Meilleur tour : même chemin que le bilan (laps filtrés → régularité),
      // repli sur le best_lap_seconds porté par la séance.
      const laps = await fetchSessionLaps(session.id);
      const reg = computeRegularity(
        laps
          .filter((l) => !l.is_outlap && !l.is_inlap)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
      );
      const tracePoints = await fetchSessionCircuitCenterline(session.id);
      if (cancelled) return;

      const bestSeconds = reg.bestSeconds ?? session.best_lap_seconds ?? null;
      const lapCount = reg.lapCount || session.lap_count || laps.length;

      setData({
        bestLapLabel: bestSeconds != null ? formatLapTime(bestSeconds) : '—',
        circuitName: session.circuit_name || 'Circuit',
        dateLabel: formatDateShort(session.started_at),
        subLabel: lapCount > 0 ? `Tracé · ${lapCount} tour${lapCount > 1 ? 's' : ''}` : 'Tracé',
        tracePoints,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const onShareImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma carte OXV',
          UTI: 'public.png',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter au pilote.
    } finally {
      setSharing(false);
    }
  };

  const onShareLink = async () => {
    try {
      await Share.share({
        message: `Ma séance sur ${data?.circuitName ?? 'circuit'} — ${SITE_URL}`,
        url: SITE_URL,
        title: 'OXV Mirror',
      });
    } catch {
      // L'utilisateur a fermé la feuille — pas d'erreur à remonter.
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="CARTE À PARTAGER" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen scroll={false}>
        <AppBar title="CARTE À PARTAGER" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={s.emptyTitle}>Aucune séance à mettre en carte.</Text>
          <Text style={s.emptyBody}>
            Ouvrez une séance depuis votre bilan pour en faire une carte.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="CARTE À PARTAGER" subtitle="VERS L'EXTÉRIEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <StatusLine label="Prêt à partager" />
        <SectionLabel>VOTRE SÉANCE, EN UNE CARTE</SectionLabel>

        <View
          style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xxl, ...cockpitHalo }}
        >
          <TrophyCard
            ref={cardRef}
            bestLapLabel={data.bestLapLabel}
            circuitName={data.circuitName}
            dateLabel={data.dateLabel}
            subLabel={data.subLabel}
            tracePoints={data.tracePoints}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={sharing ? 'Préparation…' : 'Partager'}
            onPress={onShareImage}
            disabled={sharing}
          />
          <Button label="Lien" variant="ghost" onPress={onShareLink} />
        </View>

        <Text style={s.note}>
          {Platform.OS === 'ios'
            ? 'La feuille de partage couvre Story et Enregistrer.'
            : 'Partagez l’image ou enregistrez-la depuis la feuille système.'}
        </Text>
      </View>
    </Screen>
  );
}

const s = {
  emptyTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.md,
  },
  emptyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.body * 1.5,
  },
  note: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: theme.palette.faint,
    textAlign: 'center' as const,
    marginTop: theme.spacing.lg,
  },
};
