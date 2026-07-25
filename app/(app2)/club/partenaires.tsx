/**
 * PARTENAIRES — porte CLUB, écran 5/7 du lot V2-L5 (Mission B).
 * Route `club/partenaires`.
 *
 * FlashList de cartes partenaire (HeroPhoto du visuel, repli monogramme,
 * chip de catégorie, résumé d'offre publiée) → Sheet fiche : visuel,
 * description, offres, puis « ÊTRE MIS EN RELATION » (accent) qui exige un
 * CONSENTEMENT EXPLICITE en une phrase avant `requestPartnerContact`.
 *
 * GARDE-FOU v1 CONSERVÉ : la mise en relation transmet UNIQUEMENT les
 * coordonnées du pilote — JAMAIS de donnée de pilotage (phrase de
 * consentement mot pour mot, `partenairesLogic.PARTNER_CONSENT_SENTENCE`).
 * Catalogue vide en prod → StateView empty « Les offres arrivent ».
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { MarketplacePartner } from '@/services/partnerService';
import {
  Chip,
  colors,
  HeroPhoto,
  OxvIcon,
  PressScale,
  radius,
  Sheet,
  space,
  staggerEntering,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import {
  offerSummaryLabel,
  PARTNER_CONSENT_SENTENCE,
  partnerCategoryLabel,
  partnerMonogram,
  type PartnerCardVM,
} from '@/features/club/partenairesLogic';
import { useClubPartenaires } from '@/features/club/useClubPartenaires';

export default function ClubPartenairesScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const partenaires = useClubPartenaires();
  const [openId, setOpenId] = useState<string | null>(null);

  const selected = partenaires.partners.find((p) => p.id === openId) ?? null;
  const bottomInset = tabBarSpace(insets.bottom);

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe de 20 pt : hitSlop 12 pour atteindre la cible de 44 pt.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          PARTENAIRES
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {partenaires.status === 'loading' ? (
        <View style={styles.tabPad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : partenaires.status === 'error' ? (
        <View style={styles.tabCentered}>
          <StateView
            state="error"
            errorMessage="Les partenaires n'ont pas pu se charger."
            onRetry={partenaires.reload}
          />
        </View>
      ) : (
        <FlashList
          data={partenaires.cards}
          keyExtractor={(c) => c.id}
          estimatedItemSize={200}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: bottomInset + space.xl,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.eyebrow}>AUTOUR DE VOS SORTIES</Text>}
          ListEmptyComponent={
            <StateView
              state="empty"
              emptyMessage="Les offres arrivent."
              style={styles.emptyBlock}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={staggerEntering(index)} style={styles.cardItem}>
              <PartnerCard card={item} onPress={() => setOpenId(item.id)} />
            </Animated.View>
          )}
        />
      )}

      <Sheet visible={openId !== null} onClose={() => setOpenId(null)}>
        {selected ? (
          <PartnerSheet
            key={selected.id}
            partner={selected}
            alreadyRequested={
              partenaires.cards.find((c) => c.id === selected.id)?.requested ?? false
            }
            busy={partenaires.busyId === selected.id}
            onRequest={() => partenaires.requestContact(selected.id)}
          />
        ) : null}
      </Sheet>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Carte partenaire (FlashList)
// ---------------------------------------------------------------------------

function Monogram({ text, size }: { text: string; size: number }) {
  return <Text style={[styles.monogram, { fontSize: size }]}>{text}</Text>;
}

function PartnerCard({ card, onPress }: { card: PartnerCardVM; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={`Fiche ${card.name}`} style={styles.card}>
      <HeroPhoto
        uri={card.logoUrl ?? undefined}
        height={120}
        fallback={<Monogram text={card.monogram} size={34} />}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {card.name}
          </Text>
          {card.requested ? (
            <View style={styles.requestedTag}>
              <Text style={styles.requestedTagTxt}>Demande envoyée</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.chipRow}>
          <Chip label={card.category} />
        </View>
        {card.offerLabel ? (
          <Text style={styles.cardOffer} numberOfLines={2}>
            {card.offerLabel}
          </Text>
        ) : null}
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Fiche partenaire (Sheet) — consentement explicite en deux temps
// ---------------------------------------------------------------------------

type SheetStep = 'idle' | 'consent' | 'sent';

function PartnerSheet({
  partner,
  alreadyRequested,
  busy,
  onRequest,
}: {
  partner: MarketplacePartner;
  alreadyRequested: boolean;
  busy: boolean;
  onRequest: () => Promise<boolean>;
}) {
  const [step, setStep] = useState<SheetStep>(alreadyRequested ? 'sent' : 'idle');

  const confirm = async () => {
    const ok = await onRequest();
    if (ok) setStep('sent');
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
      <HeroPhoto
        uri={partner.logoUrl ?? undefined}
        height={160}
        fallback={<Monogram text={partnerMonogram(partner.displayName)} size={44} />}
      />

      <Text style={styles.sheetName}>{partner.displayName}</Text>
      <Text style={styles.sheetCategory}>{partnerCategoryLabel(partner.type)}</Text>

      {partner.description ? (
        <Text style={styles.sheetDescription}>{partner.description}</Text>
      ) : null}

      {partner.offers.length > 0 ? (
        <View style={styles.offersBlock}>
          <Text style={styles.offersLabel}>OFFRES</Text>
          {partner.offers.map((o) => (
            <View key={o.id} style={styles.offerRow}>
              <OxvIcon name="insigne" size={16} color={colors.text.low} />
              <Text style={styles.offerText}>{offerSummaryLabel(o)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.ctaBlock}>
        {step === 'sent' ? (
          <View style={styles.sentRow}>
            <OxvIcon name="drapeau-damier" size={18} color={colors.text.mid} />
            <Text style={styles.sentTxt}>
              Demande envoyée. {partner.displayName} vous recontactera.
            </Text>
          </View>
        ) : step === 'consent' ? (
          <>
            <Text style={styles.consentSentence}>{PARTNER_CONSENT_SENTENCE}</Text>
            <PressScale
              onPress={() => void confirm()}
              disabled={busy}
              accessibilityLabel="Confirmer la mise en relation"
              style={[styles.ctaAccent, busy && styles.ctaDim]}
            >
              <Text style={styles.ctaAccentTxt}>CONFIRMER LA MISE EN RELATION</Text>
            </PressScale>
            <PressScale
              onPress={() => setStep('idle')}
              disabled={busy}
              accessibilityLabel="Annuler"
              style={styles.ctaGhost}
            >
              <Text style={styles.ctaGhostTxt}>Annuler</Text>
            </PressScale>
          </>
        ) : (
          <PressScale
            onPress={() => setStep('consent')}
            accessibilityLabel={`Être mis en relation avec ${partner.displayName}`}
            style={styles.ctaAccent}
          >
            <Text style={styles.ctaAccentTxt}>ÊTRE MIS EN RELATION</Text>
          </PressScale>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Glyphe
// ---------------------------------------------------------------------------

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
    fontSize: 15,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  tabPad: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  tabCentered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  emptyBlock: { marginTop: space.xxl },

  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.md,
  },

  monogram: {
    fontFamily: typo.display,
    letterSpacing: 2,
    color: colors.text.low,
  },

  // Carte
  cardItem: { marginBottom: space.lg },
  card: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cardBody: { padding: space.lg, gap: space.sm },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  cardName: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
    flexShrink: 1,
  },
  chipRow: { flexDirection: 'row' },
  cardOffer: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },
  requestedTag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  requestedTagTxt: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },

  // Sheet
  sheetContent: { paddingBottom: space.lg, gap: space.md },
  sheetName: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.text.hi,
    marginTop: space.sm,
  },
  sheetCategory: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text.mid,
    marginTop: -space.xs,
  },
  sheetDescription: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.mid,
  },
  offersBlock: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.md,
  },
  offersLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  offerText: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.hi,
  },

  ctaBlock: {
    marginTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.lg,
  },
  consentSentence: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
  ctaAccent: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: space.lg,
  },
  ctaDim: { opacity: 0.5 },
  ctaAccentTxt: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text.hi,
  },
  ctaGhost: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostTxt: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.text.low,
  },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sentTxt: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
});
