/**
 * COACHING — sous-écran du CLUB (app2), lot V2-L5 écran 2/7.
 *
 * Trois onglets (Chip + swipe horizontal) : Trouver · Mon coach · Demandes.
 *  - Trouver : cartes coach (HeroPhoto, spécialités) → Sheet fiche (bio, avis en
 *    CITATIONS — ZÉRO note étoilée, ZÉRO score : doctrine —, créneaux, demande de
 *    séance).
 *  - Mon coach : binôme + consentements granulaires (switches NEUTRES, révocation
 *    immédiate), factures (flag `coach_billing` fail-closed, lien externe), fin de
 *    binôme (Sheet de confirmation sobre).
 *  - Demandes : timeline d'états + avis post-séance en TEXTE LIBRE (pas d'étoiles).
 *
 * Données réelles uniquement (`useCoaching`), vouvoiement, aucun emoji, jamais
 * prescriptif.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/useAuthStore';
import {
  availabilityStatusLabel,
  bookingStatusLabel,
  type CoachAvailabilitySlot,
  type MyBooking,
} from '@/services/coachMarketplaceService';
import {
  COACH_ACCESS_LEVELS,
  COACH_COMPARAISON_PHRASE,
  type MyCoachAssignment,
} from '@/services/pilotConsentService';
import { formatInvoiceAmount, type MyCoachInvoice } from '@/services/pilotCoachBillingService';
import {
  Chip,
  colors,
  HeroPhoto,
  haptic,
  OxvIcon,
  Photo,
  PressScale,
  radius,
  ReportLink,
  SectionHeader,
  Sheet,
  Shimmer,
  space,
  Stagger,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import {
  bookingIsPast,
  bookingTimelineStep,
  clampTabIndex,
  COACHING_TABS,
  tabKeyFromIndex,
  type CoachCardVM,
} from '@/features/club/coachingLogic';
import { useCoaching, type CoachFiche } from '@/features/club/useCoaching';

/** Course horizontale (px) au-delà de laquelle le swipe change d'onglet. */
const SWIPE_THRESHOLD = 56;

type SheetState =
  | { kind: 'fiche'; coachId: string }
  | { kind: 'end'; assignment: MyCoachAssignment }
  | { kind: 'review'; booking: MyBooking }
  | null;

export default function CoachingScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const coaching = useCoaching();

  const [tabIndex, setTabIndex] = useState(0);
  const tab = tabKeyFromIndex(tabIndex);
  const [sheet, setSheet] = useState<SheetState>(null);

  const goTab = useCallback((next: number) => {
    setTabIndex(clampTabIndex(next));
  }, []);

  // Swipe horizontal entre onglets — le scroll vertical des listes reste natif
  // (activeOffsetX + failOffsetY, patron du bandeau rituel L1).
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((e) => {
          'worklet';
          if (e.translationX <= -SWIPE_THRESHOLD) runOnJS(goTab)(tabIndex + 1);
          else if (e.translationX >= SWIPE_THRESHOLD) runOnJS(goTab)(tabIndex - 1);
        }),
    [goTab, tabIndex]
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top }, door]}>
      {/* En-tête compact avec retour vers le hub. */}
      <View style={styles.header}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour au club"
          // backBtn fait 32 × 32 : hitSlop 6 pour atteindre la cible de 44 pt.
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={styles.backBtn}
        >
          <Text style={styles.backChevron}>‹</Text>
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          COACHING
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Onglets Chip. */}
      <View style={styles.tabsRow} accessibilityRole="tablist">
        {COACHING_TABS.map((t, i) => (
          <Chip
            key={t.key}
            label={t.label}
            active={tab === t.key}
            onPress={() => goTab(i)}
            style={styles.tabChip}
          />
        ))}
      </View>

      <GestureDetector gesture={swipe}>
        <View style={styles.body}>
          {tab === 'trouver' ? (
            <TrouverTab
              coaching={coaching}
              bottomInset={tabBarSpace(insets.bottom)}
              onOpen={(coachId) => setSheet({ kind: 'fiche', coachId })}
            />
          ) : tab === 'mon-coach' ? (
            <MonCoachTab
              coaching={coaching}
              bottomInset={tabBarSpace(insets.bottom)}
              onEnd={(assignment) => setSheet({ kind: 'end', assignment })}
            />
          ) : (
            <DemandesTab
              coaching={coaching}
              bottomInset={tabBarSpace(insets.bottom)}
              onReview={(booking) => setSheet({ kind: 'review', booking })}
            />
          )}
        </View>
      </GestureDetector>

      {/* Sheets — une seule ouverte à la fois. */}
      <Sheet visible={sheet?.kind === 'fiche'} onClose={closeSheet} snapHeight={620}>
        {sheet?.kind === 'fiche' ? (
          <FicheSheet
            coachId={sheet.coachId}
            loadFiche={coaching.loadFiche}
            onSubmit={coaching.submitBooking}
            pilotFirstName={profile?.first_name ?? null}
            onDone={closeSheet}
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.kind === 'end'} onClose={closeSheet} snapHeight={300}>
        {sheet?.kind === 'end' ? (
          <EndBinomeSheet
            assignment={sheet.assignment}
            onConfirm={coaching.endBinome}
            onDone={closeSheet}
          />
        ) : null}
      </Sheet>

      <Sheet visible={sheet?.kind === 'review'} onClose={closeSheet} snapHeight={420}>
        {sheet?.kind === 'review' ? (
          <ReviewSheet
            booking={sheet.booking}
            pilotFirstName={profile?.first_name ?? null}
            onSubmit={coaching.submitReview}
            onDone={closeSheet}
          />
        ) : null}
      </Sheet>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Onglet Trouver — FlashList de cartes coach
// ---------------------------------------------------------------------------

function TrouverTab({
  coaching,
  bottomInset,
  onOpen,
}: {
  coaching: ReturnType<typeof useCoaching>;
  bottomInset: number;
  onOpen: (coachId: string) => void;
}) {
  if (coaching.status === 'loading') return <ListSkeleton />;
  if (coaching.status === 'error') {
    return (
      <StateView
        state="error"
        errorMessage="Les coachs n'ont pas pu se charger."
        onRetry={coaching.refresh}
        style={styles.stateFill}
      />
    );
  }
  if (coaching.coaches.length === 0) {
    return (
      <StateView
        state="empty"
        emptyMessage="Les coachs apparaîtront ici dès qu'ils ouvriront leur fiche."
        style={styles.stateFill}
      />
    );
  }
  return (
    <FlashList
      data={coaching.coaches}
      keyExtractor={(c) => c.coachId}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + space.xl }}
      renderItem={({ item, index }) => (
        <CoachCard card={item} index={index} onPress={() => onOpen(item.coachId)} />
      )}
    />
  );
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const m = parts.map((p) => p.charAt(0).toUpperCase()).join('');
  return m || 'OXV';
}

function CoachCard({
  card,
  index,
  onPress,
}: {
  card: CoachCardVM;
  index: number;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      // Le label explicite EFFACE la lecture des enfants : on y remet ce que la
      // carte affiche (le « Voir la fiche » est déjà porté par le rôle bouton).
      accessibilityLabel={[
        card.name,
        card.specialties.slice(0, 3).join(', '),
        card.circuitsLabel,
        card.sessionPriceLabel,
      ]
        .filter(Boolean)
        .join(', ')}
      containerStyle={index > 0 ? styles.cardGap : undefined}
      style={styles.coachCard}
    >
      <HeroPhoto
        uri={card.photoUrl ?? undefined}
        height={130}
        fallback={
          <View style={styles.heroFallback}>
            <Text style={styles.heroMono}>{monogram(card.name)}</Text>
          </View>
        }
      />
      <View style={styles.coachCardBody}>
        <Text style={styles.coachName} numberOfLines={1}>
          {card.name}
        </Text>
        {card.specialties.length > 0 ? (
          <View style={styles.chipsWrap}>
            {card.specialties.slice(0, 3).map((s) => (
              <View key={s} style={styles.specChip}>
                <Text style={styles.specChipLabel} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.coachMetaRow}>
          {card.circuitsLabel ? (
            <Text style={styles.coachMeta} numberOfLines={1}>
              {card.circuitsLabel}
            </Text>
          ) : (
            <View />
          )}
          {card.sessionPriceLabel ? (
            <Text style={styles.coachPrice}>{card.sessionPriceLabel}</Text>
          ) : null}
        </View>
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Onglet Mon coach — binômes, consentements, factures, fin de binôme
// ---------------------------------------------------------------------------

function MonCoachTab({
  coaching,
  bottomInset,
  onEnd,
}: {
  coaching: ReturnType<typeof useCoaching>;
  bottomInset: number;
  onEnd: (assignment: MyCoachAssignment) => void;
}) {
  if (coaching.status === 'loading') return <ListSkeleton />;
  if (coaching.assignments.length === 0) {
    return (
      <StateView
        state="empty"
        emptyMessage="Aucun binôme pour l'instant. Un coach vous proposera un accès depuis l'onglet Trouver."
        style={styles.stateFill}
      />
    );
  }
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + space.xl }}
    >
      <Stagger step={45} initialDelay={45}>
        {coaching.assignments.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onConsent={coaching.setConsent}
            onLive={coaching.setLive}
            onEnd={() => onEnd(a)}
          />
        ))}
        {/* Factures — regroupées, uniquement si le flag coach_billing est ON
            (fail-closed). L'invoice ne porte pas le coach_id : on ne tente pas
            un rattachement fragile par nom, on les présente ensemble. */}
        {coaching.billingEnabled && coaching.invoices.length > 0 ? (
          <View style={styles.assignCard}>
            <InvoicesList invoices={coaching.invoices} />
          </View>
        ) : null}
      </Stagger>
    </ScrollView>
  );
}

function AssignmentCard({
  assignment,
  onConsent,
  onLive,
  onEnd,
}: {
  assignment: MyCoachAssignment;
  onConsent: (id: string, on: boolean) => Promise<{ ok: boolean; error?: string }>;
  onLive: (id: string, on: boolean) => Promise<{ ok: boolean; error?: string }>;
  onEnd: () => void;
}) {
  const consented = assignment.pilotConsentAt !== null;
  const live = assignment.liveSharingAt !== null;
  const name = [assignment.coachFirstName, assignment.coachLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const levelHint = COACH_ACCESS_LEVELS.find((l) => l.value === assignment.level)?.hint ?? null;

  return (
    <View style={styles.assignCard}>
      <View style={styles.cardRow}>
        <View style={styles.assignIcon}>
          <OxvIcon name="casque" size={20} color={colors.text.mid} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {name || 'Votre coach'}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {consented ? 'Accès accordé' : 'Accès en attente de votre accord'}
          </Text>
        </View>
      </View>

      {/* Consentements granulaires — couleur NEUTRE (jamais l'accent). */}
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Accès à vos séances</Text>
          {levelHint ? <Text style={styles.switchHint}>{levelHint}</Text> : null}
          {/* Ce que l'accès permet AUSSI — dit, pas deviné (jalon 6, phase 5). */}
          <Text style={styles.switchHint}>{COACH_COMPARAISON_PHRASE}</Text>
        </View>
        <Switch
          value={consented}
          // Le texte visible est un élément séparé : sans libellé, les deux
          // interrupteurs de consentement s'annoncent à l'identique.
          accessibilityLabel="Accès à vos séances"
          accessibilityHint={levelHint ?? undefined}
          onValueChange={(next) => {
            haptic('tap');
            void onConsent(assignment.id, next);
          }}
          trackColor={{ false: colors.border.card, true: colors.border.strong }}
          thumbColor={colors.text.hi}
          ios_backgroundColor={colors.border.card}
        />
      </View>

      <View style={[styles.switchRow, styles.switchRowDivider]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>Partage en direct</Text>
          <Text style={styles.switchHint}>
            Votre télémétrie et votre position en temps réel, pendant que vous roulez. Coupé
            immédiatement dès que vous le retirez.
          </Text>
        </View>
        <Switch
          value={live}
          disabled={!consented}
          accessibilityLabel="Partage en direct"
          accessibilityHint="Votre télémétrie et votre position en temps réel, pendant que vous roulez."
          onValueChange={(next) => {
            haptic('tap');
            void onLive(assignment.id, next);
          }}
          trackColor={{ false: colors.border.card, true: colors.border.strong }}
          thumbColor={consented ? colors.text.hi : colors.text.dim}
          ios_backgroundColor={colors.border.card}
        />
      </View>

      <PressScale
        onPress={onEnd}
        accessibilityLabel="Mettre fin au binôme"
        containerStyle={styles.endBtnContainer}
        style={styles.endBtn}
      >
        <Text style={styles.endBtnLabel}>Mettre fin au binôme</Text>
      </PressScale>
    </View>
  );
}

function InvoicesList({ invoices }: { invoices: MyCoachInvoice[] }) {
  if (invoices.length === 0) return null;
  return (
    <View style={styles.invoiceBlock}>
      <Text style={styles.invoiceEyebrow}>FACTURES</Text>
      {invoices.map((inv) => {
        const canPay = !inv.settled && inv.paymentLink !== null;
        return (
          <View key={inv.id} style={styles.invoiceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumber} numberOfLines={1}>
                {inv.number}
              </Text>
              <Text style={styles.invoiceMeta} numberOfLines={1}>
                {formatInvoiceAmount(inv.amountTotalCents, inv.currency)}
                {inv.settled ? ' · Réglée' : ''}
              </Text>
            </View>
            {canPay ? (
              <PressScale
                onPress={() =>
                  void Linking.openURL(inv.paymentLink as string).catch(() => undefined)
                }
                accessibilityLabel={`Régler la facture ${inv.number}`}
                style={styles.payBtn}
              >
                <Text style={styles.payBtnLabel}>Régler</Text>
              </PressScale>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onglet Demandes — timeline + avis post-séance
// ---------------------------------------------------------------------------

function DemandesTab({
  coaching,
  bottomInset,
  onReview,
}: {
  coaching: ReturnType<typeof useCoaching>;
  bottomInset: number;
  onReview: (booking: MyBooking) => void;
}) {
  if (coaching.status === 'loading') return <ListSkeleton />;
  if (coaching.bookings.length === 0) {
    return (
      <StateView
        state="empty"
        emptyMessage="Vos demandes de séance apparaîtront ici."
        style={styles.stateFill}
      />
    );
  }
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + space.xl }}
    >
      <Stagger step={40} initialDelay={40}>
        {coaching.bookings.map((b) => (
          <BookingRow
            key={b.id}
            booking={b}
            onCancel={() => void coaching.cancelRequest(b.id)}
            onReview={() => onReview(b)}
          />
        ))}
      </Stagger>
    </ScrollView>
  );
}

function BookingRow({
  booking,
  onCancel,
  onReview,
}: {
  booking: MyBooking;
  onCancel: () => void;
  onReview: () => void;
}) {
  const step = bookingTimelineStep(booking.status);
  const dotColor = step === 'acceptee' || step === 'passee' ? colors.text.hi : colors.text.dim;
  const coachName = booking.coach?.headline ?? 'Coach OXV';
  const canCancel = booking.status === 'pending';
  const canReview = bookingIsPast(booking.status);

  return (
    <View style={styles.bookingRow}>
      <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {coachName}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {bookingStatusLabel(booking.status)}
          {booking.circuitName ? ` · ${booking.circuitName}` : ''}
        </Text>
        {booking.message ? (
          <Text style={styles.bookingMessage} numberOfLines={2}>
            {booking.message}
          </Text>
        ) : null}
        {canCancel || canReview ? (
          <View style={styles.bookingActions}>
            {canCancel ? (
              <PressScale
                onPress={onCancel}
                accessibilityLabel="Annuler la demande"
                // smallBtn fait 38 pt de haut : hitSlop 4 pour atteindre 44.
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.smallBtn, styles.smallBtnGhost]}
              >
                <Text style={styles.smallBtnGhostLabel}>Annuler</Text>
              </PressScale>
            ) : null}
            {canReview ? (
              <PressScale
                onPress={onReview}
                accessibilityLabel="Laisser un avis"
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.smallBtn, styles.smallBtnGhost]}
              >
                <Text style={styles.smallBtnGhostLabel}>Laisser un avis</Text>
              </PressScale>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheet — fiche coach + demande de séance
// ---------------------------------------------------------------------------

function FicheSheet({
  coachId,
  loadFiche,
  onSubmit,
  pilotFirstName,
  onDone,
}: {
  coachId: string;
  loadFiche: (id: string) => Promise<CoachFiche | null>;
  onSubmit: (input: {
    coachId: string;
    availabilityId?: string | null;
    requestedStartsAt?: string | null;
    circuitName?: string | null;
    message?: string | null;
    pilotFirstName?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  pilotFirstName: string | null;
  onDone: () => void;
}) {
  const [fiche, setFiche] = useState<CoachFiche | null | 'missing'>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Chargement au montage du contenu de la sheet.
  useEffect(() => {
    let alive = true;
    setFiche(null);
    void loadFiche(coachId).then((f) => {
      if (alive) setFiche(f ?? 'missing');
    });
    return () => {
      alive = false;
    };
  }, [coachId, loadFiche]);

  if (fiche === null) return <FicheSkeleton />;
  if (fiche === 'missing') {
    return (
      <View style={styles.sheetPad}>
        <StateView state="empty" emptyMessage="Cette fiche n'est plus disponible." />
      </View>
    );
  }

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const slot = fiche.availability.find((s) => s.id === selectedSlot) ?? null;
    const res = await onSubmit({
      coachId,
      availabilityId: slot?.id ?? null,
      requestedStartsAt: slot?.startsAt ?? null,
      circuitName: slot?.circuitName ?? null,
      message: message.trim() || null,
      pilotFirstName,
    });
    setBusy(false);
    if (res.ok) {
      haptic('tap');
      setSent(true);
      setTimeout(onDone, 900);
    } else {
      setError(res.error ?? "La demande n'a pas pu être envoyée.");
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
      {fiche.photoUrl ? (
        <Photo uri={fiche.photoUrl} style={styles.ficheHero} accessibilityLabel={fiche.name} />
      ) : (
        <View style={[styles.ficheHero, styles.heroFallback]}>
          <Text style={styles.heroMono}>{monogram(fiche.name)}</Text>
        </View>
      )}
      <Text style={styles.ficheName}>{fiche.name}</Text>

      {fiche.specialties.length > 0 ? (
        <View style={styles.chipsWrap}>
          {fiche.specialties.map((s) => (
            <View key={s} style={styles.specChip}>
              <Text style={styles.specChipLabel}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {fiche.bio ? <Text style={styles.ficheBio}>{fiche.bio}</Text> : null}

      {/* Avis EN CITATIONS — jamais de note moyenne étoilée (doctrine). */}
      {fiche.citations.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader eyebrow="AVIS" title="Ce qu'ils en disent" />
          {fiche.citations.map((c) => (
            <View key={c.id} style={styles.citation}>
              <Text style={styles.citationQuote}>« {c.quote} »</Text>
              <View style={styles.citationPied}>
                <Text style={styles.citationAuthor}>{c.author}</Text>
                {/*
                  Ces citations sont écrites PAR DES PILOTES : c'est du contenu
                  d'utilisateur, et il doit pouvoir être signalé depuis l'endroit
                  où il se lit. `c.id` est bien l'identifiant de la ligne
                  `coach_testimonials` — c'est ce que le trigger
                  `moderation_validate_target` vérifie pour `coach_review`.
                */}
                <ReportLink
                  targetType="coach_review"
                  targetId={c.id}
                  accessibilityLabel={`Signaler l'avis de ${c.author}`}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Créneaux de disponibilité — sélection facultative. */}
      {fiche.availability.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader eyebrow="DISPONIBILITÉS" title="Choisir un créneau" />
          {fiche.availability.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              selected={selectedSlot === slot.id}
              onPress={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
            />
          ))}
        </View>
      ) : null}

      {/* Demande de séance. */}
      <View style={styles.section}>
        <SectionHeader eyebrow="DEMANDE" title="Vos attentes" />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Ce que vous aimeriez travailler, votre niveau, vos disponibilités…"
          placeholderTextColor={colors.text.dim}
          multiline
          style={styles.textArea}
          accessibilityLabel="Vos attentes"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <PressScale
        onPress={submit}
        // Le bouton PREND déjà le style éteint et `submit` sort en early-return :
        // `disabled` ne change rien au comportement, il rend l'état AUDIBLE.
        disabled={busy || sent}
        accessibilityLabel="Demander une session"
        style={[styles.primaryBtn, (busy || sent) && styles.primaryBtnDim]}
      >
        <Text style={styles.primaryBtnLabel}>
          {sent ? 'Demande envoyée' : busy ? 'Envoi…' : 'DEMANDER UNE SESSION'}
        </Text>
      </PressScale>
    </ScrollView>
  );
}

function SlotRow({
  slot,
  selected,
  onPress,
}: {
  slot: CoachAvailabilitySlot;
  selected: boolean;
  onPress: () => void;
}) {
  const when = slotWhenLabel(slot.startsAt);
  return (
    <PressScale
      onPress={onPress}
      // Vrai bouton radio à l'écran : l'état retenu n'existait que visuellement.
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${slot.circuitName}, ${when}, ${availabilityStatusLabel(
        slot.status as 'open' | 'full' | 'closed' | 'cancelled'
      )}`}
      style={[styles.slotRow, selected && styles.slotRowActive]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.slotCircuit} numberOfLines={1}>
          {slot.circuitName}
        </Text>
        <Text style={styles.slotWhen} numberOfLines={1}>
          {when} ·{' '}
          {availabilityStatusLabel(slot.status as 'open' | 'full' | 'closed' | 'cancelled')}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioActive]} />
    </PressScale>
  );
}

/** « sam. 19 juil. · 09:00 » — locale-free minimal (affichage créneau). */
function slotWhenLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?/.exec(iso);
  if (!m) return iso;
  const months = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ];
  const day = Number(m[3]);
  const mon = months[Number(m[2]) - 1] ?? '';
  const time = m[4] && m[5] ? ` · ${m[4]}:${m[5]}` : '';
  return `${day} ${mon}${time}`;
}

// ---------------------------------------------------------------------------
// Sheet — fin de binôme
// ---------------------------------------------------------------------------

function EndBinomeSheet({
  assignment,
  onConfirm,
  onDone,
}: {
  assignment: MyCoachAssignment;
  onConfirm: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const name = [assignment.coachFirstName, assignment.coachLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return (
    <View style={styles.sheetPad}>
      <Text style={styles.confirmTitle}>Mettre fin au binôme</Text>
      <Text style={styles.confirmBody}>
        {name || 'Votre coach'} cessera immédiatement de voir vos données. Vous pourrez consentir à
        nouveau à tout moment.
      </Text>
      <PressScale
        onPress={async () => {
          if (busy) return;
          setBusy(true);
          const res = await onConfirm(assignment.id);
          setBusy(false);
          if (res.ok) {
            haptic('tap');
            onDone();
          }
        }}
        disabled={busy}
        accessibilityLabel="Confirmer la fin du binôme"
        style={[styles.primaryBtn, busy && styles.primaryBtnDim]}
      >
        <Text style={styles.primaryBtnLabel}>{busy ? '…' : 'Confirmer'}</Text>
      </PressScale>
      <PressScale onPress={onDone} accessibilityLabel="Annuler" style={styles.secondaryBtn}>
        <Text style={styles.secondaryBtnLabel}>Annuler</Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheet — avis post-séance (texte libre, PAS d'étoiles)
// ---------------------------------------------------------------------------

function ReviewSheet({
  booking,
  pilotFirstName,
  onSubmit,
  onDone,
}: {
  booking: MyBooking;
  pilotFirstName: string | null;
  onSubmit: (input: {
    coachId: string;
    bookingId?: string | null;
    comment: string;
    pilotFirstName?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const comment = text.trim();
    if (!comment || busy) return;
    setBusy(true);
    setError(null);
    const res = await onSubmit({
      coachId: booking.coachId,
      bookingId: booking.id,
      comment,
      pilotFirstName,
    });
    setBusy(false);
    if (res.ok) {
      haptic('tap');
      onDone();
    } else {
      setError(res.error ?? "L'avis n'a pas pu être enregistré.");
    }
  };

  return (
    <View style={styles.sheetPad}>
      <Text style={styles.confirmTitle}>Votre avis</Text>
      <Text style={styles.confirmBody}>
        En quelques mots, ce que cette séance vous a apporté. Votre texte, sans note.
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Ce que vous retenez de cette séance…"
        placeholderTextColor={colors.text.dim}
        multiline
        style={styles.textArea}
        accessibilityLabel="Votre avis"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PressScale
        onPress={submit}
        disabled={busy || text.trim().length === 0}
        accessibilityLabel="Envoyer l'avis"
        style={[styles.primaryBtn, (busy || text.trim().length === 0) && styles.primaryBtnDim]}
      >
        <Text style={styles.primaryBtnLabel}>{busy ? '…' : 'Envoyer'}</Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Squelettes
// ---------------------------------------------------------------------------

function ListSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel="Chargement">
      <Shimmer height={200} width="100%" radius={radius.card} />
      <Shimmer height={200} width="100%" radius={radius.card} />
    </View>
  );
}

function FicheSkeleton() {
  return (
    <View style={styles.sheetPad}>
      <Shimmer height={140} width="100%" radius={radius.card} />
      <Shimmer height={16} width="52%" radius={radius.cell} />
      <Shimmer height={48} width="100%" radius={radius.cell} />
      <Shimmer height={120} width="100%" radius={radius.cell} />
    </View>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontFamily: typo.body, fontSize: 26, color: colors.text.hi, marginTop: -2 },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.text.hi,
  },

  tabsRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  tabChip: {},

  body: { flex: 1, paddingHorizontal: space.xl },
  stateFill: { flex: 1, justifyContent: 'center' },

  // Cartes coach (Trouver)
  cardGap: { marginTop: space.lg },
  coachCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  heroFallback: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card2,
  },
  heroMono: {
    fontFamily: typo.monoSemi,
    fontSize: 30,
    letterSpacing: 2,
    color: colors.text.low,
  },
  coachCardBody: { padding: space.lg, gap: space.sm },
  coachName: {
    fontFamily: typo.display,
    fontSize: 15,
    letterSpacing: 0.4,
    color: colors.text.hi,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  specChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  specChipLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.mid,
  },
  coachMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  coachMeta: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },
  // Prix indicatif : FAIT chiffré en mono neutre. L'or (heritage.gold) reste
  // réservé au Heritage / record / route certifiée (règle tokens v2).
  coachPrice: {
    fontFamily: typo.monoSemi,
    fontSize: 15,
    color: colors.text.hi,
  },

  // Mon coach
  assignCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  assignIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.text.hi },
  cardMeta: { fontFamily: typo.mono, fontSize: 11, letterSpacing: 0.4, color: colors.text.mid },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  switchRowDivider: {
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
  },
  switchLabel: { fontFamily: typo.bodyMedium, fontSize: 14, color: colors.text.hi },
  switchHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: 2,
  },
  endBtnContainer: { marginTop: space.lg },
  endBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
  },
  endBtnLabel: { fontFamily: typo.bodyMedium, fontSize: 13, color: colors.text.mid },

  // Factures
  invoiceBlock: {
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    gap: space.md,
  },
  invoiceEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.text.low,
  },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  invoiceNumber: { fontFamily: typo.bodyMedium, fontSize: 13, color: colors.text.hi },
  invoiceMeta: { fontFamily: typo.mono, fontSize: 11, color: colors.text.mid, marginTop: 2 },
  payBtn: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  payBtnLabel: { fontFamily: typo.mono, fontSize: 12, letterSpacing: 1, color: colors.accent },

  // Demandes
  bookingRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  bookingMessage: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  bookingActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  smallBtn: {
    minHeight: 38,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  smallBtnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
  },
  smallBtnGhostLabel: { fontFamily: typo.bodyMedium, fontSize: 12, color: colors.text.mid },

  // Sheets
  sheetPad: { padding: space.xl, gap: space.md },
  sheetScroll: { padding: space.xl, paddingBottom: space.xxl, gap: space.md },
  ficheHero: {
    width: '100%',
    height: 140,
    borderRadius: radius.card,
    backgroundColor: colors.bg.card2,
  },
  ficheName: { fontFamily: typo.display, fontSize: 18, letterSpacing: 0.4, color: colors.text.hi },
  ficheBio: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
  section: { marginTop: space.md, gap: space.sm },
  citation: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border.strong,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    marginTop: space.sm,
  },
  citationQuote: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
    fontStyle: 'italic',
  },
  citationPied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
    // L'auteur et le lien de signalement sont deux cibles distinctes : l'écart
    // évite que leurs hitSlop se recouvrent.
    gap: space.md,
  },
  citationAuthor: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.low,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.cell,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    marginTop: space.sm,
  },
  slotRowActive: { borderColor: colors.border.strong, backgroundColor: colors.bg.card2 },
  slotCircuit: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.hi },
  slotWhen: { fontFamily: typo.mono, fontSize: 11, color: colors.text.mid, marginTop: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  radioActive: { borderColor: colors.text.hi, backgroundColor: colors.text.hi },
  textArea: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    padding: space.md,
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.hi,
    textAlignVertical: 'top',
  },
  errorText: { fontFamily: typo.body, fontSize: 13, color: colors.accent, marginTop: space.xs },
  primaryBtn: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginTop: space.md,
  },
  primaryBtnDim: { opacity: 0.5 },
  primaryBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  secondaryBtnLabel: { fontFamily: typo.bodyMedium, fontSize: 14, color: colors.text.mid },

  confirmTitle: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.4,
    color: colors.text.hi,
  },
  confirmBody: { fontFamily: typo.body, fontSize: 14, lineHeight: 21, color: colors.text.mid },

  skeleton: { gap: space.lg, paddingTop: space.md },
});
