/**
 * Vue Coach — E0.1 : configuration de la vue AR (lunettes Ray-Ban Display).
 * Reskin refonte-v2 §12 (maquette `coach/25-vue-ar`), RESPONSIVE deux formats.
 *
 * DOCTRINE — NON NÉGOCIABLE (bloc E0, cf. docs/specs-bundle-v4/specs/E0_ar_coach.md) :
 *   - L'AR est l'outil DU COACH, porté par le coach AU BORD DE PISTE — JAMAIS le
 *     pilote. Le pilote roule en silence : rien ici ne touche le côté pilote.
 *     Aucune vue AR côté pilote, nulle part.
 *   - FAITS uniquement. La vue in-lens montre des faits (chrono, delta vs la
 *     référence PERSO du pilote, secteur). JAMAIS une consigne (« dis-lui de
 *     freiner… »). L'app ne prescrit rien — le coach lit le fait et décide de sa
 *     pédagogie, sous sa responsabilité.
 *   - Accès strictement coach (cet écran vit sous app/(coach)/, déjà gardé par
 *     rôle dans _layout.tsx) ET uniquement pour les pilotes qui ont invité le
 *     coach (consentement). On réutilise la MÊME source de pilotes que le reste
 *     de l'espace coach : `listMyPilots()` → `coach_pilots_view` (RLS : coach_id
 *     = auth.uid() ET pilot_consent_at IS NOT NULL).
 *   - PREVIEW / PROTOTYPE. Les Ray-Ban Display sont en developer preview Meta :
 *     non publiable au grand public tant que la GA n'est pas ouverte. La
 *     fonctionnalité est marquée « EXPÉRIMENTAL » dans l'UI. On NE simule PAS de
 *     connexion lunettes : état neutre « non appairées — aperçu ». On NE fabrique
 *     JAMAIS de fausse valeur (les chronos vus dans la maquette in-lens sont
 *     rendus par la route web, jamais codés en dur ici).
 *   - DIRECT (LIVE-B, livrable 3). Dès qu'une session est choisie, l'écran
 *     s'abonne au canal COACH DÉJÀ EN PLACE (`live:session:<id>`, via
 *     usePilotLive) — aucun canal neuf, et surtout pas le canal board. Le cadre
 *     d'aperçu devient alors le MIROIR de ce que lit le porteur : trois lignes,
 *     contraste maximal, faits seuls. La FC a le droit d'y être — c'est le canal
 *     privé du binôme consenti, pas le board (écran de paddock, public). Elle est
 *     rendue EN NATIF et n'est JAMAIS passée à la WebView ni ajoutée à l'URL de
 *     la route web : aucune donnée de santé ne quitte cet écran coach. Elle
 *     n'apparaît que si le flux en porte réellement ; sinon la ligne n'existe
 *     pas — on n'écrit pas « — » pour de la santé, ce serait faire exister une
 *     mesure qu'on n'a pas.
 *
 * Deux formats (décision fondateur 2026-07-13, seuil COACH_CONSOLE_MIN_WIDTH) :
 *   - CONSOLE (largeur ≥ seuil, maquette `coach/25-vue-ar`) : header (eyebrow +
 *     titre « Faits au bord de piste » + badge EXPÉRIMENTAL) puis 2 colonnes —
 *     l'aperçu in-lens (hero) + la préparation (pilote/session/équipement/lancer)
 *     à gauche, le rappel de PRINCIPE + le garde-fou sécurité à droite.
 *   - COMPAGNON (téléphone) : 1 colonne, mêmes éléments empilés, AppBar en tête.
 * Le rail (console) / les onglets (téléphone) viennent du layout : cet écran
 * n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Couleurs : accent coach = coachAccent (#E23A4E) pour l'identité UI (badge,
 * sélection, action, garde-fou) ; coachAlert (#E2685A) pour le rappel doux.
 * L'or reste au chrono/record (jamais ici). Pas de bronze (admin).
 *
 * La vue in-lens elle-même (E0.2, page `ar-view`) est servie côté WEB (route
 * dédiée, hors bundle Expo) pour pouvoir évoluer sans repasser par les stores.
 * Ici on en montre un APERÇU via WebView. La route web peut ne pas être live :
 * on gère loading + erreur/404 proprement, jamais un crash.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { EmptyState } from '@/components/instruments/EmptyState';
import { useLiveRoster } from '@/hooks/useLiveRoster';
import { usePilotLive } from '@/hooks/usePilotLive';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import * as haptics from '@/lib/haptics';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import type { BiometryLiveEvent, LiveConn, LiveFrame } from '@/services/liveSessionLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatChronoTenths, formatDateLong } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

/**
 * Route web de la vue in-lens (E0.2). Construite côté site, peut ne pas être
 * encore en ligne : la WebView gère ce cas avec un repli sobre.
 */
const AR_VIEW_URL = 'https://app.oxvehicle.fr/ar-view';

/** Statut de chargement de l'aperçu in-lens (WebView). */
type PreviewState = 'loading' | 'ready' | 'error';

/**
 * État du flux dit honnêtement, avec les mots de l'écran En direct. Le hors-ligne
 * est un état, pas un vide à combler : on ne fige jamais une donnée périmée en la
 * faisant passer pour du temps réel.
 */
const CONN_LABEL: Record<LiveConn, string> = {
  connecting: 'Connexion',
  live: 'En direct',
  stale: 'Ralenti',
  offline: 'Hors ligne',
};

export default function CoachArScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;
  const coachId = useAuthStore((st) => st.profile?.id ?? null);

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loadingPilots, setLoadingPilots] = useState(true);

  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [previewState, setPreviewState] = useState<PreviewState>('loading');

  // LIVE-B — le miroir suit la séance EN COURS, pas celle qu'on a choisie plus
  // haut. Le sélecteur de séances ne propose que des séances TERMINÉES
  // (listPilotSessions filtre status='completed') : s'y abonner ne pourrait
  // jamais produire de direct — un miroir qui ne reflète rien. La seule source
  // d'une séance vivante est le roster de présence, alimenté par les pilotes
  // réellement en piste. Hors piste, il n'y a pas de direct, et on le dit.
  const { roster } = useLiveRoster(coachId);
  const liveSessionId =
    selectedPilotId !== null
      ? (roster.find((p) => p.pilotId === selectedPilotId)?.sessionId ?? null)
      : null;
  const { frame, conn, bio } = usePilotLive(liveSessionId);

  // Chrono du TOUR EN COURS — la seule mesure de tour réellement disponible en
  // direct, portée par la trame elle-même.
  //
  // On n'affiche PAS un « dernier tour » ici : la table `laps` n'est écrite qu'à
  // la CLÔTURE de la capture (captureSessionService enfile les tours au stop).
  // Pendant la séance elle est donc vide, ou pire, remplie par une séance
  // ANTÉRIEURE — un chrono d'hier présenté au coach comme le tour qui vient de
  // passer. Un miroir montre ce qui est, ou il se tait.
  const currentChronoMs = frame?.chronoMs ?? null;

  // Pilotes consentis (même source que tout l'espace coach).
  useEffect(() => {
    let cancelled = false;
    listMyPilots()
      .then((rows) => {
        if (!cancelled) {
          setPilots(rows);
          setLoadingPilots(false);
        }
      })
      .catch(() => {
        // Réseau coupé : on sort du loading, l'état vide gère l'affichage.
        if (!cancelled) setLoadingPilots(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sessions du pilote sélectionné (RLS coach). Re-sélection remet la session à zéro.
  useEffect(() => {
    if (!selectedPilotId) {
      setSessions([]);
      setSelectedSessionId(null);
      return;
    }
    let cancelled = false;
    setLoadingSessions(true);
    setSelectedSessionId(null);
    listPilotSessions(selectedPilotId)
      .then((rows) => {
        if (!cancelled) {
          setSessions(rows);
          setLoadingSessions(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessions([]);
          setLoadingSessions(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPilotId]);

  const selectedPilot = useMemo(
    () => pilots.find((p) => p.pilotId === selectedPilotId) ?? null,
    [pilots, selectedPilotId]
  );

  const onSelectPilot = useCallback((pilotId: string) => {
    haptics.tap();
    setSelectedPilotId((prev) => (prev === pilotId ? null : pilotId));
  }, []);

  const onSelectSession = useCallback((sessionId: string) => {
    haptics.tap();
    setSelectedSessionId((prev) => (prev === sessionId ? null : sessionId));
  }, []);

  // WebView : démarrage d'un chargement (peut survenir à chaque navigation interne).
  const onPreviewLoadStart = useCallback(() => {
    setPreviewState('loading');
  }, []);

  const onPreviewLoad = useCallback((e: WebViewNavigationEvent) => {
    // Certaines plateformes 404 servent une page : on la traite via onHttpError.
    // Ici on bascule "ready" seulement si l'URL a bien chargé.
    if (e.nativeEvent.url) setPreviewState('ready');
  }, []);

  // Échec réseau / route absente → repli sobre, jamais de crash ni fausse valeur.
  const onPreviewError = useCallback((_e: WebViewErrorEvent) => {
    setPreviewState('error');
  }, []);

  const onPreviewHttpError = useCallback((_e: WebViewHttpErrorEvent) => {
    // 404 / 5xx : la route web n'est pas (encore) servie.
    setPreviewState('error');
  }, []);

  // « Lancer la vue AR » : prototype. La vue live in-lens (E0.2) est une route
  // web poussée vers les lunettes du coach — non embarquée. Tant que ce n'est
  // pas branché, on reste honnête : pas de fausse mise en route.
  const canLaunch = selectedPilotId !== null && selectedSessionId !== null;

  const pilotFullName = useCallback(
    (pilot: CoachPilotRow) =>
      [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote',
    []
  );

  const onLaunch = useCallback(() => {
    if (!canLaunch) return;
    haptics.confirm();
    // Prototype : la mise en route live (push vers les lunettes) sera branchée
    // quand la route web E0.2 et l'appairage seront disponibles.
  }, [canLaunch]);

  // ── Pièces réutilisées entre les deux formats ──────────────────────────────

  // Le MÊME cadre sert les deux situations — un seul système d'affichage, jamais
  // deux : sans session choisie, l'aperçu générique servi par le web ; session
  // choisie, le miroir du direct (ce que le porteur lit, à l'identique, sur le
  // téléphone quand les lunettes ne sont pas appairées).
  const previewHeight = isConsole ? 380 : 200;
  // Le miroir n'a de sens que sur une séance VIVANTE : il ne s'ouvre donc que
  // lorsque le pilote choisi est réellement en piste (présent au roster).
  const isMirroring = liveSessionId !== null;

  const preview = isMirroring ? (
    <MetaMirror
      height={previewHeight}
      compact={!isConsole}
      pilotName={selectedPilot ? pilotFullName(selectedPilot) : 'Pilote'}
      conn={conn}
      frame={frame}
      currentChronoMs={currentChronoMs}
      bio={bio}
    />
  ) : (
    <InLensPreview
      height={previewHeight}
      state={previewState}
      onLoadStart={onPreviewLoadStart}
      onLoad={onPreviewLoad}
      onError={onPreviewError}
      onHttpError={onPreviewHttpError}
    />
  );

  const previewCaption = (
    <Text style={s.previewCaption}>
      {isMirroring
        ? 'Miroir de ce que lit le porteur. Trois lignes, rien de plus.'
        : `Ce que vous lirez dans vos lunettes. Servie côté web (${AR_VIEW_URL}).`}
    </Text>
  );

  const principle = (
    <CockpitPanel plain>
      <Text style={s.panelEyebrow}>Principe</Text>
      <Text style={s.body}>
        Sur vos lunettes Ray-Ban Display, vous lisez des faits pendant que votre pilote roule —
        chrono, écart vs sa référence, secteur. Jamais une consigne : vous lisez, vous décidez de
        votre pédagogie.
      </Text>
    </CockpitPanel>
  );

  const safeguard = (
    <View style={s.safeguard} accessibilityRole="summary">
      <Text style={s.safeguardHead}>Jamais pour le pilote au volant.</Text>
      <Text style={s.safeguardBody}>
        La sécurité prime : aucune donnée ne s&apos;affiche à celui qui conduit. Le pilote roule en
        silence.
      </Text>
    </View>
  );

  const pilotSection = (
    <View>
      <View style={s.sectionHead}>
        <SectionLabel>1 · PILOTE</SectionLabel>
      </View>
      {loadingPilots ? (
        <Text style={s.caption}>Chargement…</Text>
      ) : pilots.length === 0 ? (
        <EmptyState
          label="Aucun pilote"
          message="Un pilote doit vous inviter au coaching avant que vous prépariez sa vue. Les invitations consenties apparaissent ici."
          source="coach_pilots_view"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pilots.map((pilot) => {
            const active = pilot.pilotId === selectedPilotId;
            return (
              <Pressable
                key={pilot.pilotId}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Pilote ${pilotFullName(pilot)}`}
                hitSlop={theme.hitSlop}
                onPress={() => onSelectPilot(pilot.pilotId)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card style={[s.choiceCard, active && s.choiceCardOn]}>
                  <View style={[s.radio, active && s.radioOn]}>
                    {active ? <View style={s.radioInner} /> : null}
                  </View>
                  <Text style={s.pilotName}>{pilotFullName(pilot)}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  const sessionSection = selectedPilotId ? (
    <View>
      <View style={s.sectionHead}>
        <SectionLabel>2 · SESSION</SectionLabel>
      </View>
      {loadingSessions ? (
        <Text style={s.caption}>Chargement des sessions…</Text>
      ) : sessions.length === 0 ? (
        <EmptyState
          label="Aucune session"
          message={`Aucune session analysée pour ${
            selectedPilot ? pilotFullName(selectedPilot) : 'ce pilote'
          }.`}
          source="telemetry_sessions"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {sessions.map((session) => {
            const active = session.id === selectedSessionId;
            const lapStr = session.lapCount
              ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
              : '—';
            return (
              <Pressable
                key={session.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Session du ${formatDateLong(session.startedAt)}`}
                hitSlop={theme.hitSlop}
                onPress={() => onSelectSession(session.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card style={[s.choiceCard, active && s.choiceCardOn]}>
                  <View style={[s.radio, active && s.radioOn]}>
                    {active ? <View style={s.radioInner} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionDate}>{formatDateLong(session.startedAt)}</Text>
                    <Text style={s.caption}>
                      {session.circuitName ?? 'Circuit'} · {lapStr}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  ) : null;

  const equipment = (
    <View>
      <View style={s.sectionHead}>
        <SectionLabel>ÉQUIPEMENT</SectionLabel>
      </View>
      <Card style={{ gap: spacing.md }}>
        {/* Appairage lunettes : NON simulé. État neutre honnête. */}
        <StatusRow label="Lunettes Ray-Ban Display" value="Non appairées — aperçu" tone="neutral" />
        <View style={s.statusDivider} />
        {/* Flux capteur : l'état RÉEL de l'abonnement au canal coach, pas une
            supposition. Sans session choisie, on ne prétend rien. */}
        <StatusRow
          label="Flux capteur"
          value={isMirroring ? CONN_LABEL[conn] : 'En attente de sélection'}
          tone={isMirroring && conn === 'live' ? 'ok' : 'neutral'}
        />
      </Card>
    </View>
  );

  const launch = (
    <View>
      <LaunchButton disabled={!canLaunch} onPress={onLaunch} />
      {!canLaunch ? (
        <Text style={[s.caption, { marginTop: spacing.sm, textAlign: 'center' }]}>
          Sélectionnez un pilote et une session pour préparer la vue.
        </Text>
      ) : null}
    </View>
  );

  // ── CONSOLE (tablette, ≥ seuil) : header + 2 colonnes ──────────────────────
  if (isConsole) {
    return (
      <Screen>
        <View style={s.consolePad}>
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>VUE AR · APERÇU E0.1</Text>
              <Text style={s.title} accessibilityRole="header">
                Faits au bord de piste
              </Text>
            </View>
            <ExperimentalBadge />
          </View>

          <View style={[s.cols, { marginTop: spacing.xl }]}>
            <View style={s.mainCol}>
              {preview}
              {previewCaption}
              <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
                {pilotSection}
                {sessionSection}
                {equipment}
                {launch}
              </View>
            </View>
            <View style={s.aside}>
              {principle}
              {safeguard}
            </View>
          </View>
        </View>
      </Screen>
    );
  }

  // ── COMPAGNON (téléphone) : 1 colonne empilée ──────────────────────────────
  return (
    <Screen>
      <AppBar title="VUE AR" onBack={() => router.back()} />
      <View style={s.companionPad}>
        <View style={s.companionHead}>
          <Text style={s.eyebrow}>VUE AR · APERÇU E0.1</Text>
          <ExperimentalBadge />
        </View>
        <Text style={s.title} accessibilityRole="header">
          Faits au bord de piste
        </Text>

        <View style={{ marginTop: spacing.lg }}>{principle}</View>

        <View style={{ marginTop: spacing.xl }}>{preview}</View>
        {previewCaption}

        <View style={{ marginTop: spacing.xl, gap: spacing.xl }}>
          {pilotSection}
          {sessionSection}
          {equipment}
          {launch}
          {safeguard}
        </View>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Badge « EXPÉRIMENTAL » (rouge coach) — matériel Ray-Ban Display en preview. */
function ExperimentalBadge() {
  return (
    <View style={s.expBadge} accessible accessibilityLabel="Fonctionnalité expérimentale, aperçu">
      <Text style={s.expBadgeTxt} accessibilityElementsHidden importantForAccessibility="no">
        EXPÉRIMENTAL
      </Text>
    </View>
  );
}

/**
 * Aperçu in-lens = la WebView de la route web (E0.2) dans un cadre sombre. On ne
 * fabrique aucun contenu : la vue vient du web. Overlays honnêtes pour le
 * chargement et l'indisponibilité (route pas encore servie).
 */
function InLensPreview({
  height,
  state,
  onLoadStart,
  onLoad,
  onError,
  onHttpError,
}: {
  height: number;
  state: PreviewState;
  onLoadStart: () => void;
  onLoad: (e: WebViewNavigationEvent) => void;
  onError: (e: WebViewErrorEvent) => void;
  onHttpError: (e: WebViewHttpErrorEvent) => void;
}) {
  return (
    <View style={[s.previewFrame, { height }]}>
      <WebView
        source={{ uri: AR_VIEW_URL }}
        originWhitelist={['https://*']}
        onLoadStart={onLoadStart}
        onLoad={onLoad}
        onError={onError}
        onHttpError={onHttpError}
        style={s.webview}
        // Fond sombre pendant le rendu, cohérent avec la vue in-lens.
        containerStyle={{ backgroundColor: palette.night }}
      />
      {state === 'loading' ? (
        <View style={s.previewOverlay} pointerEvents="none">
          <ActivityIndicator color={palette.creamMute} />
          <Text style={s.previewOverlayText}>Chargement de l&apos;aperçu…</Text>
        </View>
      ) : null}
      {state === 'error' ? (
        <View style={s.previewOverlay}>
          <Text style={s.previewErrorTitle}>Aperçu indisponible</Text>
          <Text style={s.previewErrorText}>La vue web arrive bientôt.</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Miroir Meta Display — ce que le coach lit DANS SES LUNETTES, rendu à
 * l'identique sur le téléphone tant qu'elles ne sont pas appairées. Repli assumé
 * dans le cadre d'aperçu déjà en place : un seul système d'affichage, pas deux.
 *
 * TROIS LIGNES, pas une de plus, contraste maximal (noir plein, blanc) : un verre
 * se lit d'un coup d'œil, au bord de la piste, en plein soleil.
 *   1. Le pilote en focus · son tour en cours · l'état du flux (honnête).
 *   2. Le dernier tour bouclé — un chrono, donc l'or (seule couleur qui lui revient).
 *   3. La FC — SEULEMENT si le flux en porte. Canal coach du binôme consenti :
 *      elle a sa place ici, jamais sur le canal board. Absente, la ligne n'existe
 *      pas : on n'écrit pas « — » pour de la santé.
 *
 * FAITS seuls. Aucune consigne de pilotage, aucun jugement, aucun seuil, aucune
 * couleur d'alarme : le coach lit, il décide de sa pédagogie.
 */
function MetaMirror({
  height,
  compact,
  pilotName,
  conn,
  frame,
  currentChronoMs,
  bio,
}: {
  height: number;
  compact: boolean;
  pilotName: string;
  conn: LiveConn;
  frame: LiveFrame | null;
  currentChronoMs: number | null;
  bio: BiometryLiveEvent | null;
}) {
  // Chrono du tour EN COURS (la trame le porte, en ms). « — » tant qu'aucune
  // trame n'est arrivée : on n'affiche pas un zéro qui passerait pour une mesure.
  const chrono = currentChronoMs !== null ? formatChronoTenths(currentChronoMs / 1000) : '—';
  const metaSize = compact ? 13 : 18;
  const labelSize = compact ? 10 : 13;

  // Lecture vocale : la même chose que les yeux, sans rien ajouter.
  const spoken = [
    pilotName,
    frame ? `tour ${frame.lap}` : null,
    CONN_LABEL[conn],
    `tour en cours ${chrono}`,
    bio ? `${bio.hrBpm} battements par minute` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[s.previewFrame, s.mirrorFrame, { height }]}
      accessible
      accessibilityLabel={spoken}
    >
      <View style={s.mirror}>
        {/* 1 · Pilote en focus, tour en cours, état du flux. */}
        <View style={s.mirrorRow}>
          <Text numberOfLines={1} style={[s.mirrorPilot, { fontSize: metaSize }]}>
            {pilotName}
          </Text>
          <View style={s.mirrorRight}>
            {frame ? (
              <Text style={[s.mirrorMeta, { fontSize: metaSize }]}>T{frame.lap}</Text>
            ) : null}
            <Text style={[s.mirrorMeta, { fontSize: labelSize }]}>
              {CONN_LABEL[conn].toUpperCase()}
            </Text>
          </View>
        </View>

        {/* 2 · Dernier tour bouclé — le chiffre roi. */}
        <View style={s.mirrorRow}>
          <Text style={[s.mirrorLabel, { fontSize: labelSize }]}>TOUR EN COURS</Text>
          <Text style={[s.mirrorChrono, { fontSize: compact ? 52 : 78 }]}>{chrono}</Text>
        </View>

        {/* 3 · FC — n'existe que si le pilote en émet vers son coach. */}
        {bio ? (
          <View style={s.mirrorRow}>
            <Text style={[s.mirrorLabel, { fontSize: labelSize }]}>FC</Text>
            <View style={s.mirrorRight}>
              <Text style={[s.mirrorBio, { fontSize: compact ? 24 : 34 }]}>
                {String(bio.hrBpm)}
              </Text>
              <Text style={[s.mirrorUnit, { fontSize: labelSize }]}>bpm</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Action réelle « Lancer la vue AR » (rouge coach). Grisée tant que la préparation est incomplète. */
function LaunchButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lancer la vue AR"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        s.launch,
        disabled ? s.launchDisabled : null,
        pressed && !disabled ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={[s.launchTxt, disabled ? s.launchTxtDisabled : null]}>Lancer la vue AR</Text>
    </Pressable>
  );
}

/** Ligne d'état matériel — libellé + valeur factuelle, pastille de tonalité. */
function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'ok' | 'neutral';
}) {
  return (
    <View style={s.statusRow} accessible accessibilityLabel={`${label} : ${value}`}>
      <View style={s.statusLeft}>
        <View
          style={[
            s.statusDot,
            { backgroundColor: tone === 'ok' ? dataColors.accel : palette.faint },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={s.statusLabel}>{label}</Text>
      </View>
      <Text style={s.statusValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // — Gouttières —
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // — En-têtes —
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  companionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.sm,
  },

  // — Badge expérimental (rouge coach) —
  expBadge: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expBadgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },

  // — Colonnes console —
  cols: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1.7 },
  aside: { flex: 1, maxWidth: 360, gap: spacing.lg },

  // — Panneau PRINCIPE —
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },

  // — Garde-fou sécurité (accent coach à gauche, jamais l'or) —
  safeguard: {
    borderWidth: 1,
    borderColor: 'rgba(226,58,78,0.28)',
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.06)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  safeguardHead: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.coachAlert,
  },
  safeguardBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: palette.creamSoft,
    marginTop: spacing.sm,
  },

  // — Sections —
  sectionHead: {
    marginBottom: spacing.md,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // — Cartes de choix (pilote / session) —
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderColor: palette.line,
    borderWidth: 1,
  },
  choiceCardOn: {
    borderColor: palette.coachAccent,
    borderWidth: 1.5,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: palette.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: palette.coachAccent },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.coachAccent,
  },
  pilotName: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    letterSpacing: 0.3,
    color: palette.cream,
  },
  sessionDate: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },

  // — Aperçu in-lens (WebView) —
  previewFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.night,
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: palette.night,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.night,
  },
  previewOverlayText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  previewErrorTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  previewErrorText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  previewCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
    marginTop: spacing.sm,
    lineHeight: 15,
  },

  // — Miroir Meta Display (direct) : trois lignes, contraste maximal —
  // Noir plein et blanc pur, pas les gris de l'app : sur un verre, le noir est
  // transparent et le moindre gris devient illisible en plein soleil.
  mirrorFrame: { backgroundColor: '#000000' },
  mirror: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mirrorRight: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  mirrorPilot: {
    flex: 1,
    fontFamily: fonts.monoSemi,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  mirrorMeta: {
    fontFamily: fonts.mono,
    letterSpacing: 1.2,
    color: '#FFFFFF',
  },
  mirrorLabel: {
    fontFamily: fonts.mono,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  // L'or est au chrono, et au chrono seulement (règle fondateur).
  mirrorChrono: {
    fontFamily: fonts.king,
    letterSpacing: -1.5,
    color: palette.gold,
    fontVariant: ['tabular-nums'],
  },
  // La FC reste NEUTRE : ni or (ce n'est pas un record) ni rouge (ce n'est pas
  // une alarme). L'app ne diagnostique pas.
  mirrorBio: {
    fontFamily: fonts.king,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  mirrorUnit: {
    fontFamily: fonts.mono,
    letterSpacing: 1,
    color: '#FFFFFF',
  },

  // — États matériels —
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  statusValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'right',
  },
  statusDivider: {
    height: 1,
    backgroundColor: palette.line,
  },

  // — Action rouge coach —
  launch: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  launchDisabled: { backgroundColor: '#2A2A2E' },
  launchTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
  launchTxtDisabled: { color: '#6A6A73' },
});
