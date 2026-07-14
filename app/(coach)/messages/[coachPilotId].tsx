/**
 * Coach — Fil de discussion coach↔pilote (handoff §12 `coach/29-messagerie` +
 * `coach-mobile/09-fil-discussion`, sur `coach_messages` en temps réel).
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : le MÊME écran
 * s'adapte selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes fidèles à la
 *     maquette — liste des fils (« Messages », fil actif surligné rouge) à
 *     gauche, conversation ouverte (en-tête pilote + badge « in-app · sans
 *     coordonnées » + bulles + saisie) à droite. Le rail (CoachRail) est fourni
 *     par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : une seule colonne — en-tête compact
 *     (retour + pilote + badge) puis la conversation ; la barre d'onglets coach
 *     est fournie par `_layout.tsx`.
 *
 * DOCTRINE (§4 / §12) : la voix est ATTRIBUÉE — bulles COACH en rouge coach
 * `#E23A4E`, bulles PILOTE en gris `#141416`, jamais « à l'app ». Fil in-app,
 * SANS coordonnées (RLS : la table ne porte que le texte). L'or reste réservé au
 * chrono : absent ici. Aucune note/pièce jointe vocale n'existe dans le modèle
 * `coach_messages` (body + session_id seuls) — la carte « Note vocale » de la
 * maquette n'est pas rendue (pas de contrôle mort, cf. rapport). Vouvoiement,
 * zéro emoji, descriptif jamais prescriptif.
 *
 * Temps réel via useCoachThread (Realtime). À l'ouverture, les reçus sont
 * marqués lus. Le clavier ne recouvre pas la saisie (KeyboardAvoidingView).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { useCoachThread } from '@/hooks/useCoachThread';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  listMyThreads,
  markThreadRead,
  sendMessage,
  type CoachMessage,
  type MessageThread,
} from '@/services/coachMessagesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Screen } from '@/ui/Screen';
import { timeAgoFr } from '@/utils/time';

const { palette, spacing, fonts, fontSize, radius } = theme;

/** Initiales (1-2 lettres) d'un nom pour l'avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0] ?? '');
  return chars.join('').toUpperCase() || '·';
}

/** Premier prénom d'un nom, pour l'attribution sous la bulle. */
function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Heure locale « HH:MM » d'un ISO (horloge du message, pas un chrono). */
function clockOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Libellé de jour « 4 juil. » (séparateur de date, dérivé du message). */
function dayLabelOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Clé de jour calendaire pour regrouper les messages. */
function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toDateString();
}

type FeedItem =
  | { kind: 'sep'; id: string; label: string }
  | { kind: 'msg'; id: string; msg: CoachMessage };

function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2 11 13"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2 15 22 11 13 2 9Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Badge « fil in-app, sans coordonnées » (statut doctrinal, vert = protégé). */
function PrivacyBadge({ compact }: { compact?: boolean }) {
  return (
    <View style={s.badge} accessibilityLabel="Fil in-app, sans coordonnées partagées">
      <View style={s.badgeDot} />
      <Text style={s.badgeTxt}>
        {compact ? 'in-app · sans coordonnées' : 'IN-APP · SANS COORDONNÉES'}
      </Text>
    </View>
  );
}

export default function ThreadScreen() {
  const params = useLocalSearchParams<{
    coachPilotId?: string;
    coachId?: string;
    pilotId?: string;
    name?: string;
  }>();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const profile = useAuthStore((s) => s.profile);
  const me = profile?.id ?? null;
  const coachPilotId = params.coachPilotId ?? null;
  const otherName = params.name ?? 'Pilote';
  const myFirst = profile?.first_name ?? 'Moi';
  const otherFirst = firstNameOf(otherName);

  const { messages } = useCoachThread(coachPilotId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  // À l'ouverture (et à chaque nouveau message reçu), marque le fil comme lu.
  useEffect(() => {
    if (coachPilotId && me) markThreadRead(coachPilotId, me);
  }, [coachPilotId, me, messages.length]);

  // Console uniquement : liste des fils pour la colonne de gauche (service réel).
  useEffect(() => {
    if (!isConsole || !me) return;
    let active = true;
    listMyThreads(me).then((rows) => {
      if (active) setThreads(rows);
    });
    return () => {
      active = false;
    };
  }, [isConsole, me, coachPilotId, messages.length]);

  // Regroupe les messages avec des séparateurs de jour (dérivés du message).
  const feed = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    let last = '';
    for (const m of messages) {
      const key = dayKeyOf(m.createdAt);
      if (key && key !== last) {
        out.push({ kind: 'sep', id: `sep-${key}`, label: dayLabelOf(m.createdAt) });
        last = key;
      }
      out.push({ kind: 'msg', id: m.id, msg: m });
    }
    return out;
  }, [messages]);

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

  function openThread(t: MessageThread) {
    router.replace({
      pathname: '/(coach)/messages/[coachPilotId]',
      params: {
        coachPilotId: t.coachPilotId,
        coachId: t.coachId,
        pilotId: t.pilotId,
        name: t.otherName,
      },
    } as never);
  }

  const canSend = !!draft.trim() && !sending;

  // ---- Fragments partagés entre les deux formats -------------------------

  const messageFeed = (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={s.feedContent}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      {feed.map((it) => {
        if (it.kind === 'sep') {
          return (
            <View key={it.id} style={s.sep}>
              <Text style={s.sepTxt}>{it.label}</Text>
            </View>
          );
        }
        const m = it.msg;
        const mine = m.senderId === me;
        const isCoachMsg = params.coachId ? m.senderId === params.coachId : mine;
        const senderName = mine ? myFirst : otherFirst;
        const time = clockOf(m.createdAt);
        return (
          <View key={it.id} style={[s.bubbleWrap, mine ? s.wrapMine : s.wrapOther]}>
            <View
              style={[
                s.bubble,
                isCoachMsg ? s.bubbleCoach : s.bubblePilot,
                mine ? s.tailMine : s.tailOther,
              ]}
              accessibilityLabel={`${senderName}, ${time} : ${m.body}`}
            >
              <Text style={[s.body, isCoachMsg ? s.bodyOnRed : s.bodyOnGray]}>{m.body}</Text>
            </View>
            <Text style={[s.caption, mine ? s.capMine : s.capOther]}>
              {senderName} · {time}
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
  );

  const inputBar = (
    <View style={s.inputBar}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={`Écrire à ${otherFirst}…`}
        placeholderTextColor={palette.faint}
        style={s.input}
        multiline
        accessibilityLabel="Votre message"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Envoyer"
        disabled={!canSend}
        onPress={onSend}
        style={({ pressed }) => [s.send, { opacity: !canSend ? 0.4 : pressed ? 0.85 : 1 }]}
      >
        <SendIcon color={palette.cream} />
      </Pressable>
    </View>
  );

  // ---- CONSOLE tablette : deux colonnes ----------------------------------

  if (isConsole) {
    return (
      <Screen scroll={false}>
        <View style={s.consoleRow}>
          <View style={s.listCol}>
            <Text style={s.listTitle} accessibilityRole="header">
              Messages
            </Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listContent}>
              {threads.map((t) => {
                const on = t.coachPilotId === coachPilotId;
                return (
                  <Pressable
                    key={t.coachPilotId}
                    onPress={() => openThread(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Fil avec ${t.otherName}${t.unread > 0 ? `, ${t.unread} non lus` : ''}`}
                    style={({ pressed }) => [
                      s.threadItem,
                      on && s.threadItemOn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View
                      style={[s.threadAccent, on && { backgroundColor: palette.coachAccent }]}
                    />
                    <View style={s.listAvatar}>
                      <Text style={s.listAvatarTxt}>{initialsOf(t.otherName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listName} numberOfLines={1}>
                        {t.otherName}
                      </Text>
                      <Text style={s.listPreview} numberOfLines={1}>
                        {t.lastBody ?? '—'}
                      </Text>
                    </View>
                    <View style={s.listMeta}>
                      {t.lastAt ? (
                        <Text style={s.listWhen}>{timeAgoFr(new Date(t.lastAt))}</Text>
                      ) : null}
                      {t.unread > 0 ? <View style={s.unreadDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={s.convCol}>
            {coachPilotId ? (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={s.convHeader}>
                  <View style={s.headAvatar}>
                    <Text style={s.headAvatarTxt}>{initialsOf(otherName)}</Text>
                  </View>
                  <Text style={s.headName} numberOfLines={1} accessibilityRole="header">
                    {otherName}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <PrivacyBadge />
                </View>
                {messageFeed}
                {inputBar}
              </KeyboardAvoidingView>
            ) : (
              <View style={s.convEmpty}>
                <Text style={s.convEmptyTxt}>Sélectionnez un fil pour l&apos;ouvrir.</Text>
              </View>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ---- COMPAGNON téléphone : une colonne ---------------------------------

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.mobileHeader}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <View style={s.chevron} />
          </Pressable>
          <View style={s.headAvatar}>
            <Text style={s.headAvatarTxt}>{initialsOf(otherName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headName} numberOfLines={1} accessibilityRole="header">
              {otherName}
            </Text>
            <PrivacyBadge compact />
          </View>
        </View>
        {messageFeed}
        {inputBar}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Console : deux colonnes.
  consoleRow: { flex: 1, flexDirection: 'row' },
  listCol: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: palette.line,
  },
  listTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  listContent: { paddingBottom: spacing.xl },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingRight: spacing.lg,
    paddingVertical: spacing.sm,
  },
  threadItemOn: { backgroundColor: 'rgba(226,58,78,0.08)' },
  threadAccent: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  listAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  listAvatarTxt: { fontFamily: fonts.mono, fontSize: 13, color: palette.cream },
  listName: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, color: palette.cream },
  listPreview: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  listMeta: { alignItems: 'flex-end', gap: 6 },
  listWhen: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.3, color: palette.faint },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.coachAccent },

  // Conversation.
  convCol: { flex: 1 },
  convEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  convEmptyTxt: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.body,
    color: palette.creamMute,
    textAlign: 'center',
  },

  // En-têtes.
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: palette.creamSoft,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  headAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headAvatarTxt: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.cream },
  headName: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.2, color: palette.cream },

  // Badge « in-app · sans coordonnées ».
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(79,201,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.35)',
    marginTop: 3,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: palette.green,
  },

  // Fil de messages.
  feedContent: { padding: spacing.lg, gap: spacing.sm },
  sep: { alignItems: 'center', marginVertical: spacing.sm },
  sepTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.eyebrow,
  },
  bubbleWrap: { maxWidth: '80%' },
  wrapMine: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  bubbleCoach: { backgroundColor: palette.coachAccent },
  bubblePilot: { backgroundColor: palette.card2, borderWidth: 1, borderColor: palette.line },
  tailMine: { borderBottomRightRadius: 4 },
  tailOther: { borderBottomLeftRadius: 4 },
  body: { fontFamily: fonts.body, fontSize: fontSize.body, lineHeight: 20 },
  bodyOnRed: { color: palette.cream },
  bodyOnGray: { color: palette.creamSoft },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.3,
    color: palette.faint,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  capMine: { alignSelf: 'flex-end' },
  capOther: { alignSelf: 'flex-start' },
  empty: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  // Saisie.
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
