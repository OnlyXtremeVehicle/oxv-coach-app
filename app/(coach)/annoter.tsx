/**
 * Coach — Annoter un virage d'un pilote suivi. Reskin refonte-v2 §12, RESPONSIVE
 * deux formats.
 *
 * Le coach arrive avec params {pilotId, cornerIndex, sessionId?} et peut :
 *   - Voir ses notes existantes sur ce virage (lecture, à gauche en console)
 *   - Rédiger une note (texte + mémo vocal), la partager ou la garder brouillon
 *   - Éditer / supprimer ses propres notes
 *   - Basculer la visibilité (private = brouillon, shared = visible pilote)
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette coach/06-annoter) :
 *     header (eyebrow + titre virage + pastille « VISIBLE PILOTE SI PARTAGÉE »)
 *     puis 2 colonnes — VIRAGE CONCERNÉ + vos notes à gauche, éditeur (note écrite
 *     + mémo vocal + partage + actions) à droite.
 *   - COMPAGNON (téléphone) : 1 colonne compacte, même contenu empilé, AppBar.
 * Le rail (console) et les onglets (téléphone) sont fournis par le layout : cet
 * écran n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Adaptations honnêtes vis-à-vis de la maquette (backend inchangé, zéro table) :
 *   - la maquette montre un graphe de trajectoire du virage à gauche ; cet écran
 *     ne charge pas la télémétrie de la séance → colonne « virage concerné »
 *     factuelle (n°, nom réel, profil, contexte de la note). Aucun tracé inventé.
 *   - le nom du pilote n'est pas chargé ici (RLS : le coach ne voit jamais les
 *     coordonnées) → « le pilote » plutôt qu'un prénom d'exemple.
 *   - la durée du mémo vocal est mesurée réellement (chrono d'enregistrement) ;
 *     la waveform est un glyphe décoratif (masqué de l'accessibilité), pas une
 *     amplitude affichée comme donnée.
 *
 * Doctrine : ton sobre en placeholder ; la voix du coach reste ATTRIBUÉE (rappel
 * « à votre nom, jamais une consigne »). Le rempart réel des notes partagées est
 * le filtre doctrinal du service (createAnnotation → isDoctrineSafe) : inchangé.
 * expo-av (enregistrement) requiert un build natif : signalé honnêtement.
 */

import { useEffect, useRef, useState } from 'react';
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

import { getCorner, type CornerTopology } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type AnnotationVisibility,
  type CoachAnnotation,
  createAnnotation,
  deleteAnnotation,
  listMyAnnotationsForCorner,
  updateAnnotation,
} from '@/services/coachAnnotationsService';
import {
  attachAudioToAnnotation,
  requestRecordingPermission,
  startRecording,
  stopRecording,
} from '@/services/coachAudioService';
import { type Audio } from 'expo-av';
import { type CoachAnnotationTemplate } from '@/services/coachCurationLogic';
import { listMyTemplates } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { formatDateShort } from '@/utils/format';

const { palette, spacing, fonts, fontSize, radius } = theme;

/** Profil de virage (topologie réelle) → étiquette sobre en clair. */
function paceLabel(pace: CornerTopology['pace']): string {
  return pace === 'slow' ? 'Épingle' : pace === 'fast' ? 'Courbe rapide' : 'Virage moyen';
}

/** Durée du mémo vocal en « m:ss » (chrono réel de l'enregistrement). */
function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function CoachAnnoterScreen() {
  const params = useLocalSearchParams<{
    pilotId?: string;
    cornerIndex?: string;
    sessionId?: string;
  }>();
  const cornerIndex = Number(params.cornerIndex ?? '1');
  const corner = getCorner(cornerIndex);
  const cornerName = corner?.name ?? `Virage ${cornerIndex}`;

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<AnnotationVisibility>('shared');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);
  // Note vocale (PR-59) — l'enregistrement requiert expo-av (build natif).
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  // Chrono réel de l'enregistrement (source : horloge de démarrage).
  const [recElapsedMs, setRecElapsedMs] = useState(0);
  const recStartRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyTemplates().then((rows) => {
      if (!cancelled) setTemplates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chrono d'enregistrement : démarre au passage en enregistrement, se fige au
  // stop (cleanup) pour afficher la durée finale du mémo prêt.
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

  const applyTemplate = (tpl: CoachAnnotationTemplate) => {
    setBody((prev) => (prev.trim().length > 0 ? `${prev}\n${tpl.body}` : tpl.body));
  };

  const reload = async () => {
    if (!params.pilotId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listMyAnnotationsForCorner(
        params.pilotId,
        cornerIndex,
        params.sessionId ?? undefined
      );
      setAnnotations(rows);
    } finally {
      // Toujours sortir du chargement, même en cas d'échec (pas de hang).
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.pilotId, cornerIndex, params.sessionId]);

  async function onToggleRecord() {
    if (recording) {
      const uri = await stopRecording(recording);
      setRecording(null);
      setRecordedUri(uri);
      return;
    }
    const ok = await requestRecordingPermission();
    if (!ok) return;
    const rec = await startRecording();
    if (rec) {
      setRecordedUri(null);
      setRecording(rec);
    }
  }

  function resetForm() {
    setBody('');
    setVisibility('shared');
    setEditingId(null);
    setRecordedUri(null);
    setRecElapsedMs(0);
    recStartRef.current = null;
  }

  const onSave = async () => {
    if (!params.pilotId || !body.trim()) return;
    setSaving(true);
    if (editingId) {
      await updateAnnotation(editingId, { body, visibility });
      if (recordedUri) await attachAudioToAnnotation(editingId, recordedUri);
    } else {
      const created = await createAnnotation({
        pilotId: params.pilotId,
        cornerIndex,
        telemetrySessionId: params.sessionId ?? null,
        body,
        visibility,
      });
      if (created && recordedUri) await attachAudioToAnnotation(created.id, recordedUri);
    }
    resetForm();
    await reload();
    setSaving(false);
  };

  const onEdit = (a: CoachAnnotation) => {
    setEditingId(a.id);
    setBody(a.body);
    setVisibility(a.visibility);
  };

  const onDelete = async (id: string) => {
    await deleteAnnotation(id);
    if (editingId === id) {
      setEditingId(null);
      setBody('');
    }
    await reload();
  };

  const dirty = editingId != null || body.trim().length > 0 || recordedUri != null;
  const sessionScoped = !!params.sessionId;

  // — Blocs partagés entre les deux formats —
  const cornerBlock = (
    <CornerContext
      cornerIndex={cornerIndex}
      cornerName={cornerName}
      corner={corner}
      sessionScoped={sessionScoped}
      compact={!isConsole}
    />
  );
  const notesBlock = (
    <NotesBlock annotations={annotations} loading={loading} onEdit={onEdit} onDelete={onDelete} />
  );
  const editorBlock = (
    <>
      {templates.length > 0 ? (
        <TemplateChips templates={templates} onApply={applyTemplate} />
      ) : null}
      <Field
        label={editingId ? 'Modifier la note' : 'Votre note écrite'}
        value={body}
        onChangeText={setBody}
        placeholder="Ce que vous avez observé sur ce virage. Sobre, descriptif, ouvert."
        multiline
        numberOfLines={6}
        maxLength={1000}
        showCounter
      />
      <VoiceMemo
        recording={!!recording}
        hasRecording={!!recordedUri}
        elapsedMs={recElapsedMs}
        onToggle={onToggleRecord}
      />
      <ShareToggle
        shared={visibility === 'shared'}
        onToggle={() => setVisibility(visibility === 'shared' ? 'private' : 'shared')}
      />
      <AttributionNote />
    </>
  );
  const footer = (
    <View style={[s.footer, !isConsole && s.footerStack]}>
      <View style={isConsole ? undefined : s.footerStackItem}>
        <Button label="Annuler" variant="ghost" onPress={resetForm} disabled={!dirty} />
      </View>
      <View style={isConsole ? { flex: 1.4 } : s.footerStackItem}>
        <SaveCta
          label={editingId ? 'Mettre à jour la note' : 'Enregistrer la note'}
          saving={saving}
          disabled={saving || !body.trim()}
          onPress={onSave}
        />
      </View>
    </View>
  );

  return (
    <Screen scroll={false}>
      {isConsole ? (
        <View style={s.consoleHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.headEyebrow}>{`ANNOTER · VIRAGE ${cornerIndex}`}</Text>
            <Text style={s.headTitle} accessibilityRole="header" numberOfLines={1}>
              {cornerName}
            </Text>
          </View>
          <VisibilityPill />
        </View>
      ) : (
        <AppBar title="ANNOTER" subtitle={`Virage ${cornerIndex}`} onBack={() => router.back()} />
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
          {isConsole ? (
            <View style={s.cols}>
              <View style={s.colLeft}>
                {cornerBlock}
                {notesBlock}
              </View>
              <View style={s.colRight}>
                {editorBlock}
                {footer}
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.xl }}>
              <View style={{ gap: spacing.md }}>
                <Text style={s.screenHeading} accessibilityRole="header">
                  {cornerName}
                </Text>
                <VisibilityPill />
              </View>
              {cornerBlock}
              {notesBlock}
              <View>{editorBlock}</View>
              {footer}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Colonne / bloc « virage concerné » — identité factuelle du virage (données
 *  réelles de topologie). Remplace le tracé de la maquette, non chargé ici. */
function CornerContext({
  cornerIndex,
  cornerName,
  corner,
  sessionScoped,
  compact,
}: {
  cornerIndex: number;
  cornerName: string;
  corner: CornerTopology | null;
  sessionScoped: boolean;
  compact: boolean;
}) {
  return (
    <View>
      {!compact ? <Text style={s.eyebrow}>VIRAGE CONCERNÉ</Text> : null}
      <CockpitPanel plain>
        <View style={s.cornerRow}>
          <View style={s.cornerMarker}>
            <Text style={s.cornerMarkerTxt}>{`V${cornerIndex}`}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cornerName} numberOfLines={1}>
              {cornerName}
            </Text>
            <Text style={s.cornerPace}>{corner ? paceLabel(corner.pace) : 'Virage'}</Text>
          </View>
        </View>
        <View style={s.cornerMetaRow}>
          <Text style={s.cornerMetaTxt}>
            {sessionScoped ? 'Note attachée à cette séance' : 'Note générique sur ce virage'}
          </Text>
        </View>
      </CockpitPanel>
    </View>
  );
}

/** Vos notes déjà posées sur ce virage (lecture + édition / suppression). */
function NotesBlock({
  annotations,
  loading,
  onEdit,
  onDelete,
}: {
  annotations: CoachAnnotation[];
  loading: boolean;
  onEdit: (a: CoachAnnotation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={s.eyebrow}>VOS NOTES SUR CE VIRAGE</Text>
      {loading ? (
        <Text style={s.muted}>Lecture de vos notes…</Text>
      ) : annotations.length === 0 ? (
        <Text style={s.muted}>Aucune note pour l’instant.</Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {annotations.map((a) => {
            const shared = a.visibility === 'shared';
            return (
              <Card key={a.id} style={shared ? s.noteCardShared : s.noteCardDraft}>
                <View style={s.noteHead}>
                  <Text
                    style={[
                      s.noteFlag,
                      { color: shared ? palette.coachAccent : palette.creamMute },
                    ]}
                  >
                    {shared ? 'PARTAGÉE' : 'BROUILLON'}
                  </Text>
                  <Text style={s.noteDate}>{formatDateShort(a.createdAt)}</Text>
                </View>
                <Text style={s.noteBody}>{a.body}</Text>
                <View style={s.noteActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Modifier cette note"
                    hitSlop={theme.hitSlop}
                    onPress={() => onEdit(a)}
                    style={s.noteAction}
                  >
                    <Text style={s.actionEdit}>Modifier</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer cette note"
                    hitSlop={theme.hitSlop}
                    onPress={() => onDelete(a.id)}
                    style={s.noteAction}
                  >
                    <Text style={s.actionDelete}>Supprimer</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Gabarits réutilisables (§10.3c-C) — appui pour insérer une phrase taguée. */
function TemplateChips({
  templates,
  onApply,
}: {
  templates: CoachAnnotationTemplate[];
  onApply: (t: CoachAnnotationTemplate) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={s.eyebrow}>VOS GABARITS</Text>
      <View style={s.templateRow}>
        {templates.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Insérer le gabarit ${t.label}`}
            hitSlop={theme.hitSlop}
            onPress={() => onApply(t)}
            style={({ pressed }) => [s.templateChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.templateChipTxt}>+ {t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Mémo vocal — bouton micro rouge + glyphe waveform (décoratif) + durée réelle. */
function VoiceMemo({
  recording,
  hasRecording,
  elapsedMs,
  onToggle,
}: {
  recording: boolean;
  hasRecording: boolean;
  elapsedMs: number;
  onToggle: () => void;
}) {
  const active = recording || hasRecording;
  const label = recording
    ? 'Arrêter l’enregistrement'
    : hasRecording
      ? 'Mémo prêt · réenregistrer'
      : 'Appuyez pour enregistrer';
  return (
    <View style={s.voiceCard}>
      <Text style={s.eyebrow}>MÉMO VOCAL</Text>
      <View style={s.voiceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? 'Arrêter l’enregistrement' : 'Enregistrer une note vocale'
          }
          onPress={onToggle}
          style={({ pressed }) => [s.micBtn, pressed && { opacity: 0.85 }]}
        >
          <View style={recording ? s.micStop : s.micDot} />
        </Pressable>
        <View style={s.voiceMid}>
          <Waveform active={active} />
          <Text style={s.voiceLabel}>{label}</Text>
        </View>
        {active ? <Text style={s.voiceDuration}>{fmtDuration(elapsedMs)}</Text> : null}
      </View>
    </View>
  );
}

/** Glyphe waveform décoratif (identité de la carte mémo), masqué de l'a11y —
 *  ce n'est pas une amplitude mesurée. Motif fixe (déterministe). */
function Waveform({ active }: { active: boolean }) {
  const heights = [7, 14, 22, 12, 26, 9, 20, 16, 28, 11, 18, 24, 10, 15];
  const color = active ? palette.coachAccent : palette.cardBorderProminent;
  return (
    <View
      style={s.waveform}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {heights.map((h, i) => (
        <View key={i} style={[s.waveBar, { height: h, backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Partager avec le pilote — ON = vert (état consenti/visible, cf. §7.11). */
function ShareToggle({ shared, onToggle }: { shared: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: shared }}
      accessibilityLabel="Partager cette note avec le pilote"
      onPress={onToggle}
      style={s.shareRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.shareLabel}>Partager avec le pilote</Text>
        <Text style={s.shareHint}>
          {shared ? 'Visible dès l’enregistrement' : 'Brouillon — invisible pour le pilote'}
        </Text>
      </View>
      <View
        style={[s.toggleTrack, shared ? s.toggleTrackOn : s.toggleTrackOff]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <View style={[s.toggleThumb, shared ? s.toggleThumbOn : s.toggleThumbOff]} />
      </View>
    </Pressable>
  );
}

/** Rappel d'attribution (doctrine) — la voix du coach est attribuée, jamais une
 *  consigne de l'app. Liseré rouge coach (jamais l'or, réservé au chrono). */
function AttributionNote() {
  return (
    <View style={s.attrNote} accessibilityRole="summary">
      <View style={s.attrRing} />
      <Text style={s.attrTxt}>
        Une note partagée apparaît à votre nom chez le pilote — jamais comme une consigne de l’app.
      </Text>
    </View>
  );
}

/** Pastille d'en-tête : rappelle la portée de la note (rouge coach). */
function VisibilityPill() {
  return (
    <View
      style={s.pill}
      accessibilityRole="text"
      accessibilityLabel="Visible du pilote si partagée"
    >
      <View style={s.pillRing} />
      <Text style={s.pillTxt}>VISIBLE PILOTE SI PARTAGÉE</Text>
    </View>
  );
}

/** CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le rouge. */
function SaveCta({
  label,
  saving,
  disabled,
  onPress,
}: {
  label: string;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const inert = disabled || saving;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: saving }}
      disabled={inert}
      onPress={inert ? undefined : onPress}
      style={({ pressed }) => [
        s.cta,
        disabled ? s.ctaDisabled : null,
        pressed && !inert ? { opacity: 0.9 } : null,
      ]}
    >
      <View style={s.ctaContent}>
        {saving ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.ctaTxt, disabled ? s.ctaTxtDisabled : null]}>{label}</Text>
      </View>
    </Pressable>
  );
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
  screenHeading: {
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
  colLeft: { flex: 1, maxWidth: 420 },
  colRight: { flex: 1.15, gap: spacing.md },

  // — Eyebrows de section —
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    paddingVertical: spacing.sm,
  },

  // — Virage concerné —
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cornerMarker: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(226,58,78,0.14)',
    borderWidth: 1,
    borderColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerMarkerTxt: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
    color: palette.coachAccent,
  },
  cornerName: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  cornerPace: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: 3,
  },
  cornerMetaRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  cornerMetaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamSoft,
  },

  // — Notes existantes —
  noteCardShared: { borderColor: palette.coachAccent },
  noteCardDraft: { borderColor: palette.line },
  noteHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  noteFlag: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  noteDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  noteBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.5,
  },
  noteActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  noteAction: {
    minHeight: 44,
    justifyContent: 'center',
  },
  actionEdit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamSoft,
  },
  actionDelete: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.coachAlert,
  },

  // — Gabarits —
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  templateChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  templateChipTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.creamSoft,
  },

  // — Mémo vocal —
  voiceCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.cream,
  },
  micStop: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: palette.cream,
  },
  voiceMid: { flex: 1, gap: spacing.xs },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  voiceDuration: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    letterSpacing: 0.5,
  },

  // — Partage (toggle) —
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    marginTop: spacing.md,
  },
  shareLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
    letterSpacing: 0.2,
  },
  shareHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 3,
  },
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: palette.green, alignItems: 'flex-end' },
  toggleTrackOff: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'flex-start',
  },
  toggleThumb: { width: 20, height: 20, borderRadius: 10 },
  toggleThumbOn: { backgroundColor: palette.night },
  toggleThumbOff: { backgroundColor: palette.creamMute },

  // — Note d'attribution (doctrine) —
  attrNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.07)',
  },
  attrRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: palette.coachAccent,
  },
  attrTxt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.coachAccent,
  },

  // — Pastille d'en-tête —
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.coachAccent,
    backgroundColor: palette.card2,
    alignSelf: 'flex-start',
  },
  pillRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: palette.coachAccent,
  },
  pillTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.coachAccent,
  },

  // — Pied (actions) —
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerStack: {
    flexDirection: 'column-reverse',
    alignItems: 'stretch',
  },
  footerStackItem: { alignSelf: 'stretch' },

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
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
  ctaTxtDisabled: { color: '#6A6A73' },
});
