/**
 * Écran Circuits — vos tracés connus + l'annuaire national (§7bis #9e).
 * Reskin fidèle à la maquette refonte-v2 (screens/42-circuits.png).
 *
 * Maquette : liste de circuits, une carte par circuit.
 *   - Circuit ROULÉ : mini-tracé réel (trait plein) + sous-titre factuel
 *     (km · virages) + MEILLEUR TEMPS réel en OR (l'or = chrono/record seul),
 *     « — » si aucun temps enregistré.
 *   - Circuit PAS ENCORE ROULÉ : mini-tracé en POINTILLÉ (état distinct),
 *     mention « Pas encore roulé », aucun record — on n'invente aucun temps.
 *
 * Données RÉELLES uniquement, zéro nouvelle table/colonne :
 *   - annuaire → fetchCircuits() (table `circuits`, is_official), avec le
 *     tracé réel `track_svg_path` (viewBox 0..1000, cf. userCircuitsService) ;
 *   - records par circuit → loadPilotStats(userId).byCircuit.bestLapSeconds
 *     (best_lap_seconds réels de telemetry_sessions), apparié par nom de
 *     circuit. Un circuit apparié = « roulé » ; sinon « pas encore roulé ».
 *
 * Héritage retravaillé (le graphique v2 fait loi) : la carte MapView plein
 * écran est DROP (la vue carte vit sur Carte OXV — screens/34) ; ici on suit
 * la maquette #9e (liste de tracés). Le tap → fiche circuit (services autour)
 * est GARDÉ. Tutoiement des PNG transposé en vouvoiement. Aucun classement.
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { EmptyState } from '@/components/instruments';
import { type Circuit, fetchCircuits } from '@/services/circuitsService';
import { type CircuitAggregate, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatLapTime } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Normalise un nom de circuit pour l'appariement annuaire ↔ séances. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Circuit de l'annuaire enrichi de son état RÉEL côté pilote : « roulé »
 * (apparié à un agrégat de séances, avec son meilleur temps) ou non.
 */
interface CircuitRow {
  circuit: Circuit;
  driven: boolean;
  bestLapSeconds: number | null;
}

/**
 * Sous-titre factuel d'un circuit (longueur · virages). Vide si aucune de
 * ces deux données n'est disponible en base — jamais de valeur inventée.
 */
function circuitMeta(circuit: Circuit): string {
  const parts: string[] = [];
  if (circuit.lengthKm != null) parts.push(`${circuit.lengthKm} km`.replace('.', ','));
  if (circuit.turnsCount != null) parts.push(`${circuit.turnsCount} virages`);
  return parts.join(' · ');
}

/**
 * Mini-tracé du circuit. `track_svg_path` est un path SVG dans un viewBox
 * 0..1000 (même convention que userCircuitsService/geoToSvg). Trait plein
 * pour un circuit roulé, POINTILLÉ pour un circuit pas encore roulé (état
 * distinct de la maquette). Anneau neutre en repli si aucune géométrie.
 */
function MiniTrace({ path, driven }: { path: string | null; driven: boolean }) {
  const stroke = driven ? palette.green : palette.faint;
  if (!path) {
    return (
      <View style={s.thumb}>
        <View
          style={[
            s.fallbackRing,
            { borderColor: stroke, borderStyle: driven ? 'solid' : 'dashed' },
          ]}
        />
      </View>
    );
  }
  return (
    <View style={s.thumb}>
      <Svg width={44} height={44} viewBox="0 0 1000 1000">
        <Path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={38}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={driven ? undefined : '70 60'}
        />
      </Svg>
    </View>
  );
}

/** Une carte circuit : mini-tracé, nom, méta, record OR (ou état pointillé). */
function CircuitCard({ row }: { row: CircuitRow }) {
  const { circuit, driven, bestLapSeconds } = row;
  const meta = circuitMeta(circuit);
  const best = bestLapSeconds != null ? formatLapTime(bestLapSeconds) : '—';

  const a11y = driven
    ? bestLapSeconds != null
      ? `${circuit.name}, meilleur temps ${best}`
      : `${circuit.name}, aucun temps enregistré`
    : `${circuit.name}, pas encore roulé`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() =>
        router.push({ pathname: '/(app)/circuit/[id]', params: { id: circuit.id } } as never)
      }
      style={({ pressed }) => [
        s.card,
        driven && s.cardDriven,
        pressed && { opacity: 0.92, borderColor: palette.edge },
      ]}
    >
      <MiniTrace path={circuit.trackSvgPath} driven={driven} />

      <View style={s.cardBody}>
        <Text style={s.name} numberOfLines={1}>
          {circuit.name}
        </Text>
        {driven ? (
          meta ? (
            <Text style={s.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null
        ) : (
          <Text style={s.notDriven}>Pas encore roulé</Text>
        )}
      </View>

      {driven ? (
        <View
          style={s.recordCol}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={s.recordEyebrow}>VOTRE RECORD</Text>
          <Text style={[s.recordValue, bestLapSeconds == null && { color: palette.creamMute }]}>
            {best}
          </Text>
        </View>
      ) : (
        <View style={s.chevWrap} importantForAccessibility="no">
          <View style={s.chev} />
        </View>
      )}
    </Pressable>
  );
}

export default function CircuitsScreen() {
  const profile = useAuthStore((st) => st.profile);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [byCircuit, setByCircuit] = useState<Record<string, CircuitAggregate>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const stats = profile?.id
      ? loadPilotStats(profile.id)
      : Promise.resolve({ byCircuit: {} as Record<string, CircuitAggregate> });
    Promise.all([fetchCircuits(), stats])
      .then(([all, st]) => {
        if (cancelled) return;
        setCircuits(all.filter((c) => c.isOfficial));
        setByCircuit(st.byCircuit);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useFocusEffect(reload);

  // Appariement annuaire ↔ séances par nom (best_lap_seconds réels). Les
  // circuits roulés en tête (les plus familiers), puis ceux pas encore roulés.
  // Tri alphabétique dans chaque groupe — jamais un classement de performance.
  const { driven, unseen } = useMemo(() => {
    const bestByName = new Map<string, number | null>();
    for (const agg of Object.values(byCircuit)) {
      bestByName.set(normalizeName(agg.circuitName), agg.bestLapSeconds);
    }
    const drivenRows: CircuitRow[] = [];
    const unseenRows: CircuitRow[] = [];
    for (const circuit of circuits) {
      const key = normalizeName(circuit.name);
      if (bestByName.has(key)) {
        drivenRows.push({ circuit, driven: true, bestLapSeconds: bestByName.get(key) ?? null });
      } else {
        unseenRows.push({ circuit, driven: false, bestLapSeconds: null });
      }
    }
    const byName = (a: CircuitRow, b: CircuitRow) => a.circuit.name.localeCompare(b.circuit.name);
    return { driven: drivenRows.sort(byName), unseen: unseenRows.sort(byName) };
  }, [circuits, byCircuit]);

  return (
    <Screen>
      <AppBar title="Circuits" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} />
          </View>
        ) : circuits.length === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              label="Annuaire à venir"
              message="Les circuits référencés s'afficheront ici. Le référencement national avance circuit par circuit."
              source="circuits"
            />
          </View>
        ) : (
          <>
            {driven.length > 0 ? (
              <>
                <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
                  <SectionLabel>Vos tracés</SectionLabel>
                </View>
                <View style={{ gap: spacing.sm + 2 }}>
                  {driven.map((row) => (
                    <CircuitCard key={row.circuit.id} row={row} />
                  ))}
                </View>
              </>
            ) : null}

            {unseen.length > 0 ? (
              <>
                <View
                  style={{
                    marginTop: driven.length > 0 ? spacing.xl : spacing.xs,
                    marginBottom: spacing.md,
                  }}
                >
                  <SectionLabel>À découvrir</SectionLabel>
                </View>
                <View style={{ gap: spacing.sm + 2 }}>
                  {unseen.map((row) => (
                    <CircuitCard key={row.circuit.id} row={row} />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={s.footnote}>
              Votre meilleur temps par circuit. Le vôtre seul — aucun autre pilote.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  // Carte circuit : surface v2, hairline. Le circuit roulé porte un liseré
  // d'accent 2px vert (état « roulé ») ; l'annuaire reste neutre.
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 64,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  cardDriven: {
    borderLeftWidth: 2,
    borderLeftColor: palette.green,
  },
  // Vignette du mini-tracé (carrée, surface interne).
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  fallbackRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.bodyLg,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  notDriven: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.faint,
  },
  // Colonne record : eyebrow mono + chrono OR (chrono/record seul).
  recordCol: {
    alignItems: 'flex-end' as const,
    gap: 3,
  },
  recordEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: palette.eyebrow,
  },
  recordValue: {
    fontFamily: fonts.monoSemi,
    fontSize: 15,
    letterSpacing: 0.3,
    color: palette.gold,
    fontVariant: ['tabular-nums' as const],
  },
  // Chevron des circuits pas encore roulés (invite à ouvrir la fiche).
  chevWrap: {
    width: 20,
    alignItems: 'flex-end' as const,
  },
  chev: {
    width: 8,
    height: 8,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: palette.faint,
    transform: [{ rotate: '45deg' }],
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.faint,
    textAlign: 'center' as const,
    lineHeight: fontSize.micro * 1.5,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
};
