/**
 * Admin — Support : fil d'une demande + traitement (PR-11).
 *
 * L'admin lit le fil, change le statut/la priorité, et répond (is_admin=true).
 * Admin-only (RLS). Bronze = rôle admin ; rouge = priorité P0, jamais le pilote.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { replyAsAdmin, setTicketPriority, setTicketStatus } from '@/services/supportAdminService';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
  type TicketThread,
  getTicketThread,
} from '@/services/supportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const BRONZE = '#B87333';

const STATUSES: SupportStatus[] = ['nouveau', 'ouvert', 'en_cours', 'resolu', 'ferme'];
const STATUS_LABELS: Record<SupportStatus, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};
const PRIORITIES: SupportPriority[] = ['p0', 'p1', 'p2', 'p3'];

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

export default function AdminSupportThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
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

  async function onStatus(status: SupportStatus) {
    if (!id || busy) return;
    setBusy(true);
    const res = await setTicketStatus(id, status);
    setBusy(false);
    if (res.ok) reload();
    else setError(res.error ?? 'Changement impossible.');
  }

  async function onPriority(priority: SupportPriority) {
    if (!id || busy) return;
    setBusy(true);
    const res = await setTicketPriority(id, priority);
    setBusy(false);
    if (res.ok) reload();
    else setError(res.error ?? 'Changement impossible.');
  }

  async function onReply() {
    if (sending || !id) return;
    setSending(true);
    setError(null);
    const res = await replyAsAdmin(id, reply);
    setSending(false);
    if (res.ok) {
      setReply('');
      reload();
    } else {
      setError(res.error ?? "L'envoi n'a pas pu aboutir.");
    }
  }

  return (
    <Screen>
      <AppBar title="DEMANDE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {loading || !thread ? (
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Demande introuvable.'}</Text>
        ) : (
          <>
            <Text style={[s.cat, { color: BRONZE }]}>{categoryLabel(thread.ticket.category)}</Text>
            <Text style={s.subject} accessibilityRole="header">
              {thread.ticket.subject}
            </Text>

            {/* Statut */}
            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <SectionLabel>Statut</SectionLabel>
              <View style={s.pills}>
                {STATUSES.map((st) => {
                  const on = thread.ticket.status === st;
                  return (
                    <Pressable
                      key={st}
                      onPress={() => onStatus(st)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: busy }}
                      accessibilityLabel={STATUS_LABELS[st]}
                      hitSlop={6}
                      style={[s.pill, on ? s.pillOn : null]}
                    >
                      <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{STATUS_LABELS[st]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Priorité */}
            <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
              <SectionLabel>Priorité</SectionLabel>
              <View style={s.pills}>
                {PRIORITIES.map((p) => {
                  const on = thread.ticket.priority === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => onPriority(p)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: busy }}
                      accessibilityLabel={p.toUpperCase()}
                      hitSlop={6}
                      style={[s.pill, on ? s.pillOn : null]}
                    >
                      <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{p.toUpperCase()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Fil */}
            <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              {thread.messages.map((m) => (
                <Card key={m.id} style={m.isAdmin ? s.adminCard : undefined}>
                  <Text style={s.author}>{m.isAdmin ? 'Équipe OXV' : 'Pilote'}</Text>
                  <Text style={s.body}>{m.body}</Text>
                  <Text style={s.time}>{formatDate(m.createdAt)}</Text>
                </Card>
              ))}
            </View>

            <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
              <Field
                label="Votre réponse"
                value={reply}
                onChangeText={setReply}
                maxLength={4000}
                multiline
                placeholder="Réponse au pilote."
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
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  subject: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h3 * 1.25,
    marginTop: theme.spacing.xs,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 38,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: {
    borderColor: BRONZE,
    backgroundColor: 'rgba(184,115,51,0.12)',
  },
  pillTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTxtOn: {
    color: theme.palette.cream,
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
