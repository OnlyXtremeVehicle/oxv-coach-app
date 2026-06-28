/**
 * Support pilote — liste de mes demandes + création (PR-10).
 *
 * Le pilote signale un problème (équipement, bilan, données, question coach) ou
 * dépose une demande RGPD, sans quitter l'app. Suit le statut, ouvre le fil.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, or = donnée (jamais la nav ni les
 * badges de statut). Aucune promesse de délai automatique.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
  createTicket,
  listMyTickets,
} from '@/services/supportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

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

export default function SupportIndexScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<SupportCategory>('equipement');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyTickets().then((rows) => {
      if (!cancelled) {
        setTickets(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function onSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    const res = await createTicket({ category, subject, message: message || undefined });
    setSending(false);
    if (res.ok) {
      setComposing(false);
      setSubject('');
      setMessage('');
      setCategory('equipement');
      reload();
    } else {
      setError(res.error ?? "L'envoi n'a pas pu aboutir.");
    }
  }

  return (
    <Screen>
      <AppBar title="SUPPORT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>AIDE & SUPPORT</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos demandes.
        </Text>
        <Text style={s.intro}>
          Un souci d'équipement, de bilan, de données, une question pour votre coach ou une demande
          sur vos données : écrivez-nous. Nous revenons vers vous.
        </Text>

        {!composing ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Nouvelle demande" onPress={() => setComposing(true)} />
          </View>
        ) : (
          <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <SectionLabel>Catégorie</SectionLabel>
            <View style={s.pills}>
              {SUPPORT_CATEGORIES.map((c) => {
                const on = c.value === category;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={c.label}
                    hitSlop={6}
                    style={[s.pill, on ? s.pillOn : null]}
                  >
                    <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Objet"
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
              placeholder="En quelques mots"
            />
            <Field
              label="Votre message"
              optional
              value={message}
              onChangeText={setMessage}
              maxLength={4000}
              multiline
              placeholder="Décrivez la situation."
            />

            {error ? (
              <Text style={s.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Button label="Envoyer" onPress={onSend} loading={sending} disabled={!subject.trim()} />
            <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
          </Card>
        )}

        <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
          {!loading && tickets.length === 0 ? (
            <EmptyState
              label="Aucune demande"
              message="Vous n'avez pas encore de demande en cours."
              source="support_tickets"
            />
          ) : (
            tickets.map((t) => (
              <Card
                key={t.id}
                onPress={() => router.push(`/(app)/support/${t.id}` as never)}
                accessibilityLabel={`${t.subject}, ${STATUS_LABELS[t.status]}`}
              >
                <View style={s.ticketTop}>
                  <Text style={s.ticketCat}>{categoryLabel(t.category)}</Text>
                  <Text style={s.ticketStatus}>{STATUS_LABELS[t.status]}</Text>
                </View>
                <Text style={s.ticketSubject}>{t.subject}</Text>
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
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: {
    borderColor: theme.palette.cream,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTxtOn: {
    color: theme.palette.cream,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
  ticketTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  ticketCat: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  ticketStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  ticketSubject: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
};
