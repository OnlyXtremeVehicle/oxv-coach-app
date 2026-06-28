/**
 * Carnet pilote — notes libres post-session (M3). Zone Progression.
 *
 * Page blanche : l'app ne pré-remplit ni ne suggère JAMAIS le contenu (doctrine
 * V5 P-E). Le pilote écrit ce qu'il veut, ou rien. Aucune question imposée,
 * aucun gabarit, aucune IA, aucun jugement. L'app affiche et conserve.
 *
 * Partage opt-in PAR NOTE : un interrupteur « Partagée avec mon coach », révocable.
 * Si une session est passée en paramètre, la note est RELIÉE à cette séance — le
 * lien est pré-rempli, jamais le texte.
 *
 * Ton OXV : vouvoiement, pas d'emoji, sobre.
 */

import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import {
  type PilotNote,
  addNote,
  deleteNote,
  listMyNotes,
  setNoteShared,
  updateNoteBody,
} from '@/services/pilotNotesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function CarnetScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [notes, setNotes] = useState<PilotNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyNotes().then((rows) => {
      if (!cancelled) {
        setNotes(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  }

  function onCancelEdit() {
    setEditingId(null);
    setDraft('');
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

  return (
    <Screen>
      <AppBar title="CARNET" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE CARNET</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos notes.
        </Text>

        {/* Composer — page blanche. Aucun texte pré-saisi, jamais. */}
        <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
          <SectionLabel>{editingId ? 'Modifier la note' : 'Nouvelle note'}</SectionLabel>
          {sessionId && !editingId ? (
            <Text style={s.linkHint}>Reliée à votre dernière séance.</Text>
          ) : null}
          <Field
            label="Votre note"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={5000}
            showCounter
          />
          <Button
            label={editingId ? 'Mettre à jour' : 'Enregistrer'}
            onPress={onSave}
            loading={saving}
            disabled={!draft.trim()}
          />
          {editingId ? <Button label="Annuler" variant="ghost" onPress={onCancelEdit} /> : null}
        </Card>

        <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
          {!loading && notes.length === 0 ? (
            <EmptyState label="Aucune note" message="Ce carnet est à vous." />
          ) : (
            notes.map((note) => (
              <Card key={note.id} style={{ gap: theme.spacing.sm }}>
                <Text style={s.date}>{fmtDate(note.createdAt)}</Text>
                <Text style={s.body}>{note.body}</Text>

                <View style={s.shareRow}>
                  <Text style={s.shareLabel}>Partagée avec mon coach</Text>
                  <Switch
                    value={note.sharedWithCoach}
                    onValueChange={(v) => onToggleShare(note, v)}
                    accessibilityRole="switch"
                    accessibilityLabel="Partager cette note avec mon coach"
                    accessibilityState={{ checked: note.sharedWithCoach }}
                    trackColor={{ false: '#26262B', true: theme.palette.gold }}
                    thumbColor={theme.palette.cream}
                  />
                </View>

                <View style={s.actions}>
                  <Button label="Modifier" variant="ghost" onPress={() => onEdit(note)} />
                  <Button label="Supprimer" variant="ghost" onPress={() => onDelete(note)} />
                </View>
              </Card>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  linkHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  date: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.body * 1.5,
  },
  shareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.sm,
  },
  shareLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
};
