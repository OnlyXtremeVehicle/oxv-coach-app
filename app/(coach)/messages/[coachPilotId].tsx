/**
 * Fil de messagerie coach↔pilote (2-A). Attribué, sans coordonnées.
 *
 * Bulles : les miennes à droite (crème), celles de l'autre à gauche (card2).
 * Temps réel via useCoachThread (Realtime). À l'ouverture, on marque les reçus
 * comme lus. Le clavier ne recouvre pas la saisie (KeyboardAvoidingView).
 */

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useCoachThread } from '@/hooks/useCoachThread';
import { markThreadRead, sendMessage } from '@/services/coachMessagesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, spacing, fonts, fontSize, radius } = theme;

export default function ThreadScreen() {
  const params = useLocalSearchParams<{
    coachPilotId?: string;
    coachId?: string;
    pilotId?: string;
    name?: string;
  }>();
  const profile = useAuthStore((s) => s.profile);
  const me = profile?.id ?? null;
  const coachPilotId = params.coachPilotId ?? null;

  const { messages } = useCoachThread(coachPilotId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // À l'ouverture (et à chaque nouveau message reçu), marque le fil comme lu.
  useEffect(() => {
    if (coachPilotId && me) markThreadRead(coachPilotId, me);
  }, [coachPilotId, me, messages.length]);

  async function onSend() {
    const body = draft.trim();
    if (!body || !coachPilotId || !me || !params.coachId || !params.pilotId || sending) return;
    setSending(true);
    const res = await sendMessage({
      coachPilotId,
      coachId: params.coachId,
      pilotId: params.pilotId,
      senderId: me,
      body,
    });
    setSending(false);
    if (res.ok) setDraft('');
  }

  return (
    <Screen scroll={false}>
      <AppBar title={(params.name ?? 'Fil').toUpperCase()} onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => {
            const mine = m.senderId === me;
            return (
              <View
                key={m.id}
                style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}
                accessibilityLabel={`${mine ? 'Vous' : (params.name ?? 'Coach')} : ${m.body}`}
              >
                <Text style={[s.body, mine ? { color: palette.night } : { color: palette.cream }]}>
                  {m.body}
                </Text>
              </View>
            );
          })}
          {messages.length === 0 ? (
            <Text style={s.empty}>
              Écrivez le premier message. Il sera attribué à vous, jamais « à l&apos;app ».
            </Text>
          ) : null}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Votre message…"
            placeholderTextColor={palette.faint}
            style={s.input}
            multiline
            accessibilityLabel="Votre message"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            disabled={!draft.trim() || sending}
            onPress={onSend}
            style={({ pressed }) => [
              s.send,
              { opacity: !draft.trim() || sending ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={s.sendTxt}>Envoyer</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = {
  bubble: {
    maxWidth: '82%' as const,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bubbleMine: { alignSelf: 'flex-end' as const, backgroundColor: palette.cream },
  bubbleOther: {
    alignSelf: 'flex-start' as const,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  body: { fontFamily: fonts.body, fontSize: fontSize.body, lineHeight: fontSize.body * 1.4 },
  empty: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  inputBar: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.night,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  send: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.coachAccent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendTxt: { fontFamily: fonts.bodyMedium, fontSize: 14, color: palette.cream },
};
