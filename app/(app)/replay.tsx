/**
 * Écran #30 — Rejouer un tour.
 *
 * Reskin fidèle à la maquette refonte-v2 §7bis (#6c, 21-rejouer.png) :
 *   - AppBar détail « Rejouer · Tour N » (pastille ronde + titre centré).
 *   - Carte surface avec le tracé (`TrackStage` mode `replay`, contrôlé) et le
 *     relevé VITESSE de la frame courante en haut à droite (mono crème — la
 *     vitesse est une donnée, jamais l'or).
 *   - Scrubber MANUEL : chrono OR (formatChronoMs, temps réel écoulé dans le
 *     tour — l'or reste au chrono) qui suit la position, barre fine à
 *     remplissage or + pastille, total du tour à droite.
 *   - Commandes en pastilles ‹ ⏸ › : pas d'autoplay par défaut ; la lecture ne
 *     part QUE sur geste du pilote, au rythme réel du tour (fenêtre des frames),
 *     et s'arrête en fin de tour. ‹ / › reculent/avancent d'une seconde réelle.
 *
 * Tuiles live G latéral / G longitudinal (mode détaillé, valeurs réelles de la
 * frame courante, « — » si le boîtier n'a rien mesuré). La tuile « Position % »
 * de l'ancien écran est DROP : le chrono porte déjà la position.
 *
 * Données réelles uniquement : frames `telemetry_frames` via `loadLapFrames`
 * (SessionFrame, convention d'axes G verrouillée), tours via `fetchSessionLaps`.
 * Le chargement des tours/frames et `useDetailLevel` restent inchangés.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { TrackStage } from '@/components/CircuitMap';
import { EmptyState as DataEmptyState, Fact } from '@/components/instruments';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames, type SessionFrame } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';
import { formatChronoMs } from '@/utils/time';

/** G en « fr » : 2 décimales, virgule, − U+2212, « — » si non mesuré. */
function formatG(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return '—';
  // Arrondi AVANT le formatage (+0 neutralise le « −0,00 » de bord).
  const v = Math.round(g * 100) / 100 + 0;
  return v.toFixed(2).replace('.', ',').replace('-', '−');
}

/** Étiquette factuelle du type de tour. */
function lapKindLabel(lap: Lap): string {
  if (lap.is_best_lap) return 'Meilleur tour';
  if (lap.is_outlap) return 'Tour de sortie';
  if (lap.is_inlap) return 'Tour de rentrée';
  return 'Tour valide';
}

export default function ReplayScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; lapNumber?: string }>();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [frames, setFrames] = useState<SessionFrame[]>([]);
  const [loadingLaps, setLoadingLaps] = useState(true);
  const [errorLaps, setErrorLaps] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const { level, toggle, canToggle } = useDetailLevel();

  // Charge la liste des tours
  useEffect(() => {
    if (!params.sessionId) {
      setLoadingLaps(false);
      return;
    }
    let cancelled = false;
    setLoadingLaps(true);
    setErrorLaps(false);
    fetchSessionLaps(params.sessionId)
      .then((rows) => {
        if (cancelled) return;
        setLaps(rows);
        const initial = params.lapNumber
          ? Number(params.lapNumber)
          : (rows.find((l) => l.is_best_lap)?.lap_number ??
            rows.find((l) => !l.is_outlap && !l.is_inlap)?.lap_number ??
            rows[0]?.lap_number ??
            null);
        setSelectedLap(initial);
        setLoadingLaps(false);
      })
      .catch(() => {
        // Erreur de lecture honnête : on la montre plutôt que de l'avaler.
        if (!cancelled) {
          setErrorLaps(true);
          setLoadingLaps(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, params.lapNumber, reloadKey]);

  // Charge les frames du tour sélectionné (SessionFrame tel quel — les canaux
  // absents restent null et s'affichent « — », jamais un faux zéro).
  useEffect(() => {
    if (!params.sessionId || selectedLap === null) return;
    const sessionId = params.sessionId;
    const lapNumber = selectedLap;
    let cancelled = false;
    setLoadingFrames(true);
    loadLapFrames(sessionId, lapNumber).then((rows) => {
      if (cancelled) return;
      setFrames(rows);
      setLoadingFrames(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, selectedLap]);

  const currentLap = useMemo(
    () => laps.find((l) => l.lap_number === selectedLap) ?? null,
    [laps, selectedLap]
  );

  // États de l'écran (SPEC_BUILD §5) — un seul wrapper pour tours + frames.
  const state: ScreenState = loadingLaps
    ? 'loading'
    : errorLaps
      ? 'error'
      : laps.length === 0
        ? 'empty'
        : loadingFrames
          ? 'loading'
          : 'nominal';

  return (
    <Screen>
      <AppBar
        title={currentLap ? `Rejouer · Tour ${currentLap.lap_number}` : 'Rejouer'}
        onBack={() => router.back()}
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {/* Sélecteur de tour (héritage utile, chips au langage v2). */}
        {laps.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: theme.spacing.md }}
            contentContainerStyle={{ gap: theme.spacing.xs, paddingHorizontal: 2 }}
          >
            {laps.map((l) => {
              const on = selectedLap === l.lap_number;
              const kind = l.is_best_lap
                ? ', meilleur tour'
                : l.is_outlap
                  ? ', tour de sortie'
                  : l.is_inlap
                    ? ', tour de rentrée'
                    : '';
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Tour ${l.lap_number}${kind}`}
                  accessibilityHint="Sélectionne ce tour à rejouer"
                  hitSlop={theme.hitSlop}
                  key={l.id}
                  onPress={() => setSelectedLap(l.lap_number)}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    justifyContent: 'center',
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.sm,
                    borderWidth: 1,
                    borderColor: on
                      ? l.is_best_lap
                        ? theme.palette.gold // tour de référence = chrono/record (or)
                        : theme.palette.edge
                      : theme.palette.line,
                    backgroundColor: on ? 'rgba(255,255,255,0.07)' : theme.palette.card2,
                    opacity: pressed ? 0.85 : l.is_outlap || l.is_inlap ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono,
                      color: on ? theme.palette.cream : theme.palette.creamMute,
                      fontSize: theme.fontSize.small,
                    }}
                  >
                    {l.lap_number}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Fait du tour (chrono DB réel + type) à gauche, toggle détails à droite. */}
        {currentLap || canToggle ? (
          <View style={s.metaRow}>
            {currentLap ? (
              <Text style={s.meta}>
                <Text style={currentLap.is_best_lap ? { color: theme.palette.gold } : null}>
                  {formatLapTime(currentLap.duration_seconds)}
                </Text>
                {' · '}
                {lapKindLabel(currentLap)}
              </Text>
            ) : (
              <View />
            )}
            {canToggle && laps.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: level === 'detailed' }}
                hitSlop={theme.hitSlop}
                onPress={toggle}
                style={s.toggleHit}
              >
                <Text style={s.toggle}>
                  {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Scène de rejeu */}
        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucun tour à rejouer"
          emptyMessage="Le rejeu s'ouvre dès qu'une session contient au moins un tour complet."
          emptySource="laps"
          errorCause="Vos tours n'ont pas pu être chargés."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <ReplayStage frames={frames} showGs={level === 'detailed'} />
        </StateWrapper>

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.back}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Scène de rejeu (maquette #6c) : `TrackStage` mode `replay` contrôlé + relevé
 * vitesse dans la carte + scrubber manuel (chrono or) + pastilles ‹ ⏸ ›.
 * Aucune lecture automatique : la lecture ne part que sur geste du pilote.
 */
function ReplayStage({ frames, showGs }: { frames: SessionFrame[]; showGs: boolean }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const widthRef = useRef(1);
  const total = frames.length;

  // Réinitialise curseur et lecture quand on change de tour.
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [frames]);

  // Tracé : uniquement les frames avec position GPS réelle (jamais un (0,0)).
  const trajectory = useMemo(
    () =>
      frames
        .filter((f) => f.lat != null && f.lon != null)
        .map((f) => ({ lat: f.lat as number, lon: f.lon as number, speed: f.speedKmh ?? 0 })),
    [frames]
  );

  const firstMs = total > 0 ? frames[0].elapsedMs : 0;
  // Fenêtre temporelle réelle du tour (frames telemetry_frames).
  const totalMs = total > 1 ? frames[total - 1].elapsedMs - firstMs : 0;

  const index = total > 1 ? Math.round(progress * (total - 1)) : 0;
  const cur: SessionFrame | undefined = frames[index];
  const elapsedMs = cur ? cur.elapsedMs - firstMs : 0;

  // Lecture 1× au rythme réel du tour. Jamais lancée seule ; s'arrête au bout.
  useEffect(() => {
    if (!playing || totalMs <= 0) return undefined;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      setProgress((p) => Math.min(1, p + dt / totalMs));
    }, 80);
    return () => clearInterval(id);
  }, [playing, totalMs]);

  // Fin de tour : la lecture s'arrête (pas de boucle — sobriété).
  useEffect(() => {
    if (playing && progress >= 1) setPlaying(false);
  }, [playing, progress]);

  const setFromX = (x: number) => {
    setPlaying(false); // le geste reprend la main sur la lecture
    const w = widthRef.current || 1;
    setProgress(Math.max(0, Math.min(1, x / w)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    })
  ).current;

  /** Recule/avance d'une seconde réelle dans la fenêtre du tour. */
  const stepBy = (dir: 1 | -1) => {
    if (totalMs <= 0) return;
    setPlaying(false);
    setProgress((p) => Math.max(0, Math.min(1, p + (dir * 1000) / totalMs)));
  };

  if (total === 0) {
    return (
      <DataEmptyState
        label="Pas de frames sur ce tour"
        message="Le rejeu se construit sur vos frames réelles. Choisissez un tour complet."
        source="telemetry_frames"
      />
    );
  }

  return (
    <View>
      {/* Carte surface : tracé + relevé vitesse de la frame courante (crème —
          la vitesse est une donnée, l'or reste au chrono). */}
      <View style={{ position: 'relative' }}>
        <TrackStage
          mode="replay"
          trajectory={trajectory}
          progress={progress}
          autoplay={false}
          height={300}
          background={theme.palette.card}
        />
        <View
          style={s.speedOverlay}
          pointerEvents="none"
          accessible
          accessibilityLabel={
            cur?.speedKmh != null
              ? `Vitesse à cet instant : ${Math.round(cur.speedKmh)} kilomètres par heure`
              : 'Vitesse à cet instant : non mesurée'
          }
        >
          <Text style={s.speedValue}>
            {cur?.speedKmh != null ? String(Math.round(cur.speedKmh)) : '—'}
          </Text>
          <Text style={s.speedUnit}>km/h</Text>
        </View>
      </View>

      {/* Scrubber manuel : chrono OR qui suit la position + total du tour. */}
      {totalMs > 0 ? (
        <>
          <View style={s.scrubRow}>
            <Text style={s.chronoNow}>{formatChronoMs(elapsedMs)}</Text>
            <View
              style={s.scrubTrack}
              accessibilityRole="adjustable"
              accessibilityLabel="Position dans le tour"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(progress * 100),
                text: `${formatChronoMs(elapsedMs)} sur ${formatChronoMs(totalMs)}`,
              }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e: AccessibilityActionEvent) => {
                if (e.nativeEvent.actionName === 'increment') stepBy(1);
                else if (e.nativeEvent.actionName === 'decrement') stepBy(-1);
              }}
              onLayout={(e: LayoutChangeEvent) => {
                widthRef.current = e.nativeEvent.layout.width;
              }}
              {...pan.panHandlers}
            >
              <View style={s.scrubBar} accessibilityElementsHidden importantForAccessibility="no">
                <View style={[s.scrubFill, { width: `${progress * 100}%` }]} />
              </View>
              <View
                style={[s.scrubThumb, { left: `${progress * 100}%` }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <Text style={s.chronoTotal}>{formatChronoMs(totalMs)}</Text>
          </View>
          <Text style={s.scrubHint}>Faites glisser pour avancer — pas de lecture automatique.</Text>
        </>
      ) : null}

      {/* Tuiles live G (mode détaillé) — frame courante, réel ou « — ». */}
      {showGs ? (
        <View style={s.readouts}>
          <Fact label="G latéral" value={formatG(cur?.gLat)} unit="g" />
          <Fact label="G long." value={formatG(cur?.gLong)} unit="g" />
        </View>
      ) : null}

      {/* Commandes ‹ ⏸ › en pastilles (maquette #6c). Chaque bouton agit
          réellement sur le curseur ; rien ne se lance tout seul. */}
      {totalMs > 0 ? (
        <View style={s.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reculer d'une seconde dans le tour"
            hitSlop={theme.hitSlop}
            onPress={() => stepBy(-1)}
            style={({ pressed }) => [s.sideBtn, pressed && { opacity: 0.7 }]}
          >
            <View style={s.chevLeft} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Mettre en pause' : 'Lire le tour'}
            accessibilityHint="La lecture avance le curseur au rythme réel du tour"
            hitSlop={theme.hitSlop}
            onPress={() => {
              if (!playing && progress >= 1) setProgress(0);
              setPlaying((p) => !p);
            }}
            style={({ pressed }) => [s.playBtn, pressed && { opacity: 0.85 }]}
          >
            {playing ? (
              <View style={s.pauseIcon}>
                <View style={s.pauseBar} />
                <View style={s.pauseBar} />
              </View>
            ) : (
              <View style={s.playIcon} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Avancer d'une seconde dans le tour"
            hitSlop={theme.hitSlop}
            onPress={() => stepBy(1)}
            style={({ pressed }) => [s.sideBtn, pressed && { opacity: 0.7 }]}
          >
            <View style={s.chevRight} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = {
  metaRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.md,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  toggle: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  // Cible tactile confortable pour le lien-toggle (texte seul).
  toggleHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  // Relevé vitesse dans la carte (maquette : grand mono crème en haut à droite).
  speedOverlay: {
    position: 'absolute' as const,
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'flex-end' as const,
  },
  speedValue: {
    fontFamily: theme.fonts.king,
    fontSize: 30,
    letterSpacing: -0.5,
    color: theme.palette.cream,
  },
  speedUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.eyebrow,
    marginTop: 2,
  },
  // — Scrubber (maquette : chrono or · barre fine or · total) —
  scrubRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  chronoNow: {
    fontFamily: theme.fonts.monoSemi, // chrono accentué = or (loi couleur)
    fontSize: theme.fontSize.small,
    color: theme.palette.gold,
  },
  chronoTotal: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  scrubTrack: {
    flex: 1,
    height: 44, // cible tactile pleine hauteur
    justifyContent: 'center' as const,
  },
  scrubBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.palette.borderHair,
    overflow: 'hidden' as const,
  },
  scrubFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
  },
  scrubThumb: {
    position: 'absolute' as const,
    top: 15,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: theme.palette.gold,
  },
  scrubHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.micro,
    color: theme.palette.legend,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  readouts: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  // — Pastilles de commande ‹ ⏸ › —
  controls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xl,
    marginTop: theme.spacing.xxl,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.palette.cream,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chevLeft: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: theme.palette.creamSoft,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  chevRight: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: theme.palette.creamSoft,
    transform: [{ rotate: '225deg' }],
    marginRight: 3,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: theme.palette.night,
    marginLeft: 3,
  },
  pauseIcon: {
    flexDirection: 'row' as const,
    gap: 5,
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 1.5,
    backgroundColor: theme.palette.night,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  // Cible tactile confortable pour le lien « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
