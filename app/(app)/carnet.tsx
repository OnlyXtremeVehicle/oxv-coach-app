/**
 * Carnet — espace perso du pilote, onglet racine. Base : reskin fidèle
 * refonte-v2 §7.9 (screens/09-carnet.png). DÉVELOPPÉ build 23 phase 2
 * (chantier carnet-developpe) : la page se comprend d'elle-même.
 *
 * Ouverture : une phrase qui dit la raison d'être du Carnet + trois repères
 * visuels (ressenti · conditions · intentions) avec insignes SVG — de simples
 * pictos de présentation, jamais de fausse donnée.
 *
 * Sections parlantes, chacune : eyebrow + sous-titre d'usage.
 *  - CONDITIONS DU JOUR : snapshot météo RÉEL capté aujourd'hui sur la séance
 *    (weather_snapshots) en chips iconées + heure réelle du relevé. Section
 *    MASQUÉE sinon — jamais de météo inventée ni périmée sous « du jour ».
 *  - CE QUE VOUS AVEZ RESSENTI : le composer CRUD existant mis en scène
 *    (panneau, en-tête plume, invite chaleureuse quand le carnet est blanc).
 *    Aucun gabarit, aucune pré-saisie : l'app ne suggère JAMAIS le contenu.
 *  - VOS DERNIÈRES NOTES : les entrées réelles (pilotNotesService) en fil
 *    chronologique animé (Stagger + rail), compteur réel de notes, chaque note
 *    datée, partage coach opt-in par note, révocable. Vide = invitation.
 *  - VOS REPÈRES : intentions réelles (session_intentions) en checklist de
 *    lecture datée + lien réel vers l'écran Prochaine fois (saisie d'intention).
 *
 * Zone volontairement SANS donnée de perf ni couleur QDI (doctrine Carnet) ;
 * le vert discret (caret, coche) est l'accent canon de la maquette carnet.
 * Ton OXV : vouvoiement, pas d'emoji, descriptif jamais prescriptif.
 *
 * Motion (kit src/components/motion, courbes et durées du kit) : hero et
 * sections en fondu décalé, insignes et notes en cascade (Stagger), compteur
 * de notes en CountUpNumber, éléments conditionnels en AnimatedPresence,
 * actions en PressableScale. Reduce-motion respecté par le kit.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { ConsentSwitchRow } from '@/components/ConsentSwitchRow';
import {
  AnimatedPresence,
  CountUpNumber,
  FadeInSection,
  PressableScale,
  Stagger,
} from '@/components/motion';
import {
  type SessionIntention,
  getIntentionForSession,
  getPendingIntention,
} from '@/services/intentionsService';
import {
  type PilotNote,
  addNote,
  deleteNote,
  listMyNotes,
  setNoteShared,
  updateNoteBody,
} from '@/services/pilotNotesService';
import { fetchAllSessions } from '@/services/sessionsService';
import {
  type WeatherData,
  fetchSessionWeather,
  trackConditions,
  windDirectionCardinal,
} from '@/services/weatherService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** « 12 juillet » — date courte pour les méta de repère. */
function fmtDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** « 14:32 » — heure réelle du relevé météo. */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** La date ISO tombe-t-elle sur le jour calendaire local courant ? */
function isSameLocalDay(iso: string, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Format stable du compteur de notes (module scope : ne relance pas l'anim). */
const notesCountFormat = (n: number): string => `×${Math.round(n)}`;

/* ------------------------------------------------------------------ */
/* Insignes SVG — pictos de présentation (décor, cachés aux lecteurs   */
/* d'écran). Trait fin creamMute, langage ligne du reste de l'app.     */
/* ------------------------------------------------------------------ */

const ICON_STROKE = 1.4;

/** Plume — le ressenti, les mots du pilote. */
function PenIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M3.2 12.8 L4.1 9.7 L10.4 3.4 A1.35 1.35 0 0 1 12.3 5.3 L6 11.6 L3.2 12.8 Z"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M9.4 4.4 L11.3 6.3" stroke={color} strokeWidth={ICON_STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/** Nuage — le ciel du jour. */
function CloudIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M4.6 11.2 H11 A2.3 2.3 0 0 0 11.3 6.6 A3.3 3.3 0 0 0 4.9 6.9 A2.3 2.3 0 0 0 4.6 11.2 Z"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Case cochée — les intentions, les repères. */
function CheckSquareIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Rect
        x={2.7}
        y={2.7}
        width={10.6}
        height={10.6}
        rx={2.6}
        stroke={color}
        strokeWidth={ICON_STROKE}
        fill="none"
      />
      <Path
        d="M5.4 8.3 L7.2 10.1 L10.6 6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Thermomètre — température captée. */
function ThermoIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M6.9 8.8 V3.7 A1.3 1.3 0 0 1 9.5 3.7 V8.8 A2.7 2.7 0 1 1 6.9 8.8 Z"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={8.2} cy={10.8} r={1.1} fill={color} />
    </Svg>
  );
}

/** Route à médiane pointillée — l'état de la piste. */
function TrackIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M4.2 13 C6 9.6 6.2 6.6 5.2 3"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M11.8 13 C10 9.6 9.8 6.6 10.8 3"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Line x1={8} y1={4.4} x2={8} y2={6} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Line x1={8} y1={8} x2={8} y2={9.6} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Line
        x1={8}
        y1={11.6}
        x2={8}
        y2={13}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Filets de vent. */
function WindIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M2.6 6.2 H9.2 A1.7 1.7 0 1 0 7.5 4.5"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M2.6 9.4 H11 A1.7 1.7 0 1 1 9.3 11.1"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Goutte — humidité. */
function DropletIcon({ color = palette.creamMute }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden>
      <Path
        d="M8 2.8 C6.2 5.5 5 7.3 5 8.9 A3 3 0 0 0 11 8.9 C11 7.3 9.8 5.5 8 2.8 Z"
        stroke={color}
        strokeWidth={ICON_STROKE}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */

/**
 * Repère = une intention réelle du pilote. `carried` : l'intention a été
 * rattachée à une séance terminée (elle a été portée en piste) → case cochée.
 * Une intention encore en attente (avant la prochaine séance) → case vide.
 */
interface RepereItem {
  intention: SessionIntention;
  carried: boolean;
}

interface ConditionChip {
  key: string;
  label: string;
  icon: ReactNode;
}

export default function CarnetScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const profile = useAuthStore((s) => s.profile);

  const [notes, setNotes] = useState<PilotNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Conditions du jour : snapshot météo RÉEL capté aujourd'hui, sinon null
  // (section masquée — jamais une météo inventée ni périmée sous « du jour »).
  const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
  const [reperes, setReperes] = useState<RepereItem[]>([]);

  const inputRef = useRef<TextInput>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyNotes().then((rows) => {
      if (!cancelled) {
        setNotes(rows);
        setLoading(false);
      }
    });

    // Contexte de lecture : la séance passée en paramètre, sinon la dernière
    // séance complétée du pilote. Sert à la météo captée et au repère rattaché.
    (async () => {
      let sid: string | null = sessionId ?? null;
      if (!sid && profile) {
        const latest = await fetchAllSessions(profile.id, { limit: 1 });
        sid = latest[0]?.id ?? null;
      }
      if (cancelled) return;

      if (sid) {
        // Même source que l'écran Conditions : weather_snapshots de la séance.
        const snaps = await fetchSessionWeather(sid);
        const w = snaps.length > 0 ? snaps[0] : null;
        if (!cancelled) {
          setTodayWeather(w && isSameLocalDay(w.capturedAt, new Date()) ? w : null);
        }
      } else if (!cancelled) {
        setTodayWeather(null);
      }

      // Repères : intentions réelles (own-row RLS). Le service n'expose que
      // l'intention en attente et celle rattachée à une séance — on rend ces
      // deux-là, rien d'inventé.
      const [pending, linked] = await Promise.all([
        getPendingIntention(),
        sid ? getIntentionForSession(sid) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        const items: RepereItem[] = [];
        if (linked) items.push({ intention: linked, carried: true });
        if (pending && pending.id !== linked?.id)
          items.push({ intention: pending, carried: false });
        setReperes(items);
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sessionId, profile]);

  useFocusEffect(reload);

  async function onSave() {
    if (saving || !draft.trim()) return;
    setSaving(true);
    const res = editingId
      ? await updateNoteBody(editingId, draft)
      : await addNote(draft, sessionId ?? null);
    setSaving(false);
    if (res.ok) {
      setDraft('');
      setEditingId(null);
      reload();
    }
  }

  function onEdit(note: PilotNote) {
    setEditingId(note.id);
    setDraft(note.body);
    inputRef.current?.focus();
  }

  function onCancelEdit() {
    setEditingId(null);
    setDraft('');
  }

  /** Bouton rond « + » du header : repartir sur une note neuve, prête à écrire. */
  function onNewNote() {
    if (editingId) {
      // On quitte la modification (la note d'origine reste intacte dans la liste).
      setEditingId(null);
      setDraft('');
    }
    inputRef.current?.focus();
  }

  async function onToggleShare(note: PilotNote, next: boolean) {
    // Optimiste : reflète tout de suite l'état, recharge en cas d'échec.
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, sharedWithCoach: next } : n)));
    const res = await setNoteShared(note.id, next);
    if (!res.ok) reload();
  }

  function onDelete(note: PilotNote) {
    Alert.alert('Supprimer cette note', 'Cette note sera définitivement effacée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteNote(note.id);
          if (res.ok) {
            if (editingId === note.id) onCancelEdit();
            reload();
          }
        },
      },
    ]);
  }

  // Chips météo iconées : uniquement des valeurs captées (weather_snapshots)
  // + la lecture piste dérivée par le service partagé trackConditions. A-WEATHER-1 :
  // une mesure ABSENTE (null) n'invente PAS de chip — pas de « 0 °C » fabriqué.
  const conditionChips: ConditionChip[] = [];
  if (todayWeather) {
    // Ciel INCONNU : pas de chip. Le libellé est nullable depuis qu'un code
    // météo absent ne se convertit plus en « Ciel dégagé ».
    const sky = todayWeather.weatherLabel?.trim() ?? '';
    if (sky) conditionChips.push({ key: 'ciel', label: sky, icon: <CloudIcon /> });
    if (todayWeather.temperatureC != null) {
      conditionChips.push({
        key: 'temp',
        label: `${Math.round(todayWeather.temperatureC)} °C`,
        icon: <ThermoIcon />,
      });
    }
    conditionChips.push({
      key: 'piste',
      label: trackConditions(todayWeather).label,
      icon: <TrackIcon />,
    });
    if (todayWeather.windSpeedKmh != null) {
      const cardinal =
        todayWeather.windSpeedKmh > 0 && todayWeather.windDirectionDeg != null
          ? ` ${windDirectionCardinal(todayWeather.windDirectionDeg)}`
          : '';
      conditionChips.push({
        key: 'vent',
        label: `Vent ${Math.round(todayWeather.windSpeedKmh)} km/h${cardinal}`,
        icon: <WindIcon />,
      });
    }
    if (todayWeather.humidityPct != null) {
      conditionChips.push({
        key: 'humidite',
        label: `Humidité ${Math.round(todayWeather.humidityPct)} %`,
        icon: <DropletIcon />,
      });
    }
  }

  const carnetBlanc = !loading && notes.length === 0;

  return (
    <Screen>
      {/* Racine de zone : pas de retour. Bouton rond « + » = nouvelle note. */}
      <AppBar
        title="Carnet"
        trailing={
          <PressableScale
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Nouvelle note"
            hitSlop={8}
            haptic="tap"
            style={s.plusBtn}
          >
            <Text style={s.plusGlyph}>+</Text>
          </PressableScale>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* ── OUVERTURE — la raison d'être du Carnet en une phrase, puis trois
            repères visuels de ce qu'on y fait (insignes en cascade). ───────── */}
        <FadeInSection style={s.hero}>
          <Text style={s.heroLead}>
            Votre mémoire de pilote : ce que vous ressentez, ce que vous voulez garder.
          </Text>
          <Stagger
            interval={70}
            initialDelay={140}
            style={s.heroBadges}
            itemStyle={s.heroBadgeItem}
          >
            <View style={s.badge}>
              <View style={s.badgeIcon}>
                <PenIcon color={palette.creamSoft} />
              </View>
              <Text style={s.badgeLabel}>Ressenti</Text>
              <Text style={s.badgeCaption}>Vos mots</Text>
            </View>
            <View style={s.badge}>
              <View style={s.badgeIcon}>
                <CloudIcon color={palette.creamSoft} />
              </View>
              <Text style={s.badgeLabel}>Conditions</Text>
              <Text style={s.badgeCaption}>La piste du jour</Text>
            </View>
            <View style={s.badge}>
              <View style={s.badgeIcon}>
                <CheckSquareIcon color={palette.creamSoft} />
              </View>
              <Text style={s.badgeLabel}>Intentions</Text>
              <Text style={s.badgeCaption}>Vos repères</Text>
            </View>
          </Stagger>
        </FadeInSection>

        {/* ── CONDITIONS DU JOUR — masquée sans météo réelle captée aujourd'hui.
            La section monte en fondu quand le snapshot arrive (AnimatedPresence). */}
        <AnimatedPresence visible={conditionChips.length > 0}>
          <View style={s.section}>
            <Text style={s.eyebrow}>CONDITIONS DU JOUR</Text>
            {todayWeather ? (
              <Text style={s.sub}>
                Relevées en bord de piste à {fmtTime(todayWeather.capturedAt)}, sur votre séance du
                jour.
              </Text>
            ) : null}
            <View style={s.chipsRow}>
              {conditionChips.map((chip) => (
                <View key={chip.key} style={s.chip}>
                  <View accessibilityElementsHidden>{chip.icon}</View>
                  <Text style={s.chipText}>{chip.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedPresence>

        {/* ── CE QUE VOUS AVEZ RESSENTI — la zone de note libre (maquette),
            c'est-à-dire le composer CRUD existant mis en scène. Aucun gabarit,
            aucune pré-saisie ; le trait de saisie vert est le seul accent. */}
        <FadeInSection delay={80} style={s.section}>
          <Text style={s.eyebrow}>CE QUE VOUS AVEZ RESSENTI</Text>
          <Text style={s.sub}>
            À chaud ou plus tard, vos mots restent les vôtres. Le partage avec votre coach se décide
            note par note, et se retire de même.
          </Text>

          <Card style={s.composer}>
            <View style={s.composerHead}>
              <View style={s.composerIcon} accessibilityElementsHidden>
                <PenIcon />
              </View>
              <Text style={s.composerMode}>{editingId ? 'MODIFICATION' : 'NOUVELLE NOTE'}</Text>
            </View>

            {/* Invite chaleureuse quand le carnet est encore blanc. */}
            <AnimatedPresence visible={carnetBlanc && !editingId && draft.trim().length === 0}>
              <Text style={s.composerInvite}>
                Votre première note peut tenir en une phrase. Elle n'appartient qu'à vous.
              </Text>
            </AnimatedPresence>

            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={5000}
              placeholder="Écrivez ici, si vous le souhaitez."
              placeholderTextColor={palette.faint}
              selectionColor={palette.green}
              cursorColor={palette.green}
              accessibilityLabel="Votre note"
              style={s.noteInput}
            />
            {/* Mention conditionnelle : fondu d'entrée/sortie plutôt qu'un saut. */}
            <AnimatedPresence visible={Boolean(sessionId) && !editingId}>
              <Text style={s.linkHint}>Reliée à votre dernière séance.</Text>
            </AnimatedPresence>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                label={editingId ? 'Mettre à jour' : 'Enregistrer'}
                onPress={onSave}
                loading={saving}
                disabled={!draft.trim()}
              />
              {/* Le bouton d'annulation entre et sort en fondu avec le mode édition. */}
              <AnimatedPresence visible={editingId != null}>
                <Button label="Annuler la modification" variant="ghost" onPress={onCancelEdit} />
              </AnimatedPresence>
            </View>
          </Card>
        </FadeInSection>

        {/* ── VOS DERNIÈRES NOTES — le fil réel du carnet (pilot_notes), du plus
            récent au plus ancien, en cascade le long d'un rail. Compteur réel.
            Vide = invitation, jamais un blanc muet. */}
        <FadeInSection delay={160} style={s.section}>
          <View style={s.sectionHeadRow}>
            <Text style={s.eyebrow}>VOS DERNIÈRES NOTES</Text>
            {notes.length > 0 ? (
              <CountUpNumber
                value={notes.length}
                duration={700}
                format={notesCountFormat}
                style={s.countBadge}
              />
            ) : null}
          </View>

          {carnetBlanc ? (
            <View style={s.invite}>
              <Text style={s.inviteLabel}>PREMIÈRE PAGE</Text>
              <Text style={s.inviteText}>
                Encore aucune note dans le fil. La première s'écrit ci-dessus, quand vous le
                souhaitez — personne ne la lira sans votre accord.
              </Text>
            </View>
          ) : (
            <Stagger interval={70} style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {notes.map((note, index) => (
                <View key={note.id} style={s.threadRow}>
                  <View style={s.threadRail} accessibilityElementsHidden>
                    <View style={s.threadDot} />
                    {index < notes.length - 1 ? <View style={s.threadLine} /> : null}
                  </View>
                  <Card style={s.threadCard}>
                    <Text style={s.noteDate}>{fmtDate(note.createdAt)}</Text>
                    <Text style={s.noteBody}>{note.body}</Text>

                    <ConsentSwitchRow
                      label="Partagée avec mon coach"
                      value={note.sharedWithCoach}
                      onValueChange={(v) => onToggleShare(note, v)}
                      accessibilityLabel="Partager cette note avec mon coach"
                      style={s.shareRow}
                    />

                    <View style={s.noteActions}>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Modifier cette note"
                        haptic="tap"
                        onPress={() => onEdit(note)}
                        style={s.noteAction}
                      >
                        <Text style={s.noteActionTxt}>Modifier</Text>
                      </PressableScale>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel="Supprimer cette note"
                        haptic="tap"
                        onPress={() => onDelete(note)}
                        style={s.noteAction}
                      >
                        <Text style={s.noteActionTxt}>Supprimer</Text>
                      </PressableScale>
                    </View>
                  </Card>
                </View>
              ))}
            </Stagger>
          )}
        </FadeInSection>

        {/* ── VOS REPÈRES — les intentions réelles du pilote, en lecture datée.
            Case cochée = intention portée en séance ; case vide = posée pour la
            prochaine fois. Le lien réel ouvre l'écran Prochaine fois, qui porte
            la saisie d'intention (maquette #7a). */}
        <FadeInSection delay={240} style={s.section}>
          <Text style={s.eyebrow}>VOS REPÈRES</Text>
          <Text style={s.sub}>
            Posés avant la séance, relus après. Une coche signale un repère porté en piste.
          </Text>
          {reperes.length > 0 ? (
            <Stagger style={{ marginTop: spacing.md, gap: spacing.md }}>
              {reperes.map(({ intention, carried }) => (
                <View
                  key={intention.id}
                  style={s.repereRow}
                  accessible
                  accessibilityLabel={`Repère : ${intention.body}. ${
                    carried ? 'Porté en séance.' : 'Posé pour la prochaine fois.'
                  } Posé le ${fmtDayMonth(intention.createdAt)}.`}
                >
                  <View style={[s.checkBox, carried && s.checkBoxOn]}>
                    {carried ? <View style={s.checkGlyph} /> : null}
                  </View>
                  <View style={s.repereBody}>
                    <Text style={[s.repereText, !carried && s.repereTextPending]}>
                      {intention.body}
                    </Text>
                    <Text style={s.repereMeta}>
                      {carried ? 'Porté en séance' : 'Pour la prochaine fois'} · posé le{' '}
                      {fmtDayMonth(intention.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </Stagger>
          ) : (
            <Text style={s.repereEmpty}>Aucun repère posé pour l'instant.</Text>
          )}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Poser un repère pour la prochaine fois"
            haptic="tap"
            onPress={() => router.push('/(app)/prochaine-fois' as never)}
            style={s.addRepere}
          >
            <Text style={s.addRepereGlyph}>+</Text>
            <Text style={s.addRepereTxt}>Poser un repère pour la prochaine fois</Text>
          </PressableScale>
        </FadeInSection>
      </View>
    </Screen>
  );
}

const s = {
  // Eyebrow de section — mono uppercase, gris faint (maquette §7.9).
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  // Sous-titre d'usage sous l'eyebrow — chaque section dit à quoi elle sert.
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  section: { marginTop: spacing.xl },
  sectionHeadRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },

  // Bouton rond « + » du header (pastille surface-2, comme le retour AppBar).
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  plusGlyph: {
    fontFamily: fonts.body,
    fontSize: 20,
    lineHeight: 22,
    color: palette.creamSoft,
  },

  // Ouverture — phrase de raison d'être + trois insignes d'usage.
  hero: { marginTop: spacing.sm },
  heroLead: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    lineHeight: fontSize.h3 * 1.45,
    color: palette.creamSoft,
  },
  heroBadges: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroBadgeItem: { flex: 1 },
  badge: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  badgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 2,
  },
  badgeLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamSoft,
  },
  badgeCaption: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: palette.creamMute,
    textAlign: 'center' as const,
  },

  // Chips météo — fines, iconées, surface sombre, sans couleur de donnée.
  chipsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },

  // Composer mis en scène — panneau carte, en-tête plume, saisie intérieure.
  composer: {
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  composerHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  composerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  composerMode: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  composerInvite: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  noteInput: {
    marginTop: spacing.md,
    minHeight: 132,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.separator,
    backgroundColor: palette.surface3,
    padding: spacing.lg,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    color: palette.cream,
    textAlignVertical: 'top' as const,
  },
  linkHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },

  // Compteur réel de notes (fil) — mono discret.
  countBadge: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },

  // Fil chronologique — rail à points le long des notes.
  threadRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  threadRail: {
    width: 14,
    alignItems: 'center' as const,
    paddingTop: spacing.lg,
  },
  threadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: palette.green,
    backgroundColor: palette.card,
  },
  threadLine: {
    flex: 1,
    width: 1,
    backgroundColor: palette.separator,
    marginTop: spacing.xs,
  },
  threadCard: {
    flex: 1,
    gap: spacing.sm,
  },

  // Invitation quand le carnet est blanc — jamais un vide muet.
  invite: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  inviteLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  inviteText: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.55,
    color: palette.creamMute,
  },

  // Notes enregistrées.
  noteDate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  noteBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.5,
  },
  shareRow: {
    borderTopWidth: 1,
    borderTopColor: palette.separator,
    paddingTop: spacing.sm,
  },
  noteActions: {
    flexDirection: 'row' as const,
    gap: spacing.xl,
  },
  noteAction: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  noteActionTxt: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },

  // Checklist des repères — lecture seule (cochage = fait réel : rattachement).
  repereRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.4,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
  },
  checkBoxOn: {
    borderColor: palette.green,
  },
  checkGlyph: {
    width: 9,
    height: 5,
    borderLeftWidth: 1.6,
    borderBottomWidth: 1.6,
    borderColor: palette.green,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  repereBody: { flex: 1, gap: 2 },
  repereText: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.45,
  },
  repereTextPending: {
    color: palette.creamMute,
  },
  repereMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: palette.eyebrow,
  },
  repereEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  addRepere: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    alignSelf: 'flex-start' as const,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  addRepereGlyph: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 19,
    color: palette.creamSoft,
  },
  addRepereTxt: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
};
