/**
 * Carnet — espace perso du pilote, onglet racine. Reskin FIDÈLE à la maquette
 * refonte-v2 §7.9 (screens/09-carnet.png), règle fondateur : le graphique v2
 * fait loi, l'héritage utile est retravaillé, jamais collé.
 *
 * Maquette : header « Carnet » (racine, pas de retour) + bouton rond « + »
 * (nouvelle note) · eyebrow « CONDITIONS DU JOUR » + chips météo RÉELLES
 * (snapshot capté sur la séance du jour — section MASQUÉE sinon, jamais de
 * météo inventée) · eyebrow « CE QUE VOUS AVEZ RESSENTI » + zone de note libre
 * (= le composer CRUD existant restylé, trait de saisie vert discret) + notes
 * enregistrées dessous (partage coach opt-in par note, révocable) · eyebrow
 * « VOS REPÈRES » = les intentions réelles du pilote (session_intentions) en
 * checklist de lecture + « Ajouter un repère » vers l'écran Prochaine fois
 * (qui porte la saisie réelle d'intention).
 *
 * Zone volontairement SANS donnée de perf ni couleur QDI (doctrine Carnet).
 * Page blanche : l'app ne pré-remplit ni ne suggère JAMAIS le contenu (V5 P-E).
 * Ton OXV : vouvoiement, pas d'emoji, sobre.
 */

import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ConsentSwitchRow } from '@/components/ConsentSwitchRow';
import { EmptyState } from '@/components/instruments';
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
import { type WeatherData, fetchSessionWeather, trackConditions } from '@/services/weatherService';
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

/**
 * Repère = une intention réelle du pilote. `carried` : l'intention a été
 * rattachée à une séance terminée (elle a été portée en piste) → case cochée.
 * Une intention encore en attente (avant la prochaine séance) → case vide.
 */
interface RepereItem {
  intention: SessionIntention;
  carried: boolean;
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

  // Chips météo : uniquement des valeurs captées (weather_snapshots) + la
  // lecture piste dérivée par le service partagé trackConditions.
  const conditionChips = todayWeather
    ? [
        `${Math.round(todayWeather.temperatureC)} °C`,
        trackConditions(todayWeather).label,
        `Vent ${Math.round(todayWeather.windSpeedKmh)} km/h`,
      ]
    : [];

  return (
    <Screen>
      {/* Racine de zone : pas de retour. Bouton rond « + » = nouvelle note. */}
      <AppBar
        title="Carnet"
        trailing={
          <Pressable
            onPress={onNewNote}
            accessibilityRole="button"
            accessibilityLabel="Nouvelle note"
            hitSlop={8}
            style={({ pressed }) => [s.plusBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.plusGlyph}>+</Text>
          </Pressable>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* ── CONDITIONS DU JOUR — masquée sans météo réelle captée aujourd'hui. */}
        {conditionChips.length > 0 ? (
          <View style={s.section}>
            <Text style={s.eyebrow}>CONDITIONS DU JOUR</Text>
            <View style={s.chipsRow}>
              {conditionChips.map((chip) => (
                <View key={chip} style={s.chip}>
                  <Text style={s.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── CE QUE VOUS AVEZ RESSENTI — la zone de note libre (maquette),
            c'est-à-dire le composer CRUD existant restylé. Aucun gabarit,
            aucune pré-saisie ; le trait de saisie vert est le seul accent. */}
        <View style={s.section}>
          <Text style={s.eyebrow}>CE QUE VOUS AVEZ RESSENTI</Text>
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
          {sessionId && !editingId ? (
            <Text style={s.linkHint}>Reliée à votre dernière séance.</Text>
          ) : null}
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button
              label={editingId ? 'Mettre à jour' : 'Enregistrer'}
              onPress={onSave}
              loading={saving}
              disabled={!draft.trim()}
            />
            {editingId ? (
              <Button label="Annuler la modification" variant="ghost" onPress={onCancelEdit} />
            ) : null}
          </View>

          {/* Notes enregistrées — l'héritage gardé, restylé v2. */}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {!loading && notes.length === 0 ? (
              <EmptyState label="Aucune note" message="Ce carnet est à vous." />
            ) : (
              notes.map((note) => (
                <Card key={note.id} style={{ gap: spacing.sm }}>
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
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Modifier cette note"
                      onPress={() => onEdit(note)}
                      style={({ pressed }) => [s.noteAction, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={s.noteActionTxt}>Modifier</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Supprimer cette note"
                      onPress={() => onDelete(note)}
                      style={({ pressed }) => [s.noteAction, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={s.noteActionTxt}>Supprimer</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>
        </View>

        {/* ── VOS REPÈRES — les intentions réelles du pilote, en lecture.
            Case cochée = intention portée en séance ; case vide = posée pour la
            prochaine fois. « Ajouter un repère » ouvre l'écran Prochaine fois,
            qui porte désormais la saisie réelle d'intention (maquette #7a). */}
        <View style={s.section}>
          <Text style={s.eyebrow}>VOS REPÈRES</Text>
          {reperes.length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              {reperes.map(({ intention, carried }) => (
                <View
                  key={intention.id}
                  style={s.repereRow}
                  accessible
                  accessibilityLabel={`Repère : ${intention.body}. ${
                    carried ? 'Porté en séance.' : 'Posé pour la prochaine fois.'
                  }`}
                >
                  <View style={[s.checkBox, carried && s.checkBoxOn]}>
                    {carried ? <View style={s.checkGlyph} /> : null}
                  </View>
                  <Text style={[s.repereText, !carried && s.repereTextPending]}>
                    {intention.body}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter un repère"
            onPress={() => router.push('/(app)/prochaine-fois' as never)}
            style={({ pressed }) => [s.addRepere, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.addRepereTxt}>+ Ajouter un repère</Text>
          </Pressable>
        </View>
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
  section: { marginTop: spacing.xl },

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

  // Chips météo — fines, surface sombre, sans couleur de donnée (zone Carnet).
  chipsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
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

  // Zone de note libre — panneau sombre arrondi (maquette : fond card, le
  // trait de saisie vert vient de selectionColor/cursorColor).
  noteInput: {
    marginTop: spacing.md,
    minHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
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
  repereText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.45,
  },
  repereTextPending: {
    color: palette.creamMute,
  },
  addRepere: {
    minHeight: 44,
    justifyContent: 'center' as const,
    marginTop: spacing.sm,
    alignSelf: 'flex-start' as const,
  },
  addRepereTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
};
