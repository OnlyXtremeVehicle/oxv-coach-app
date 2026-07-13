/**
 * Écran Débrief présentiel — reskin fidèle à la maquette refonte-v2 §7bis
 * (`#7d`, screens/28-debrief-presentiel.png).
 *
 * Fil de NOTES PARTAGÉES coach↔pilote, à montrer en séance : bulles ATTRIBUÉES
 * (coach = liseré + pastille rouge coach, vous = gris), ajout de note réel.
 * DISTINCT du Debrief J+1 (`debrief.tsx`, récit littéraire async).
 *
 * Données réelles uniquement :
 *   - fil        : table `coach_messages` via coachMessagesService (RLS : les
 *     deux membres du binôme actif + consenti), temps réel via useCoachThread ;
 *   - binôme     : `coach_pilots` via listMyThreads (nom réel du coach) ;
 *   - écriture   : sendMessage (sender_id = auth.uid()) — le canal pilote
 *     existe, l'ajout de note est donc RÉEL, avec `session_id` attaché quand
 *     l'écran est ouvert depuis une séance (param `sessionId`) ;
 *   - lecture    : markThreadRead à l'ouverture (les non-lus réels tombent).
 *
 * DROP net (doctrine « le graphique v2 fait loi ») : l'ancienne vue riche
 * DebriefMirror (actes + piliers + modules RaceBox) n'appartient pas à cette
 * maquette — le débrief chiffré vit dans Bilan/Data Lab. Ici : les mots
 * échangés, rien d'autre. Le contenu des notes est de la parole humaine
 * attribuée (coach ou pilote), jamais celle de l'app.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useCoachThread } from '@/hooks/useCoachThread';
import {
  type MessageThread,
  listMyThreads,
  markThreadRead,
  sendMessage,
} from '@/services/coachMessagesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Initiales pour l'avatar du binôme (nom réel du coach, fallback tiret). */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
  return (letters || '—').toUpperCase();
}

/** Prénom (premier mot du nom réel) pour l'attribution des bulles coach. */
function firstNameOf(name: string): string {
  return name.split(/\s+/).filter(Boolean)[0] ?? name;
}

export default function DebriefPresentielScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const profile = useAuthStore((s) => s.profile);
  const me = profile?.id ?? null;

  const [thread, setThread] = useState<MessageThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Résout le binôme réel (coach_pilots actif + consenti). S'il en existe
  // plusieurs, on ouvre le fil le plus récemment actif.
  useEffect(() => {
    let alive = true;
    if (!me) {
      setThreadLoading(false);
      return;
    }
    listMyThreads(me)
      .then((threads) => {
        if (!alive) return;
        const sorted = [...threads].sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
        setThread(sorted[0] ?? null);
        setThreadLoading(false);
      })
      .catch(() => {
        if (alive) setThreadLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [me]);

  const { messages, loading: messagesLoading } = useCoachThread(thread?.coachPilotId ?? null);

  // À l'ouverture (et à chaque note reçue), les non-lus réels tombent.
  useEffect(() => {
    if (thread?.coachPilotId && me) markThreadRead(thread.coachPilotId, me);
  }, [thread?.coachPilotId, me, messages.length]);

  const coachFirst = useMemo(() => (thread ? firstNameOf(thread.otherName) : ''), [thread]);

  async function onSend() {
    const body = draft.trim();
    if (!body || !thread || !me || sending) return;
    setSending(true);
    setSendFailed(false);
    const res = await sendMessage({
      coachPilotId: thread.coachPilotId,
      coachId: thread.coachId,
      pilotId: thread.pilotId,
      senderId: me,
      body,
      sessionId: params.sessionId ?? null,
    });
    setSending(false);
    if (res.ok) setDraft('');
    else setSendFailed(true);
  }

  const loading = threadLoading || (thread !== null && messagesLoading);

  return (
    <Screen scroll={false}>
      <AppBar title="Débrief présentiel" onBack={() => router.back()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement des notes" />
        </View>
      ) : !thread ? (
        <EmptyState />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Carte binôme — liseré gauche rouge coach (maquette). */}
            <Card style={styles.headerCard}>
              <View style={styles.headerRow}>
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarText}>{initialsOf(thread.otherName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerName} accessibilityRole="header">
                    {`Avec ${thread.otherName}`}
                  </Text>
                  <Text style={styles.headerSub}>
                    {messages.length > 0
                      ? `Notes partagées · ${messages.length} note${messages.length > 1 ? 's' : ''}`
                      : 'Notes partagées'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Fil attribué : coach = rouge, vous = gris. Contenu = parole
                humaine réelle (table coach_messages), jamais celle de l'app. */}
            <View style={styles.feed}>
              {messages.map((m) => {
                const mine = m.senderId === me;
                const author = mine ? 'Vous' : coachFirst;
                return (
                  <View
                    key={m.id}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}
                    accessibilityLabel={`Note de ${author} : ${m.body}`}
                  >
                    <View style={styles.bubbleHead}>
                      <View style={[styles.dot, mine ? styles.dotMine : styles.dotCoach]}>
                        <Text style={[styles.dotText, !mine && { color: palette.cream }]}>
                          {author.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.author, mine ? styles.authorMine : styles.authorCoach]}>
                        {author.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.body}>{m.body}</Text>
                  </View>
                );
              })}

              {messages.length === 0 ? (
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedTitle}>Aucune note partagée pour l’instant.</Text>
                  <Text style={styles.emptyFeedHint}>
                    {`La première note — la vôtre ou celle de ${coachFirst} — ouvrira le fil.`}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Ajout de note RÉEL : écrit dans coach_messages (attribué à vous),
              rattaché à la séance quand l'écran vient d'une séance. */}
          <View style={styles.composer}>
            <View style={styles.inputRow}>
              <Text style={styles.plus} importantForAccessibility="no">
                +
              </Text>
              <TextInput
                value={draft}
                onChangeText={(t) => {
                  setDraft(t);
                  if (sendFailed) setSendFailed(false);
                }}
                placeholder="Ajouter une note partagée"
                placeholderTextColor={palette.faint}
                style={styles.input}
                multiline
                accessibilityLabel="Votre note partagée"
              />
              {draft.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Partager la note"
                  accessibilityState={{ disabled: sending, busy: sending }}
                  disabled={sending}
                  onPress={onSend}
                  hitSlop={theme.hitSlop}
                  style={({ pressed }) => [
                    styles.send,
                    { opacity: sending ? 0.5 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.sendText}>Partager</Text>
                </Pressable>
              ) : null}
            </View>
            {sendFailed ? (
              <Text style={styles.sendError} accessibilityLiveRegion="polite">
                {'La note n’a pas été partagée. Votre texte est conservé.'}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

/**
 * Sans binôme actif + consenti, il n'existe aucun fil : état honnête,
 * sans faux champ de saisie (l'écriture exige un binôme — RLS).
 */
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          Aucun coach pour le moment.
        </Text>
        <Text style={styles.emptyHint}>
          {
            'Les notes partagées vivent entre vous et votre coach. Quand un coach vous accompagnera — avec votre accord — le fil s’ouvrira ici.'
          }
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
          <Button
            label="Découvrir les coachs"
            variant="ghost"
            onPress={() => router.push('/(app)/coachs' as never)}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  // Carte binôme : surface card, liseré gauche 2 px rouge coach (maquette).
  headerCard: {
    padding: spacing.lg - 2,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 1,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.secondary,
  },
  headerName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  headerSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.legend,
    marginTop: 2,
  },
  feed: { marginTop: spacing.xl, gap: spacing.md },
  bubble: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg - 2,
  },
  // Bulle coach : pleine largeur, surface card, liseré rouge coach.
  bubbleCoach: {
    backgroundColor: palette.card,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
  },
  // Bulle « vous » : décalée à droite, surface alt, attribution grise.
  bubbleMine: {
    backgroundColor: palette.card2,
    marginLeft: spacing.xxl + spacing.sm,
  },
  bubbleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCoach: { backgroundColor: palette.coachAccent },
  dotMine: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
  },
  dotText: {
    fontFamily: fonts.monoSemi,
    fontSize: 9,
    color: palette.creamMute,
  },
  // Attribution : eyebrow mono, rouge coach / gris vous (maquette).
  author: {
    fontFamily: fonts.monoSemi,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  authorCoach: { color: palette.coachAccent },
  authorMine: { color: palette.creamMute },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },
  emptyFeed: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyFeedTitle: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    color: palette.creamSoft,
    textAlign: 'center',
  },
  emptyFeedHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'center',
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.sm,
  },
  // Rangée d'ajout : « + Ajouter une note partagée » (maquette), champ réel.
  composer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: palette.night,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  plus: {
    fontFamily: fonts.body,
    fontSize: fontSize.h3,
    color: palette.creamMute,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  send: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    marginBottom: 5,
    borderRadius: radius.sm,
    backgroundColor: palette.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#000',
  },
  sendError: {
    fontFamily: fonts.body,
    fontSize: fontSize.micro,
    color: palette.coachAlert,
    marginTop: spacing.xs + 2,
    marginLeft: spacing.xs,
  },
  emptyWrap: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    color: palette.creamSoft,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'center',
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
  },
});
