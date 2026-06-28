/**
 * Support pilote — fil d'une demande + réponse (PR-10).
 *
 * Affiche le ticket (objet, catégorie, statut) et son fil de messages. Le pilote
 * peut répondre. Le statut/priorité sont gérés par l'admin (lecture seule ici).
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, or = donnée (jamais badge/nav).
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportStatus,
  type TicketThread,
  getTicketThread,
  replyToTicket,
} from '@/services/supportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

const STATUS_LABELS: Record<SupportStatus, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

function categoryLabel(c: SupportCategory): string {
  return SUPPORT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getTicketThread(id).then((t) => {
      if (!cancelled) {
        setThread(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(reload);

  async function onReply() {
    if (sending || !id) return;
    setSending(true);
    setError(null);
    const res = await replyToTicket(id, reply);
    setSending(false);
    if (res.ok) {
      setReply('');
      reload();
    } else {
      setError(res.error ?? "L'envoi n'a pas pu aboutir.");
    }
  }

  const closed = thread?.ticket.status === 'ferme';

  return (
    <Screen>
      <AppBar title="DEMANDE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {loading || !thread ? (
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Demande introuvable.'}</Text>
        ) : (
          <>
            <Text style={s.cat}>{categoryLabel(thread.ticket.category)}</Text>
            <Text style={s.subject} accessibilityRole="header">
              {thread.ticket.subject}
            </Text>
            <Text style={s.status}>Statut · {STATUS_LABELS[thread.ticket.status]}</Text>

            <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              {thread.messages.length === 0 ? (
                <Text style={s.muted}>Aucun message pour l'instant.</Text>
              ) : (
                thread.messages.map((m) => (
                  <Card key={m.id} style={m.isAdmin ? s.adminCard : undefined}>
                    <Text style={s.author}>{m.isAdmin ? 'Équipe OXV' : 'Vous'}</Text>
                    <Text style={s.body}>{m.body}</Text>
                    <Text style={s.time}>{formatDate(m.createdAt)}</Text>
                  </Card>
                ))
              )}
            </View>

            {closed ? (
              <Text style={[s.muted, { marginTop: theme.spacing.xl }]}>
                Cette demande est close. Ouvrez-en une nouvelle si besoin.
              </Text>
            ) : (
              <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
                <Field
                  label="Votre réponse"
                  value={reply}
                  onChangeText={setReply}
                  maxLength={4000}
                  multiline
                  placeholder="Ajoutez une précision."
                />
                {error ? (
                  <Text style={s.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
                <Button
                  label="Répondre"
                  onPress={onReply}
                  loading={sending}
                  disabled={!reply.trim()}
                />
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  cat: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  subject: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h3 * 1.25,
    marginTop: theme.spacing.xs,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  adminCard: {
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  author: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.body * 1.5,
  },
  time: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
};
