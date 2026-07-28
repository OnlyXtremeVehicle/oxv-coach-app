/**
 * Messages — fils coach↔pilote (handoff §12 `coach/29-messagerie` + coach-mobile
 * `07-messages`). Table `coach_messages` : fil ATTRIBUÉ (sender_id), SANS
 * coordonnées (RGPD — la table ne porte que le texte). Le groupe de routes
 * `(coach)` est gardé sur role='coach' (cf. `_layout`) : le membre courant est le
 * coach, l'« autre » est son pilote consenti.
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13), même écran :
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes fidèles à la
 *     maquette — liste des fils à gauche (sélection, pas de navigation) + aperçu
 *     du fil sélectionné à droite (en-tête pilote + garantie « in-app · sans
 *     coordonnées », bulles temps réel via `useCoachThread`, saisie réelle via
 *     `sendMessage`). Le rail (CoachRail) est fourni par `_layout.tsx`.
 *   - COMPAGNON téléphone (< seuil) : une seule colonne — grand titre
 *     « Messages », garantie confidentialité, liste des fils ; le tap ouvre le
 *     fil plein écran (`messages/[coachPilotId]`).
 *
 * Doctrine : c'est le coach qui parle, jamais « l'app » ; sa voix est attribuée
 * (bulle rouge coach à droite). Aucune coordonnée exposée. Aucun classement.
 * L'or n'apparaît pas (ni chrono ni record ici). Vouvoiement, zéro emoji.
 *
 * Écart maquette assumé : les bulles « moi » (coach) restent alignées à DROITE
 * en rouge coach — cohérent avec le fil plein écran (`messages/[coachPilotId]`)
 * et la doctrine « voix du coach attribuée en rouge » —, là où le PNG les place
 * à gauche. La carte « note vocale » du PNG et le bouton pièce-jointe ne sont pas
 * rendus : `coach_messages` ne porte que du texte (pas de contrôle mort).
 *
 * Motion (passe transversale, kit src/components/motion) : liste des fils en
 * cascade (Stagger), chaque bulle monte en fondu+translation à son montage —
 * l'historique fond d'un bloc à l'ouverture du fil, chaque NOUVEAU message
 * arrive seul en fondu (append-only : rien ne rejoue). Fils, envoi et rangées
 * en PressableScale. Durées et courbes = celles du kit ; reduce-motion respecté.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import * as haptics from '@/lib/haptics';
import { useCoachThread } from '@/hooks/useCoachThread';
import {
  listMyThreads,
  markThreadRead,
  sendMessage,
  type MessageThread,
} from '@/services/coachMessagesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { timeAgoFr } from '@/utils/time';

const { palette, spacing, fonts, fontSize, radius } = theme;

const LIST_W = 300; // largeur de la colonne « liste des fils » (console)
const AVATAR = 40;

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export default function MessagesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const profile = useAuthStore((s) => s.profile);
  const me = profile?.id ?? null;

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      if (!me) return;
      let active = true;
      setLoading(true);
      listMyThreads(me).then((rows) => {
        if (!active) return;
        setThreads(rows);
        setLoading(false);
        // Console : sélection par défaut sur le fil le plus récent (liste triée),
        // sauf si la sélection courante existe toujours.
        setSelectedId((prev) =>
          prev && rows.some((r) => r.coachPilotId === prev) ? prev : (rows[0]?.coachPilotId ?? null)
        );
      });
      return () => {
        active = false;
      };
    }, [me])
  );

  const selected = useMemo(
    () => threads.find((t) => t.coachPilotId === selectedId) ?? null,
    [threads, selectedId]
  );

  // Fil temps réel du binôme sélectionné (console uniquement — le téléphone
  // ouvre le fil plein écran). Le hook no-op proprement quand l'id est null.
  const activeId = isConsole ? selectedId : null;
  const { messages } = useCoachThread(activeId);

  // À l'ouverture d'un fil (et à chaque nouveau message), marque les reçus comme
  // lus et reflète l'état dans la liste (badge à zéro).
  useEffect(() => {
    if (!isConsole || !activeId || !me) return;
    markThreadRead(activeId, me);
    setThreads((prev) => prev.map((t) => (t.coachPilotId === activeId ? { ...t, unread: 0 } : t)));
  }, [isConsole, activeId, me, messages.length]);

  const selectThread = useCallback((id: string) => {
    haptics.tap();
    setSelectedId(id);
  }, []);

  const openThread = useCallback((t: MessageThread) => {
    router.push({
      pathname: '/(coach)/messages/[coachPilotId]',
      params: {
        coachPilotId: t.coachPilotId,
        coachId: t.coachId,
        pilotId: t.pilotId,
        name: t.otherName,
      },
    } as never);
  }, []);

  const onSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !selected || !me || sending) return;
    setSending(true);
    haptics.tap();
    const res = await sendMessage({
      coachPilotId: selected.coachPilotId,
      coachId: selected.coachId,
      pilotId: selected.pilotId,
      senderId: me,
      body,
    });
    setSending(false);
    if (res.ok) setDraft('');
  }, [draft, selected, me, sending]);

  const listState: ScreenState = loading ? 'loading' : threads.length === 0 ? 'empty' : 'nominal';

  const renderList = (asConsole: boolean) => (
    <StateWrapper
      state={listState}
      skeletonLines={4}
      emptyLabel="Aucun fil"
      emptyMessage="Vos échanges avec vos pilotes consentis apparaîtront ici. Rien ne fuite : ni numéro, ni email."
      emptySource="coach_messages"
    >
      {/* Fils en cascade d'entrée (listes courtes — pilotes consentis). */}
      <Stagger style={asConsole ? undefined : { marginTop: spacing.md }}>
        {threads.map((t, i) => (
          <ThreadRow
            key={t.coachPilotId}
            item={t}
            isConsole={asConsole}
            selected={asConsole && t.coachPilotId === selectedId}
            isLast={i === threads.length - 1}
            onPress={() => (asConsole ? selectThread(t.coachPilotId) : openThread(t))}
          />
        ))}
      </Stagger>
    </StateWrapper>
  );

  // ── CONSOLE : liste + aperçu ────────────────────────────────────────────────
  if (isConsole) {
    return (
      <Screen scroll={false}>
        <View style={s.console}>
          <View style={s.listCol}>
            <FadeInSection>
              <Text style={s.listTitle} accessibilityRole="header">
                Messages
              </Text>
            </FadeInSection>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              showsVerticalScrollIndicator={false}
            >
              {renderList(true)}
            </ScrollView>
          </View>

          <View style={s.previewCol}>
            {selected ? (
              <>
                <View style={s.previewHead}>
                  <View style={[s.avatar, s.avatarActive]}>
                    <Text style={s.avatarTxt}>{initialsOf(selected.otherName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.previewName} numberOfLines={1}>
                      {selected.otherName}
                    </Text>
                    <Text style={s.previewSub}>
                      {me === selected.coachId ? 'Votre pilote' : 'Votre coach'}
                    </Text>
                  </View>
                  <GuaranteePill label="IN-APP · SANS COORDONNÉES" />
                </View>

                <ScrollView
                  ref={scrollRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={s.threadScroll}
                  onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  showsVerticalScrollIndicator={false}
                >
                  {messages.length === 0 ? (
                    <Text style={s.firstHint}>
                      Écrivez le premier message. Il sera attribué à vous, jamais «&nbsp;à
                      l&apos;app&nbsp;».
                    </Text>
                  ) : (
                    renderBubbles(messages, me, selected.otherName)
                  )}
                </ScrollView>

                <View style={s.composeBar}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={`Écrire à ${firstNameOf(selected.otherName)}…`}
                    placeholderTextColor={palette.faint}
                    style={s.input}
                    multiline
                    accessibilityLabel="Écrire un message"
                  />
                  {/* L'état désactivé vit sur le wrapper : l'opacité animée du
                      PressableScale écraserait une opacité statique interne. */}
                  <View style={!draft.trim() || sending ? s.sendDim : null}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Envoyer le message"
                      disabled={!draft.trim() || sending}
                      onPress={onSend}
                      style={s.send}
                    >
                      <Text style={s.sendGlyph}>→</Text>
                    </PressableScale>
                  </View>
                </View>
              </>
            ) : (
              <View style={s.previewEmpty}>
                <Text style={s.previewEmptyTxt}>
                  {loading
                    ? 'Chargement de vos fils…'
                    : 'Vos échanges avec vos pilotes consentis apparaîtront ici.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ── TÉLÉPHONE : liste seule ─────────────────────────────────────────────────
  return (
    <Screen>
      <View style={s.mobilePad}>
        <FadeInSection style={s.mobileHead}>
          <Text style={s.mobileTitle} accessibilityRole="header">
            Messages
          </Text>
          <GuaranteePill label="SANS COORDONNÉES" />
        </FadeInSection>
        {renderList(false)}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ThreadRow({
  item,
  isConsole,
  selected,
  isLast,
  onPress,
}: {
  item: MessageThread;
  isConsole: boolean;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const when = item.lastAt ? timeAgoFr(new Date(item.lastAt)) : null;
  const unreadLabel =
    item.unread > 0
      ? `, ${item.unread} message${item.unread > 1 ? 's' : ''} non lu${item.unread > 1 ? 's' : ''}`
      : '';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={isConsole ? { selected } : undefined}
      accessibilityLabel={`Fil avec ${item.otherName}${unreadLabel}`}
      onPress={onPress}
      style={[
        isConsole ? s.rowConsole : s.rowMobile,
        isConsole && selected && s.rowConsoleActive,
        !isConsole && !isLast && s.rowMobileSep,
      ]}
    >
      <View style={[s.avatar, isConsole && selected && s.avatarActive]}>
        <Text style={s.avatarTxt}>{initialsOf(item.otherName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={s.name}>
          {item.otherName}
        </Text>
        <Text numberOfLines={1} style={s.preview}>
          {item.lastBody ?? 'Pas encore de message.'}
        </Text>
      </View>
      <View style={s.rowTrail}>
        {when ? <Text style={s.when}>{when}</Text> : null}
        {item.unread > 0 ? <View style={s.dot} /> : null}
      </View>
    </PressableScale>
  );
}

/** Garantie de confidentialité — fait doctrinal (RGPD : aucune coordonnée dans
 *  `coach_messages`), rendu en vert « validé ». Non interactif. */
function GuaranteePill({ label }: { label: string }) {
  return (
    <View style={s.pill}>
      <View style={s.pillDot} />
      <Text style={s.pillTxt}>{label}</Text>
    </View>
  );
}

/** Bulles du fil, groupées par jour (séparateurs dérivés de `created_at`).
 *  Chaque bulle monte en fondu+translation À SON MONTAGE (FadeInSection) : le
 *  fil est append-only, donc l'historique fond une fois à l'ouverture et seul
 *  le NOUVEAU message s'anime ensuite — rien ne rejoue, rien n'est inventé. */
function renderBubbles(
  messages: { id: string; senderId: string; body: string; createdAt: string }[],
  me: string | null,
  otherName: string
): ReactNode[] {
  const out: ReactNode[] = [];
  let lastDay = '';
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== lastDay) {
      lastDay = key;
      out.push(
        <FadeInSection key={`day-${key}`}>
          <Text style={s.daySep}>{dayLabelFr(d)}</Text>
        </FadeInSection>
      );
    }
    const mine = m.senderId === me;
    out.push(
      <FadeInSection key={m.id} style={[s.bubbleRow, mine ? s.bubbleRowMine : s.bubbleRowOther]}>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
          <Text style={s.bubbleTxt}>{m.body}</Text>
        </View>
        <Text style={[s.bubbleMeta, mine ? s.metaMine : s.metaOther]}>
          {mine ? hhmm(m.createdAt) : `${otherName} · ${hhmm(m.createdAt)}`}
        </Text>
      </FadeInSection>
    );
  }
  return out;
}

// ── Helpers (purs, affichage — dérivés de données réelles) ────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase() || '·';
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabelFr(d: Date, now: Date = new Date()): string {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()] ?? ''}`.trim();
}

const s = StyleSheet.create({
  // ── Console : deux colonnes ──
  console: { flex: 1, flexDirection: 'row' },
  listCol: {
    width: LIST_W,
    borderRightWidth: 1,
    borderRightColor: palette.line,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  listTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    marginBottom: spacing.md,
  },
  previewCol: { flex: 1 },

  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  previewName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  previewSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.eyebrow,
    marginTop: 2,
  },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  previewEmptyTxt: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    maxWidth: 320,
  },

  threadScroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  firstHint: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },

  // ── Bulles ──
  daySep: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.faint,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  bubbleRow: { maxWidth: '82%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Voix du coach (moi) : rouge coach attribué (doctrine).
  bubbleMine: { backgroundColor: palette.coachAccent },
  bubbleOther: { backgroundColor: palette.card2, borderWidth: 1, borderColor: palette.line },
  bubbleTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.4,
    color: palette.cream,
  },
  bubbleMeta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: palette.faint,
    marginTop: 4,
  },
  metaMine: { textAlign: 'right' },
  metaOther: { textAlign: 'left' },

  // ── Saisie ──
  composeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
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
    width: 48,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Atténuation « rien à envoyer » — portée par le wrapper du PressableScale.
  sendDim: { opacity: 0.4 },
  sendGlyph: { fontFamily: fonts.mono, fontSize: 18, color: palette.cream },

  // ── Téléphone ──
  mobilePad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  mobileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  mobileTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    letterSpacing: 0.3,
    color: palette.cream,
  },

  // ── Rangée de fil (partagée, deux formats) ──
  rowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  rowMobileSep: { borderBottomWidth: 1, borderBottomColor: palette.separator },
  rowConsole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  rowConsoleActive: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: { borderColor: palette.coachAccent },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.5, color: palette.creamSoft },
  name: { fontFamily: fonts.bodySemi, fontSize: fontSize.bodyLg, color: palette.cream },
  preview: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  rowTrail: { alignItems: 'flex-end', justifyContent: 'center', gap: 6, minWidth: 34 },
  when: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.4, color: palette.faint },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.coachAccent },

  // ── Pastille garantie ──
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.45)',
    backgroundColor: 'rgba(79,201,138,0.10)',
  },
  pillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.green },
  pillTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.green,
  },
});
