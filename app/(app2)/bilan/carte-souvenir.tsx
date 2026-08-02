/**
 * Écran « Carte-souvenir » (maquette refonte-v2 §7bis, `36-carte-trophee.png`).
 *
 * Un souvenir partageable : une carte ambrée à halo or, portant le meilleur tour
 * réel de la séance en chrono or géant, un tracé et une signature gravée. C'est
 * le seul objet OXV pensé pour être vu HORS de l'app.
 *
 * Prend `?sessionId=`, charge la séance + ses tours comme le bilan, en tire le
 * meilleur tour (computeRegularity → bestSeconds, repli best_lap_seconds) et la
 * géométrie du tracé, puis rend <TrophyCard> (4:5, capturable) suivi d'une rangée
 * d'actions ancrée en bas :
 *   — « Partager » (crème, primaire) : capture la carte en image
 *     (react-native-view-shot) → feuille de partage OS (expo-sharing). La feuille
 *     système couvre Story et Enregistrer.
 *   — bouton carré d'export (à droite) : Share.share() natif, un lien simple vers
 *     le site — le même souvenir, sans image.
 *
 * Doctrine (OXV Moment) : le meilleur tour est un FAIT, pas un classement.
 * MethodLimitBlock + ExportWatermark posent la portée honnête AVANT le geste.
 * Restyle refonte-v2, fonctionnel inchangé. Valeurs réelles ; « — » si absentes.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Polyline } from 'react-native-svg';
import * as Sharing from 'expo-sharing';

import { MethodLimitBlock } from '@/components/MethodLimitBlock';
import { TrophyCard } from '@/components/TrophyCard';
import { FadeInSection } from '@/components/motion';
import type { LatLon } from '@/circuit/circuitGenerator';
import { fetchSessionCircuitCenterline } from '@/services/circuitsService';
import { logMediaExport } from '@/services/mediaExportsService';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { supabase } from '@/lib/supabase';
import type { TelemetrySession } from '@/types/telemetry';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PressScale, SectionHeader, colors, radius, space, typo } from '@/ui/v2';
import { formatDateLong, formatLapTime } from '@/utils/format';

// `www` et non l'apex : celui-ci répond 307, et tous les clients ne suivent pas
// les redirections. Mesuré le 02/08/2026.
const SITE_URL = 'https://www.oxvehicle.fr';

interface CardData {
  bestLapLabel: string;
  circuitName: string;
  dateLabel: string;
  subLabel: string;
  tracePoints: LatLon[] | null;
}

/** Glyphe d'export (flèche montante hors du plateau) pour le bouton carré. */
function ExportGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="8,7 12,3 16,7"
        stroke={theme.palette.cream}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 3 V15" stroke={theme.palette.cream} strokeWidth={1.7} strokeLinecap="round" />
      <Path
        d="M5 13 V19 A2 2 0 0 0 7 21 H17 A2 2 0 0 0 19 19 V13"
        stroke={theme.palette.cream}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * CORRESPONDANCE V1 → V2, POSÉE UNE FOIS
 *
 * Vingt-six références aux jetons V1 vivent dans les styles. Les traduire ici
 * plutôt que de les réécrire garde le portage vérifiable, et nomme les deux
 * seuls renoncements : `bodyLight` rejoint `body` — le kit V2 n'a pas de
 * graisse légère — et `cardBorderProminent` rejoint `border.strong`.
 */
const theme = {
  palette: {
    card2: colors.bg.card2,
    cardBorderProminent: colors.border.strong,
    cream: colors.text.hi,
    creamMute: colors.text.low,
  },
  fonts: { body: typo.body, bodyLight: typo.body, display: typo.display },
  fontSize: { small: 12, body: 14, h2: 21 },
  spacing: { xs: space.xs, sm: space.sm, md: space.md, lg: space.lg, xl: space.xl },
  radius: { md: radius.cell },
} as const;

/**
 * L'en-tête de l'écran. Le kit V2 n'a pas d'`AppBar` : les écrans de app2
 * composent le leur — chevron à gauche, titre mono centré, largeur symétrique
 * à droite pour que le centrage tienne.
 */
function EnTete({ insetsTop }: { insetsTop: number }) {
  return (
    <View style={[s.entete, { paddingTop: insetsTop + space.sm }]}>
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.chevron}>‹</Text>
      </PressScale>
      <Text style={s.enteteTitre} accessibilityRole="header">
        CARTE-SOUVENIR
      </Text>
      <View style={s.enteteEspaceur} />
    </View>
  );
}
export default function CarteSouvenirScreen() {
  const insets = useSafeAreaInsets();
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
        dateLabel: formatDateLong(session.started_at),
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
        // Journal d'export (OXV Moment) — best-effort, jamais bloquant.
        void logMediaExport({ exportType: 'image', telemetrySessionId: params.sessionId ?? null });
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
      void logMediaExport({ exportType: 'link', telemetrySessionId: params.sessionId ?? null });
    } catch {
      // L'utilisateur a fermé la feuille — pas d'erreur à remonter.
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <EnTete insetsTop={insets.top} />
        <View style={s.center}>
          <ActivityIndicator
            color={theme.palette.creamMute}
            accessibilityLabel="Préparation de la carte"
          />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.root}>
        <EnTete insetsTop={insets.top} />
        <View style={s.empty}>
          <Text style={s.emptyTitle} accessibilityRole="header">
            Aucune séance à mettre en carte.
          </Text>
          <Text style={s.emptyBody}>
            Ouvrez une séance depuis votre bilan pour en faire un souvenir.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <EnTete insetsTop={insets.top} />
      <View style={s.page}>
        {/* En-tête révélé en douceur. La carte elle-même (capturée en image par
            react-native-view-shot) reste STATIQUE et hors de toute animation. */}
        <FadeInSection delay={0}>
          <SectionHeader eyebrow="PRÊT À PARTAGER" />
        </FadeInSection>

        <View style={s.cardHalo}>
          <TrophyCard
            ref={cardRef}
            bestLapLabel={data.bestLapLabel}
            circuitName={data.circuitName}
            dateLabel={data.dateLabel}
            subLabel={data.subLabel}
            tracePoints={data.tracePoints}
          />
        </View>

        {/* Espace vivant sous la carte — la maquette laisse respirer le souvenir. */}
        <View style={{ flex: 1 }} />

        {/* Portée honnête de l'image, AVANT le geste de partage (V9 §17). */}
        <FadeInSection delay={60} style={{ marginBottom: theme.spacing.md }}>
          <MethodLimitBlock />
        </FadeInSection>

        {/* Actions ancrées en bas (maquette : « Partager » plein + carré d'export).
            Le bouton primaire passe par l'état `loading` du kit (spinner + libellé
            tenu + `busy` a11y) pendant la capture ; l'export lien est neutralisé
            en parallèle pour éviter une seconde feuille de partage concurrente. */}
        <FadeInSection delay={80}>
          <View style={s.actions}>
            <View style={{ flex: 1 }}>
              <Button label="Partager" onPress={onShareImage} loading={sharing} />
            </View>
            <Pressable
              onPress={sharing ? undefined : onShareLink}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Partager un lien vers la séance"
              accessibilityState={{ disabled: sharing }}
              hitSlop={8}
              style={({ pressed }) => [
                s.exportBtn,
                sharing && s.exportBtnInert,
                pressed && !sharing && { opacity: 0.85 },
              ]}
            >
              <ExportGlyph />
            </Pressable>
          </View>

          <Text style={s.note}>
            {Platform.OS === 'ios'
              ? 'La feuille de partage couvre Story et Enregistrer.'
              : 'L’image se partage ou s’enregistre depuis la feuille système.'}
          </Text>
        </FadeInSection>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text.hi,
    width: 24,
  },
  enteteTitre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
  },
  enteteEspaceur: { width: 24 },
  page: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  cardHalo: {
    marginTop: theme.spacing.xs,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    textAlign: 'center',
    lineHeight: theme.fontSize.body * 1.5,
  },
  // Rangée d'actions ancrée : « Partager » plein prend la largeur, le carré
  // d'export se pose à droite (surface-2, bord fin — grammaire refonte-v2).
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
  },
  exportBtn: {
    width: 52,
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.cardBorderProminent,
    backgroundColor: theme.palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnInert: {
    opacity: 0.5,
  },
  // Note d'aide : c'est une phrase (pas un chiffre) → corps léger, pas mono.
  // Contraste `creamMute` (7.30:1, au-dessus de AA) car ce texte porte une
  // information que le pilote doit pouvoir lire.
  note: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});
