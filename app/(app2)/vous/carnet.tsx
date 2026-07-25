/**
 * CARNET — porte VOUS, écran 4/8 du lot V2-L4. Route `vous/carnet`.
 *
 * L'espace intime du pilote, à 4 onglets (Notes · Intentions · Objectifs ·
 * Programme) parcourus au SWIPE horizontal (pager gestuel Reanimated) sous un
 * indicateur hairline qui GLISSE d'un onglet à l'autre au rythme du doigt. Les
 * décisions d'onglets/swipe sont pures et testées (carnetLogic).
 *
 * Données RÉELLES câblées (useCarnet, services existants) :
 *   - Notes : pilot_notes datées + météo RÉELLE du jour de la note quand elle
 *     existe (A-WEATHER-1 : jamais un 0° fabriqué, jamais un autre jour) ;
 *     composer bas (addNote) ; partage coach opt-in par note (setNoteShared) ;
 *   - Intentions : une carte par intention liée à sa séance (mini-tracé), état
 *     honorée/en attente FACTUEL (session_intentions) ;
 *   - Objectifs : perso, INVISIBLES du coach (mention text.dim en tête) ; barre
 *     hairline SEULEMENT si l'objectif porte une mesure (jamais inventée) ;
 *   - Programme : cycles PARTAGÉS par le coach, lus tels quels (espace
 *     prescriptif autorisé ici), badge coach.
 *
 * Doctrine : FR vouvoyé, zéro emoji, jamais prescriptif (côté pilote) ; l'app
 * n'écrit ni ne suggère JAMAIS le contenu des notes/intentions/objectifs. Absent
 * = « — » / section masquée / StateView, jamais un placeholder fabriqué. Skia
 * natif (dev-client), pas d'Expo Go.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuthStore } from '@/store/useAuthStore';
import {
  Chip,
  colors,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  haptic,
  motionTokens,
  OxvIcon,
  PressScale,
  radius,
  space,
  staggerEntering,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';

import {
  CARNET_TAB_LABELS,
  CARNET_TABS,
  goalProgress,
  goalStatusLabel,
  intentionState,
  intentionStateLabel,
  nextTabIndex,
  type CarnetTab,
} from '@/features/vous/carnetLogic';
import {
  useCarnet,
  type Carnet,
  type CarnetIntentionItem,
  type CarnetNoteItem,
} from '@/features/vous/useCarnet';
import type { PilotGoal } from '@/services/pilotGoalsService';
import type { SharedCycle } from '@/services/developmentCycleService';

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

function longDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const txt = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function CarnetScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { width } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const carnet = useCarnet(profile?.id ?? null);

  const [tab, setTab] = useState(0);
  // « Animations réduites » : le changement d'onglet déclenché par un appui se
  // pose sans ressort (le pan, lui, est de la manipulation directe).
  const reduce = useReduceMotion();
  const tx = useSharedValue(0);
  const startTx = useSharedValue(0);
  // Layouts mesurés des 4 chips (x, largeur) — pour l'indicateur glissant.
  // Longueur fixe : on n'expose l'indicateur que lorsque les 4 sont connus.
  const [chipLayouts, setChipLayouts] = useState<({ x: number; width: number } | undefined)[]>(() =>
    new Array(CARNET_TABS.length).fill(undefined)
  );

  const goTo = (index: number) => {
    setTab(index);
    tx.value = reduce ? -index * width : withSpring(-index * width, motionTokens.spring);
    haptic('tap');
  };

  const maxIndex = CARNET_TABS.length - 1;

  // Décision de fin de swipe sur le thread JS (nextTabIndex n'est pas un
  // worklet) : depuis JS on peut assigner tx.value = withSpring(...) — l'anim
  // se joue bien sur l'UI thread.
  const settleSwipe = useCallback(
    (startValue: number, translationX: number, velocityX: number) => {
      const current = Math.round(-startValue / width);
      const target = nextTabIndex(current, translationX, velocityX, width);
      tx.value = reduce ? -target * width : withSpring(-target * width, motionTokens.spring);
      setTab(target);
    },
    [tx, width, reduce]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onStart(() => {
          startTx.value = tx.value;
        })
        .onUpdate((event) => {
          const next = startTx.value + event.translationX;
          // Suit le doigt, borné aux extrémités du pager.
          tx.value = Math.max(-maxIndex * width, Math.min(0, next));
        })
        .onEnd((event) => {
          runOnJS(settleSwipe)(startTx.value, event.translationX, event.velocityX);
        }),
    [tx, startTx, width, maxIndex, settleSwipe]
  );

  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  // Indicateur hairline : glisse ET se redimensionne d'un chip à l'autre au
  // rythme du pan (interpolation sur les layouts mesurés). Masqué tant que les
  // 4 chips ne sont pas mesurés (jamais un trait mal placé). L'interpolation
  // exige un domaine croissant : on inverse (tx va de 0 à -3W).
  const complete = chipLayouts.every((c): c is { x: number; width: number } => c !== undefined);
  const revInput = complete ? CARNET_TABS.map((_, i) => -(maxIndex - i) * width) : [];
  const revXs = complete ? [...chipLayouts].reverse().map((c) => (c as { x: number }).x) : [];
  const revWidths = complete
    ? [...chipLayouts].reverse().map((c) => (c as { width: number }).width)
    : [];
  const indicatorStyle = useAnimatedStyle(() => {
    if (revInput.length !== CARNET_TABS.length) return { opacity: 0 };
    return {
      opacity: 1,
      width: interpolate(tx.value, revInput, revWidths, Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(tx.value, revInput, revXs, Extrapolation.CLAMP) }],
    };
  });

  const onChipLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width: w } = e.nativeEvent.layout;
    setChipLayouts((prev) => {
      const cur = prev[index];
      if (cur && cur.x === x && cur.width === w) return prev;
      const next = [...prev];
      next[index] = { x, width: w };
      return next;
    });
  };

  return (
    <Animated.View style={[styles.root, door]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe nu de 20 pt : hitSlop 12 porte la cible à 44 × 44.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          CARNET
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Onglets Chip + indicateur glissant */}
      <View style={styles.chipRow}>
        {CARNET_TABS.map((t, i) => (
          <View key={t} onLayout={onChipLayout(i)} style={styles.chipSlot}>
            <Chip label={CARNET_TAB_LABELS[t]} active={tab === i} onPress={() => goTo(i)} />
          </View>
        ))}
        <Animated.View style={[styles.indicator, indicatorStyle]} />
      </View>

      {/* Pager gestuel : 4 panneaux côte à côte */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.pager, { width: width * CARNET_TABS.length }, pagerStyle]}>
          {/* Les 4 panneaux vivent côte à côte, sans clipping : seuls ceux hors
              écran sont retirés aux lecteurs d'écran, sinon VoiceOver traverse
              les 4 onglets d'affilée, sans frontière. */}
          {CARNET_TABS.map((t, i) => (
            <View
              key={t}
              style={[styles.page, { width }]}
              accessibilityElementsHidden={i !== tab}
              importantForAccessibility={i !== tab ? 'no-hide-descendants' : 'auto'}
            >
              <Panel tab={t} carnet={carnet} bottomInset={tabBarSpace(insets.bottom)} />
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Panneau d'onglet
// ---------------------------------------------------------------------------

function Panel({
  tab,
  carnet,
  bottomInset,
}: {
  tab: CarnetTab;
  carnet: Carnet;
  bottomInset: number;
}) {
  if (carnet.status === 'loading') {
    return (
      <View style={styles.panelContent}>
        <StateView state="loading" shape="list" />
      </View>
    );
  }
  if (carnet.status === 'error') {
    return (
      <View style={styles.panelCentered}>
        <StateView
          state="error"
          errorMessage="Votre carnet n'a pas pu se charger."
          onRetry={carnet.reload}
        />
      </View>
    );
  }
  if (tab === 'notes') return <NotesPanel carnet={carnet} bottomInset={bottomInset} />;
  if (tab === 'intentions') return <IntentionsPanel carnet={carnet} bottomInset={bottomInset} />;
  if (tab === 'objectifs') return <ObjectifsPanel carnet={carnet} bottomInset={bottomInset} />;
  return <ProgrammePanel carnet={carnet} bottomInset={bottomInset} />;
}

// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------

function NotesPanel({ carnet, bottomInset }: { carnet: Carnet; bottomInset: number }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (saving || draft.trim().length === 0) return;
    setSaving(true);
    const ok = await carnet.addNote(draft);
    setSaving(false);
    if (ok) setDraft('');
  };

  const disabled = saving || draft.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.panelFill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.panelFill}>
        <FlashList
          data={carnet.notes}
          keyExtractor={(item) => item.note.id}
          estimatedItemSize={140}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: space.xl,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <StateView
              state="empty"
              emptyMessage="Aucune note. La première s'écrit ci-dessous, quand vous le souhaitez."
              style={styles.emptyBlock}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={staggerEntering(index)}>
              <NoteCard item={item} onToggleShare={carnet.toggleNoteShared} />
            </Animated.View>
          )}
        />
      </View>

      {/* Composer bas — le pilote écrit son texte ; l'app ne suggère jamais. */}
      <View style={[styles.composer, { paddingBottom: bottomInset + space.sm }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={5000}
          placeholder="Écrivez ici, si vous le souhaitez."
          placeholderTextColor={colors.text.dim}
          selectionColor={colors.accent}
          style={styles.composerInput}
          accessibilityLabel="Votre note"
        />
        <PressScale
          onPress={onSave}
          disabled={disabled}
          accessibilityLabel="Enregistrer la note"
          accessibilityState={{ disabled }}
          containerStyle={styles.composerBtnContainer}
          style={[styles.composerBtn, disabled && styles.composerBtnDisabled]}
        >
          <Text style={styles.composerBtnLabel}>{saving ? 'ENVOI' : 'ENREGISTRER'}</Text>
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

function NoteCard({
  item,
  onToggleShare,
}: {
  item: CarnetNoteItem;
  onToggleShare: Carnet['toggleNoteShared'];
}) {
  const { note, weather } = item;
  return (
    <View style={styles.noteCard}>
      <View style={styles.noteHeadRow}>
        <Text style={styles.noteDate}>{longDate(note.createdAt)}</Text>
        {weather !== null ? (
          <View style={styles.noteWeather}>
            <OxvIcon name="meteo-piste" size={14} color={colors.text.low} />
            <Text style={styles.noteWeatherText} numberOfLines={1}>
              {`${weather.tempC}°${weather.label ? ` · ${weather.label}` : ''}`}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.noteBody}>{note.body}</Text>
      <View style={styles.shareRow}>
        <Text style={styles.shareLabel}>Partagée avec le coach</Text>
        <Switch
          value={note.sharedWithCoach}
          onValueChange={(v) => {
            haptic(v ? 'tap' : 'warn');
            void onToggleShare(note.id, v);
          }}
          // Piste NEUTRE (jamais l'accent rouge) : un consentement n'est pas une
          // alerte, et une liste de bascules rouges banaliserait l'accent unique.
          trackColor={{ false: colors.bg.card2, true: colors.text.mid }}
          thumbColor={colors.text.hi}
          ios_backgroundColor={colors.bg.card2}
          accessibilityLabel="Partager cette note avec le coach"
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// INTENTIONS
// ---------------------------------------------------------------------------

function IntentionsPanel({ carnet, bottomInset }: { carnet: Carnet; bottomInset: number }) {
  return (
    <View style={styles.panelFill}>
      <FlashList
        data={carnet.intentions}
        keyExtractor={(item) => item.intention.id}
        estimatedItemSize={104}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: bottomInset + space.xl,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <StateView
            state="empty"
            emptyMessage="Aucune intention posée. Elles se posent avant la séance."
            style={styles.emptyBlock}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={staggerEntering(index)}>
            <IntentionCard item={item} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function IntentionCard({ item }: { item: CarnetIntentionItem }) {
  const state = intentionState(item.intention.sessionId);
  const honored = state === 'honored';
  return (
    <View style={styles.intentionCard}>
      <View style={styles.intentionGlyph}>
        <CircuitGlyph />
      </View>
      <View style={styles.intentionBody}>
        <Text style={[styles.intentionText, !honored && styles.intentionTextPending]}>
          {item.intention.body}
        </Text>
        <View style={styles.intentionMetaRow}>
          <View style={[styles.intentionDot, honored ? styles.dotHonored : styles.dotPending]} />
          <Text style={styles.intentionMeta} numberOfLines={1}>
            {intentionStateLabel(state)}
            {item.circuitName ? ` · ${item.circuitName}` : ''}
            {honored && item.sessionStartedAt
              ? ` · ${dayMonth(item.sessionStartedAt)}`
              : ` · posée le ${dayMonth(item.intention.createdAt)}`}
          </Text>
        </View>
      </View>
      {honored && item.intention.sessionId ? (
        <PressScale
          onPress={() => router.push(`/(app2)/bilan/${item.intention.sessionId}` as never)}
          accessibilityLabel="Ouvrir la séance liée"
          // Chevron de 16 pt : hitSlop 14 porte la cible à 44 × 44.
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Chevron />
        </PressScale>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// OBJECTIFS
// ---------------------------------------------------------------------------

function ObjectifsPanel({ carnet, bottomInset }: { carnet: Carnet; bottomInset: number }) {
  return (
    <View style={styles.panelFill}>
      <FlashList
        data={carnet.goals}
        keyExtractor={(item) => item.id}
        estimatedItemSize={96}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: bottomInset + space.xl,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.objectifsMention}>
            Vos objectifs personnels. Votre coach ne les voit pas.
          </Text>
        }
        ListEmptyComponent={
          <StateView
            state="empty"
            emptyMessage="Aucun objectif pour l'instant."
            style={styles.emptyBlock}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={staggerEntering(index)}>
            <GoalCard goal={item} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function GoalCard({ goal }: { goal: PilotGoal }) {
  // Barre hairline UNIQUEMENT si l'objectif porte une mesure réelle. Le schéma
  // pilot_goals n'en porte pas → progress = null → aucune barre (jamais inventée).
  const progress = goalProgress(goal as { current?: number | null; target?: number | null });
  return (
    <View style={styles.goalCard}>
      <Text style={styles.goalBody}>{goal.body}</Text>
      <Text style={styles.goalStatus}>{goalStatusLabel(goal.status)}</Text>
      {progress !== null ? (
        <View style={styles.goalBarTrack}>
          <View style={[styles.goalBarFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PROGRAMME (cycles partagés par le coach — espace prescriptif autorisé)
// ---------------------------------------------------------------------------

function ProgrammePanel({ carnet, bottomInset }: { carnet: Carnet; bottomInset: number }) {
  return (
    <View style={styles.panelFill}>
      <FlashList
        data={carnet.cycles}
        keyExtractor={(item) => item.id}
        estimatedItemSize={180}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: bottomInset + space.xl,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <StateView
            state="empty"
            emptyMessage="Aucun programme partagé par votre coach."
            style={styles.emptyBlock}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={staggerEntering(index)}>
            <CycleCard cycle={item} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function CycleCard({ cycle }: { cycle: SharedCycle }) {
  return (
    <View style={styles.cycleCard}>
      <View style={styles.coachBadge}>
        <OxvIcon name="insigne" size={13} color={colors.text.mid} />
        <Text style={styles.coachBadgeText}>PROGRAMME COACH</Text>
      </View>
      <Text style={styles.cycleTitle}>{cycle.title}</Text>
      {cycle.intention ? <Text style={styles.cycleIntention}>{cycle.intention}</Text> : null}
      {cycle.steps.length > 0 ? (
        <View style={styles.stepList}>
          {cycle.steps.map((step, i) => (
            <View key={step.id} style={styles.stepRow}>
              <Text style={styles.stepIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepFocus}>{step.focus}</Text>
                {step.note ? <Text style={styles.stepNote}>{step.note}</Text> : null}
              </View>
              <Text style={styles.stepState}>
                {step.status === 'atteint' ? 'Atteint' : 'En cours'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glyphes
// ---------------------------------------------------------------------------

/** Mini-tracé décoratif (motif de circuit générique, jamais une donnée réelle). */
function CircuitGlyph() {
  return (
    <Canvas
      style={styles.circuitGlyphCanvas}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <GlowStroke path={EMPTY_CIRCUIT_PATH} strokeWidth={2} />
    </Canvas>
  );
}

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9 5 L15.5 12 L9 19"
        stroke={colors.text.dim}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  // Onglets
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.sm,
  },
  chipSlot: {},
  indicator: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },

  // Pager
  pager: { flex: 1, flexDirection: 'row' },
  page: { height: '100%' },
  panelFill: { flex: 1 },
  panelContent: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  panelCentered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  emptyBlock: { marginTop: space.xxl },

  // Notes
  noteCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  noteHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  noteDate: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  noteWeather: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  noteWeatherText: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.low,
    flexShrink: 1,
  },
  noteBody: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.sm,
  },
  shareLabel: { fontFamily: typo.body, fontSize: 13, color: colors.text.mid },

  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.sm,
  },
  composerInput: {
    minHeight: 60,
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
    textAlignVertical: 'top',
  },
  composerBtnContainer: { alignSelf: 'flex-end' },
  composerBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  composerBtnDisabled: { borderColor: colors.border.strong },
  composerBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },

  // Intentions
  intentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
  },
  intentionGlyph: {
    width: 52,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitGlyphCanvas: { width: 52, height: 30 },
  intentionBody: { flex: 1, gap: space.xs },
  intentionText: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.hi,
  },
  intentionTextPending: { color: colors.text.mid },
  intentionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intentionDot: { width: 6, height: 6, borderRadius: 3 },
  dotHonored: { backgroundColor: colors.text.mid },
  dotPending: { backgroundColor: colors.text.dim },
  intentionMeta: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.low,
  },

  // Objectifs
  objectifsMention: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.dim,
    marginBottom: space.md,
  },
  goalCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  goalBody: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
  },
  goalStatus: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  goalBarTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.border.card,
    overflow: 'hidden',
  },
  goalBarFill: { height: 3, borderRadius: radius.pill, backgroundColor: colors.accent },

  // Programme
  cycleCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  coachBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coachBadgeText: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.mid,
  },
  cycleTitle: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
  },
  cycleIntention: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
  stepList: { marginTop: space.xs, gap: space.md },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stepIndex: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.dim,
    paddingTop: 1,
  },
  stepBody: { flex: 1, gap: 2 },
  stepFocus: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
  stepNote: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },
  stepState: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.low,
    paddingTop: 1,
  },
});
