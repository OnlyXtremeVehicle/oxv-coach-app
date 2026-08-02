/**
 * Coach — Assistant IA (C-1). Reskin refonte-v2 §12, RESPONSIVE deux formats,
 * ENRICHI (retour fondateur build 23) : contexte visible, file réelle, historique.
 *
 * L'IA PRÉ-RÉDIGE une observation descriptive sur un virage ; le coach la relit,
 * l'édite, puis la VALIDE (vers le pilote) ou l'écarte. Rien n'atteint le pilote
 * sans cette validation (garde-fou C-1). Le filtrage doctrinal est côté serveur
 * (edge) — l'écran reste utilisable si l'IA est indisponible.
 *
 * Matière RÉELLE de l'écran (aucune valeur inventée, absent = « — ») :
 *   - FILE « en attente » : brouillons status='draft' (coach_ai_drafts, RLS
 *     own-coach), chacun avec le CONTEXTE de sa séance — pilote, circuit, date,
 *     virage — et, si le virage figure au triage factuel de la séance, le fait
 *     mesuré (coachTriageService). Le coach décide avec le contexte sous les yeux.
 *   - HISTORIQUE : annotations ai_assisted existantes (coach_annotations),
 *     badge « validée » ou « retouchée » (texte final ≠ texte généré).
 *   - TROIS ÉTATS distincts et honnêtes : file vide ≠ erreur de lecture ≠
 *     assistant désactivé (consentement pilote coach_ai_enabled, RPC
 *     coach_ai_consent — l'activation se fait côté pilote, chemin réel affiché).
 *
 * Deux formats (décision fondateur 2026-07-13, handoff §12) :
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes —
 *     à gauche la file à valider + « demander une proposition », à droite la
 *     relecture active + l'historique. La bande-garde IA reste en tête.
 *   - COMPAGNON téléphone : une colonne, même matière empilée.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Mouvement : FadeInSection à l'entrée (cascade sobre), LayoutAnimation sur les
 * transitions de file (une carte validée quitte la file et paraît dans
 * l'historique ; une carte écartée disparaît). Respect de reduceMotion.
 *
 * Doctrine : l'IA propose, le coach décide — la validation humaine reste
 * OBLIGATOIRE et visible (AIReviewBanner intact, provenance « IA » badgée sur
 * chaque carte, jamais adoucie). Identité coach = rouge d'accent (#E23A4E) sur
 * les actions ; jamais l'or (chrono) ni le rouge de donnée sur une action.
 * Vouvoiement, pas d'emoji, descriptif jamais prescriptif.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { AIReviewBanner } from '@/components/AIReviewBanner';
import { EmptyState } from '@/components/instruments';
import { FadeInSection, useReduceMotion } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { supabase } from '@/lib/supabase';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { discardDraft, requestDraft, validateDraft } from '@/services/coachAiService';
import { type TriageCorner } from '@/services/coachTriageLogic';
import { getSessionTriage } from '@/services/coachTriageService';
import { marginZoneExportColor } from '@/services/marginZoneColorLogic';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateLong, formatDateShort } from '@/utils/format';
import { timeAgoFr } from '@/utils/time';

const { palette, spacing, fonts, fontSize, radius } = theme;

const CORNERS = [1, 2, 3, 4, 5, 6, 7];

// LayoutAnimation (transitions de file) — l'ancienne architecture Android exige
// l'activation explicite ; sans effet ailleurs.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function errorLabel(code: string | undefined): string {
  switch (code) {
    case 'coach_ai_not_allowed':
      return "Ce pilote n'a pas activé l'assistant IA, ou vous n'avez pas l'accès détaillé consenti.";
    case 'doctrine_violation':
      return "La proposition n'était pas conforme à la doctrine. Réessayez ou rédigez votre note.";
    case 'segment_not_found':
      return 'Ce virage n’a pas de données analysées sur cette séance.';
    case 'openai_error':
    case 'openai_empty_response':
      return 'L’IA est momentanément indisponible. Vous pouvez rédiger votre note manuellement.';
    default:
      return 'La proposition a échoué. Réessayez plus tard.';
  }
}

// ---------------------------------------------------------------------------
// Données réelles de l'écran — file, historique, contexte des séances
// ---------------------------------------------------------------------------

/** Brouillon IA en attente de validation humaine (coach_ai_drafts, 'draft'). */
interface PendingDraft {
  id: string;
  pilotId: string;
  sessionId: string | null;
  cornerIndex: number;
  /** Texte généré (déjà filtré côté serveur avant insertion). */
  text: string;
  createdAt: string;
}

/** Contexte minimal d'une séance (telemetry_sessions, RLS coach). */
interface SessionMeta {
  circuitName: string | null;
  startedAt: string | null;
}

/** Annotation ai_assisted existante (coach_annotations) — l'historique réel. */
interface HistoryItem {
  id: string;
  pilotId: string;
  sessionId: string | null;
  /**
   * `null` DEPUIS L30 (02/08/2026) : un MARQUEUR ne connaît pas son virage au
   * moment du geste — il se résout à la lecture, contre les cordes de
   * référence. La colonne est devenue nullable, et le typage régénéré depuis la
   * base l'a révélé : l'ancien fichier de types, périmé, l'affirmait obligatoire
   * et masquait la conséquence.
   */
  cornerIndex: number | null;
  body: string;
  visibility: 'private' | 'shared';
  createdAt: string;
  /** true = texte final ≠ texte généré (le coach a retouché) ; null = inconnu. */
  retouched: boolean | null;
}

interface AssistantData {
  pending: PendingDraft[];
  history: HistoryItem[];
  sessionMeta: Record<string, SessionMeta>;
}

/**
 * Charge la file (brouillons 'draft'), l'historique (annotations ai_assisted)
 * et le contexte des séances concernées. RLS partout (own-coach, pilotes
 * consentis). Retourne null en cas d'erreur de lecture — l'écran distingue
 * alors honnêtement « erreur » de « file vide ».
 */
async function fetchAssistantData(): Promise<AssistantData | null> {
  try {
    const [pendingRes, historyRes, validatedRes] = await Promise.all([
      supabase
        .from('coach_ai_drafts')
        .select('id, pilot_id, telemetry_session_id, corner_index, generated_text, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coach_annotations')
        .select('id, pilot_id, telemetry_session_id, corner_index, body, visibility, created_at')
        .eq('ai_assisted', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('coach_ai_drafts')
        .select('resulting_annotation_id, generated_text')
        .eq('status', 'validated')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (pendingRes.error || historyRes.error) return null;

    // Détection « retouchée » : on compare le texte final de l'annotation au
    // texte généré du brouillon validé correspondant. Introuvable → inconnu.
    const generatedByAnnotation = new Map<string, string>();
    for (const row of validatedRes.data ?? []) {
      if (row.resulting_annotation_id) {
        generatedByAnnotation.set(row.resulting_annotation_id, row.generated_text);
      }
    }

    const pending: PendingDraft[] = (pendingRes.data ?? []).map((r) => ({
      id: r.id,
      pilotId: r.pilot_id,
      sessionId: r.telemetry_session_id,
      cornerIndex: r.corner_index,
      text: r.generated_text,
      createdAt: r.created_at,
    }));

    const history: HistoryItem[] = (historyRes.data ?? []).map((r) => {
      const generated = generatedByAnnotation.get(r.id);
      return {
        id: r.id,
        pilotId: r.pilot_id,
        sessionId: r.telemetry_session_id,
        cornerIndex: r.corner_index,
        body: r.body,
        visibility: r.visibility === 'private' ? 'private' : 'shared',
        createdAt: r.created_at,
        retouched: generated === undefined ? null : r.body.trim() !== generated.trim(),
      };
    });

    const sessionIds = [
      ...new Set(
        [...pending.map((p) => p.sessionId), ...history.map((h) => h.sessionId)].filter(
          (x): x is string => Boolean(x)
        )
      ),
    ];
    const sessionMeta: Record<string, SessionMeta> = {};
    if (sessionIds.length > 0) {
      const sessRes = await supabase
        .from('telemetry_sessions')
        .select('id, circuit_name, started_at')
        .in('id', sessionIds);
      for (const row of sessRes.data ?? []) {
        sessionMeta[row.id] = { circuitName: row.circuit_name, startedAt: row.started_at };
      }
    }

    return { pending, history, sessionMeta };
  } catch {
    return null;
  }
}

/** Ligne de contexte d'une carte : circuit · date · virage. Absent = « — ». */
function contextLine(meta: SessionMeta | undefined, cornerIndex: number | null): string {
  const circuit = meta?.circuitName ?? 'Circuit —';
  const date = meta?.startedAt ? formatDateShort(meta.startedAt) : '—';
  // Un marqueur n'a pas de virage : on ne fabrique pas « Virage null », et on
  // n'invente pas un numéro. On dit ce qu'on sait.
  const virage = cornerIndex !== null ? `Virage ${cornerIndex}` : 'Instant marqué';
  return `${circuit} · ${date} · ${virage}`;
}

/** Nom complet d'un pilote suivi (fallback neutre, jamais inventé). */
function fullPilotName(p: CoachPilotRow): string {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pilote';
}

export default function CoachAssistantScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;
  const reduceMotion = useReduceMotion();

  // Garde anti-setState après démontage (requêtes lancées hors effet).
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── Sélection « demander une proposition » ────────────────────────────────
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [pilotId, setPilotId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [corner, setCorner] = useState<number>(1);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── File + historique (données réelles) ───────────────────────────────────
  const [assistState, setAssistState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState<PendingDraft[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sessionMeta, setSessionMeta] = useState<Record<string, SessionMeta>>({});
  const [triageBySession, setTriageBySession] = useState<Record<string, TriageCorner[]>>({});
  const triageRequested = useRef<Set<string>>(new Set());

  // Consentement IA par pilote (RPC coach_ai_consent, fail-closed). Le gate
  // réel reste côté edge — ici on informe honnêtement, sans jamais l'ouvrir.
  const [aiConsent, setAiConsent] = useState<Record<string, boolean>>({});

  // ── Relecture active (validation humaine) ─────────────────────────────────
  const [activeDraft, setActiveDraft] = useState<PendingDraft | null>(null);
  const [draftText, setDraftText] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'shared'>('shared');
  const [validating, setValidating] = useState(false);
  /** Confirmation factuelle de la dernière validation (liseur d'écran inclus). */
  const [outcome, setOutcome] = useState<string | null>(null);

  /** Transition de liste sobre (file → historique, retrait de la file). */
  const animate = useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        240,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
  }, [reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    listMyPilots().then((rows) => {
      if (!cancelled) setPilots(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pilotId) {
      setSessions([]);
      setSessionId(null);
      return;
    }
    let cancelled = false;
    listPilotSessions(pilotId).then((rows) => {
      if (!cancelled) {
        setSessions(rows);
        setSessionId(rows[0]?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  // File + historique + contexte des séances.
  useEffect(() => {
    let cancelled = false;
    setAssistState('loading');
    fetchAssistantData().then((res) => {
      if (cancelled) return;
      if (!res) {
        setAssistState('error');
        return;
      }
      setPending(res.pending);
      setHistory(res.history);
      setSessionMeta((m) => ({ ...m, ...res.sessionMeta }));
      setAssistState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Fait de triage de la séance (si le virage figure parmi les plus serrés) —
  // chargé une fois par séance de la file, jamais bloquant.
  const ensureTriage = useCallback((sid: string | null) => {
    if (!sid || triageRequested.current.has(sid)) return;
    triageRequested.current.add(sid);
    getSessionTriage(sid)
      .then((rows) => {
        if (aliveRef.current) setTriageBySession((m) => ({ ...m, [sid]: rows }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    for (const d of pending.slice(0, 8)) ensureTriage(d.sessionId);
  }, [pending, ensureTriage]);

  // Consentement IA du pilote sélectionné (une lecture par pilote).
  useEffect(() => {
    if (!pilotId || aiConsent[pilotId] !== undefined) return;
    let cancelled = false;
    supabase.rpc('coach_ai_consent', { pilot_uuid: pilotId }).then(({ data, error: rpcError }) => {
      if (!cancelled && !rpcError) {
        setAiConsent((m) => ({ ...m, [pilotId]: data === true }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pilotId, aiConsent]);

  const pilotNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pilots) m.set(p.pilotId, fullPilotName(p));
    return m;
  }, [pilots]);

  const selectedPilot = pilots.find((p) => p.pilotId === pilotId) ?? null;
  const selectedConsent = pilotId ? aiConsent[pilotId] : undefined;

  // La carte en relecture sort de l'affichage de la file (elle y retourne si
  // le coach la garde pour plus tard — rien n'est perdu, tout reste en base).
  const visibleQueue = useMemo(
    () => pending.filter((d) => d.id !== activeDraft?.id),
    [pending, activeDraft]
  );

  const factFor = useCallback(
    (d: PendingDraft): TriageCorner | null => {
      if (!d.sessionId) return null;
      return (
        (triageBySession[d.sessionId] ?? []).find((c) => c.segmentIndex === d.cornerIndex) ?? null
      );
    },
    [triageBySession]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function openDraft(d: PendingDraft) {
    animate();
    setActiveDraft(d);
    setDraftText(d.text);
    setVisibility('shared');
    setError(null);
    setOutcome(null);
    ensureTriage(d.sessionId);
  }

  /** Garde pour plus tard : la carte retourne dans la file (statut inchangé). */
  function keepForLater() {
    animate();
    setActiveDraft(null);
    setDraftText('');
    setVisibility('shared');
  }

  async function onPropose() {
    if (!pilotId || !sessionId || requesting) return;
    setRequesting(true);
    setError(null);
    setOutcome(null);
    const res = await requestDraft({ pilotId, sessionId, cornerIndex: corner });
    if (!aliveRef.current) return;
    setRequesting(false);
    if (res.ok && res.draftId && res.text) {
      const created: PendingDraft = {
        id: res.draftId,
        pilotId,
        sessionId,
        cornerIndex: corner,
        text: res.text,
        createdAt: new Date().toISOString(),
      };
      // Contexte de la séance déjà connu via la liste de sélection.
      const sess = sessions.find((x) => x.id === sessionId);
      if (sess) {
        setSessionMeta((m) => ({
          ...m,
          [sessionId]: { circuitName: sess.circuitName, startedAt: sess.startedAt },
        }));
      }
      setPending((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      openDraft(created);
    } else {
      setError(errorLabel(res.error));
    }
  }

  async function onValidate() {
    if (!activeDraft || validating || !draftText.trim()) return;
    setValidating(true);
    const res = await validateDraft({ draftId: activeDraft.id, editedText: draftText, visibility });
    if (!aliveRef.current) return;
    setValidating(false);
    if (res.ok) {
      // La carte validée quitte la file et paraît en tête d'historique — ce
      // sont les données réelles qui viennent d'être créées (edge ok).
      animate();
      const item: HistoryItem = {
        id: res.annotationId ?? activeDraft.id,
        pilotId: activeDraft.pilotId,
        sessionId: activeDraft.sessionId,
        cornerIndex: activeDraft.cornerIndex,
        body: draftText.trim(),
        visibility,
        createdAt: new Date().toISOString(),
        retouched: draftText.trim() !== activeDraft.text.trim(),
      };
      setHistory((h) => [item, ...h].slice(0, 8));
      setPending((prev) => prev.filter((d) => d.id !== activeDraft.id));
      setActiveDraft(null);
      setDraftText('');
      setVisibility('shared');
      setOutcome(
        visibility === 'shared'
          ? 'Observation validée — visible par le pilote sur le virage.'
          : 'Note de travail enregistrée — non visible du pilote.'
      );
    } else {
      setError(errorLabel(res.error));
    }
  }

  /** Écarter : le brouillon passe 'discarded' (jamais transmis au pilote). */
  function onDiscard(d: PendingDraft) {
    Alert.alert(
      'Écarter la suggestion',
      'Elle ne sera pas transmise au pilote et sortira de la file.',
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Écarter',
          style: 'destructive',
          onPress: async () => {
            const ok = await discardDraft(d.id);
            if (!aliveRef.current) return;
            if (!ok) {
              setError('La suggestion n’a pas pu être écartée. Réessayez.');
              return;
            }
            animate();
            setPending((prev) => prev.filter((x) => x.id !== d.id));
            // Si c'était la carte en relecture, la relecture se ferme aussi.
            setActiveDraft((cur) => (cur?.id === d.id ? null : cur));
          },
        },
      ]
    );
  }

  // ── Section FILE — suggestions en attente de validation humaine ───────────
  const queueState: ScreenState =
    assistState === 'loading'
      ? 'loading'
      : assistState === 'error'
        ? 'error'
        : visibleQueue.length === 0
          ? 'empty'
          : 'nominal';

  const queueSection = (
    <FadeInSection delay={0}>
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          label="En attente de validation"
          count={assistState === 'ready' ? visibleQueue.length : undefined}
        />
        <StateWrapper
          state={queueState}
          skeletonLines={3}
          emptyLabel="File vide"
          emptyMessage="Aucune suggestion en attente de votre validation. Demandez une proposition sur un virage pour en créer une."
          emptySource="coach_ai_drafts · draft"
          errorCause="La file des suggestions n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <View style={{ gap: spacing.md }}>
            {visibleQueue.map((d, i) => (
              <FadeInSection key={d.id} delay={Math.min(i, 5) * 60}>
                <SuggestionCard
                  draft={d}
                  pilotLabel={pilotNameById.get(d.pilotId) ?? 'Pilote'}
                  metaLine={contextLine(
                    d.sessionId ? sessionMeta[d.sessionId] : undefined,
                    d.cornerIndex
                  )}
                  fact={factFor(d)}
                  onOpen={() => openDraft(d)}
                  onDiscard={() => onDiscard(d)}
                />
              </FadeInSection>
            ))}
          </View>
        </StateWrapper>
      </View>
    </FadeInSection>
  );

  // ── Section DEMANDE — choisir la lecture : pilote · séance · virage ───────
  const setupSection = (
    <FadeInSection delay={90}>
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <SectionHeader label="Demander une proposition" />
          <Text style={s.sectionLabelSub}>Pilote</Text>
          {pilots.length === 0 ? (
            <EmptyState
              label="Aucun pilote consentant"
              message="Un pilote apparaît ici lorsqu'il vous a accordé l'accès détaillé."
              source="coach_pilots_view"
            />
          ) : (
            pilots.map((p) => (
              <Card
                key={p.pilotId}
                onPress={() => {
                  setPilotId(p.pilotId);
                  setError(null);
                  setOutcome(null);
                }}
                accessibilityLabel={fullPilotName(p)}
                style={pilotId === p.pilotId ? s.cardSelected : undefined}
              >
                <Text style={s.rowLabel}>{fullPilotName(p)}</Text>
              </Card>
            ))
          )}
        </View>

        {pilotId && selectedConsent === false ? (
          // État « assistant désactivé » (consentement) — distinct de la file
          // vide et de l'erreur. Le chemin d'activation réel est côté pilote.
          <View style={s.consentOff}>
            <Text style={s.consentOffEyebrow}>Assistant désactivé pour ce pilote</Text>
            <Text style={s.consentOffTxt}>
              {`${selectedPilot ? fullPilotName(selectedPilot) : 'Ce pilote'} n'a pas activé « Assistant IA de mon coach ». L'activation se fait de son côté, dans son application : Réglages, ou Centre de consentement. Vos annotations manuelles restent disponibles.`}
            </Text>
            <Text style={s.consentOffSource}>champ · users.coach_ai_enabled</Text>
          </View>
        ) : null}

        {pilotId && selectedConsent !== false ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={s.sectionLabelSub}>Séance</Text>
            {sessions.length === 0 ? (
              <EmptyState
                label="Aucune séance analysée"
                message="Les séances analysées de ce pilote apparaîtront ici."
                source="app_session_analyses"
              />
            ) : (
              sessions.slice(0, 6).map((sess) => (
                <Card
                  key={sess.id}
                  onPress={() => {
                    setSessionId(sess.id);
                    setError(null);
                  }}
                  accessibilityLabel={`${formatDateLong(sess.startedAt)}, ${sess.circuitName ?? 'circuit'}`}
                  style={sessionId === sess.id ? s.cardSelected : undefined}
                >
                  <Text style={s.rowLabel}>{formatDateLong(sess.startedAt)}</Text>
                  <Text style={s.muted}>{sess.circuitName ?? 'Circuit'}</Text>
                </Card>
              ))
            )}
          </View>
        ) : null}

        {pilotId && selectedConsent !== false && sessionId ? (
          <View style={{ gap: spacing.md }}>
            <Text style={s.sectionLabelSub}>Virage</Text>
            <Segmented
              options={CORNERS.map(String)}
              value={String(corner)}
              onChange={(v) => setCorner(Number(v))}
            />
            <CoachCta
              label="Proposer une observation"
              onPress={onPropose}
              loading={requesting}
              disabled={requesting}
            />
          </View>
        ) : null}
      </View>
    </FadeInSection>
  );

  // ── Section RELECTURE — validation humaine (le seul chemin vers le pilote) ─
  const activeMeta = activeDraft?.sessionId ? sessionMeta[activeDraft.sessionId] : undefined;
  const activeFact = activeDraft ? factFor(activeDraft) : null;
  const activeRetouched = activeDraft ? draftText.trim() !== activeDraft.text.trim() : false;

  const reviewSection = (
    <FadeInSection delay={180}>
      <View style={{ gap: spacing.md }}>
        <SectionHeader label="Relecture" />
        {activeDraft ? (
          <Card style={s.reviewCard}>
            <View style={s.cardTopRow}>
              <ProvenanceBadge label="IA · en relecture" tone="pending" />
              <Text style={s.timeAgo}>{timeAgoFr(new Date(activeDraft.createdAt))}</Text>
            </View>
            <View>
              <Text style={s.contextName}>
                {pilotNameById.get(activeDraft.pilotId) ?? 'Pilote'}
              </Text>
              <Text style={s.contextMeta}>{contextLine(activeMeta, activeDraft.cornerIndex)}</Text>
            </View>
            {activeFact ? <FactRow fact={activeFact} /> : null}
            <Field
              label="Observation (éditable)"
              value={draftText}
              onChangeText={setDraftText}
              multiline
              maxLength={1000}
              showCounter
            />
            {activeRetouched ? (
              <Text style={s.retouche}>
                Texte retouché — il sera re-filtré côté serveur avant publication.
              </Text>
            ) : null}
            <Text style={s.sectionLabelSub}>Visibilité</Text>
            <Segmented
              options={['Note de travail', 'Partagée au pilote']}
              value={visibility === 'shared' ? 'Partagée au pilote' : 'Note de travail'}
              onChange={(v) => setVisibility(v === 'Partagée au pilote' ? 'shared' : 'private')}
            />
            <View style={s.reviewActions}>
              <View style={{ flex: 1 }}>
                <CoachCta
                  label="Valider l'observation"
                  onPress={onValidate}
                  loading={validating}
                  disabled={!draftText.trim()}
                />
              </View>
              <Button label="Écarter" variant="ghost" onPress={() => onDiscard(activeDraft)} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Garder dans la file pour plus tard"
              hitSlop={theme.hitSlop}
              onPress={keepForLater}
            >
              <Text style={s.laterLink}>Garder dans la file pour plus tard</Text>
            </Pressable>
          </Card>
        ) : (
          <EmptyState
            label="Aucune relecture en cours"
            message={
              visibleQueue.length > 0
                ? 'Ouvrez une suggestion de la file, ou demandez une proposition sur un virage.'
                : 'Choisissez un pilote et une séance, puis demandez une proposition sur un virage.'
            }
          />
        )}
      </View>
    </FadeInSection>
  );

  // ── Section HISTORIQUE — ce que l'assistant a produit, validé par vous ─────
  const historyState: ScreenState =
    assistState === 'loading'
      ? 'loading'
      : assistState === 'error'
        ? 'error'
        : history.length === 0
          ? 'empty'
          : 'nominal';

  const historySection = (
    <FadeInSection delay={270}>
      <View style={{ gap: spacing.md }}>
        <SectionHeader label="Validées / retouchées récemment" />
        {outcome ? (
          <Text style={s.outcome} accessibilityLiveRegion="polite">
            {outcome}
          </Text>
        ) : null}
        <StateWrapper
          state={historyState}
          skeletonLines={2}
          emptyLabel="Aucune validation"
          emptyMessage="Vos observations assistées par IA, validées ou retouchées, apparaîtront ici."
          emptySource="coach_annotations · ai_assisted"
          errorCause="L'historique n'a pas pu être chargé."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <View style={{ gap: spacing.md }}>
            {history.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                pilotLabel={pilotNameById.get(item.pilotId) ?? 'Pilote'}
                metaLine={contextLine(
                  item.sessionId ? sessionMeta[item.sessionId] : undefined,
                  item.cornerIndex
                )}
              />
            ))}
          </View>
        </StateWrapper>
      </View>
    </FadeInSection>
  );

  return (
    <Screen>
      <AppBar title="ASSISTANT IA" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        {/* En-tête : le pilote sélectionné situe la lecture (comme la maquette). */}
        <Text style={s.eyebrow}>
          {selectedPilot ? `Assistant · ${fullPilotName(selectedPilot)}` : 'Aide à la rédaction'}
        </Text>
        <Text style={s.title} accessibilityRole="header">
          Observations proposées.
        </Text>
        <Text style={s.subtitle}>{"L'IA propose un fait. Vous décidez."}</Text>

        {/* Bande-garde IA (garde-fou C-1) : pleine largeur, toujours visible —
            rien n'atteint le pilote sans validation. Composant partagé, intact. */}
        <View style={{ marginTop: spacing.lg }}>
          <AIReviewBanner />
        </View>

        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {isConsole ? (
          <View style={s.consoleRow}>
            <View style={[{ flex: 1 }, s.colGap]}>
              {queueSection}
              {setupSection}
            </View>
            <View style={[{ flex: 1.2 }, s.colGap]}>
              {reviewSection}
              {historySection}
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.xl, marginTop: spacing.xl }}>
            {queueSection}
            {reviewSection}
            {setupSection}
            {historySection}
          </View>
        )}

        <Text style={s.doctrine}>
          {"L'assistant propose un fait. La validation, et la décision, restent à vous."}
        </Text>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

/**
 * Carte de la file : une suggestion IA en attente, avec son CONTEXTE réel —
 * pilote, circuit, date, virage, et le fait de triage de la séance si le
 * virage figure parmi les plus serrés. La provenance IA est badgée, jamais
 * adoucie ; les deux actions sont explicites (relire / écarter).
 */
function SuggestionCard({
  draft,
  pilotLabel,
  metaLine,
  fact,
  onOpen,
  onDiscard,
}: {
  draft: PendingDraft;
  pilotLabel: string;
  metaLine: string;
  fact: TriageCorner | null;
  onOpen: () => void;
  onDiscard: () => void;
}) {
  return (
    <Card style={s.queueCard}>
      <View style={s.cardTopRow}>
        <ProvenanceBadge label="IA · à valider" tone="pending" />
        <Text style={s.timeAgo}>{timeAgoFr(new Date(draft.createdAt))}</Text>
      </View>
      <Text style={s.contextName}>{pilotLabel}</Text>
      <Text style={s.contextMeta}>{metaLine}</Text>
      {fact ? <FactRow fact={fact} /> : null}
      <Text style={s.excerpt} numberOfLines={3}>
        {draft.text}
      </Text>
      <View style={s.cardActions}>
        <View style={{ flex: 1 }}>
          <CoachCta compact label="Relire et décider" onPress={onOpen} />
        </View>
        <Button label="Écarter" variant="ghost" onPress={onDiscard} />
      </View>
    </Card>
  );
}

/**
 * Carte d'historique : une annotation ai_assisted réelle. Badge « validée »
 * (texte publié tel que proposé) ou « retouchée » (le coach a édité avant de
 * valider) ; visibilité affichée telle qu'enregistrée.
 */
function HistoryCard({
  item,
  pilotLabel,
  metaLine,
}: {
  item: HistoryItem;
  pilotLabel: string;
  metaLine: string;
}) {
  return (
    <Card style={s.historyCard}>
      <View style={s.cardTopRow}>
        <ProvenanceBadge
          label={item.retouched ? 'IA · retouchée · validée' : 'IA · validée'}
          tone="done"
        />
        <Text style={s.timeAgo}>{timeAgoFr(new Date(item.createdAt))}</Text>
      </View>
      <Text style={s.contextName}>{pilotLabel}</Text>
      <Text style={s.contextMeta}>{metaLine}</Text>
      <Text style={s.excerpt} numberOfLines={3}>
        {item.body}
      </Text>
      <Text style={s.visibilityTag}>
        {item.visibility === 'shared'
          ? 'Partagée au pilote'
          : 'Note de travail · non visible du pilote'}
      </Text>
    </Card>
  );
}

/**
 * Badge de provenance IA — toujours visible, jamais adouci (transparence C-1).
 * `pending` = rouge d'accent coach (action attendue) ; `done` = vert (validé).
 */
function ProvenanceBadge({ label, tone }: { label: string; tone: 'pending' | 'done' }) {
  return (
    <View style={[s.badge, tone === 'pending' ? s.badgePending : s.badgeDone]}>
      <Text style={[s.badgeTxt, tone === 'pending' ? s.badgeTxtPending : s.badgeTxtDone]}>
        {label}
      </Text>
    </View>
  );
}

/** Fait de triage mesuré (point coloré à la zone de marge + énoncé factuel). */
function FactRow({ fact }: { fact: TriageCorner }) {
  return (
    <View style={s.factRow}>
      <View
        style={[s.factDot, { backgroundColor: marginZoneExportColor(fact.marginZone) }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={s.factTxt}>{fact.fact}</Text>
    </View>
  );
}

/** En-tête de section avec compteur réel optionnel (rouge coach = à traiter). */
function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionLabel}>{label}</Text>
      {typeof count === 'number' ? (
        <View style={s.countBadge}>
          <Text style={s.countBadgeTxt}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * CoachCta — action primaire d'identité coach (rouge d'accent #E23A4E). Texte
 * sombre pour le contraste (précédent Studio), grammaire mono du bouton OXV.
 * Porte l'état de chargement (spinner) sans casser la cible ≥ 48 px ; la
 * variante `compact` (cartes de file) garde une cible ≥ 44 px.
 */
function CoachCta({
  label,
  onPress,
  loading,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        s.cta,
        compact ? s.ctaCompact : null,
        disabled ? s.ctaDisabled : null,
        pressed && !inert ? s.ctaPressed : null,
      ]}
    >
      <View style={s.ctaContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.night}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={s.ctaLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  consoleRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  colGap: { gap: spacing.xxl },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  // Sous-étiquette d'un groupe à l'intérieur d'une section (pilote/séance/virage).
  sectionLabelSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(226,58,78,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226,58,78,0.35)',
    alignItems: 'center',
  },
  countBadgeTxt: {
    fontFamily: fonts.monoSemi,
    fontSize: 10,
    color: palette.coachAccent,
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  // Sélection = contexte coach → liseré rouge d'accent (identité de rôle).
  cardSelected: {
    borderColor: palette.coachAccent,
    borderWidth: 1.5,
  },
  // Carte de relecture : accent haut 2px coach (handoff §5 « bordure d'accent »).
  reviewCard: {
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Carte de file : accent gauche rouge coach (même grammaire que le hub —
  // « quelque chose attend votre lecture »).
  queueCard: {
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    padding: spacing.lg,
  },
  historyCard: { padding: spacing.lg },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: 'rgba(226,58,78,0.12)',
    borderColor: 'rgba(226,58,78,0.35)',
  },
  badgeDone: {
    backgroundColor: 'rgba(79,201,138,0.10)',
    borderColor: 'rgba(79,201,138,0.30)',
  },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badgeTxtPending: { color: palette.coachAccent },
  badgeTxtDone: { color: palette.green },
  timeAgo: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
  },
  contextName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  contextMeta: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: 2,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: palette.surface3,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  factDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  factTxt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.5,
  },
  excerpt: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.55,
    marginTop: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  visibilityTag: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retouche: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  laterLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.creamMute,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  outcome: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.green,
    lineHeight: fontSize.small * 1.5,
  },
  // État « assistant désactivé » (consentement pilote) — liseré alerte douce
  // coach, jamais le rouge de donnée ni l'or.
  consentOff: {
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAlert,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  consentOffEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.coachAlert,
  },
  consentOffTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.55,
    marginTop: spacing.sm,
  },
  consentOffSource: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.coachAlert,
    marginTop: spacing.lg,
    lineHeight: fontSize.small * 1.5,
  },
  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },
  // CTA coach (identité rouge d'accent)
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg - 2,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCompact: {
    paddingVertical: spacing.md - 2,
    minHeight: 44,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaPressed: { opacity: 0.9 },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaLabel: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.night,
  },
});
