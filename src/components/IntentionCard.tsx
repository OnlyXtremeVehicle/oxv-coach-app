/**
 * IntentionCard (V9 §17 Narration) — saisie de l'intention de séance.
 *
 * Une question ouverte, puis l'espace du pilote pour y répondre DE SES MOTS.
 * L'app ne pré-remplit ni ne suggère jamais (doctrine) : le champ ne propose
 * aucun gabarit, le placeholder n'oriente pas le contenu. Partage opt-in vers le
 * coach, révocable. Sobre, vouvoiement, pas d'emoji.
 *
 * Charge l'intention « en attente » du pilote pour lui rappeler ce qu'IL a écrit
 * (jamais une proposition), et l'enregistre sur un geste explicite. Le circuit
 * sert seulement de contexte au stockage — le rattachement suit le pilote.
 */

import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import {
  getPendingIntention,
  savePendingIntention,
  type SessionIntention,
} from '@/services/intentionsService';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';

type SaveState = 'idle' | 'saving' | 'saved';

export function IntentionCard({ circuitId }: { circuitId: string | null }) {
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(false);
  const [existing, setExisting] = useState<SessionIntention | null>(null);
  const [save, setSave] = useState<SaveState>('idle');

  useEffect(() => {
    let cancelled = false;
    getPendingIntention().then((it) => {
      if (cancelled || !it) return;
      setExisting(it);
      setBody(it.body);
      setShared(it.sharedWithCoach);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSave = body.trim().length > 0 && save !== 'saving';

  async function onSave() {
    if (!canSave) return;
    setSave('saving');
    const res = await savePendingIntention({ circuitId, body, sharedWithCoach: shared });
    if (res.ok) {
      haptics.confirm();
      if (res.id) setExisting((prev) => (prev ? { ...prev, id: res.id as string } : prev));
      setSave('saved');
    } else {
      setSave('idle');
    }
  }

  return (
    <Card style={{ marginTop: theme.spacing.sm }}>
      <Text style={s.question}>Qu’aimeriez-vous explorer aujourd’hui ?</Text>
      <Text style={s.muted}>Vos mots, à vous. Partagés seulement si vous le décidez.</Text>

      <TextInput
        value={body}
        onChangeText={(t) => {
          setBody(t);
          if (save === 'saved') setSave('idle');
        }}
        multiline
        placeholder="Écrivez ici, si vous le souhaitez."
        placeholderTextColor={theme.palette.faint}
        style={s.input}
        accessibilityLabel="Votre intention de séance"
        maxLength={2000}
      />

      <View style={s.shareRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.shareLabel}>Partager avec mon coach</Text>
          <Text style={s.shareHint}>Lecture seule. Révocable à tout moment.</Text>
        </View>
        <Switch
          value={shared}
          onValueChange={(v) => {
            setShared(v);
            if (save === 'saved') setSave('idle');
          }}
          trackColor={{ false: theme.palette.line, true: theme.palette.edge }}
          thumbColor={theme.palette.cream}
          accessibilityLabel="Partager cette intention avec mon coach"
        />
      </View>

      <Text
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        onPress={onSave}
        style={[s.save, !canSave ? s.saveDisabled : null]}
      >
        {save === 'saved'
          ? 'Intention gardée'
          : existing
            ? 'Mettre à jour'
            : 'Garder cette intention'}
      </Text>
    </Card>
  );
}

const s = {
  question: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.bodyLg * 1.4,
    marginBottom: theme.spacing.sm,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
  input: {
    marginTop: theme.spacing.md,
    minHeight: 88,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
    padding: theme.spacing.md,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    textAlignVertical: 'top' as const,
  },
  shareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  shareLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  shareHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  save: {
    marginTop: theme.spacing.lg,
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
    color: theme.palette.cream,
    textAlign: 'center' as const,
    textAlignVertical: 'center' as const,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    paddingVertical: theme.spacing.md,
  },
  saveDisabled: {
    opacity: 0.5,
  },
};
