/**
 * FIN DE SÉANCE — écran 8/8 du flux capture v2 (lot V2-L2, PORTE REC).
 * Route : /(app2)/rec/fin (segment immersif — la TabBar s'efface).
 *
 * Fusionne les 3 écrans v1 (pilotage-fini · préservation · bilan-prêt) + un état
 * d'erreur en UNE peau à phases cross-fadées. La MACHINE EST INCHANGÉE : la
 * préservation rebranche EXACTEMENT `analyzeAndPersistSession` de la v1 ; on ne
 * fait que trancher les phases (finLogic, pur/testé) et formater des faits réels.
 *
 * À la phase « fini » : déclencheur BIO-1 (lecture Watch), IDEMPOTENT, FAIL-CLOSED
 * et JAMAIS bloquant (bio1Trigger) — no-op propre aujourd'hui (HealthKit absent).
 * Rejeu des incidents hors-ligne (incidentOffline, registre SÉPARÉ de la file de
 * capture durcie — cardinal). Lien D4 « Déclarer un incident » → Sheet.
 *
 * Données réelles : le résumé ne montre que ce que le store a mesuré (tours,
 * minutes) ; la distance absente est absente (jamais un 0 fabriqué).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { analyzeAndPersistSession } from '@/services/analyzeSessionService';
import {
  concerneLaSeance,
  messageSynchro,
  type EtatSynchro,
} from '@/features/rec/syncEnAttenteLogic';
import { lireEtatSynchro, rejouerMaintenant } from '@/services/syncEnAttenteService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { loadBiometryConsents } from '@/services/consentService';
import { computeQuality } from '@/services/v2/biometryLogic';
import { saveSamples } from '@/services/v2/biometryService';
import { readHeartRate } from '@/services/v2/healthKitService';
import { report as reportIncident } from '@/services/v2/incidentService';
import { captureException } from '@/lib/sentry';
import { storage } from '@/lib/mmkv';
import {
  CUMUL_VIDE,
  ajouterRun,
  dayCompteKey,
  dayCumulKey,
  faitsJournee,
  journeeAPlusieursRuns,
  lireCumul,
  localDayIso,
} from '@/features/rec/journeeLogic';
import { bilanInterruptions, phraseInterruptions } from '@/features/rec/interruptionLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { useSessionStore } from '@/store/useSessionStore';
import {
  ChronoHero,
  colors,
  haptic,
  PressScale,
  radius,
  Sheet,
  space,
  StateView,
  typo,
  useDoorTransition,
  useHeroMorphSource,
  useReduceMotion,
} from '@/ui/v2';

import { bilanHeroMorphId } from '@/features/miroir/bilanLogic';
import { CarteProchaineFois } from '@/features/rec/CarteProchaineFois';
import { bio1GuardKey, runBio1, type Bio1Deps } from '@/features/rec/bio1Trigger';
import {
  buildFinSummary,
  constatSeanceMuette,
  lireTotalFrames,
  finBilanRoute,
  FIN_ERROR_MESSAGE,
  finDurationMin,
  finPhaseTitle,
  mapPreservationResult,
  PRESERVATION_STEPS,
  type FinPhase,
} from '@/features/rec/finLogic';
import { enqueueIncident, replayQueue, type PendingIncident } from '@/features/rec/incidentOffline';

const PRESERVE_MIN_VISIBLE_MS = 3_500;
const PRESERVE_SAFETY_MS = 30_000;

/**
 * Intervalle de relecture de la file de synchro, tant qu'elle n'est pas vide.
 *
 * Une seconde et demie : assez court pour que le message disparaisse pendant
 * que le pilote lit encore l'écran, assez long pour ne pas relire le disque en
 * boucle. Le sondage s'arrête dès que la file est vide — voir `BandeauSynchro`.
 */
const RELECTURE_SYNCHRO_MS = 1_500;

export default function FinScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const params = useLocalSearchParams<{
    sessionId?: string;
    ubxUri?: string;
    totalFrames?: string;
  }>();
  const sessionId = params.sessionId ?? '';
  const ubxUri = params.ubxUri ?? '';
  /**
   * LE PARAMÈTRE ÉTAIT ENVOYÉ ET N'ÉTAIT PAS LU. `useLocalSearchParams` ne
   * déclarait que deux champs ; `totalFrames`, transmis par le roulage
   * précisément pour que cet écran puisse annoncer une séance vide, n'arrivait
   * nulle part. Voir `constatSeanceMuette`.
   */
  const constatMuet = constatSeanceMuette(lireTotalFrames(params.totalFrames));

  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);
  const linkGaps = useSessionStore((s) => s.linkGaps);
  const meta = useSessionStore((s) => s.meta);

  const [phase, setPhase] = useState<FinPhase>('fini');
  const morph = useHeroMorphSource(bilanHeroMorphId(sessionId || 'session'));

  // ── Phase « fini » : résumé de faits réels ────────────────────────────────
  const durationMs =
    meta?.startedAt != null
      ? (meta.endedAt ?? new Date()).getTime() - meta.startedAt.getTime()
      : null;
  const summary = buildFinSummary({ lapCount, durationMs, distanceKm: null });

  /**
   * LE CUMUL DE LA JOURNÉE — lot 21g, « journée résumée ».
   *
   * L'écran est atteint à la fin de CHAQUE run. Le résumé au-dessus est donc
   * celui du run, et il le reste : c'est ce que le pilote vient de faire. Mais
   * un pilote qui a fait quatre sorties voyait quatre fois le chiffre de la
   * dernière, et jamais celui de sa journée.
   *
   * Le cumul s'ajoute UNE FOIS par séance — la garde est une clé MMKV par
   * `sessionId`, empruntée à la célébration du record du jour. Un remontage de
   * l'écran, un retour arrière, une reprise d'application ne recomptent pas.
   */
  const [cumul, setCumul] = useState(CUMUL_VIDE);
  const cumulCompte = useRef(false);
  useEffect(() => {
    if (cumulCompte.current) return;
    if (!sessionId || meta?.startedAt == null) return;
    cumulCompte.current = true;

    const jour = localDayIso(new Date());
    const cleJour = dayCumulKey(jour);
    const dejaCompte = storage.getString(dayCompteKey(sessionId)) != null;
    const actuel = lireCumul(storage.getString(cleJour));

    if (dejaCompte) {
      setCumul(actuel);
      return;
    }
    const suivant = ajouterRun(actuel, { tours: lapCount, dureeMs: durationMs });
    storage.set(cleJour, JSON.stringify(suivant));
    storage.set(dayCompteKey(sessionId), new Date().toISOString());
    setCumul(suivant);
  }, [sessionId, meta, lapCount, durationMs]);

  // Sur la première sortie, cumul et run disent le même chiffre : afficher les
  // deux sous deux titres différents ferait douter des deux.
  const faitsDuJour = journeeAPlusieursRuns(cumul) ? faitsJournee(cumul) : [];

  /**
   * LE RELEVÉ DES INTERRUPTIONS — lot 21e, et il se dit ICI, au retour.
   *
   * Le seuil suit le tour de référence du pilote : vingt secondes ne veulent
   * pas dire la même chose sur un tour de 1:41 et sur un tour de 3:00. Les
   * trous sous le seuil ne sont pas comptés — les additionner ferait annoncer
   * « quatre minutes d'interruption » là où il n'y a eu que des reconnexions
   * ordinaires.
   *
   * Rien ne s'affiche quand rien n'a dépassé le seuil : `phraseInterruptions`
   * rend `null`, et un bloc sans matière est un bloc qu'on ne rend pas.
   */
  const phraseTrous = phraseInterruptions(bilanInterruptions(linkGaps, bestLapMs));

  // Célébration : AUCUN RecordFlash ici. La garde partagée recordCelebration.ts
  // fait du Bilan la SOURCE UNIQUE de la célébration d'un record (all-time) —
  // le célébrer aussi en fin le doublerait, et déduire « record » de l'absence
  // d'une garde day-record fabriquerait une célébration sur un run ordinaire
  // (vérif L2 [5]). La fin affiche donc le chrono nu ; le record du jour se
  // célèbre à l'entre-runs (son vrai moment), l'all-time au bilan.

  // ── BIO-1 : déclenché une fois à l'entrée en « fini », non bloquant ────────
  const bio1Ran = useRef(false);
  useEffect(() => {
    if (bio1Ran.current || !sessionId || meta?.startedAt == null) return;
    bio1Ran.current = true;
    const deps: Bio1Deps = {
      guardHas: (id) => storage.getString(bio1GuardKey(id)) != null,
      guardMark: (id) => storage.set(bio1GuardKey(id), new Date().toISOString()),
      isFlagEnabled,
      loadCaptureConsent: async () =>
        userId ? (await loadBiometryConsents(userId)).capture : false,
      readHeartRate,
      saveSamples: async (id, samples) => saveSamples(id, samples, 'apple_watch'),
      computeQuality,
      captureError: captureException,
    };
    void runBio1({ sessionId, start: meta.startedAt, end: meta.endedAt ?? new Date() }, deps);
  }, [sessionId, meta, userId]);

  // ── Rejeu des incidents hors-ligne en attente (registre séparé) ────────────
  useEffect(() => {
    void replayQueue(storage, async (item: PendingIncident) => {
      const res = await reportIncident({
        sessionId: item.sessionId,
        occurredAt: item.occurredAt,
        description: item.description,
        photoUri: item.photoUri ?? undefined,
      });
      return { ok: res.ok };
    });
  }, []);

  // ── Phase « préservation » : MÊME analyse que la v1 ────────────────────────
  const cancelled = useRef(false);
  useEffect(() => {
    if (phase !== 'preservation') return;
    cancelled.current = false;
    const startedAt = Date.now();
    let threw = false;

    const safety = setTimeout(() => {
      if (!cancelled.current) settle(false);
    }, PRESERVE_SAFETY_MS);

    async function run() {
      if (sessionId && userId) {
        try {
          await analyzeAndPersistSession({
            telemetrySessionId: sessionId,
            userId,
            localUbxUri: ubxUri || undefined,
          });
        } catch (e) {
          threw = true;
          captureException(e, { where: 'fin/preservation', sessionId });
        }
      }
      const remaining = Math.max(0, PRESERVE_MIN_VISIBLE_MS - (Date.now() - startedAt));
      await new Promise((r) => setTimeout(r, remaining));
      settle(threw);
    }

    function settle(didThrow: boolean) {
      if (cancelled.current) return;
      cancelled.current = true;
      clearTimeout(safety);
      const next = mapPreservationResult({ hasSessionId: sessionId.length > 0, threw: didThrow });
      setPhase(next);
    }

    void run();
    return () => {
      cancelled.current = true;
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId, userId, ubxUri]);

  const openBilan = useCallback(() => {
    morph.capture();
    router.replace(finBilanRoute(sessionId) as never);
  }, [morph, sessionId]);

  // ── D4 incident ────────────────────────────────────────────────────────────
  const [incidentOpen, setIncidentOpen] = useState(false);

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        door,
      ]}
    >
      <View style={styles.center}>
        {/*
          CE QUI RESTE SUR LE TÉLÉPHONE, DIT ICI ET NULLE PART AILLEURS.

          `hasPending`, `pendingSessionIds` et le dossier de quarantaine
          existaient depuis longtemps et n'avaient AUCUN appelant. Une séance
          entière pouvait dormir sur le disque sans le moindre signe — pas de
          bandeau, pas de compteur. Le seul symptôme externe était une ligne
          figée en `recording`, découverte en interrogeant la base à la main.

          C'est ce silence qui transforme un incident RÉPARABLE — les octets
          sont là — en perte apparente. Le bandeau est muet quand tout est
          parti : annoncer « tout est synchronisé » à chaque séance diluerait
          le seul message qui compte.
        */}
        <BandeauSynchro sessionId={sessionId} />

        {phase === 'fini' ? (
          <FiniPhase
            summary={summary}
            constatMuet={constatMuet}
            faitsDuJour={faitsDuJour}
            phraseTrous={phraseTrous}
            durationMin={finDurationMin(
              meta?.startedAt?.getTime() ?? null,
              (meta?.endedAt ?? new Date()).getTime()
            )}
            onPreserve={() => setPhase('preservation')}
          />
        ) : null}

        {phase === 'preservation' ? <PreservationPhase /> : null}

        {phase === 'pret' ? (
          // Défilement : le troisième acte porte un champ de saisie, et le
          // clavier mange la moitié de l'écran sur un téléphone court.
          <ScrollView
            style={styles.pretScroll}
            contentContainerStyle={styles.pretScrollContenu}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
              {bestLapMs !== null ? <ChronoHero chronoMs={bestLapMs} size="l" /> : null}
              <Text style={styles.pretTitle} accessibilityRole="header">
                {finPhaseTitle('pret')}
              </Text>
              <PressScale
                onPress={openBilan}
                accessibilityLabel="Ouvrir le bilan"
                containerStyle={styles.ctaContainer}
                style={styles.cta}
              >
                <Text style={styles.ctaLabel}>Ouvrir le bilan</Text>
              </PressScale>
            </Animated.View>

            {/*
              ACTE 3 — « poser la variable de la prochaine fois » (Arbre pilote,
              étape 8). Il vient APRÈS l'accès au bilan, et il est facultatif :
              la séance se lit d'abord, l'intention se pose si elle vient. Rien
              n'oblige à écrire pour sortir de cet écran.

              C'était, avant ce lot, la seule capacité que l'arbre V1 détenait
              sans équivalent : `savePendingIntention` n'avait que deux
              appelants, tous deux en V1.

              `onGardee={null}` : ici, rien d'autre à l'écran ne rend
              l'intention — personne n'a à être prévenu. En préparation, la
              carte du run l'affiche, et elle écoute.
            */}
            <CarteProchaineFois
              circuitId={meta?.circuitId ?? null}
              moment="apres"
              onGardee={null}
            />
          </ScrollView>
        ) : null}

        {phase === 'erreur' ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
            <StateView
              state="error"
              errorMessage={FIN_ERROR_MESSAGE}
              onRetry={() => setPhase('preservation')}
            />
          </Animated.View>
        ) : null}
      </View>

      {/* D4 — toujours accessible, discret. */}
      <PressScale
        onPress={() => setIncidentOpen(true)}
        accessibilityLabel="Déclarer un incident"
        containerStyle={styles.incidentLinkContainer}
        style={styles.incidentLink}
      >
        <Text style={styles.incidentLinkTxt}>Déclarer un incident</Text>
      </PressScale>

      <IncidentSheet
        visible={incidentOpen}
        sessionId={sessionId || null}
        onClose={() => setIncidentOpen(false)}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Phase « fini »
// ---------------------------------------------------------------------------

function FiniPhase({
  phraseTrous,
  faitsDuJour,
  summary,
  constatMuet,
  durationMin,
  onPreserve,
}: {
  phraseTrous: string | null;
  faitsDuJour: ReturnType<typeof faitsJournee>;
  summary: ReturnType<typeof buildFinSummary>;
  constatMuet: ReturnType<typeof constatSeanceMuette>;
  durationMin: number | null;
  onPreserve: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
      <Text style={styles.finiTitle} accessibilityRole="header">
        {finPhaseTitle('fini')}
      </Text>
      {/*
        LE CONSTAT DE SÉANCE MUETTE PASSE DEVANT LE RÉSUMÉ.
        Placé après, il aurait commenté des chiffres qu'il contredit : « 20
        Minutes » suivi de « rien n'a été enregistré » se lit comme une panne
        d'affichage. Devant, il cadre la lecture de tout ce qui suit.
      */}
      {constatMuet ? (
        <View style={styles.constatMuet} accessible accessibilityRole="alert">
          <Text style={styles.constatMuetTitre}>{constatMuet.titre}</Text>
          <Text style={styles.constatMuetCorps}>{constatMuet.corps}</Text>
        </View>
      ) : null}

      {summary.length > 0 ? (
        <View style={styles.summaryRow}>
          {/* Groupé : séparés, « 12 » et « 34 » étaient des chiffres orphelins.
              buildFinSummary rend déjà le singulier-pluriel correct. */}
          {summary.map((item) => (
            <View
              key={item.key}
              style={styles.summaryItem}
              accessible
              accessibilityLabel={`${item.value} ${item.label}`}
            >
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.summaryEmpty}>
          {durationMin !== null ? `${durationMin} min de piste.` : 'Séance enregistrée.'}
        </Text>
      )}

      {/* Le relevé des interruptions de liaison. Descriptif, jamais un
          reproche : une liaison qui tombe n'est pas une faute du pilote. */}
      {phraseTrous ? <Text style={styles.trous}>{phraseTrous}</Text> : null}

      {/* LA JOURNÉE, et seulement à partir de la deuxième sortie. Sur la
          première, elle répéterait le run mot pour mot. */}
      {faitsDuJour.length > 0 ? (
        <View style={styles.jourBloc}>
          <Text style={styles.jourEyebrow}>DEPUIS CE MATIN</Text>
          <View style={styles.summaryRow}>
            {faitsDuJour.map((f) => (
              <View
                key={f.cle}
                style={styles.summaryItem}
                accessible
                accessibilityLabel={`${f.valeur} ${f.label} depuis ce matin`}
              >
                <Text style={styles.summaryValue}>{f.valeur}</Text>
                <Text style={styles.summaryLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <PressScale
        onPress={onPreserve}
        accessibilityLabel="Préserver la séance"
        containerStyle={styles.ctaContainer}
        style={styles.cta}
      >
        <Text style={styles.ctaLabel}>Préserver la séance</Text>
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Phase « préservation » — le cadran rassure, les étapes défilent
// ---------------------------------------------------------------------------

function PreservationPhase() {
  const [stepIdx, setStepIdx] = useState(0);
  const reduce = useReduceMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    // Indicateur INDÉTERMINÉ (arc rotatif) : le service d'analyse n'expose PAS
    // de progression réelle — afficher un « 63 % » serait un chiffre fabriqué
    // (vérif L2 [6], règle données réelles). On rassure par le mouvement et les
    // micro-textes factuels, jamais par un pourcentage inventé.
    // Sous « animations réduites », seul le mouvement s'arrête : les
    // micro-textes continuent de défiler, l'information reste.
    if (!reduce) {
      spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
    }
    const started = Date.now();
    const tick = setInterval(() => {
      setStepIdx(
        Math.min(PRESERVATION_STEPS.length - 1, Math.floor((Date.now() - started) / 1100))
      );
    }, 200);
    return () => {
      cancelAnimation(spin);
      clearInterval(tick);
    };
  }, [spin, reduce]);

  const arcStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
      <Text style={styles.preserveEyebrow}>PRÉSERVATION</Text>
      <Animated.View
        style={[styles.preserveArc, arcStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={styles.preserveStep} accessibilityLiveRegion="polite">
        {PRESERVATION_STEPS[stepIdx]}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// D4 — Sheet de déclaration d'incident (immuable après envoi)
// ---------------------------------------------------------------------------

function makeLocalId(): string {
  // uuid local léger (clé d'idempotence hors-ligne) — pas de dépendance native.
  return `inc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function IncidentSheet({
  visible,
  sessionId,
  onClose,
}: {
  visible: boolean;
  sessionId: string | null;
  onClose: () => void;
}) {
  /**
   * L'HEURE EST POSÉE À L'OUVERTURE DE LA FEUILLE, PAS AU MONTAGE DE L'ÉCRAN.
   *
   * `IncidentSheet` est monté sans condition avec l'écran de fin. L'heure était
   * donc figée à l'instant où le pilote ARRIVE sur l'écran — pas à celui où il
   * décide de déclarer, et encore moins à celui de l'incident. Elle est
   * affichée, et écrite dans `occurred_at` sur une ligne que la RLS rend
   * immuable : un incident survenu vingt minutes plus tôt en piste était daté
   * faux, sans recours.
   *
   * Poser l'heure à l'ouverture ne la rend pas vraie — elle reste l'heure de la
   * DÉCLARATION. Le libellé le dit désormais, au lieu de laisser croire.
   * Capturer la véritable heure de survenue demande un champ de saisie : c'est
   * un lot, pas un correctif, et il est consigné.
   */
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  useEffect(() => {
    if (visible) setOccurredAt(new Date());
  }, [visible]);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /**
   * TROIS ISSUES, PARCE QU'IL Y EN A TROIS. `done` n'en distinguait que deux —
   * « pas encore » et « c'est fait » — et rangeait dans la seconde un envoi qui
   * n'avait pas eu lieu.
   */
  const [issue, setIssue] = useState<null | 'envoyee' | 'en_attente'>(null);
  const [error, setError] = useState<string | null>(null);

  const tooShort = description.trim().length < 10;

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      // MediaTypeOptions est la forme acceptée par les typings d'expo-image-picker
      // 15.1.0 installé (la forme tableau ['images'] arrive plus tard) — à migrer
      // en même temps que l'upgrade du paquet (vérif L2 [11], non bloquant).
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) setPhotoUri(res.assets[0].uri);
  }

  async function submit() {
    if (sending || tooShort) return;
    setSending(true);
    setError(null);
    try {
      const res = await reportIncident({
        sessionId,
        occurredAt,
        description: description.trim(),
        photoUri: photoUri ?? undefined,
      });
      if (res.ok) {
        setIssue('envoyee');
        haptic('doorSnap');
        return;
      }
      // ÉCHEC. La déclaration est préservée dans le registre hors-ligne SÉPARÉ
      // (jamais la file de capture), et le pilote l'apprend — il ne l'apprenait
      // pas : `setDone(true)` affichait « votre déclaration est enregistrée »
      // alors que le serveur venait de la refuser, et `res.error` était jeté.
      //
      // On ne cherche PAS à distinguer ici le refus de la panne : le service
      // rend `{ ok: false }` pour les deux, et se tromper de côté coûterait une
      // déclaration perdue au bord d'une piste. On garde tout, et on dit la
      // vérité — « en attente », pas « enregistrée ».
      enqueueIncident(storage, {
        localId: makeLocalId(),
        sessionId,
        occurredAt: occurredAt.toISOString(),
        description: description.trim(),
        photoUri,
        queuedAt: new Date().toISOString(),
      });
      setError(res.error ?? null);
      setIssue('en_attente');
    } catch {
      enqueueIncident(storage, {
        localId: makeLocalId(),
        sessionId,
        occurredAt: occurredAt.toISOString(),
        description: description.trim(),
        photoUri,
        queuedAt: new Date().toISOString(),
      });
      setIssue('en_attente');
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
        {issue !== null ? (
          <>
            <Text style={styles.sheetTitle}>
              {issue === 'envoyee'
                ? 'Votre déclaration est enregistrée.'
                : 'Votre déclaration est en attente d’envoi.'}
            </Text>
            <Text style={styles.sheetBody}>
              {issue === 'envoyee'
                ? 'Elle ne peut plus être modifiée.'
                : 'Elle est conservée sur cet appareil et partira dès que possible.'}
            </Text>
            {issue === 'en_attente' && error ? (
              <Text style={styles.sheetError}>{error}</Text>
            ) : null}
            <PressScale
              onPress={onClose}
              accessibilityLabel="Fermer"
              containerStyle={styles.ctaContainer}
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>Fermer</Text>
            </PressScale>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Déclarer un incident</Text>
            <Text style={styles.sheetMeta}>
              {`Déclaré à ${occurredAt.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={4000}
              placeholder="Décrivez ce qui s’est passé."
              placeholderTextColor={colors.text.mid}
              selectionColor={colors.accent}
              accessibilityLabel="Description de l’incident"
              style={styles.sheetInput}
            />
            <Text style={styles.sheetCounter}>{description.trim().length} / 4000 (10 minimum)</Text>
            <PressScale
              onPress={pickPhoto}
              accessibilityLabel={photoUri ? 'Photo ajoutée, remplacer' : 'Ajouter une photo'}
              containerStyle={styles.photoBtnContainer}
              style={styles.photoBtn}
            >
              <Text style={styles.photoBtnTxt}>
                {photoUri ? 'Photo ajoutée · remplacer' : 'Ajouter une photo'}
              </Text>
            </PressScale>
            {error ? <Text style={styles.sheetError}>{error}</Text> : null}
            <PressScale
              onPress={submit}
              disabled={tooShort || sending}
              accessibilityLabel="Envoyer la déclaration"
              // L'état annoncé suit l'état RÉEL : pendant l'envoi, le bouton
              // est inerte et doit se dire tel quel.
              accessibilityState={{ disabled: tooShort || sending, busy: sending }}
              containerStyle={styles.ctaContainer}
              style={[styles.cta, (tooShort || sending) && styles.ctaDim]}
            >
              <Text style={styles.ctaLabel}>{sending ? 'Envoi…' : 'Envoyer'}</Text>
            </PressScale>
          </>
        )}
      </View>
    </Sheet>
  );
}

/**
 * Bandeau d'état de la file de synchronisation.
 *
 * Il ne s'affiche QUE s'il a quelque chose de factuel à dire, et il propose un
 * rejeu manuel uniquement quand ce rejeu peut aboutir — proposer un bouton qui
 * ne sort rien de la quarantaine serait promettre ce qu'on ne peut pas tenir.
 */
function BandeauSynchro({ sessionId }: { sessionId: string }) {
  const [etat, setEtat] = useState<EtatSynchro | null>(null);
  const [enCours, setEnCours] = useState(false);

  /**
   * ===========================================================================
   * IL LISAIT LA FILE UNE SEULE FOIS, ET ANNONÇAIT UNE PANNE QUI N'EN ÉTAIT PAS
   * ===========================================================================
   *
   * `useEffect(..., [])` : une lecture au montage, aucune autre.
   *
   * Or l'enchaînement de fin de séance est exactement celui-ci :
   * `stopCaptureSession` enfile les tours, la clôture et l'envoi du `.ubx`, puis
   * lance `processQueue()` SANS l'attendre (`void`), et le roulage navigue
   * aussitôt. Les fichiers d'opérations sont donc sur le disque à l'instant
   * précis où cet écran les compte — alors même que le drain est en train de
   * réussir.
   *
   * Sur une fin de séance parfaitement en ligne, le pilote lisait donc :
   * « 3 opérations attendent le réseau. Elles partiront toutes seules dès qu'il
   * revient. » Et la phrase restait, inchangée, tant qu'il ne quittait pas
   * l'écran.
   *
   * Le seul message censé être rare devenait le message ordinaire — et un
   * message d'alerte qu'on voit à chaque fois cesse d'être lu.
   *
   * On relit donc tant qu'il reste quelque chose à voir. Le sondage s'arrête de
   * lui-même dès que la file est vide, et au démontage : il n'y a pas de veille
   * permanente sur un écran de fin de séance.
   */
  useEffect(() => {
    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    const relire = () => {
      lireEtatSynchro()
        .then((e) => {
          if (!vivant) return;
          setEtat(e);
          // Plus rien en attente ni en quarantaine : le drain a abouti, on
          // cesse de regarder.
          if (e.enAttente === 0 && e.enQuarantaine === 0) return;
          minuteur = setTimeout(relire, RELECTURE_SYNCHRO_MS);
        })
        .catch(() => undefined);
    };
    relire();

    return () => {
      vivant = false;
      if (minuteur !== null) clearTimeout(minuteur);
    };
  }, []);

  if (etat === null) return null;
  const msg = messageSynchro(etat);
  if (msg === null) return null;
  // Une opération d'une séance d'avant-hier n'a rien à faire sur l'écran de
  // fin de CELLE-CI — sauf si elle est bloquée, qui se dit toujours.
  if (msg.registre === 'attente' && !concerneLaSeance(etat, sessionId || null)) return null;

  const rejouer = () => {
    if (enCours) return;
    setEnCours(true);
    rejouerMaintenant()
      .then(setEtat)
      .catch(() => undefined)
      .finally(() => setEnCours(false));
  };

  return (
    <View style={styles.syncBandeau} accessibilityLiveRegion="polite">
      <Text style={styles.syncTitre}>{msg.titre}</Text>
      <Text style={styles.syncCorps}>{msg.corps}</Text>
      {msg.rejeuUtile ? (
        <PressScale
          onPress={rejouer}
          accessibilityLabel="Réessayer l’envoi maintenant"
          containerStyle={styles.syncActionContainer}
          style={styles.syncAction}
        >
          <Text style={styles.syncActionLabel}>
            {enCours ? 'Envoi en cours…' : 'Réessayer maintenant'}
          </Text>
        </PressScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Bandeau de synchronisation — sobre, factuel, jamais alarmiste.
  syncBandeau: {
    marginHorizontal: space.xl,
    marginBottom: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    backgroundColor: colors.bg.card2,
  },
  syncTitre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  syncCorps: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.hi,
  },
  syncActionContainer: {
    marginTop: space.md,
  },
  syncAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncActionLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
    textDecorationLine: 'underline',
  },
  trous: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    textAlign: 'center',
    marginTop: space.md,
    paddingHorizontal: space.lg,
  },
  jourBloc: {
    marginTop: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  jourEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text.mid,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBlock: {
    alignItems: 'center',
    gap: space.lg,
    width: '100%',
  },
  /** Phase « prêt » : elle défile, contrairement aux deux autres. */
  pretScroll: { flex: 1, width: '100%' },
  pretScrollContenu: { flexGrow: 1, justifyContent: 'center', paddingVertical: space.xl },
  finiTitle: {
    fontFamily: typo.display,
    fontSize: 24,
    color: colors.text.hi,
    textAlign: 'center',
  },
  pretTitle: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.mid,
    textAlign: 'center',
  },
  constatMuet: {
    borderLeftWidth: 2,
    borderLeftColor: colors.text.mid,
    paddingLeft: 12,
    marginBottom: 20,
    gap: 4,
  },
  constatMuetTitre: {
    // Même registre que le bandeau de synchro, deux blocs plus bas : ce sont
    // deux constats de même nature, ils ne doivent pas se parler de deux voix.
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  constatMuetCorps: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    // `text.mid`, jamais `text.low` : cet écran se lit au circuit, de nuit ou
    // en plein soleil selon l'heure. Plancher de contraste 7:1.
    color: colors.text.mid,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: space.xxl,
    marginTop: space.sm,
  },
  summaryItem: {
    alignItems: 'center',
    gap: space.xs,
  },
  summaryValue: {
    fontFamily: typo.monoSemi,
    fontSize: 30,
    color: colors.text.hi,
  },
  summaryLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  summaryEmpty: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
  },
  preserveEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  preserveArc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border.strong,
    borderTopColor: colors.text.hi,
    marginTop: space.lg,
  },
  preserveStep: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.text.mid,
    marginTop: space.lg,
  },
  ctaContainer: {
    width: '100%',
    marginTop: space.md,
  },
  cta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDim: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
  incidentLinkContainer: {
    alignSelf: 'center',
  },
  incidentLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  incidentLinkTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.mid,
  },
  // Sheet incident
  sheet: {
    gap: space.md,
    paddingBottom: space.lg,
  },
  sheetTitle: {
    fontFamily: typo.display,
    fontSize: 18,
    color: colors.text.hi,
  },
  sheetBody: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
  },
  sheetMeta: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.text.mid,
  },
  sheetInput: {
    minHeight: 96,
    marginTop: space.sm,
    padding: space.md,
    backgroundColor: colors.bg.card2,
    borderRadius: radius.cell,
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
    textAlignVertical: 'top',
  },
  sheetCounter: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text.mid,
    alignSelf: 'flex-end',
  },
  sheetError: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },
  photoBtnContainer: {
    alignSelf: 'flex-start',
  },
  photoBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  photoBtnTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
});
