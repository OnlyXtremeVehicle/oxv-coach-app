/**
 * Coach — Rapport de séance (PDF). Reskin refonte-v2 §12, RESPONSIVE deux formats.
 *
 * Le coach rédige SON bilan d'une séance. Il est ENREGISTRÉ, et le pilote le lit
 * dans son bilan. Le PDF n'est plus qu'un export.
 *
 * ---
 *
 * CE QUE CET ÉCRAN FAISAIT JUSQU'AU 14/08/2026
 *
 * *« Aucun schéma nouveau ; le bilan n'est pas stocké — IL VOYAGE DANS LE
 * DOCUMENT. »* C'était écrit ici, et c'était le défaut : le produit était le
 * PDF. Un fichier perdu, et le bilan de la séance n'existait plus. Le critère
 * d'acceptation du jalon 6 — *« une carte de séance est-elle REÇUE par un
 * pilote ? »* — ne pouvait pas être satisfait : rien n'était reçu, quelque
 * chose était partagé.
 *
 * Le plan demandait l'inverse : *« rapport devient la composition de la carte de
 * séance — le PDF reste un export, plus le produit. »*
 *
 * `coach_annotations` accepte depuis le 14/08 une NOTE DE SÉANCE — ni virage ni
 * instant, mais une séance et un texte. Le bilan y est écrit, une seule par
 * séance et par coach : rédiger à nouveau REMPLACE, plutôt que d'empiler deux
 * avis que le pilote lirait comme deux.
 *
 * Le garde-fou doctrinal est celui des notes de virage — une note partagée ne
 * peut pas être prescriptive, et le rempart réel est le trigger en base.
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette coach/05-rapport) :
 *     header (eyebrow + titre + CTA rouge coach) puis 2 colonnes — VOTRE RÉDACTION
 *     à gauche, APERÇU DU PDF (document clair) à droite ; note d'attribution en bas.
 *   - COMPAGNON (téléphone) : 1 colonne compacte, même contenu empilé.
 * Le rail (console) et les onglets (téléphone) sont fournis par le layout : cet
 * écran n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Adaptations honnêtes vis-à-vis de la maquette (backend inchangé, zéro table) :
 *   - la maquette montre plusieurs SECTIONS d'édition + « Enregistrer le brouillon » ;
 *     le service ne persiste RIEN et ne rend qu'UN bilan libre → un seul champ,
 *     pas de bouton brouillon (aucun contrôle sans effet réel).
 *   - l'attribution du document reprend le nom RÉEL du coach (son profil), tel
 *     qu'il apparaît « chez le pilote » ; l'aperçu clair reflète le contenu du PDF
 *     (le gabarit natif coachReportPdfService, thème sombre, n'est pas modifié ici).
 *
 * expo-print ne tourne pas en Expo Go (build natif) : on le signale honnêtement.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  chargerMarqueursSeance,
  ligneDocument,
  type MarqueurSeance,
} from '@/features/coach/marqueursSeanceService';
import { PressableScale } from '@/components/motion';
import { RecordingPresets, useAudioRecorder } from 'expo-audio';

import { MemoVocal } from '@/features/coach/MemoVocal';
import { upsertSessionNote, listSessionNotes } from '@/services/coachAnnotationsService';
import {
  attachAudioToAnnotation,
  requestRecordingPermission,
  startRecording,
  stopRecording,
} from '@/services/coachAudioService';
import { exportAndShareCoachReport } from '@/services/coachReportPdfService';
import { getStudioSession, type StudioSession } from '@/services/coachStudioService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatChronoTenths, formatDateShort } from '@/utils/format';

const { palette, spacing, fonts, radius, fontSize } = theme;

// Papier du document (aperçu clair) — surfaces locales à cet écran (le reste de
// l'app est sombre). L'or lisible sur clair = palette.goldText (chrono/record).
const PAPER = '#F5F4F1';
const PAPER_CELL = '#ECEAE3';
const PAPER_LINE = '#DEDBD3';
const INK = '#15151A';
const INK_SOFT = '#3B3B42';
const INK_MUTE = '#8B8B85';

export default function CoachRapportScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; startedAt?: string }>();
  const sessionId = params.sessionId;
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const profile = useAuthStore((s) => s.profile);
  const coachName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Votre coach';
  const coachInitials =
    [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
    'C';

  const [studio, setStudio] = useState<StudioSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bilan, setBilan] = useState('');
  const [saving, setSaving] = useState(false);
  /** Horodatage du dernier enregistrement — `null` tant que rien n'est écrit. */
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /**
   * LA VOIX DU COACH.
   *
   * Le critère d'acceptation n° 3 du jalon 6 demande une carte de séance reçue
   * par un pilote *avec l'audio*. `coach_annotations.audio_url` existe depuis le
   * lot PR-59 et le bucket `coach-audio` aussi ; il ne manquait que le geste.
   *
   * L'enregistreur vit ICI et non dans le service : depuis le SDK 55,
   * `useAudioRecorder` est un hook et expo-audio n'expose aucune fabrique hors
   * React. Le service opère sur l'enregistreur qu'on lui passe.
   *
   * `noteAudioUrl` porte le mémo DÉJÀ envoyé, relu à l'ouverture. Sans lui,
   * rouvrir une séance déjà commentée à la voix afficherait « appuyez pour
   * enregistrer » — le coach croirait n'avoir rien dit. C'est le même défaut que
   * le champ de texte vide, corrigé au même endroit.
   */
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [noteAudioUrl, setNoteAudioUrl] = useState<string | null>(null);
  const [recElapsedMs, setRecElapsedMs] = useState(0);
  const recStartRef = useRef<number | null>(null);
  const [generating, setGenerating] = useState(false);
  /**
   * LES MOMENTS RETENUS — « le coach retient un marqueur, envoie ».
   *
   * Les marqueurs de la seance, resolus. Rien n'est retenu par defaut : le
   * document ne porte que ce que le coach a choisi d'y mettre.
   */
  const [marqueurs, setMarqueurs] = useState<MarqueurSeance[]>([]);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) {
      setMarqueurs([]);
      return;
    }
    let annule = false;
    chargerMarqueursSeance(sessionId)
      .then((liste) => {
        if (!annule) setMarqueurs(liste);
      })
      // Best-effort : sans marqueurs, le coach ecrit quand meme sa phrase.
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getStudioSession(sessionId)
      .then((s) => {
        if (!cancelled) {
          setStudio(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  /**
   * RELIRE LE BILAN DÉJÀ ÉCRIT.
   *
   * Sans cela, rouvrir l'écran présenterait un champ vide sur une séance déjà
   * commentée — et le coach, croyant n'avoir rien écrit, recommencerait. Le
   * `upsert` remplacerait alors sa propre note sans qu'il l'ait voulu.
   */
  useEffect(() => {
    if (!sessionId || !studio?.pilotId) return;
    let annule = false;
    listSessionNotes(studio.pilotId, sessionId)
      .then((notes) => {
        if (annule || notes.length === 0) return;
        setBilan(notes[0].body);
        setSavedAt(notes[0].updatedAt);
        setNoteAudioUrl(notes[0].audioUrl);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, [sessionId, studio?.pilotId]);

  /**
   * CE QUI PARTIRA DANS LE DOCUMENT — calculé UNE fois.
   *
   * L'aperçu et la génération lisent la même liste. Deux calculs séparés
   * finiraient par diverger, et le coach enverrait autre chose que ce qu'il a
   * relu. Dans l'ORDRE DE LA SÉANCE, pas dans l'ordre où il a coché : le
   * document raconte le roulage, pas la sélection.
   */
  const lignesRetenues = useMemo(
    () =>
      marqueurs
        .filter((m) => retenus.has(m.id))
        .map(ligneDocument)
        .filter((l): l is string => l !== null),
    [marqueurs, retenus]
  );

  /**
   * Chrono d'enregistrement — mesuré depuis l'horloge de démarrage, jamais
   * estimé. Il se fige au `stop` (nettoyage) pour donner la durée du mémo prêt.
   */
  useEffect(() => {
    if (!recording) return;
    recStartRef.current = Date.now();
    setRecElapsedMs(0);
    const id = setInterval(() => {
      if (recStartRef.current != null) setRecElapsedMs(Date.now() - recStartRef.current);
    }, 250);
    return () => {
      clearInterval(id);
      if (recStartRef.current != null) {
        setRecElapsedMs(Date.now() - recStartRef.current);
        recStartRef.current = null;
      }
    };
  }, [recording]);

  async function onToggleRecord() {
    if (recording) {
      const uri = await stopRecording(recorder);
      setRecording(false);
      setRecordedUri(uri);
      return;
    }
    const ok = await requestRecordingPermission();
    if (!ok) return;
    if (await startRecording(recorder)) {
      setRecordedUri(null);
      setRecording(true);
    }
  }

  /** Retenir ou relacher un moment. Rien n'est retenu par defaut. */
  function basculeRetenu(id: string) {
    setRetenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * ENREGISTRER — le geste principal désormais.
   *
   * Le pilote reçoit la note dans son bilan ; le PDF, lui, ne part que si le
   * coach le demande. On n'enchaîne donc PAS les deux : un export raté ne doit
   * pas faire croire que le bilan n'a pas été enregistré, ni l'inverse.
   */
  async function onEnregistrer() {
    if (!sessionId || !studio?.pilotId || saving) return;
    setSaving(true);
    const note = await upsertSessionNote({
      pilotId: studio.pilotId,
      telemetrySessionId: sessionId,
      body: bilan,
    });

    /**
     * L'AUDIO NE PEUT PAS PRÉCÉDER LA NOTE.
     *
     * La policy `coach_audio_insert` lit l'objet par son NOM, qui doit être
     * l'uuid de l'annotation : sans annotation, l'envoi est refusé. L'ordre
     * n'est donc pas une commodité, c'est la contrainte du stockage.
     *
     * Et l'échec de l'audio ne doit pas se lire comme un échec du bilan : le
     * texte est écrit, il est visible du pilote, le dire autrement ferait
     * recommencer le coach sur une note déjà enregistrée.
     */
    let audioEchoue = false;
    if (note && recordedUri) {
      const res = await attachAudioToAnnotation(note.id, recordedUri);
      if (res.ok) setNoteAudioUrl(note.id);
      else audioEchoue = true;
    }

    setSaving(false);
    if (note) setSavedAt(note.updatedAt);
    Toast.show(
      note
        ? audioEchoue
          ? {
              type: 'error',
              text1: 'Bilan enregistré, mémo vocal non envoyé.',
              text2: 'Votre pilote voit le texte. Réessayez pour la voix.',
            }
          : { type: 'success', text1: 'Bilan enregistré. Votre pilote le voit.' }
        : {
            type: 'error',
            // Trois causes possibles, toutes dites par le service dans la
            // console : texte vide, tournure prescriptive, écriture refusée.
            text1: 'Bilan non enregistré.',
            text2: 'Texte vide, ou tournure prescriptive.',
          }
    );
  }

  async function onGenerate() {
    if (!sessionId || generating) return;
    setGenerating(true);
    const res = await exportAndShareCoachReport({
      sessionId,
      coachBilan: bilan,
      startedAt: params.startedAt ?? null,
      // La MÊME liste que celle relue dans l'aperçu — cf. `lignesRetenues`.
      marqueurs: lignesRetenues,
    });
    setGenerating(false);
    Toast.show(
      res.ok
        ? { type: 'success', text1: 'Rapport généré.' }
        : { type: 'error', text1: res.error ?? 'Génération impossible.' }
    );
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !sessionId || !studio
        ? 'empty'
        : 'nominal';

  /**
   * Un seul mémo pour les deux mises en page. L'élément est construit ici et
   * passé aux deux `Editor` : le monter deux fois créerait deux enregistreurs.
   */
  const memoVocal = (
    <MemoVocal
      eyebrow="VOTRE VOIX (FACULTATIF)"
      recording={recording}
      hasRecording={!!recordedUri || !!noteAudioUrl}
      elapsedMs={recElapsedMs}
      onToggle={onToggleRecord}
    />
  );

  const dateLabel = params.startedAt ? formatDateShort(params.startedAt).toUpperCase() : null;
  const canGenerate = !!sessionId && !!studio;

  return (
    <Screen scroll={false}>
      {isConsole ? (
        <View style={s.consoleHead}>
          <View style={{ flex: 1 }}>
            <View style={{ marginBottom: spacing.sm }}>
              <RoleBadge role="coach" />
            </View>
            <Text style={s.headEyebrow}>
              RAPPORT DE SÉANCE{studio?.circuitName ? ` · ${studio.circuitName}` : ''}
            </Text>
            <Text style={s.headTitle} accessibilityRole="header">
              Votre bilan de coach
            </Text>
          </View>
          <View style={{ gap: spacing.sm, alignItems: 'flex-end' }}>
            <EnregistrerButton
              saving={saving}
              disabled={!sessionId || !studio?.pilotId}
              motif={motifInerte(sessionId ?? null, studio?.pilotId ?? null)}
              savedAt={savedAt}
              onPress={onEnregistrer}
            />
            <GenerateButton generating={generating} disabled={!canGenerate} onPress={onGenerate} />
          </View>
        </View>
      ) : (
        <AppBar title="RAPPORT" onBack={() => router.back()} />
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: isConsole ? spacing.xl : spacing.lg,
            paddingTop: isConsole ? spacing.sm : spacing.md,
            paddingBottom: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {!isConsole ? (
            <>
              <View style={{ marginBottom: spacing.md }}>
                <RoleBadge role="coach" />
              </View>
              <Text style={s.headEyebrow}>RAPPORT DE SÉANCE</Text>
              <Text style={s.headTitle} accessibilityRole="header">
                Votre bilan de coach
              </Text>
            </>
          ) : null}

          <View style={{ marginTop: isConsole ? 0 : spacing.lg }}>
            <StateWrapper
              state={state}
              skeletonLines={6}
              emptyLabel="Aucune séance"
              emptyMessage="Ouvrez le rapport depuis une séance de votre file de lecture."
              errorCause="La séance n'a pas pu être chargée."
              onRetry={() => setReloadKey((k) => k + 1)}
            >
              {studio ? (
                isConsole ? (
                  <>
                    <View style={s.cols}>
                      <View style={s.colEditor}>
                        <FaitsPanel studio={studio} />
                        <MomentsPanel
                          marqueurs={marqueurs}
                          retenus={retenus}
                          onToggle={basculeRetenu}
                        />
                        <Editor bilan={bilan} onChange={setBilan} memo={memoVocal} />
                      </View>
                      <View style={s.colPreview}>
                        <PdfPreview
                          studio={studio}
                          bilan={bilan}
                          dateLabel={dateLabel}
                          coachName={coachName}
                          coachInitials={coachInitials}
                          moments={lignesRetenues}
                        />
                      </View>
                    </View>
                    <DoctrineNote />
                  </>
                ) : (
                  <View style={{ gap: spacing.xl }}>
                    <FaitsPanel studio={studio} />
                    <MomentsPanel
                      marqueurs={marqueurs}
                      retenus={retenus}
                      onToggle={basculeRetenu}
                    />
                    <Editor bilan={bilan} onChange={setBilan} memo={memoVocal} />
                    <PdfPreview
                      studio={studio}
                      bilan={bilan}
                      dateLabel={dateLabel}
                      coachName={coachName}
                      coachInitials={coachInitials}
                      moments={lignesRetenues}
                    />
                    <EnregistrerButton
                      saving={saving}
                      disabled={!sessionId || !studio?.pilotId}
                      motif={motifInerte(sessionId ?? null, studio?.pilotId ?? null)}
                      savedAt={savedAt}
                      onPress={onEnregistrer}
                      block
                    />
                    <GenerateButton
                      generating={generating}
                      disabled={!canGenerate}
                      onPress={onGenerate}
                      block
                    />
                    <DoctrineNote />
                  </View>
                )
              ) : null}
            </StateWrapper>
          </View>

          {studio ? (
            <Text style={s.note}>
              Le rapport reprend les faits clés et votre bilan. Le rendu PDF s’ouvre dans le build
              de l’application (impression native).
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Faits clés de la séance qui iront dans le document (rappel pour le coach). */
function FaitsPanel({ studio }: { studio: StudioSession }) {
  return (
    <CockpitPanel>
      <Text style={s.eyebrow}>{studio.circuitName ?? 'Séance'}</Text>
      <Text style={s.facts}>{factsLine(studio)}</Text>
    </CockpitPanel>
  );
}

/**
 * LES MOMENTS RETENUS — « le coach retient un marqueur, envoie ».
 *
 * Chaque ligne porte les FAITS que la mesure a résolus, puis la note du coach
 * s'il en a écrit une. L'ordre est celui de la SÉANCE, pas celui des choix : le
 * document raconte le roulage.
 *
 * RIEN N'EST RETENU PAR DÉFAUT. Un marqueur est un repère que le coach s'est
 * posé à lui-même ; le porter au document est un second geste, délibéré.
 *
 * Aucun marqueur → le panneau n'existe pas. Un titre sur une liste vide ferait
 * exister une attente qu'on ne peut pas satisfaire.
 */
function MomentsPanel({
  marqueurs,
  retenus,
  onToggle,
}: {
  marqueurs: MarqueurSeance[];
  retenus: Set<string>;
  onToggle: (id: string) => void;
}) {
  // On n'offre que les marqueurs qui ÉCRIRAIENT quelque chose : un repère dont
  // rien n'a pu être résolu et qui ne porte aucune note n'a rien à dire.
  const offrables = marqueurs.filter((m) => ligneDocument(m) !== null);
  if (offrables.length === 0) return null;

  return (
    <View>
      <Text style={s.sectionLabel}>LES MOMENTS RETENUS</Text>
      <CockpitPanel>
        {offrables.map((m) => {
          const retenu = retenus.has(m.id);
          const ligne = ligneDocument(m) as string;
          return (
            <PressableScale
              key={m.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: retenu }}
              accessibilityLabel={`${ligne}. ${retenu ? 'Retenu' : 'Non retenu'}.`}
              // PAS DE hitSlop VERTICAL : les lignes sont jointives, et un
              // débordement de 8 px au-dessus et en dessous fait que le dernier
              // frère rafle le toucher destiné à son voisin. Le piège a déjà
              // mordu deux fois dans ce dépôt. La hauteur de cible vient du
              // padding, qui lui n'empiète sur personne.
              hitSlop={{ left: 12, right: 12 }}
              onPress={() => onToggle(m.id)}
              style={{ paddingVertical: spacing.md, flexDirection: 'row', gap: spacing.md }}
            >
              <Text style={[s.facts, { color: retenu ? palette.cream : palette.creamMute }]}>
                {retenu ? '■' : '□'}
              </Text>
              <Text
                style={[s.facts, { flex: 1, color: retenu ? palette.cream : palette.creamMute }]}
              >
                {ligne}
              </Text>
            </PressableScale>
          );
        })}
      </CockpitPanel>
    </View>
  );
}

/**
 * VOTRE RÉDACTION — un seul champ libre (le service ne rend qu'un bilan).
 *
 * `memo` est passé plutôt que monté ici : l'écran a deux mises en page (console
 * et compagnon) donc deux appels à `Editor`, et l'enregistreur ne peut exister
 * qu'en UN exemplaire — deux `useAudioRecorder` sur un même écran se
 * disputeraient le micro.
 */
function Editor({
  bilan,
  onChange,
  memo,
}: {
  bilan: string;
  onChange: (t: string) => void;
  memo?: ReactNode;
}) {
  return (
    <View>
      <Text style={s.sectionLabel}>VOTRE RÉDACTION</Text>
      <Field
        label="Le bilan de votre coach"
        value={bilan}
        onChangeText={onChange}
        placeholder="Votre lecture pour ce pilote. Elle apparaîtra à votre nom, dans une bande attribuée — jamais comme une consigne de l'app."
        multiline
        numberOfLines={8}
        maxLength={1500}
        showCounter
        optional
      />
      {memo}
    </View>
  );
}

/** APERÇU DU PDF — document clair reflétant le contenu du rapport (données réelles). */
function PdfPreview({
  studio,
  bilan,
  dateLabel,
  coachName,
  coachInitials,
  moments,
}: {
  studio: StudioSession;
  bilan: string;
  dateLabel: string | null;
  coachName: string;
  coachInitials: string;
  /**
   * Les lignes des moments RETENUS, dans l'ordre de la séance.
   *
   * L'aperçu les ignorait : le coach cochait, le papier ne bougeait pas, et il
   * ne pouvait vérifier ce qu'il envoyait qu'APRÈS l'avoir envoyé. Un aperçu qui
   * ne montre pas ce qui part n'est pas un aperçu. Relevé par la revue
   * adversariale du 02/08/2026.
   */
  moments: string[];
}) {
  const cells = [
    {
      label: 'MEILLEUR TOUR',
      value: studio.bestLapSeconds != null ? formatChronoTenths(studio.bestLapSeconds) : '—',
      gold: true,
    },
    {
      label: 'MARGE GLOBALE',
      value: studio.margins.global != null ? `${Math.round(studio.margins.global)} %` : '—',
      gold: false,
    },
    {
      label: 'TOURS',
      value: studio.lapCount > 0 ? String(studio.lapCount) : '—',
      gold: false,
    },
  ];
  const body = bilan.trim();

  return (
    <View>
      <Text style={s.sectionLabel}>APERÇU DU PDF</Text>
      <View style={s.paper}>
        <View style={s.paperHead}>
          <Text style={s.paperLogo}>OXV</Text>
          <Text style={s.paperHeadMeta}>{dateLabel ? `RAPPORT · ${dateLabel}` : 'RAPPORT'}</Text>
        </View>

        <Text style={s.paperEyebrow}>SÉANCE</Text>
        <Text style={s.paperTitle}>{studio.circuitName ?? 'Séance'}</Text>

        <View style={s.paperCells}>
          {cells.map((c) => (
            <View key={c.label} style={s.paperCell}>
              <Text style={s.paperCellLabel}>{c.label}</Text>
              <Text style={[s.paperCellValue, c.gold ? { color: palette.goldText } : null]}>
                {c.value}
              </Text>
            </View>
          ))}
        </View>

        {moments.length > 0 ? (
          <>
            <Text style={s.paperBandLabel}>LES MOMENTS RETENUS</Text>
            <View style={{ marginBottom: spacing.md }}>
              {moments.map((ligne, i) => (
                <Text key={i} style={s.paperMoment}>
                  {ligne}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.paperBandLabel}>LE BILAN DE VOTRE COACH</Text>
        <Text style={body ? s.paperBilan : s.paperBilanEmpty}>
          {body || 'Votre bilan apparaîtra ici, à votre nom.'}
        </Text>

        <View style={s.paperSign}>
          <View style={s.paperAvatar}>
            <Text style={s.paperAvatarTxt}>{coachInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.paperSignName} numberOfLines={1}>
              {coachName}
            </Text>
            <Text style={s.paperSignRole}>coach OXV</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Note d'attribution (doctrine) — la voix du coach est attribuée, jamais une consigne. */
function DoctrineNote() {
  return (
    <View style={s.noteBand} accessibilityRole="summary">
      <View style={s.noteRing} />
      <Text style={s.noteBandTxt}>
        Votre bilan apparaîtra à votre nom chez le pilote — jamais comme une consigne de l’app.
      </Text>
    </View>
  );
}

/** CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le rouge. */
/**
 * ENREGISTRER — le geste principal.
 *
 * Il précède l'export dans les deux formats : le bilan atteint le pilote par la
 * base, pas par un fichier. Le PDF reste offert, il n'est plus le produit.
 *
 * L'état « enregistré » porte son HORODATAGE plutôt qu'une coche : une coche dit
 * qu'on a cliqué, une date dit ce qui est en base. Sans note écrite, la ligne
 * est ABSENTE — pas un « jamais enregistré » qui ferait du vide une alerte.
 */
/**
 * CE QUI MANQUE, NOMMÉ.
 *
 * Le bouton se grisait sans un mot : le coach voyait un geste refusé et rien
 * qui dise pourquoi. La doctrine exige l'inverse — un état fermé nomme le champ
 * absent.
 *
 * Cette feuille est une feuille de DONNÉES : le motif s'écrit donc en
 * mots-clés, pas en phrase.
 */
function motifInerte(sessionId: string | null, pilotId: string | null): string | null {
  if (!sessionId) return 'SÉANCE ABSENTE';
  if (!pilotId) return 'PILOTE NON IDENTIFIÉ';
  return null;
}

function EnregistrerButton({
  saving,
  disabled,
  motif,
  savedAt,
  onPress,
  block,
}: {
  saving: boolean;
  disabled: boolean;
  /** Mot-clé nommant ce qui manque, ou `null` quand le geste est ouvert. */
  motif: string | null;
  savedAt: string | null;
  onPress: () => void;
  block?: boolean;
}) {
  const inert = disabled || saving;
  return (
    <View style={block ? { alignSelf: 'stretch' } : undefined}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enregistrer le bilan — votre pilote le verra dans sa séance"
        accessibilityState={{ disabled, busy: saving }}
        disabled={inert}
        onPress={inert ? undefined : onPress}
        style={({ pressed }) => [
          s.cta,
          block ? { alignSelf: 'stretch' } : null,
          disabled ? s.ctaDisabled : null,
          pressed && !inert ? { opacity: 0.85 } : null,
        ]}
      >
        <Text style={s.ctaTxt}>{saving ? 'ENREGISTREMENT…' : 'ENREGISTRER'}</Text>
      </Pressable>
      {disabled && motif ? <Text style={s.enregistreLe}>{motif}</Text> : null}
      {savedAt ? (
        <Text style={s.enregistreLe}>Enregistré le {formatDateShort(savedAt)}</Text>
      ) : null}
    </View>
  );
}

function GenerateButton({
  generating,
  disabled,
  onPress,
  block,
}: {
  generating: boolean;
  disabled: boolean;
  onPress: () => void;
  block?: boolean;
}) {
  const inert = disabled || generating;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Générer et envoyer le rapport PDF"
      accessibilityState={{ disabled, busy: generating }}
      disabled={inert}
      onPress={inert ? undefined : onPress}
      style={({ pressed }) => [
        s.cta,
        block ? { alignSelf: 'stretch' } : null,
        disabled ? s.ctaDisabled : null,
        pressed && !inert ? { opacity: 0.9 } : null,
      ]}
    >
      <View style={s.ctaContent}>
        {generating ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.ctaTxt, disabled ? s.ctaTxtDisabled : null]}>
          {generating ? 'Génération…' : 'Générer et envoyer'}
        </Text>
      </View>
    </Pressable>
  );
}

function factsLine(studio: StudioSession): string {
  const parts: string[] = [`${studio.lapCount} tour${studio.lapCount > 1 ? 's' : ''}`];
  if (studio.bestLapSeconds != null) {
    parts.push(`meilleur ${formatChronoTenths(studio.bestLapSeconds)}`);
  }
  parts.push(studio.qdi ? 'QDI 5 branches' : 'QDI en attente');
  return parts.join(' · ');
}

const s = StyleSheet.create({
  // — Header console —
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.xs,
  },
  headTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
  },

  // — Colonnes console —
  cols: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  colEditor: { flex: 1.15, gap: spacing.lg },
  colPreview: { flex: 1, maxWidth: 380 },

  // — Faits —
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  facts: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamSoft,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },

  // — Aperçu document (papier clair) —
  paper: {
    backgroundColor: PAPER,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PAPER_LINE,
    padding: spacing.lg,
  },
  paperHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  paperLogo: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 2,
    color: INK,
  },
  paperHeadMeta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: INK_MUTE,
  },
  paperEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: INK_MUTE,
    marginBottom: spacing.xs,
  },
  paperTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    letterSpacing: 0.2,
    color: INK,
    marginBottom: spacing.lg,
  },
  paperCells: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  paperCell: {
    flex: 1,
    backgroundColor: PAPER_CELL,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  paperCellLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: INK_MUTE,
    marginBottom: spacing.xs,
  },
  paperCellValue: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    color: INK,
  },
  paperMoment: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
    color: INK_SOFT,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: PAPER_LINE,
    marginBottom: 6,
  },
  paperBandLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: palette.red,
    marginBottom: spacing.sm,
  },
  paperBilan: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: INK_SOFT,
  },
  paperBilanEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    lineHeight: fontSize.small * 1.55,
    color: INK_MUTE,
  },
  paperSign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: PAPER_LINE,
  },
  paperAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PAPER_CELL,
    borderWidth: 1,
    borderColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperAvatarTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: INK,
  },
  paperSignName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.small,
    color: INK,
  },
  paperSignRole: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: INK_MUTE,
    marginTop: 1,
  },

  // — Note d'attribution (doctrine) —
  noteBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: palette.red,
    backgroundColor: 'rgba(200,16,46,0.07)',
  },
  noteRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: palette.coachAccent,
  },
  noteBandTxt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.coachAccent,
  },

  // — CTA rouge coach —
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: '#2A2A2E' },
  enregistreLe: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
  ctaTxtDisabled: { color: '#6A6A73' },

  // — Note technique —
  note: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.xl,
    lineHeight: fontSize.small * 1.5,
  },
});
