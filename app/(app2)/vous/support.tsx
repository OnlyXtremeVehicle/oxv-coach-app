/**
 * SUPPORT — écran 8/8 de la porte VOUS (V2-L4, mission D). Route NOUVELLE.
 *
 * FlashList des demandes du pilote (pastille de statut) ; tap → fil du ticket
 * dans un Sheet (bulles hairline, réponse). CTA « Nous écrire » → composer
 * (catégorie en Chip, objet, message). Services v1 inchangés (supportService,
 * RLS own-row), habillage v2. Vide → StateView + « Une question ? Écrivez-nous. »
 *
 * Doctrine : sobre, vouvoiement, zéro emoji. Un seul accent rouge : la pastille
 * d'un ticket en cours de traitement (le reste en gris).
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  SUPPORT_CATEGORIES,
  type SupportStatus,
  type SupportTicket,
} from '@/services/supportService';
import {
  SUPPORT_STATUS_LABELS,
  isTicketClosed,
  supportStatusTone,
  type SupportTone,
} from '@/features/vous/supportLogic';
import { useSupport } from '@/features/vous/useSupport';
import {
  Chip,
  PressScale,
  Sheet,
  StateView,
  colors,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

// Pastilles monochromes (lightness = semantic) : l'unique accent rouge de la
// zone reste au bouton d'envoi. En cours de traitement = clair (attire l'œil).
const TONE_COLOR: Record<SupportTone, string> = {
  active: colors.text.hi,
  done: colors.text.mid,
  muted: colors.text.dim,
};

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function categoryLabel(value: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.dim}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.inputMultiline]}
        accessibilityLabel={label}
      />
    </View>
  );
}

function TicketRow({
  ticket,
  index,
  onPress,
}: {
  ticket: SupportTicket;
  index: number;
  onPress: () => void;
}) {
  const tone = TONE_COLOR[supportStatusTone(ticket.status)];
  return (
    <Animated.View entering={staggerEntering(index)} style={styles.ticketWrap}>
      <PressScale
        onPress={onPress}
        accessibilityLabel={`${ticket.subject}, ${categoryLabel(ticket.category)}, ${
          SUPPORT_STATUS_LABELS[ticket.status]
        }`}
        style={styles.ticketCard}
      >
        <View style={[styles.statusDot, { backgroundColor: tone }]} />
        <View style={styles.ticketMain}>
          <Text style={styles.ticketSubject} numberOfLines={1}>
            {ticket.subject}
          </Text>
          <Text style={styles.ticketMeta} numberOfLines={1}>
            {categoryLabel(ticket.category)} · {formatDate(ticket.createdAt)}
          </Text>
        </View>
        <Text style={[styles.statusLabel, { color: tone }]}>
          {SUPPORT_STATUS_LABELS[ticket.status].toUpperCase()}
        </Text>
      </PressScale>
    </Animated.View>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const sup = useSupport();
  const [composerOpen, setComposerOpen] = useState(false);

  async function onCreate() {
    const ok = await sup.submitTicket();
    if (ok) setComposerOpen(false);
  }

  const closed = sup.thread ? isTicketClosed(sup.thread.ticket.status as SupportStatus) : false;

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.backDisc}>
            <BackChevron />
          </View>
        </PressScale>
        <Text style={styles.title} accessibilityRole="header">
          SUPPORT
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlashList
        data={sup.tickets}
        keyExtractor={(t) => t.id}
        estimatedItemSize={76}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
        ListHeaderComponent={
          <PressScale
            onPress={() => setComposerOpen(true)}
            accessibilityLabel="Nous écrire, ouvrir une demande"
            containerStyle={styles.writeContainer}
            style={styles.writeCta}
          >
            <Text style={styles.writeTitle}>Nous écrire</Text>
            <Text style={styles.writeSub}>Ouvrir une demande</Text>
          </PressScale>
        }
        ListEmptyComponent={
          sup.status === 'loading' ? (
            <StateView state="loading" shape="list" />
          ) : sup.status === 'error' ? (
            <StateView
              state="error"
              errorMessage="Vos demandes n'ont pas pu se charger."
              onRetry={sup.reload}
            />
          ) : (
            <StateView state="empty" emptyMessage="Une question ? Écrivez-nous." />
          )
        }
        renderItem={({ item, index }) => (
          <TicketRow ticket={item} index={index} onPress={() => void sup.openThread(item.id)} />
        )}
      />

      {/* Composer — nouvelle demande */}
      <Sheet visible={composerOpen} onClose={() => setComposerOpen(false)} snapHeight={480}>
        <Text style={styles.sheetTitle}>Nouvelle demande</Text>
        <Text style={styles.sheetSub}>Catégorie</Text>
        <View style={styles.chips}>
          {SUPPORT_CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={c.value === sup.category}
              onPress={() => sup.setCategory(c.value)}
            />
          ))}
        </View>
        <View style={styles.composerFields}>
          <Field
            label="Objet"
            value={sup.subject}
            onChange={sup.setSubject}
            placeholder="En quelques mots"
            maxLength={200}
          />
          <Field
            label="Votre message"
            value={sup.message}
            onChange={sup.setMessage}
            placeholder="Décrivez la situation."
            multiline
            maxLength={4000}
          />
          {sup.composerError ? <Text style={styles.error}>{sup.composerError}</Text> : null}
          <PressScale
            onPress={onCreate}
            disabled={sup.sending || !sup.subject.trim()}
            accessibilityLabel="Envoyer la demande"
            containerStyle={styles.sendContainer}
            style={[styles.sendBtn, (sup.sending || !sup.subject.trim()) && styles.btnDisabled]}
          >
            <Text style={styles.sendLabel}>{sup.sending ? 'Envoi…' : 'Envoyer'}</Text>
          </PressScale>
        </View>
      </Sheet>

      {/* Fil d'un ticket — bulles hairline + réponse */}
      <Sheet
        visible={sup.thread !== null || sup.threadLoading}
        onClose={sup.closeThread}
        snapHeight={560}
      >
        {sup.threadLoading || sup.thread === null ? (
          <StateView state="loading" shape="list" />
        ) : (
          <>
            <Text style={styles.threadCat}>{categoryLabel(sup.thread.ticket.category)}</Text>
            <Text style={styles.sheetTitle}>{sup.thread.ticket.subject}</Text>
            <Text style={styles.threadStatus}>
              Statut · {SUPPORT_STATUS_LABELS[sup.thread.ticket.status as SupportStatus]}
            </Text>

            <View style={styles.bubbles}>
              {sup.thread.messages.length === 0 ? (
                <Text style={styles.muted}>Aucun message pour l'instant.</Text>
              ) : (
                sup.thread.messages.map((m) => (
                  // Auteur, corps et horodatage sont trois Text frères :
                  // groupés, le message se lit d'un bloc.
                  <View
                    key={m.id}
                    style={[styles.bubble, m.isAdmin ? styles.bubbleAdmin : styles.bubbleMine]}
                    accessible
                    accessibilityLabel={`${m.isAdmin ? 'Équipe OXV' : 'Vous'}. ${m.body}. ${formatDate(
                      m.createdAt
                    )}`}
                  >
                    <Text style={styles.bubbleAuthor}>{m.isAdmin ? 'Équipe OXV' : 'Vous'}</Text>
                    <Text style={styles.bubbleBody}>{m.body}</Text>
                    <Text style={styles.bubbleTime}>{formatDate(m.createdAt)}</Text>
                  </View>
                ))
              )}
            </View>

            {closed ? (
              <Text style={styles.muted}>
                Cette demande est close. Ouvrez-en une nouvelle si besoin.
              </Text>
            ) : (
              <View style={styles.replyBlock}>
                <Field
                  label="Votre réponse"
                  value={sup.reply}
                  onChange={sup.setReply}
                  placeholder="Ajoutez une précision."
                  multiline
                  maxLength={4000}
                />
                {sup.threadError ? <Text style={styles.error}>{sup.threadError}</Text> : null}
                <PressScale
                  onPress={() => void sup.submitReply()}
                  disabled={sup.replying || !sup.reply.trim()}
                  accessibilityLabel="Répondre"
                  containerStyle={styles.sendContainer}
                  style={[
                    styles.sendBtn,
                    (sup.replying || !sup.reply.trim()) && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.sendLabel}>{sup.replying ? 'Envoi…' : 'Répondre'}</Text>
                </PressScale>
              </View>
            )}
          </>
        )}
      </Sheet>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: { fontFamily: typo.display, fontSize: 18, letterSpacing: 2, color: colors.text.hi },

  // CTA écrire
  writeContainer: { marginBottom: space.lg },
  writeCta: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  writeTitle: { fontFamily: typo.bodySemi, fontSize: 16, color: colors.text.hi },
  writeSub: { fontFamily: typo.body, fontSize: 13, color: colors.text.mid, marginTop: 2 },

  // Ticket
  ticketWrap: { marginBottom: space.sm },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ticketMain: { flex: 1 },
  ticketSubject: { fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },
  ticketMeta: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.text.low,
    marginTop: 3,
  },
  statusLabel: { fontFamily: typo.mono, fontSize: 9, letterSpacing: 1.2 },

  // Sheets
  sheetTitle: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.4,
    color: colors.text.hi,
    marginTop: space.sm,
  },
  sheetSub: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  composerFields: { marginTop: space.lg, gap: space.md },

  fieldLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.sm,
  },
  input: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', lineHeight: 22 },
  error: { fontFamily: typo.body, fontSize: 12, color: colors.accent },

  sendContainer: { marginTop: space.xs },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  sendLabel: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.hi },
  btnDisabled: { opacity: 0.5 },

  // Thread
  threadCat: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.dim,
    marginTop: space.sm,
  },
  threadStatus: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  bubbles: { marginTop: space.xl, gap: space.sm },
  bubble: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.hairline,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  bubbleMine: { backgroundColor: colors.bg.card },
  bubbleAdmin: { backgroundColor: colors.bg.card2, borderColor: colors.border.card },
  bubbleAuthor: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  bubbleBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
  },
  bubbleTime: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.text.dim,
    marginTop: space.sm,
  },
  muted: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
    marginTop: space.lg,
  },
  replyBlock: { marginTop: space.xl, gap: space.md },
});
