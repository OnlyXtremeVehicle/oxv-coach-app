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
import { StyleSheet, Text, TextInput, View } from 'react-native';
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
import { isFlagEnabled } from '@/services/featureFlagsService';
import { loadBiometryConsents } from '@/services/consentService';
import { computeQuality } from '@/services/v2/biometryLogic';
import { saveSamples } from '@/services/v2/biometryService';
import { readHeartRate } from '@/services/v2/healthKitService';
import { report as reportIncident } from '@/services/v2/incidentService';
import { captureException } from '@/lib/sentry';
import { storage } from '@/lib/mmkv';
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
} from '@/ui/v2';

import { bilanHeroMorphId } from '@/features/miroir/bilanLogic';
import { bio1GuardKey, runBio1, type Bio1Deps } from '@/features/rec/bio1Trigger';
import {
  buildFinSummary,
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

export default function FinScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const params = useLocalSearchParams<{ sessionId?: string; ubxUri?: string }>();
  const sessionId = params.sessionId ?? '';
  const ubxUri = params.ubxUri ?? '';

  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);
  const meta = useSessionStore((s) => s.meta);

  const [phase, setPhase] = useState<FinPhase>('fini');
  const morph = useHeroMorphSource(bilanHeroMorphId(sessionId || 'session'));

  // ── Phase « fini » : résumé de faits réels ────────────────────────────────
  const durationMs =
    meta?.startedAt != null
      ? (meta.endedAt ?? new Date()).getTime() - meta.startedAt.getTime()
      : null;
  const summary = buildFinSummary({ lapCount, durationMs, distanceKm: null });

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
        {phase === 'fini' ? (
          <FiniPhase
            summary={summary}
            durationMin={finDurationMin(
              meta?.startedAt?.getTime() ?? null,
              (meta?.endedAt ?? new Date()).getTime()
            )}
            onPreserve={() => setPhase('preservation')}
          />
        ) : null}

        {phase === 'preservation' ? <PreservationPhase /> : null}

        {phase === 'pret' ? (
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
  summary,
  durationMin,
  onPreserve,
}: {
  summary: ReturnType<typeof buildFinSummary>;
  durationMin: number | null;
  onPreserve: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
      <Text style={styles.finiTitle} accessibilityRole="header">
        {finPhaseTitle('fini')}
      </Text>
      {summary.length > 0 ? (
        <View style={styles.summaryRow}>
          {summary.map((item) => (
            <View key={item.key} style={styles.summaryItem}>
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
  const spin = useSharedValue(0);

  useEffect(() => {
    // Indicateur INDÉTERMINÉ (arc rotatif) : le service d'analyse n'expose PAS
    // de progression réelle — afficher un « 63 % » serait un chiffre fabriqué
    // (vérif L2 [6], règle données réelles). On rassure par le mouvement et les
    // micro-textes factuels, jamais par un pourcentage inventé.
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
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
  }, [spin]);

  const arcStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.phaseBlock}>
      <Text style={styles.preserveEyebrow}>PRÉSERVATION</Text>
      <Animated.View style={[styles.preserveArc, arcStyle]} accessibilityElementsHidden />
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
  const [occurredAt] = useState(() => new Date());
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
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
        setDone(true);
        haptic('doorSnap');
        return;
      }
      // Échec réseau/serveur : on préserve la déclaration dans le registre
      // hors-ligne SÉPARÉ (jamais la file de capture) — rejouée plus tard.
      enqueueIncident(storage, {
        localId: makeLocalId(),
        sessionId,
        occurredAt: occurredAt.toISOString(),
        description: description.trim(),
        photoUri,
        queuedAt: new Date().toISOString(),
      });
      setDone(true);
    } catch {
      enqueueIncident(storage, {
        localId: makeLocalId(),
        sessionId,
        occurredAt: occurredAt.toISOString(),
        description: description.trim(),
        photoUri,
        queuedAt: new Date().toISOString(),
      });
      setDone(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
        {done ? (
          <>
            <Text style={styles.sheetTitle}>Votre déclaration est enregistrée.</Text>
            <Text style={styles.sheetBody}>Elle ne peut plus être modifiée.</Text>
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
              {occurredAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={4000}
              placeholder="Décrivez ce qui s’est passé."
              placeholderTextColor={colors.text.dim}
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
              accessibilityState={{ disabled: tooShort, busy: sending }}
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

const styles = StyleSheet.create({
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
    color: colors.text.low,
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
    color: colors.text.low,
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
    color: colors.text.dim,
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
    color: colors.text.low,
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
    color: colors.text.dim,
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
