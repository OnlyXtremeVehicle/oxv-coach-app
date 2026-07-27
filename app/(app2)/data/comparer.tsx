/**
 * COMPARER — mise en regard de deux lectures (V2-L3 DATA). Route NOUVELLE du
 * groupe (app2) : `/data/comparer`, lue avec `?a=&b=` (deux séances) et,
 * optionnellement, `?friend=` (comparaison avec un ami accepté).
 *
 * DOCTRINE (verrouillée, non négociable) :
 *  - AUCUN gagnant, AUCUN classement. Deux colonnes strictement symétriques ;
 *    l'écart est un signe orienté NEUTRE (compareFacts → ComparedRow, déjà
 *    signé sans jugement). Les DEUX valeurs sont en `text.hi`, jamais teintées
 *    d'un verdict. L'écart vit en `text.mid`.
 *  - SELF-ONLY côté données brutes : on ne lit que SES propres séances, tours,
 *    trames. Le mode Ami s'appuie sur les RLS d'amitié (0027) qui n'ouvrent que
 *    les FAITS de séance de l'ami (meilleur tour, vitesse max) — jamais ses
 *    tours ni ses trames. Ce qui n'est pas lisible reste « — » (honnête).
 *  - DONNÉES RÉELLES : chaque valeur trace vers une source réelle. La prod n'a
 *    presque pas de trames (≈ 1 séance / 1 tour) : chaque bloc dégrade
 *    proprement en état vide honnête, jamais un chiffre fabriqué.
 *  - Couleurs d'IDENTITÉ (pas de hiérarchie) : A = accent, B = crème neutre.
 *    Deux étiquettes de « qui », posées à l'identique des deux côtés. L'OR est
 *    BANNI ici (réservé record/prestige app-wide) : il peindrait le côté B en
 *    « étalon » et créerait une hiérarchie. En mode Ami : Vous = accent, l'ami
 *    = crème — deux teintes neutres de même poids.
 *
 * Trois modes (Chip) : Séances · Tours · Ami.
 *  - Séances : deux têtes SessionCard (remplaçables via Sheet) + tableau
 *    compareFacts (meilleur tour, régularité, vitesse maxi, distance).
 *  - Tours : sélecteurs de tour (mini barres) + tracés superposés (Skia,
 *    A accent / B crème) + canaux de vitesse superposés avec un curseur partagé
 *    qui lit LES DEUX côtés.
 *  - Ami (`?friend=`) : deux pastilles d'identité, sélecteurs de séance de
 *    chaque côté, tableau côte à côte. La régularité et la distance de l'ami
 *    ne sont pas ouvertes par la RLS → « — » honnête.
 *
 * Partage : capture (react-native-view-shot) de la carte de comparaison sobre
 * → feuille de partage OS (expo-sharing).
 *
 * Self-contained : n'importe que @/ui/v2, @/services/*, @/features/data/*,
 * @/store/* et les types. Aucun fichier partagé inter-écrans créé.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Canvas, Path } from '@shopify/react-native-skia';
import Animated from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import {
  Chip,
  PressScale,
  SectionHeader,
  SessionCard,
  Sheet,
  StateView,
  centerlineToTrace,
  colors,
  msToLapLabel,
  pointsToSvgPath,
  radius,
  space,
  tabBarSpace,
  typo,
  useDoorTransition,
  type XY,
} from '@/ui/v2';
import { compareFacts, type ComparedRow, type SideFacts } from '@/features/data/comparerLogic';
import { regularityHistogram } from '@/features/data/seasonLogic';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames, type SessionFrame } from '@/services/sessionTelemetryService';
import { loadFriendSessionList, type DuelSessionRow } from '@/services/duelService';
import { listAcceptedFriends } from '@/services/friendshipsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { Lap, TelemetrySession } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Constantes d'identité et de mise en page
// ---------------------------------------------------------------------------

// Couleurs d'IDENTITÉ (jamais un rang) : A = accent, B = crème neutre.
// L'OR est BANNI ici : `heritage.gold` = record/référence/prestige app-wide
// (tokens.ts « jamais un chrome générique »). L'utiliser pour le côté B / l'ami
// le peindrait en couleur « étalon » et introduirait une hiérarchie sur un écran
// doctrinalement SANS gagnant. Deux teintes neutres de même poids, point.
const A_COLOR = colors.accent;
const B_COLOR = colors.text.hi;

const TRACE_HEIGHT = 200;
const SPEED_HEIGHT = 120;

type Mode = 'seances' | 'tours' | 'ami';
type LoadStatus = 'loading' | 'ready' | 'error';
type Slot = 'A' | 'B';

// ---------------------------------------------------------------------------
// Helpers purs d'affichage (locaux — rien d'inventé)
// ---------------------------------------------------------------------------

/** Conversion sûre des numeric Supabase (parfois des chaînes au runtime). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** « 4 juil. » — date courte sans année (têtes de séance). */
function formatDayMonth(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Initiales (2 lettres max) d'un nom, « — » à défaut. */
function initialsFrom(source: string | null): string {
  const letters = (source ?? '')
    .replace(/^@+/, '')
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || '—';
}

/** Chrono de référence d'une séance, en millisecondes, ou undefined. */
function bestMsOf(session: TelemetrySession | undefined): number | undefined {
  const s = num(session?.best_lap_seconds);
  return s !== null && s > 0 ? s * 1000 : undefined;
}

/** Ne garde que les tours chronométrés « de course » (hors outlap/inlap). */
function racingLaps(laps: Lap[] | undefined): Lap[] {
  return (laps ?? []).filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);
}

/** Numéro du tour de référence (durée mini) d'une séance, ou null. */
function bestLapNumber(laps: Lap[] | undefined): number | null {
  const racing = racingLaps(laps);
  if (racing.length === 0) return null;
  let best = racing[0];
  // duration_seconds arrive en STRING depuis PostgREST (colonne numeric) : comparer
  // via Number(), sinon « 9.5 » < « 10.2 » se lit lexicographiquement (faux tour).
  for (const l of racing) if (Number(l.duration_seconds) < Number(best.duration_seconds)) best = l;
  return best.lap_number;
}

/**
 * Part FACTUELLE des tours à ≤ 1 s du tour de référence, en % (seasonLogic).
 * Aucun tour lisible → null (jamais un zéro fabriqué).
 */
function regularityPctOf(laps: Lap[] | undefined): number | null {
  const durations = racingLaps(laps).map((l) => l.duration_seconds);
  if (durations.length === 0) return null;
  const bestSec = Math.min(...durations);
  const hist = regularityHistogram(
    durations.map((d) => d * 1000),
    bestSec * 1000
  );
  return hist.withinOneSecPct;
}

/** Faits d'un côté (SideFacts) à partir d'une séance + sa régularité mesurée. */
function sessionFacts(
  session: TelemetrySession | undefined,
  regularityPct: number | null | undefined
): SideFacts {
  return {
    bestLapMs: bestMsOf(session) ?? null,
    regularityPct: regularityPct ?? null,
    maxSpeedKmh: num(session?.max_speed_kmh),
    distanceKm: num(session?.distance_km),
  };
}

/** Trames → points lat/lon exploitables (filtre les trames sans GPS). */
function toLatLon(frames: SessionFrame[] | null): { lat: number; lon: number }[] {
  if (!frames) return [];
  const out: { lat: number; lon: number }[] = [];
  for (const f of frames) {
    if (f.lat !== null && f.lon !== null) out.push({ lat: f.lat, lon: f.lon });
  }
  return out;
}

/** Série vitesse {t 0..1, v km/h} d'un tour, filtrée des trames sans vitesse. */
function speedSeries(frames: SessionFrame[] | null): { t: number; v: number }[] {
  if (!frames) return [];
  const valid = frames.filter((f) => f.speedKmh !== null && Number.isFinite(f.speedKmh));
  if (valid.length < 2) return [];
  return valid.map((f, i) => ({ t: i / (valid.length - 1), v: f.speedKmh as number }));
}

/** Vitesse échantillonnée à l'abscisse t (0..1) — plus proche voisin. */
function sampleAt(series: { t: number; v: number }[], t: number): number | null {
  if (series.length === 0) return null;
  const idx = Math.round(clampT(t) * (series.length - 1));
  return series[idx]?.v ?? null;
}

/** Borne 0..1. */
function clampT(t: number): number {
  return Math.max(0, Math.min(1, t));
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function ComparerScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string; friend?: string }>();
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const myFirstName = useAuthStore((s) => s.profile?.first_name ?? null);

  const friendParam = typeof params.friend === 'string' ? params.friend : null;

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sessions, setSessions] = useState<TelemetrySession[]>([]);
  const [idA, setIdA] = useState<string | null>(null);
  const [idB, setIdB] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(friendParam ? 'ami' : 'seances');

  // Tours + régularité, mis en cache par identifiant de séance.
  const [lapsBySession, setLapsBySession] = useState<Record<string, Lap[]>>({});
  const [regBySession, setRegBySession] = useState<Record<string, number | null>>({});

  // Tour sélectionné de chaque côté (mode Tours).
  const [lapA, setLapA] = useState<number | null>(null);
  const [lapB, setLapB] = useState<number | null>(null);
  const [framesA, setFramesA] = useState<SessionFrame[] | null>(null);
  const [framesB, setFramesB] = useState<SessionFrame[] | null>(null);

  // Remplacement de séance (Sheet).
  const [replaceSlot, setReplaceSlot] = useState<Slot | null>(null);

  // Ami.
  const [friendInfo, setFriendInfo] = useState<{
    handle: string | null;
    firstName: string | null;
  } | null>(null);
  const [friendSessions, setFriendSessions] = useState<DuelSessionRow[]>([]);
  const [friendSel, setFriendSel] = useState<string | null>(null);

  // Partage.
  const captureAreaRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  // ── Chargement des séances (strict → l'erreur DB devient un état, pas [] trompeur)
  const load = useCallback(() => {
    if (!myUserId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    fetchAllSessions(myUserId, { limit: 40, strict: true })
      .then((rows) => {
        setSessions(rows);
        const ids = new Set(rows.map((r) => r.id));
        const a0 = params.a && ids.has(params.a) ? params.a : (rows[0]?.id ?? null);
        const b0 =
          params.b && ids.has(params.b) && params.b !== a0
            ? params.b
            : (rows.find((r) => r.id !== a0)?.id ?? null);
        setIdA(a0);
        setIdB(b0);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [myUserId, params.a, params.b]);

  useEffect(load, [load]);

  // ── Tours + régularité des séances sélectionnées (cache par id, sans refetch)
  useEffect(() => {
    const targets = [idA, idB].filter((id): id is string => id !== null && !(id in lapsBySession));
    if (targets.length === 0) return;
    let cancelled = false;
    targets.forEach((sid) => {
      fetchSessionLaps(sid, { strict: true })
        .then((laps) => {
          if (cancelled) return;
          setLapsBySession((prev) => ({ ...prev, [sid]: laps }));
          setRegBySession((prev) => ({ ...prev, [sid]: regularityPctOf(laps) }));
        })
        .catch(() => {
          if (cancelled) return;
          // Panne de lecture des tours : régularité NON mesurée (« — »), jamais 0.
          setLapsBySession((prev) => ({ ...prev, [sid]: [] }));
          setRegBySession((prev) => ({ ...prev, [sid]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [idA, idB, lapsBySession]);

  // ── Réinitialise le tour choisi quand la séance du côté change
  useEffect(() => {
    setLapA(null);
  }, [idA]);
  useEffect(() => {
    setLapB(null);
  }, [idB]);

  // ── Défaut : tour de référence de chaque côté, une fois les tours lus
  useEffect(() => {
    if (idA && lapA === null && lapsBySession[idA]) {
      const n = bestLapNumber(lapsBySession[idA]);
      if (n !== null) setLapA(n);
    }
  }, [idA, lapA, lapsBySession]);
  useEffect(() => {
    if (idB && lapB === null && lapsBySession[idB]) {
      const n = bestLapNumber(lapsBySession[idB]);
      if (n !== null) setLapB(n);
    }
  }, [idB, lapB, lapsBySession]);

  // ── Trames du tour sélectionné (mode Tours uniquement)
  useEffect(() => {
    if (mode !== 'tours' || !idA || lapA === null) {
      setFramesA(null);
      return;
    }
    let cancelled = false;
    setFramesA(null);
    loadLapFrames(idA, lapA)
      .then((f) => {
        if (!cancelled) setFramesA(f);
      })
      .catch(() => {
        if (!cancelled) setFramesA([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, idA, lapA]);
  useEffect(() => {
    if (mode !== 'tours' || !idB || lapB === null) {
      setFramesB(null);
      return;
    }
    let cancelled = false;
    setFramesB(null);
    loadLapFrames(idB, lapB)
      .then((f) => {
        if (!cancelled) setFramesB(f);
      })
      .catch(() => {
        if (!cancelled) setFramesB([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, idB, lapB]);

  // ── Ami : info + séances de l'ami (RLS 0027). [] si l'amitié n'est pas (plus) acceptée.
  useEffect(() => {
    if (!friendParam || !myUserId) return;
    let cancelled = false;
    Promise.all([listAcceptedFriends(myUserId), loadFriendSessionList(friendParam, 20)])
      .then(([friends, fsessions]) => {
        if (cancelled) return;
        const f = friends.find((x) => x.friendId === friendParam);
        setFriendInfo(
          f
            ? { handle: f.friendHandle, firstName: f.friendFirstName }
            : { handle: null, firstName: null }
        );
        setFriendSessions(fsessions);
        if (fsessions.length > 0) setFriendSel(fsessions[0].sessionId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [friendParam, myUserId]);

  const sessionA = useMemo(() => sessions.find((s) => s.id === idA), [sessions, idA]);
  const sessionB = useMemo(() => sessions.find((s) => s.id === idB), [sessions, idB]);

  // ── Partage : capture de la carte de comparaison sobre, feuille OS
  const onShare = useCallback(async () => {
    if (sharing || !captureAreaRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(captureAreaRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager la comparaison',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter au pilote.
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  const friendName =
    friendInfo?.firstName ?? (friendInfo?.handle ? `@${friendInfo.handle}` : 'Cet ami');

  // ── Facts des trois modes (compareFacts — écart neutre, aucun gagnant)
  const seanceRows = useMemo(
    () =>
      compareFacts(
        sessionFacts(sessionA, idA ? regBySession[idA] : null),
        sessionFacts(sessionB, idB ? regBySession[idB] : null)
      ),
    [sessionA, sessionB, idA, idB, regBySession]
  );

  const friendRow = useMemo(
    () => friendSessions.find((s) => s.sessionId === friendSel),
    [friendSessions, friendSel]
  );
  const amiRows = useMemo(() => {
    const selfFacts = sessionFacts(sessionA, idA ? regBySession[idA] : null);
    // Côté ami : la RLS n'ouvre que meilleur tour + vitesse maxi. Régularité et
    // distance restent NON lisibles → null (« — »), jamais fabriquées.
    const friendFacts: SideFacts = {
      bestLapMs:
        friendRow?.bestLapSeconds != null && friendRow.bestLapSeconds > 0
          ? friendRow.bestLapSeconds * 1000
          : null,
      regularityPct: null,
      maxSpeedKmh: friendRow?.maxSpeedKmh ?? null,
      distanceKm: null,
    };
    return compareFacts(selfFacts, friendFacts);
  }, [sessionA, idA, regBySession, friendRow]);

  // ── Rendu
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          paddingHorizontal: space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={door}>
          {/* En-tête sobre : retour · titre · partage */}
          <View style={styles.header}>
            {/* Glyphes de 20 pt : hitSlop 12 pour atteindre la cible de 44 pt. */}
            <PressScale
              onPress={() => router.back()}
              accessibilityLabel="Retour"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <BackGlyph />
            </PressScale>
            <Text style={styles.headerTitle} accessibilityRole="header">
              COMPARER
            </Text>
            <PressScale
              onPress={onShare}
              disabled={sharing}
              accessibilityLabel="Partager la comparaison"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ShareGlyph />
            </PressScale>
          </View>

          {/* Trois modes */}
          <View style={styles.chipRow}>
            <Chip label="Séances" active={mode === 'seances'} onPress={() => setMode('seances')} />
            <Chip label="Tours" active={mode === 'tours'} onPress={() => setMode('tours')} />
            <Chip label="Ami" active={mode === 'ami'} onPress={() => setMode('ami')} />
          </View>

          {status === 'loading' ? (
            <StateView state="loading" shape="list" style={styles.stateWrap} />
          ) : status === 'error' ? (
            <StateView
              state="error"
              errorMessage="Vos séances n'ont pas pu être chargées."
              onRetry={load}
              style={styles.stateWrap}
            />
          ) : mode === 'ami' ? (
            <AmiBody
              hasFriendParam={friendParam !== null}
              captureRef={captureAreaRef}
              friendName={friendName}
              myInitials={initialsFrom(myFirstName)}
              friendInitials={initialsFrom(friendInfo?.firstName ?? friendInfo?.handle ?? null)}
              mySessions={sessions}
              selfId={idA}
              onSelfSelect={setIdA}
              friendSessions={friendSessions}
              friendSel={friendSel}
              onFriendSelect={setFriendSel}
              rows={amiRows}
            />
          ) : sessions.length < 2 ? (
            <StateView
              state="empty"
              emptyMessage="Comparer demande au moins deux séances. Roulez encore une fois et elles se mettront en regard ici."
              style={styles.stateWrap}
            />
          ) : mode === 'seances' ? (
            <SeancesBody
              captureRef={captureAreaRef}
              sessionA={sessionA}
              sessionB={sessionB}
              onReplace={setReplaceSlot}
              rows={seanceRows}
            />
          ) : (
            <ToursBody
              captureRef={captureAreaRef}
              sessionA={sessionA}
              sessionB={sessionB}
              lapsA={idA ? lapsBySession[idA] : undefined}
              lapsB={idB ? lapsBySession[idB] : undefined}
              lapA={lapA}
              lapB={lapB}
              onSelectLapA={setLapA}
              onSelectLapB={setLapB}
              framesA={framesA}
              framesB={framesB}
              onReplace={setReplaceSlot}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Sheet de remplacement de séance (modes Séances / Tours) */}
      <Sheet visible={replaceSlot !== null} onClose={() => setReplaceSlot(null)} snapHeight={420}>
        <SectionHeader
          eyebrow={replaceSlot ? `CHOISIR LA SÉANCE ${replaceSlot}` : 'CHOISIR LA SÉANCE'}
        />
        <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
          {sessions.map((row) => {
            const otherId = replaceSlot === 'A' ? idB : idA;
            if (row.id === otherId) return null; // pas deux fois la même
            const active = (replaceSlot === 'A' ? idA : idB) === row.id;
            return (
              <View key={row.id} style={styles.sheetCardWrap}>
                <SessionCard
                  circuit={row.circuit_name || '—'}
                  dateLabel={formatDayMonth(row.started_at)}
                  chronoMs={bestMsOf(row)}
                  onPress={() => {
                    if (replaceSlot === 'A') setIdA(row.id);
                    else if (replaceSlot === 'B') setIdB(row.id);
                    setReplaceSlot(null);
                  }}
                  style={active ? styles.sheetCardActive : undefined}
                />
              </View>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mode Séances — deux têtes remplaçables + tableau des faits
// ---------------------------------------------------------------------------

function SeancesBody({
  captureRef: areaRef,
  sessionA,
  sessionB,
  onReplace,
  rows,
}: {
  captureRef: React.RefObject<View | null>;
  sessionA: TelemetrySession | undefined;
  sessionB: TelemetrySession | undefined;
  onReplace: (slot: Slot) => void;
  rows: ComparedRow[];
}) {
  return (
    <View>
      <SlotHead slot="A" color={A_COLOR} session={sessionA} onReplace={() => onReplace('A')} />
      <SlotHead slot="B" color={B_COLOR} session={sessionB} onReplace={() => onReplace('B')} />

      <View ref={areaRef} collapsable={false} style={styles.factsCard}>
        {rows.map((row, i) => (
          <FactRow key={row.key} row={row} last={i === rows.length - 1} />
        ))}
      </View>

      <Text style={styles.manifest}>Vos deux séances, sans gagnant — juste ce qui a changé.</Text>
    </View>
  );
}

/** Tête d'un côté : eyebrow d'identité coloré + carte séance (appui → remplacer). */
function SlotHead({
  slot,
  color,
  session,
  onReplace,
}: {
  slot: Slot;
  color: string;
  session: TelemetrySession | undefined;
  onReplace: () => void;
}) {
  return (
    <View style={styles.slotHead}>
      <View style={styles.slotEyebrowRow}>
        <View style={[styles.slotDot, { backgroundColor: color }]} />
        <Text style={[styles.slotEyebrow, { color }]}>SÉANCE {slot}</Text>
        <Text style={styles.slotReplace}>Remplacer</Text>
      </View>
      {session ? (
        <SessionCard
          circuit={session.circuit_name || '—'}
          dateLabel={formatDayMonth(session.started_at)}
          chronoMs={bestMsOf(session)}
          onPress={onReplace}
        />
      ) : (
        <Text style={styles.muted}>Aucune séance sélectionnée.</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mode Tours — sélecteurs de tour + tracés + canaux de vitesse superposés
// ---------------------------------------------------------------------------

function ToursBody({
  captureRef: areaRef,
  sessionA,
  sessionB,
  lapsA,
  lapsB,
  lapA,
  lapB,
  onSelectLapA,
  onSelectLapB,
  framesA,
  framesB,
  onReplace,
}: {
  captureRef: React.RefObject<View | null>;
  sessionA: TelemetrySession | undefined;
  sessionB: TelemetrySession | undefined;
  lapsA: Lap[] | undefined;
  lapsB: Lap[] | undefined;
  lapA: number | null;
  lapB: number | null;
  onSelectLapA: (n: number) => void;
  onSelectLapB: (n: number) => void;
  framesA: SessionFrame[] | null;
  framesB: SessionFrame[] | null;
  onReplace: (slot: Slot) => void;
}) {
  return (
    <View>
      <SlotLine slot="A" color={A_COLOR} session={sessionA} onReplace={() => onReplace('A')} />
      <LapSelector slot="A" color={A_COLOR} laps={lapsA} selected={lapA} onSelect={onSelectLapA} />
      <SlotLine slot="B" color={B_COLOR} session={sessionB} onReplace={() => onReplace('B')} />
      <LapSelector slot="B" color={B_COLOR} laps={lapsB} selected={lapB} onSelect={onSelectLapB} />

      <View ref={areaRef} collapsable={false} style={styles.traceCard}>
        <TraceOverlay framesA={framesA} framesB={framesB} lapA={lapA} lapB={lapB} />
        <SpeedChannels framesA={framesA} framesB={framesB} />
      </View>

      <Text style={styles.manifest}>Deux tours superposés. On regarde, on ne classe pas.</Text>
    </View>
  );
}

/** Ligne compacte de séance (appui → remplacer), au-dessus du sélecteur de tour. */
function SlotLine({
  slot,
  color,
  session,
  onReplace,
}: {
  slot: Slot;
  color: string;
  session: TelemetrySession | undefined;
  onReplace: () => void;
}) {
  return (
    <PressScale onPress={onReplace} accessibilityLabel={`Remplacer la séance ${slot}`}>
      <View style={styles.slotLine}>
        <View style={[styles.slotDot, { backgroundColor: color }]} />
        <Text style={[styles.slotLineTag, { color }]}>SÉANCE {slot}</Text>
        <Text style={styles.slotLineMeta} numberOfLines={1}>
          {session ? `${session.circuit_name || '—'} · ${formatDayMonth(session.started_at)}` : '—'}
        </Text>
        <Text style={styles.slotReplace}>Remplacer</Text>
      </View>
    </PressScale>
  );
}

/**
 * Sélecteur de tour — mini barres (plus haut = tour plus rapide). La sélection
 * porte la couleur d'identité du côté. Aucune barre n'est un « record » doré :
 * ce sont des repères de choix, pas un palmarès.
 */
function LapSelector({
  slot,
  color,
  laps,
  selected,
  onSelect,
}: {
  slot: Slot;
  color: string;
  laps: Lap[] | undefined;
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  if (laps === undefined) {
    return <StateView state="loading" shape="list" style={styles.lapLoading} />;
  }
  const racing = racingLaps(laps);
  if (racing.length === 0) {
    return <Text style={styles.muted}>Aucun tour chronométré pour cette séance.</Text>;
  }
  const durations = racing.map((l) => l.duration_seconds);
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  return (
    <View style={styles.lapSelBlock}>
      <Text style={[styles.lapSelTag, { color }]}>TOUR {slot}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.lapBarsRow}>
          {racing.map((l) => {
            const active = l.lap_number === selected;
            // Plus rapide (durée mini) = barre plus haute. Amplitude nulle → mi-hauteur.
            const norm = max === min ? 0.5 : (max - l.duration_seconds) / (max - min);
            const h = 12 + norm * 36;
            return (
              <PressScale
                key={l.lap_number}
                onPress={() => onSelect(l.lap_number)}
                // Colonne de 24 pt : hitSlop pour atteindre la cible de 44 pt.
                // La durée n'est sinon encodée que par la HAUTEUR de la barre.
                hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                accessibilityLabel={`Tour ${l.lap_number}, ${msToLapLabel(
                  Number(l.duration_seconds) * 1000
                )}`}
                accessibilityState={{ selected: active }}
              >
                <View style={styles.lapBarCol}>
                  <View style={styles.lapBarTrack}>
                    <View
                      style={[
                        styles.lapBar,
                        { height: h, backgroundColor: active ? color : colors.border.strong },
                      ]}
                    />
                  </View>
                  <Text style={[styles.lapNum, active && { color }]}>{l.lap_number}</Text>
                </View>
              </PressScale>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Tracés superposés (Skia) — A en accent, B en or. Deux couleurs d'identité,
 * aucune hiérarchie. Trames absentes → état vide honnête (la prod n'a presque
 * pas de trames avant Valence).
 *
 * TODO device-tune : chaque tracé est ajusté indépendamment à sa boîte
 * (centerlineToTrace). Sur un même circuit les silhouettes se superposent
 * bien ; une projection COMMUNE (bornes fusionnées) alignera les deux tours au
 * mètre près — à valider sur build device avec de vraies trames.
 */
function TraceOverlay({
  framesA,
  framesB,
  lapA,
  lapB,
}: {
  framesA: SessionFrame[] | null;
  framesB: SessionFrame[] | null;
  lapA: number | null;
  lapB: number | null;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const ptsA = useMemo(() => toLatLon(framesA), [framesA]);
  const ptsB = useMemo(() => toLatLon(framesB), [framesB]);
  const traceA = useMemo(
    () =>
      width > 0 && ptsA.length > 1
        ? centerlineToTrace(ptsA, width, TRACE_HEIGHT, 14, false)
        : { path: '', points: [] as XY[] },
    [width, ptsA]
  );
  const traceB = useMemo(
    () =>
      width > 0 && ptsB.length > 1
        ? centerlineToTrace(ptsB, width, TRACE_HEIGHT, 14, false)
        : { path: '', points: [] as XY[] },
    [width, ptsB]
  );

  const loading = framesA === null || framesB === null;
  const empty = !loading && ptsA.length < 2 && ptsB.length < 2;

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendDot color={A_COLOR} label={`A · Tour ${lapA ?? '—'}`} />
        <LegendDot color={B_COLOR} label={`B · Tour ${lapB ?? '—'}`} />
      </View>
      <View style={[styles.traceBox, { height: TRACE_HEIGHT }]} onLayout={onLayout}>
        {loading ? (
          <StateView state="loading" shape="hero" />
        ) : empty ? (
          <StateView
            state="empty"
            emptyMessage="La superposition des tracés apparaîtra dès que ces deux tours auront des trames réelles."
          />
        ) : width > 0 ? (
          <Canvas
            style={{ width, height: TRACE_HEIGHT }}
            accessible
            // « non choisi » remplace le tiret cadratin affiché, muet à l'oral.
            accessibilityLabel={`Tracés superposés, A ${
              lapA !== null ? `tour ${lapA}` : 'tour non choisi'
            }, B ${lapB !== null ? `tour ${lapB}` : 'tour non choisi'}`}
          >
            {traceB.path !== '' ? (
              <Path
                path={traceB.path}
                style="stroke"
                strokeWidth={2.5}
                strokeCap="round"
                strokeJoin="round"
                color={B_COLOR}
              />
            ) : null}
            {traceA.path !== '' ? (
              <Path
                path={traceA.path}
                style="stroke"
                strokeWidth={2.5}
                strokeCap="round"
                strokeJoin="round"
                color={A_COLOR}
              />
            ) : null}
          </Canvas>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Canaux de vitesse superposés (Skia) avec un curseur PARTAGÉ qui lit LES DEUX
 * côtés à la même abscisse. Le curseur ne classe rien : il énonce deux faits.
 *
 * TODO device-tune : le scrubbing est une version DE BASE (PanResponder + état
 * React). La cible 60 fps (curseur piloté par un worklet Reanimated, sans
 * re-render) est à câbler et valider sur build device.
 */
function SpeedChannels({
  framesA,
  framesB,
}: {
  framesA: SessionFrame[] | null;
  framesB: SessionFrame[] | null;
}) {
  const [width, setWidth] = useState(0);
  const [cursorT, setCursorT] = useState<number | null>(null);

  const serA = useMemo(() => speedSeries(framesA), [framesA]);
  const serB = useMemo(() => speedSeries(framesB), [framesB]);
  const maxV = useMemo(() => {
    let m = 1;
    for (const s of serA) if (s.v > m) m = s.v;
    for (const s of serB) if (s.v > m) m = s.v;
    return m;
  }, [serA, serB]);

  const pathA = useMemo(() => seriesToPath(serA, width, SPEED_HEIGHT, maxV), [serA, width, maxV]);
  const pathB = useMemo(() => seriesToPath(serB, width, SPEED_HEIGHT, maxV), [serB, width, maxV]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          if (width > 0) setCursorT(clampT(e.nativeEvent.locationX / width));
        },
        onPanResponderMove: (e) => {
          if (width > 0) setCursorT(clampT(e.nativeEvent.locationX / width));
        },
      }),
    [width]
  );

  const loading = framesA === null || framesB === null;
  const empty = !loading && serA.length < 2 && serB.length < 2;

  if (loading || empty) {
    // Le tracé au-dessus porte déjà l'état vide/chargement — ici on reste discret.
    return empty ? (
      <Text style={styles.channelHint}>
        Le profil de vitesse s&apos;affichera avec de vraies trames.
      </Text>
    ) : null;
  }

  const readA = cursorT !== null ? sampleAt(serA, cursorT) : null;
  const readB = cursorT !== null ? sampleAt(serB, cursorT) : null;

  return (
    <View style={styles.channelBlock}>
      <View style={styles.channelHead}>
        <Text style={styles.channelTitle}>PROFIL DE VITESSE</Text>
        <View style={styles.channelReadouts}>
          <ChannelReadout side="A" color={A_COLOR} value={readA} />
          <ChannelReadout side="B" color={B_COLOR} value={readB} />
        </View>
      </View>
      {/* Le curseur ne se déplace qu'au PanResponder : sans alternative, les
          deux relevés restent « non lu » pour un lecteur d'écran, et l'invite
          affichée « Glissez pour lire… » devient inapplicable. */}
      <View
        style={[styles.channelBox, { height: SPEED_HEIGHT }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Profil de vitesse des deux tours"
        accessibilityValue={{
          text: `A ${readA !== null ? `${Math.round(readA)} km/h` : 'non lu'}, B ${
            readB !== null ? `${Math.round(readB)} km/h` : 'non lu'
          }`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          setCursorT((t) =>
            clampT((t ?? 0.5) + (e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))
          )
        }
      >
        {width > 0 ? (
          <Canvas style={{ width, height: SPEED_HEIGHT }}>
            {pathB !== '' ? (
              <Path
                path={pathB}
                style="stroke"
                strokeWidth={2}
                strokeCap="round"
                strokeJoin="round"
                color={B_COLOR}
              />
            ) : null}
            {pathA !== '' ? (
              <Path
                path={pathA}
                style="stroke"
                strokeWidth={2}
                strokeCap="round"
                strokeJoin="round"
                color={A_COLOR}
              />
            ) : null}
          </Canvas>
        ) : null}
        {cursorT !== null && width > 0 ? (
          <View style={[styles.cursorLine, { left: cursorT * width }]} pointerEvents="none" />
        ) : null}
      </View>
      <Text style={styles.channelHint}>
        Glissez pour lire les deux vitesses au même endroit du tour.
      </Text>
    </View>
  );
}

/** Chemin SVG/Skia d'une série vitesse dans une boîte width×height. */
function seriesToPath(
  series: { t: number; v: number }[],
  width: number,
  height: number,
  maxV: number
): string {
  if (width <= 0 || series.length < 2 || maxV <= 0) return '';
  const points: XY[] = series.map((s) => ({
    x: s.t * width,
    y: height - (s.v / maxV) * height,
  }));
  return pointsToSvgPath(points, false);
}

/**
 * Un relevé au curseur. Le côté A ou B n'est porté à l'écran que par une
 * pastille de COULEUR : le regroupement le nomme, sinon deux valeurs identiques
 * se suivent sans qu'on sache laquelle est laquelle.
 */
function ChannelReadout({
  side,
  color,
  value,
}: {
  side: 'A' | 'B';
  color: string;
  value: number | null;
}) {
  return (
    <View
      style={styles.readout}
      accessible
      accessibilityLabel={`Côté ${side} : ${value !== null ? `${Math.round(value)} km/h` : 'non lu'}`}
    >
      <View style={[styles.slotDot, { backgroundColor: color }]} />
      <Text style={styles.readoutValue}>{value !== null ? `${Math.round(value)} km/h` : '—'}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.slotDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Mode Ami — deux pastilles d'identité + sélecteurs + tableau côte à côte
// ---------------------------------------------------------------------------

function AmiBody({
  hasFriendParam,
  captureRef: areaRef,
  friendName,
  myInitials,
  friendInitials,
  mySessions,
  selfId,
  onSelfSelect,
  friendSessions,
  friendSel,
  onFriendSelect,
  rows,
}: {
  hasFriendParam: boolean;
  captureRef: React.RefObject<View | null>;
  friendName: string;
  myInitials: string;
  friendInitials: string;
  mySessions: TelemetrySession[];
  selfId: string | null;
  onSelfSelect: (id: string) => void;
  friendSessions: DuelSessionRow[];
  friendSel: string | null;
  onFriendSelect: (id: string) => void;
  rows: ComparedRow[];
}) {
  if (!hasFriendParam) {
    return (
      <StateView
        state="empty"
        emptyMessage="Ouvrez un ami depuis vos amis pour le mettre en regard, côte à côte."
        style={styles.stateWrap}
      />
    );
  }

  const hasBoth = mySessions.length > 0 && friendSessions.length > 0;

  return (
    <View>
      <View style={styles.duo}>
        <IdentityBadge initials={myInitials} name="Vous" color={A_COLOR} />
        <Text style={styles.amp}>&amp;</Text>
        <IdentityBadge initials={friendInitials} name={friendName} color={B_COLOR} />
      </View>

      {!hasBoth ? (
        <Text style={styles.muted}>
          Une séance de chaque côté suffit à comparer. Elles apparaîtront ici dès que {friendName}{' '}
          et vous en aurez chacun une.
        </Text>
      ) : (
        <>
          <PillPicker
            tag="VOTRE SÉANCE"
            color={A_COLOR}
            items={mySessions.map((s) => ({
              id: s.id,
              label: `${formatDayMonth(s.started_at)} · ${s.circuit_name || '—'}`,
            }))}
            selectedId={selfId}
            onSelect={onSelfSelect}
          />
          <PillPicker
            tag={`SÉANCE DE ${friendName.toUpperCase()}`}
            color={B_COLOR}
            items={friendSessions.map((s) => ({
              id: s.sessionId,
              label: `${formatDayMonth(s.startedAt)} · ${s.circuitName || '—'}`,
            }))}
            selectedId={friendSel}
            onSelect={onFriendSelect}
          />

          <View ref={areaRef} collapsable={false} style={styles.factsCard}>
            {rows.map((row, i) => (
              <FactRow key={row.key} row={row} last={i === rows.length - 1} />
            ))}
          </View>
        </>
      )}

      <Text style={styles.manifest}>Deux styles, deux tours. On regarde, on ne classe pas.</Text>
    </View>
  );
}

/** Pastille d'identité — anneau de couleur du côté (accent / or). */
function IdentityBadge({
  initials,
  name,
  color,
}: {
  initials: string;
  name: string;
  color: string;
}) {
  return (
    <View style={styles.badgeWrap} accessible accessibilityLabel={name}>
      <View style={[styles.badge, { borderColor: color }]}>
        <Text style={styles.badgeInitials}>{initials}</Text>
      </View>
      <Text style={[styles.badgeName, { color }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

/** Sélecteur horizontal de séances (pills), accent du côté. */
function PillPicker({
  tag,
  color,
  items,
  selectedId,
  onSelect,
}: {
  tag: string;
  color: string;
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={[styles.lapSelTag, { color }]}>{tag}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.pickerRow}>
          {items.map((it) => {
            const active = it.id === selectedId;
            return (
              <PressScale
                key={it.id}
                onPress={() => onSelect(it.id)}
                accessibilityLabel={it.label}
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.pill, active && { borderColor: color }]}>
                  <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                    {it.label}
                  </Text>
                </View>
              </PressScale>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tableau des faits — deux colonnes symétriques, écart neutre
// ---------------------------------------------------------------------------

/**
 * Une ligne de faits mis en regard : valeur A · (libellé + écart neutre) ·
 * valeur B. Les deux valeurs sont en `text.hi` (aucune couleur de jugement) ;
 * l'écart signé, déjà neutre, vit en `text.mid`. « — » quand un côté manque.
 */
function FactRow({ row, last }: { row: ComparedRow; last?: boolean }) {
  return (
    <View
      style={[styles.factRow, !last && styles.factRowBorder]}
      accessible
      accessibilityLabel={`${row.label}. Côté A : ${row.aText}. Côté B : ${row.bText}. Écart : ${
        row.deltaText ?? 'non calculable'
      }.`}
    >
      <Text style={styles.factValue}>{row.aText}</Text>
      <View style={styles.factCenter}>
        <Text style={styles.factLabel}>{row.label}</Text>
        <Text style={styles.factDelta}>{row.deltaText ?? '—'}</Text>
      </View>
      <Text style={[styles.factValue, styles.factValueRight]}>{row.bText}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glyphes d'en-tête (SVG au trait, cohérents avec le kit)
// ---------------------------------------------------------------------------

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <SvgPath
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ShareGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <SvgPath
        d="M12 3.5 L12 14.5 M12 3.5 L8.5 7 M12 3.5 L15.5 7"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <SvgPath
        d="M5 11 L5 18.5 C5 19.6 5.9 20.5 7 20.5 L17 20.5 C18.1 20.5 19 19.6 19 18.5 L19 11"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xl,
  },
  stateWrap: {
    marginTop: space.xxl,
  },

  // Têtes de séance (mode Séances)
  slotHead: {
    marginTop: space.xl,
  },
  slotEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  slotEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    flex: 1,
  },
  slotReplace: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },

  // Ligne compacte de séance (mode Tours)
  slotLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    marginTop: space.lg,
  },
  slotLineTag: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  slotLineMeta: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },

  // Sélecteur de tour (mini barres)
  lapLoading: {
    marginTop: space.md,
  },
  lapSelBlock: {
    marginTop: space.sm,
    marginBottom: space.md,
  },
  lapSelTag: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: space.sm,
  },
  lapBarsRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-end',
  },
  lapBarCol: {
    alignItems: 'center',
    gap: space.xs,
    minWidth: 24,
  },
  lapBarTrack: {
    height: 48,
    justifyContent: 'flex-end',
  },
  lapBar: {
    width: 10,
    borderRadius: radius.pill,
  },
  lapNum: {
    fontFamily: typo.mono,
    fontSize: 10,
    color: colors.text.low,
    fontVariant: ['tabular-nums'],
  },

  // Carte tracé + vitesse (mode Tours)
  traceCard: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  legendRow: {
    flexDirection: 'row',
    gap: space.lg,
    marginBottom: space.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  legendLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
  },
  traceBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBlock: {
    marginTop: space.xl,
  },
  channelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  channelTitle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  channelReadouts: {
    flexDirection: 'row',
    gap: space.md,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  readoutValue: {
    fontFamily: typo.monoSemi,
    fontSize: 13,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
  channelBox: {
    position: 'relative',
    overflow: 'hidden',
  },
  cursorLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.text.mid,
  },
  channelHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },

  // Tableau des faits
  factsCard: {
    marginTop: space.xl,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    paddingHorizontal: space.lg,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: space.md,
  },
  factRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  factValue: {
    flex: 1,
    fontFamily: typo.monoSemi,
    fontSize: 16,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
  factValueRight: {
    textAlign: 'right',
  },
  factCenter: {
    flex: 1.3,
    alignItems: 'center',
  },
  factLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    textAlign: 'center',
  },
  factDelta: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },

  // Mode Ami — pastilles + pickers
  duo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: space.xl,
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  amp: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.mid,
    marginTop: 18,
  },
  badgeWrap: {
    alignItems: 'center',
    maxWidth: 130,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInitials: {
    fontFamily: typo.monoSemi,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.text.hi,
  },
  badgeName: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: space.sm,
    textAlign: 'center',
  },
  pickerBlock: {
    marginTop: space.lg,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  pill: {
    backgroundColor: colors.bg.card2,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  pillLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },
  pillLabelActive: {
    color: colors.text.hi,
  },

  // Sheet de remplacement
  sheetList: {
    marginTop: space.md,
  },
  sheetCardWrap: {
    marginBottom: space.sm,
  },
  sheetCardActive: {
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
  },

  // Divers
  manifest: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.low,
    textAlign: 'center',
    marginTop: space.xxl,
    paddingHorizontal: space.md,
  },
  muted: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.mid,
    marginTop: space.md,
  },
});
