/**
 * Coach — En direct · focus pilote (handoff §12 `coach/27-en-direct-focus` +
 * coach-mobile `02-pilote-live`). Le coach suit UN pilote en piste (P5).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13), le MÊME écran :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes
 *     fidèles à la maquette — à gauche le TOUR EN COURS (chrono roi, or), le
 *     secteur en cours et la liste des tours ; à droite la VITESSE live (relevé
 *     + trace qui défile), les forces G, l'alerte « à surveiller » et les actions
 *     rapides. Le rail §12 est porté par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : une colonne compacte — chrono roi, relevés
 *     live, alerte, tours, actions. Les onglets bas sont portés par `_layout`.
 *
 * Chiffre roi = le CHRONO du tour en cours (or — c'est un chrono/record en
 * devenir). La vitesse et les G sont des relevés NEUTRES (jamais l'or, réservé au
 * chrono : règle fondateur). L'état de connexion est HONNÊTE (live / connexion /
 * ralenti / coupé) : réseau circuit instable, on n'invente jamais un direct — les
 * valeurs figées sont atténuées pour cesser de passer pour du temps réel.
 *
 * Doctrine (Principe 3 · silence en piste) : le coach OBSERVE, le pilote conduit
 * en silence. Données factuelles temps réel seulement (positions/relevés/écarts),
 * AUCUN ordre de pilotage. L'alerte est descriptive (« à surveiller »), jamais une
 * consigne. La note du coach est ATTRIBUÉE, lisible après la séance — jamais « de
 * l'app ». Vouvoiement, zéro emoji.
 *
 * Données réelles uniquement : le flux via usePilotLive (broadcast Realtime), les
 * tours terminés via fetchSessionLaps (table `laps`, best-effort — vides tant que
 * le boîtier n'a rien déposé). Aucune valeur inventée : le delta « vs son best »
 * de la maquette n'a pas de source dans la trame → il n'est pas affiché.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';

import { Fact, EmptyState } from '@/components/instruments';
import { usePilotLive, type LiveBioPoint } from '@/hooks/usePilotLive';
import { getCorner } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type BiometryLiveEvent,
  type LiveConn,
  type LiveFrame,
  formatLiveChrono,
  liveAlert,
} from '@/services/liveSessionLogic';
import { fetchSessionLaps } from '@/services/sessionsService';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import type { Lap } from '@/types/telemetry';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  decideMarqueur,
  motifLisible,
  type DecisionMarqueur,
} from '@/features/coach/marqueurGesteLogic';
import { poserMarqueur } from '@/services/coachAnnotationsService';
import { KingNumber } from '@/ui/KingNumber';
import { Screen } from '@/ui/Screen';
import { formatChronoTenths } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Longueur du tampon de trace de vitesse (relevés live accumulés côté client). */
const TRACE_LEN = 48;

/** État de connexion honnête → badge court + phrase descriptive. */
const CONN: Record<LiveConn, { badge: string; note: string }> = {
  connecting: { badge: 'Connexion', note: 'Connexion au flux…' },
  live: { badge: 'En direct', note: '' },
  stale: { badge: 'Ralenti', note: 'Flux ralenti — dernières données conservées.' },
  offline: {
    badge: 'Hors ligne',
    note: 'Flux coupé — reconnexion auto, télémétrie gardée sur le boîtier.',
  },
};

export default function CockpitFocusScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; name?: string }>();
  const sessionId = params.sessionId ?? null;
  const pilotName = params.name ?? 'Pilote';
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const { frame, conn, bio, bioSeries, derniereReceptionMs } = usePilotLive(sessionId);

  // Tours terminés (table `laps`, best-effort) — la liste TOURS de la maquette,
  // le meilleur en or. Vide tant que le boîtier n'a rien déposé : EmptyState.
  const [laps, setLaps] = useState<Lap[]>([]);
  useEffect(() => {
    if (!sessionId) {
      setLaps([]);
      return;
    }
    let cancelled = false;
    fetchSessionLaps(sessionId)
      .then((rows) => {
        if (!cancelled) setLaps(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Le pilote propriétaire de la séance. L'écran ne reçoit que l'identifiant de
  // séance ; sans cette résolution, l'action « Note vocale » ouvrait l'éditeur
  // sans destinataire et l'enregistrement échouait en silence. Même motif que
  // app/(app)/virage.tsx ; RLS arbitre la lecture.
  const [pilotId, setPilotId] = useState<string | null>(null);
  /**
   * Début de la capture — l'ORIGINE des temps du marqueur.
   *
   * La trame du direct porte `atMs`, posé par l'appareil DU PILOTE. Le début
   * l'est par le même appareil : leur différence est donc exacte, quelle que
   * soit l'heure du téléphone du coach. Sans cette origine, aucun marqueur ne
   * peut être daté.
   */
  const [debutCaptureIso, setDebutCaptureIso] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setPilotId(null);
      setDebutCaptureIso(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // `started_at` voyage avec `user_id` : une seule requete pour deux besoins,
      // et l'origine des temps arrive en meme temps que le destinataire.
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('user_id, started_at')
        .eq('id', sessionId)
        .maybeSingle();
      if (cancelled) return;
      setPilotId((data?.user_id as string | undefined) ?? null);
      setDebutCaptureIso((data?.started_at as string | undefined) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Trace de vitesse qui défile : relevés live accumulés (données réelles, pas de
  // synthèse). Bornée à TRACE_LEN. Réinitialisée quand on change de pilote.
  const [speedTrace, setSpeedTrace] = useState<number[]>([]);
  useEffect(() => {
    setSpeedTrace([]);
  }, [sessionId]);
  useEffect(() => {
    if (!frame) return;
    setSpeedTrace((prev) => {
      const next = [...prev, frame.speedKmh];
      return next.length > TRACE_LEN ? next.slice(next.length - TRACE_LEN) : next;
    });
  }, [frame]);

  const cornerName =
    frame?.cornerIndex != null ? (getCorner(frame.cornerIndex)?.name ?? null) : null;
  const alert = frame ? liveAlert(frame, cornerName) : null;

  // Flux périmé : on atténue les valeurs LIVE figées (le bandeau ne suffit pas, le
  // chiffre roi domine). Les tours (base, pas du live) restent, eux, pleins.
  const isStale = conn === 'stale' || conn === 'offline';
  const dim = isStale ? s.dim : null;

  // Meilleur tour volant → surligné en or dans la liste.
  const timedLaps = useMemo(
    () => laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0),
    [laps]
  );
  const bestLapNumber = useMemo(() => {
    if (timedLaps.length === 0) return null;
    const flagged = timedLaps.find((l) => l.is_best_lap);
    if (flagged) return flagged.lap_number;
    // `duration_seconds` est `numeric` : PostgREST le rend en CHAÎNE, et
    // « 102.7 » < « 95.2 » est VRAI en comparaison lexicographique — le
    // tour le plus LENT devenait le meilleur. On coerce avant de comparer.
    return timedLaps.reduce((m, l) =>
      Number(l.duration_seconds) < Number(m.duration_seconds) ? l : m
    ).lap_number;
  }, [timedLaps]);

  const header = (
    <LiveHeader
      name={pilotName}
      subtitle={frame ? subtitleFor(frame) : 'En attente du flux'}
      conn={conn}
      isConsole={isConsole}
    />
  );
  const chrono = <ChronoHero frame={frame} dim={dim} />;
  const secteur = frame?.sector != null ? <SecteurLine sector={frame.sector} dim={dim} /> : null;
  const alertCard = alert ? (
    <AlertCard text={alert} cornerIndex={frame?.cornerIndex ?? null} dim={dim} />
  ) : null;
  // Live : dernier tour en tête (maquette 27-en-direct-focus, ordre décroissant).
  const tours = <ToursPanel laps={[...timedLaps].reverse()} bestLapNumber={bestLapNumber} />;
  const actions = (
    <ActionsPanel
      sessionId={sessionId}
      pilotId={pilotId}
      cornerIndex={frame?.cornerIndex ?? null}
      marqueur={decideMarqueur({
        derniereTrameAtMs: frame?.atMs ?? null,
        // La FRAÎCHEUR se juge sur notre horloge, l'INSTANT sur celle du pilote.
        receptionMs: derniereReceptionMs,
        debutCaptureIso,
        maintenantMs: Date.now(),
      })}
    />
  );
  // BIO-2 — bande FC : n'existe QUE si le pilote émet (triple verrou côté pilote).
  // Absente sinon : jamais de bloc « pas de données santé » qui ferait exister
  // l'idée d'une mesure qu'on n'a pas.
  const cardio = bio !== null ? <CardioPanel bio={bio} series={bioSeries} dim={dim} /> : null;

  return (
    <Screen>
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {header}

        {isConsole ? (
          <View style={s.consoleRow}>
            {/* Colonne gauche : le tour en cours (chrono roi) + secteur + tours. */}
            <View style={[s.col, { flex: 1 }]}>
              {chrono}
              {secteur}
              {tours}
            </View>
            {/* Colonne droite : vitesse live + forces + alerte + actions. */}
            <View style={[s.col, { flex: 1.4 }]}>
              <SpeedPanel current={frame?.speedKmh ?? null} trace={speedTrace} dim={dim} />
              <GRow frame={frame} dim={dim} />
              {cardio}
              {alertCard}
              {actions}
              <DoctrineCaption />
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl, marginTop: spacing.lg }}>
            {chrono}
            <LiveRow frame={frame} dim={dim} />
            {cardio}
            {alertCard}
            {tours}
            {actions}
            <DoctrineCaption />
          </View>
        )}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// En-tête : identité du pilote + état de connexion honnête.
// ─────────────────────────────────────────────────────────────────────────────

function LiveHeader({
  name,
  subtitle,
  conn,
  isConsole,
}: {
  name: string;
  subtitle: string;
  conn: LiveConn;
  isConsole: boolean;
}) {
  const note = CONN[conn].note;
  return (
    <View style={[s.headerWrap, isConsole && { paddingTop: spacing.sm }]}>
      <View style={s.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <View style={s.chev} />
        </Pressable>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initialsOf(name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.headerName} accessibilityRole="header">
            {name}
          </Text>
          <Text numberOfLines={1} style={s.headerSub}>
            {subtitle}
          </Text>
        </View>
        <LiveBadge conn={conn} />
      </View>
      {note ? <Text style={s.connNote}>{note}</Text> : null}
    </View>
  );
}

function LiveBadge({ conn }: { conn: LiveConn }) {
  const live = conn === 'live';
  return (
    // `accessible` est indispensable : sans lui, le libellé posé sur une View
    // reste inerte sur iOS et seul « RALENTI » sortirait, jamais la phrase.
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={live ? 'En direct' : CONN[conn].note || CONN[conn].badge}
      style={[s.badge, live ? s.badgeLive : s.badgeMuted]}
    >
      <View style={[s.badgeDot, { backgroundColor: live ? palette.cream : palette.faint }]} />
      <Text style={[s.badgeTxt, { color: live ? palette.cream : palette.creamMute }]}>
        {CONN[conn].badge.toUpperCase()}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tour en cours : le chiffre roi (chrono, or).
// ─────────────────────────────────────────────────────────────────────────────

function ChronoHero({ frame, dim }: { frame: LiveFrame | null; dim: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.heroCard, dim]}>
      <Text style={s.eyebrow}>Tour en cours</Text>
      <View style={{ marginTop: spacing.sm }}>
        <KingNumber
          value={formatLiveChrono(frame?.chronoMs ?? null)}
          color={palette.gold}
          size={52}
        />
      </View>
    </View>
  );
}

function SecteurLine({ sector, dim }: { sector: number; dim: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.secteurCard, dim]}>
      <Text style={s.eyebrow}>Secteur</Text>
      <View style={s.secteurRow}>
        <Text style={s.secteurValue}>S{sector}</Text>
        <Text style={s.secteurState}>en cours</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vitesse live (console) : relevé dominant neutre + trace qui défile.
// ─────────────────────────────────────────────────────────────────────────────

function SpeedPanel({
  current,
  trace,
  dim,
}: {
  current: number | null;
  trace: number[];
  dim: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.speedCard, dim]}>
      <View style={s.speedHead}>
        <Text style={s.eyebrow}>Vitesse · live</Text>
        {/* Valeur et unité groupées : le relevé se lit d'un bloc. */}
        <View
          style={s.speedValueRow}
          accessible
          // Le tiret cadratin est MUET à l'oral : « Vitesse — km/h » s'entend
          // « Vitesse km/h », soit une unité sans valeur, qui laisse croire à un
          // relevé qu'on aurait raté. L'absence se dit avec des mots.
          accessibilityLabel={current != null ? `${Math.round(current)} km/h` : 'Vitesse non reçue'}
        >
          <Text style={s.speedValue}>{current != null ? String(Math.round(current)) : '—'}</Text>
          <Text style={s.speedUnit}>km/h</Text>
        </View>
      </View>
      <SpeedTrace values={trace} />
    </View>
  );
}

/**
 * Bande cardio live (BIO-2) — donnée de SANTÉ, affichée sous le régime le plus
 * strict de l'app.
 *
 * N'apparaît que si le pilote émet (triple verrou côté pilote : consentement,
 * binôme, drapeau). Strictement FACTUELLE : la valeur, la tendance de
 * variabilité (liste fermée de 3 constats), le contact capteur. AUCUNE zone
 * cible, AUCUN seuil, AUCUNE alerte automatique, AUCUNE couleur d'alarme —
 * le coach juge, l'app ne diagnostique pas. Neutre en crème comme la vitesse :
 * ni or (record) ni rouge (alarme).
 */
function CardioPanel({
  bio,
  series,
  dim,
}: {
  bio: BiometryLiveEvent;
  series: LiveBioPoint[];
  dim: StyleProp<ViewStyle>;
}) {
  const contactNote =
    bio.contact === 'ok'
      ? 'contact établi'
      : bio.contact === 'poor'
        ? 'contact faible'
        : 'contact non rapporté';
  return (
    <View style={[s.speedCard, dim]}>
      <View style={s.speedHead}>
        <Text style={s.eyebrow}>Cardio · live</Text>
        {/* Valeur et unité groupées : le relevé se lit d'un bloc. */}
        <View style={s.speedValueRow} accessible accessibilityLabel={`${bio.hrBpm} bpm`}>
          <Text style={s.speedValue}>{String(bio.hrBpm)}</Text>
          <Text style={s.speedUnit}>bpm</Text>
        </View>
      </View>
      {/* Le graphe montre un cardio : son libellé doit le dire, pas parler de vitesse. */}
      <SpeedTrace
        values={series.map((p) => p.hr)}
        label="Trace de la fréquence cardiaque relevée en direct."
      />
      <Text style={s.cardioNote}>{`Variabilité ${bio.rrTrend} · ${contactNote}`}</Text>
    </View>
  );
}

/** Sparkline des relevés de vitesse (données réelles accumulées). Neutre : la
 *  vitesse n'est ni un chrono/record (or) ni une alarme (rouge). */
function SpeedTrace({
  values,
  label = 'Trace de la vitesse relevée en direct.',
}: {
  values: number[];
  label?: string;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const H = 64;
  const PAD = 6;

  let body = (
    <Text style={s.tracePlaceholder}>La trace de vitesse défile dès les premières trames.</Text>
  );
  if (w > 0 && values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min < 1 ? 1 : max - min;
    const pts = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = PAD + (1 - (v - min) / span) * (H - PAD * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    body = (
      <Svg width={w} height={H}>
        <Polyline
          points={pts}
          fill="none"
          stroke={palette.creamSoft}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={s.traceWrap}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {body}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Relevés de forces (neutres, factuels).
// ─────────────────────────────────────────────────────────────────────────────

/** Console : forces G seules (la vitesse a son panneau dédié). */
function GRow({ frame, dim }: { frame: LiveFrame | null; dim: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tiles, dim]}>
      <Fact label="G latéral" value={frame ? formatG(frame.gLat) : '—'} unit="g" />
      <Fact label="G long." value={frame ? formatG(frame.gLong) : '—'} unit="g" />
    </View>
  );
}

/** Téléphone : vitesse + forces G en une rangée compacte. */
function LiveRow({ frame, dim }: { frame: LiveFrame | null; dim: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tiles, dim]}>
      <Fact label="Vitesse" value={frame ? String(Math.round(frame.speedKmh)) : '—'} unit="km/h" />
      <Fact label="G latéral" value={frame ? formatG(frame.gLat) : '—'} unit="g" />
      <Fact label="G long." value={frame ? formatG(frame.gLong) : '—'} unit="g" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerte factuelle « à surveiller » (vue du coach, jamais une consigne).
// ─────────────────────────────────────────────────────────────────────────────

function AlertCard({
  text,
  cornerIndex,
  dim,
}: {
  text: string;
  cornerIndex: number | null;
  dim: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.alertCard, dim]}>
      {cornerIndex != null ? (
        <View style={s.alertBadge}>
          <Text style={s.alertBadgeTxt}>{cornerIndex}</Text>
        </View>
      ) : (
        <View style={s.alertBar} />
      )}
      <Text style={s.alertTxt}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tours terminés : la liste des chronos, le meilleur en or.
// ─────────────────────────────────────────────────────────────────────────────

function ToursPanel({ laps, bestLapNumber }: { laps: Lap[]; bestLapNumber: number | null }) {
  return (
    <View>
      <Text style={[s.eyebrow, { marginBottom: spacing.sm }]}>Tours</Text>
      {laps.length === 0 ? (
        <EmptyState
          label="Tours en attente"
          message="Les tours terminés apparaîtront ici, dès les premiers tours du boîtier."
          source="laps"
        />
      ) : (
        <View style={s.toursCard}>
          {laps.map((l, i) => {
            const isBest = l.lap_number === bestLapNumber;
            return (
              <View
                key={l.id}
                // Sans `accessible`, le libellé ci-dessous reste inerte sur iOS
                // et la ligne se lit en trois morceaux.
                accessible
                accessibilityRole="text"
                accessibilityLabel={`Tour ${l.lap_number}, ${formatChronoTenths(l.duration_seconds)}${
                  isBest ? ', son meilleur' : ''
                }`}
                style={[s.lapRow, i > 0 && s.lapRowBorder, isBest && s.lapRowBest]}
              >
                <Text style={[s.lapNo, isBest && s.lapBest]}>T{l.lap_number}</Text>
                {isBest ? <Text style={s.lapTag}>meilleur</Text> : <View style={{ flex: 1 }} />}
                <Text style={[s.lapChrono, isBest && s.lapBest]}>
                  {formatChronoTenths(l.duration_seconds)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions rapides du coach — vers des écrans réels (aucun contrôle mort).
// ─────────────────────────────────────────────────────────────────────────────

function ActionsPanel({
  sessionId,
  pilotId,
  cornerIndex,
  marqueur,
}: {
  sessionId: string | null;
  pilotId: string | null;
  cornerIndex: number | null;
  /** Décision pure : le geste est-il posable, et sur quel instant. */
  marqueur: DecisionMarqueur;
}) {
  // Une note est classée par pilote ET par virage en base. Tant que le pilote
  // n'est pas résolu ou que la trame n'indique aucun virage, la note n'aurait
  // nulle part où aller : on désactive et on dit pourquoi, plutôt qu'ouvrir un
  // éditeur qui accepterait le texte puis le perdrait.
  const peutNoter = !!sessionId && !!pilotId && cornerIndex != null;
  return (
    <View>
      <Text style={[s.eyebrow, { marginBottom: spacing.sm }]}>Actions rapides</Text>
      <View style={{ gap: spacing.sm }}>
        {/* MARQUER — le geste du bord de piste. Il vient EN PREMIER parce que
            c'est celui qu'on fait sans quitter la piste des yeux : le coach voit
            quelque chose et marque. Aucun texte, aucun jugement — le sens
            viendra quand il relira le fil. */}
        <ActionButton
          label="Marquer cet instant"
          primary
          disabled={!marqueur.posable || !pilotId || !sessionId}
          onPress={() => {
            if (!marqueur.posable || !pilotId || !sessionId) return;
            haptics.confirm();
            void poserMarqueur({
              pilotId,
              telemetrySessionId: sessionId,
              elapsedMs: marqueur.elapsedMs,
            }).then((r) => {
              Toast.show(
                r.ok
                  ? { type: 'success', text1: 'Marqué.', text2: 'À retrouver dans le fil.' }
                  : { type: 'error', text1: 'Le marqueur n’a pas été posé.', text2: r.error }
              );
            });
          }}
        />
        {!marqueur.posable ? (
          <Text style={s.actionHint}>{motifLisible(marqueur.motif)}</Text>
        ) : null}
        <ActionButton
          label="Note vocale"
          primary
          disabled={!peutNoter}
          onPress={() => {
            if (!peutNoter) return;
            router.push({
              pathname: '/(coach)/annoter',
              params: {
                sessionId: sessionId as string,
                pilotId: pilotId as string,
                cornerIndex: String(cornerIndex),
              },
            } as never);
          }}
        />
        {!peutNoter ? (
          <Text style={s.actionHint}>
            {pilotId == null
              ? 'La note s’ouvrira dès que la séance sera identifiée.'
              : 'La note s’ouvrira dès qu’un virage sera franchi : elle est classée par virage.'}
          </Text>
        ) : null}
        <ActionButton
          label="Poser un repère"
          onPress={() => router.push({ pathname: '/(coach)/reperes' } as never)}
        />
        <ActionButton
          label="Message"
          onPress={() => router.push({ pathname: '/(coach)/messages' } as never)}
        />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.actionBtn,
        primary ? s.actionBtnPrimary : s.actionBtnGhost,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      <Text style={[s.actionTxt, primary ? s.actionTxtPrimary : s.actionTxtGhost]}>{label}</Text>
    </Pressable>
  );
}

function DoctrineCaption() {
  return <Text style={s.doctrine}>Votre note part attribuée à vous, lisible après sa séance.</Text>;
}

// ============================================================================
// Helpers (purs, affichage seulement)
// ============================================================================

function subtitleFor(frame: LiveFrame): string {
  const sector = frame.sector != null ? ` · secteur ${frame.sector}` : '';
  return `Tour ${frame.lap}${sector}`;
}

/** G en français : virgule décimale, signe « − » (U+2212) si négatif. */
function formatG(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(2).replace('-', '−').replace('.', ',');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase() || '·';
}

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  consoleRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  col: { gap: spacing.xl },
  dim: { opacity: 0.4 },

  // En-tête
  headerWrap: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chev: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: palette.creamSoft,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.5, color: palette.creamSoft },
  headerName: { fontFamily: fonts.display, fontSize: fontSize.h3, color: palette.cream },
  headerSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  connNote: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.creamMute,
    marginLeft: 34 + spacing.md,
  },

  // Badge live / état
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 26,
    borderRadius: radius.pill,
  },
  badgeLive: { backgroundColor: palette.red },
  badgeMuted: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.2 },

  // Eyebrow commun
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },

  // Tour en cours (chiffre roi)
  heroCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Secteur
  secteurCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  secteurRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secteurValue: { fontFamily: fonts.monoSemi, fontSize: 20, color: palette.cream },
  secteurState: { fontFamily: fonts.mono, fontSize: fontSize.small, color: palette.creamMute },

  // Vitesse live
  speedCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  speedHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  speedValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  speedValue: {
    fontFamily: fonts.king,
    fontSize: 30,
    letterSpacing: -1,
    color: palette.cream,
    fontVariant: ['tabular-nums'],
  },
  speedUnit: { fontFamily: fonts.mono, fontSize: 11, color: palette.creamMute },
  traceWrap: { height: 64, marginTop: spacing.md, justifyContent: 'center' },
  tracePlaceholder: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.4,
  },
  /** Mention cardio factuelle (variabilité + contact) — jamais une alerte. */
  cardioNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },

  // Relevés
  tiles: { flexDirection: 'row', gap: spacing.sm },

  // Alerte
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  alertBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.coachAlert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeTxt: { fontFamily: fonts.monoSemi, fontSize: 11, color: palette.night },
  alertBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: palette.coachAlert,
  },
  alertTxt: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },

  // Tours
  toursCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  lapRowBorder: { borderTopWidth: 1, borderTopColor: palette.separator },
  lapRowBest: {
    backgroundColor: 'rgba(255,183,3,0.08)',
    borderRadius: radius.sm,
    borderTopWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  lapNo: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  lapTag: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.gold,
  },
  lapChrono: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    fontVariant: ['tabular-nums'],
  },
  lapBest: { color: palette.gold },

  // Actions
  actionBtn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionBtnPrimary: { backgroundColor: palette.coachAccent },
  actionBtnGhost: { backgroundColor: palette.card2, borderWidth: 1, borderColor: palette.line },
  actionTxt: { fontFamily: fonts.bodySemi, fontSize: fontSize.body, letterSpacing: 0.2 },
  actionTxtPrimary: { color: palette.cream },
  actionTxtGhost: { color: palette.creamSoft },
  actionHint: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.4,
    color: palette.creamMute,
  },

  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
});
