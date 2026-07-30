/**
 * Fiche partenaire — la vitrine d'UN partenaire validé (build 23 phase 2,
 * demande fondateur : « le partenaire en lui-même, développe-le, qu'on ait
 * des photos »).
 *
 * Atteinte depuis Découverte › Partenaires (tap sur la carte). Structure :
 *   - HÉROS : LOGO réel en grand sur fond nuancé bleu partenaire, badge type,
 *     nom, zone géographique réelle, description réelle ;
 *   - VITRINE : les IMAGES RÉELLES de ses offres publiées (image_url), en
 *     grille fondu — c'est sa vitrine photo, jamais une image de banque ;
 *   - OFFRES : ses offres publiées réelles, cartes cohérentes avec le
 *     catalogue (même patron ProductCard), CTA « Je suis intéressé » ;
 *   - CONTACT : coordonnées réelles si le partenaire les a publiées
 *     (contact_email / contact_policy — lisibles par le pilote via la RLS
 *     `partner_accounts` : un compte `validated` est public, migration 0017).
 *
 * Doctrine « miroir » appliquée au commerce (décision fondateur, verrouillée) :
 *   - fiche NAVIGABLE, jamais poussée depuis la télémétrie ;
 *   - le lead (« Je suis intéressé ») n'est créé qu'après un CONSENTEMENT
 *     EXPLICITE (confirmation), comme l'exige la RLS `partner_leads` (§8.1) —
 *     patron exact de catalogue.tsx (requestPartnerContact).
 *
 * Intégrité (tout trace vers `partner_accounts` / `partner_offers`) :
 *   - partenaire introuvable ou plus `validated` → état « Fiche indisponible » ;
 *   - offre expirée exclue ; quota épuisé → « Complet », CTA désactivé ;
 *   - logo/image/description/zone/coordonnées absents → section masquée,
 *     jamais une valeur inventée. Prix : `price_eur` ENTIER en EUROS.
 *
 * Motion (kit src/components/motion) : héros en fondu + respiration lente du
 * panneau logo (seul BreathingGlow de l'écran), vitrine et cartes en cascade
 * (Stagger), images en fondu au chargement, CTA en PressableScale, badge
 * « Intérêt envoyé » en AnimatedPresence. Reduce-motion respecté par le kit.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  StyleSheet,
  Text,
  View,
  type ImageProps,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  AnimatedPresence,
  BreathingGlow,
  FadeInSection,
  PressableScale,
  Stagger,
  useReduceMotion,
} from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import {
  type OfferStatus,
  type PartnerOffer,
  listMyPilotLeads,
  requestPartnerContact,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const { palette, roleColors, fonts, fontSize, spacing, radius } = theme;

/** Teintes bleu partenaire (mêmes valeurs que catalogue.tsx / coachs.tsx). */
const PARTNER_TINT = 'rgba(91,141,239,0.12)';
const PARTNER_LINE = 'rgba(91,141,239,0.35)';

/** Libellés humains des catégories partenaires (mêmes clés que le site). */
const TYPE_LABEL: Record<string, string> = {
  photographe: 'Photographe / vidéaste',
  garage: 'Garage / préparateur',
  hotel: 'Hébergement',
  restaurant: 'Restaurant',
  transport: 'Transport véhicule',
  assurance: 'Assurance piste',
  loueur: 'Location véhicule',
  autre: 'Partenaire',
};

/** La fiche complète d'un partenaire validé, vue pilote. */
interface PartnerFiche {
  id: string;
  displayName: string;
  type: string;
  description: string | null;
  logoUrl: string | null;
  geoZone: string | null;
  contactEmail: string | null;
  contactPolicy: string | null;
  /** Offres publiées, non expirées, plus récentes d'abord. */
  offers: PartnerOffer[];
}

/**
 * Offre expirée ? Même règle que catalogue.tsx : date seule (YYYY-MM-DD)
 * inclusive jusqu'à la fin de journée ; une date illisible n'exclut jamais
 * l'offre (on ne masque pas une donnée réelle par erreur).
 */
function isExpired(validUntil: string | null, now: number): boolean {
  if (!validUntil) return false;
  const raw = validUntil.trim();
  const d = new Date(raw);
  const t = d.getTime();
  if (!Number.isFinite(t)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d.setHours(23, 59, 59, 999);
    return d.getTime() < now;
  }
  return t < now;
}

/** Prix ENTIER en euros → « 120 € » / « 1 200 € » (fr-FR). Jamais des centimes. */
function formatEuros(euros: number): string {
  if (!Number.isFinite(euros)) return '';
  return `${euros.toLocaleString('fr-FR')} €`;
}

/** Monogramme partenaire (2 initiales) pour les placeholders sobres. */
function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join('');
  return initials || 'OXV';
}

/**
 * Charge la fiche d'UN partenaire `validated` + ses offres `published` non
 * expirées. Requête locale à l'écran (périmètre fiche seule) sur les colonnes
 * PUBLIQUES de `partner_accounts` — la RLS 0017 les expose au pilote dès que
 * le compte est validé. Renvoie null si introuvable/retiré ; JETTE en cas
 * d'erreur réseau (on affiche une vraie erreur, pas une fiche faussement vide).
 */
async function loadPartnerFiche(partnerId: string): Promise<PartnerFiche | null> {
  const [accRes, offRes] = await Promise.all([
    supabase
      .from('partner_accounts')
      .select(
        'id, display_name, type, description, logo_url, geo_zone, contact_email, contact_policy'
      )
      .eq('id', partnerId)
      .eq('status', 'validated')
      .maybeSingle(),
    supabase
      .from('partner_offers')
      .select(
        'id, partner_id, title, description, price_eur, quota, status, category, valid_until, conditions, image_url'
      )
      .eq('partner_id', partnerId)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ]);
  if (accRes.error) throw new Error(accRes.error.message);
  if (!accRes.data) return null;
  if (offRes.error) throw new Error(offRes.error.message);

  const a = accRes.data as Record<string, unknown>;
  const now = Date.now();
  const offers: PartnerOffer[] = (offRes.data ?? [])
    .map((o0) => {
      const o = o0 as Record<string, unknown>;
      return {
        id: o.id as string,
        partnerId: o.partner_id as string,
        title: o.title as string,
        description: (o.description as string | null) ?? null,
        priceEur: (o.price_eur as number | null) ?? null,
        quota: (o.quota as number | null) ?? null,
        status: o.status as OfferStatus,
        category: (o.category as string | null) ?? null,
        validUntil: (o.valid_until as string | null) ?? null,
        conditions: (o.conditions as string | null) ?? null,
        imageUrl: (o.image_url as string | null) ?? null,
      };
    })
    .filter((o) => !isExpired(o.validUntil, now));

  return {
    id: a.id as string,
    displayName: a.display_name as string,
    type: a.type as string,
    description: (a.description as string | null) ?? null,
    logoUrl: (a.logo_url as string | null) ?? null,
    geoZone: (a.geo_zone as string | null) ?? null,
    contactEmail: (a.contact_email as string | null) ?? null,
    contactPolicy: (a.contact_policy as string | null) ?? null,
    offers,
  };
}

/**
 * Image distante en fondu au chargement — opacity 0 → 1 sur onLoad (400 ms
 * ease-out cubic, mêmes courbes/durées que le kit motion, useNativeDriver).
 * Locale à l'écran, comme dans catalogue.tsx (le kit ne porte pas d'image).
 * Reduce-motion : l'image apparaît sans fondu.
 */
function FadeInImage({ style, onLoad, ...rest }: ImageProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) opacity.setValue(1);
  }, [reduceMotion, opacity]);

  const handleLoad: NonNullable<ImageProps['onLoad']> = (event) => {
    if (!reduceMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    onLoad?.(event);
  };

  return <Animated.Image {...rest} onLoad={handleLoad} style={[style, { opacity }]} />;
}

/** Pictogramme repère de carte — décoratif, bleu partenaire. */
function PinPicto() {
  return (
    <Svg width={16} height={16} viewBox="0 0 26 26">
      <Path
        d="M13 3.2c-3.8 0-6.6 2.8-6.6 6.4 0 4.7 6.6 12.6 6.6 12.6s6.6-7.9 6.6-12.6c0-3.6-2.8-6.4-6.6-6.4z"
        stroke={roleColors.partner}
        strokeWidth={1.8}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx={13} cy={9.8} r={2.4} stroke={roleColors.partner} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

/** Pictogramme enveloppe — décoratif, bleu partenaire. */
function MailPicto() {
  return (
    <Svg width={18} height={18} viewBox="0 0 26 26">
      <Rect
        x={3.5}
        y={6.5}
        width={19}
        height={13}
        rx={2.5}
        stroke={roleColors.partner}
        strokeWidth={1.6}
        fill="none"
      />
      <Path
        d="M4.5 8.5L13 14l8.5-5.5"
        stroke={roleColors.partner}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function PartenaireFicheScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const partnerId = typeof params.id === 'string' ? params.id : '';

  const [loadState, setLoadState] = useState<'loading' | 'nominal' | 'missing' | 'error'>(
    'loading'
  );
  const [fiche, setFiche] = useState<PartnerFiche | null>(null);
  const [requestedOffers, setRequestedOffers] = useState<Set<string>>(new Set());
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!partnerId) {
      setLoadState('missing');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    Promise.all([loadPartnerFiche(partnerId), listMyPilotLeads()])
      .then(([loaded, leads]) => {
        if (cancelled) return;
        setFiche(loaded);
        setRequestedOffers(
          new Set(leads.filter((l) => l.offerId != null).map((l) => l.offerId as string))
        );
        setLoadState(loaded ? 'nominal' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId]);

  useFocusEffect(reload);

  const state: ScreenState =
    loadState === 'loading'
      ? 'loading'
      : loadState === 'error'
        ? 'error'
        : loadState === 'missing'
          ? 'empty'
          : 'nominal';

  /** « Je suis intéressé » — lead CONSENTI uniquement (§8.1), patron catalogue. */
  function askInterest(offer: PartnerOffer) {
    if (!fiche || busyOfferId) return;
    const partnerName = fiche.displayName;
    Alert.alert(
      'Manifester votre intérêt ?',
      `En confirmant, vous autorisez ${partnerName} à vous recontacter au sujet de « ${offer.title} ». Vous restez libre de ne pas donner suite.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setBusyOfferId(offer.id);
            const res = await requestPartnerContact({
              partnerId: offer.partnerId,
              offerId: offer.id,
            });
            setBusyOfferId(null);
            if (!res.ok) {
              Toast.show({ type: 'error', text1: 'La demande n’a pas pu être envoyée.' });
              return;
            }
            haptics.success();
            Toast.show({ type: 'success', text1: 'Intérêt envoyé.' });
            setRequestedOffers((prev) => {
              const next = new Set(prev);
              next.add(offer.id);
              return next;
            });
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <AppBar title="Fiche partenaire" onBack={() => router.back()} />
      <View style={s.page}>
        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="Fiche indisponible"
          emptyMessage="Ce partenaire n’est plus visible."
          emptySource="partner_accounts"
          errorCause="La fiche partenaire est momentanément indisponible."
          onRetry={reload}
        >
          {fiche ? (
            <>
              <FadeInSection>
                <Hero fiche={fiche} />
              </FadeInSection>
              <GallerySection offers={fiche.offers} />
              <OffersSection
                fiche={fiche}
                requestedOffers={requestedOffers}
                busyOfferId={busyOfferId}
                onInterested={askInterest}
              />
              <ContactSection fiche={fiche} />
              <Text style={s.privacyNote}>
                Vous choisissez de partager. Ni votre télémétrie, ni votre identité.
              </Text>
            </>
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Héros — logo réel en grand sur fond nuancé, nom, type, zone, texte  */
/* ------------------------------------------------------------------ */

function Hero({ fiche }: { fiche: PartnerFiche }) {
  return (
    <View style={s.hero}>
      {/* Panneau logo : fond nuancé bleu partenaire, respiration lente
          (seul BreathingGlow de l'écran — règle du kit). */}
      <BreathingGlow style={s.logoPanelWrap}>
        <View style={s.logoPanel}>
          <View style={s.logoTint} pointerEvents="none" />
          {fiche.logoUrl ? (
            <FadeInImage
              source={{ uri: fiche.logoUrl }}
              style={s.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessibilityRole="image"
              accessibilityLabel={`Logo de ${fiche.displayName}`}
            />
          ) : (
            <Text style={s.logoMonogram}>{monogram(fiche.displayName)}</Text>
          )}
        </View>
      </BreathingGlow>

      <View style={s.typeBadge}>
        <Text style={s.typeBadgeT}>{TYPE_LABEL[fiche.type] ?? 'Partenaire'}</Text>
      </View>
      <Text style={s.name}>{fiche.displayName}</Text>

      {/* Zone géographique réelle (geo_zone) — absente = masquée. */}
      {fiche.geoZone ? (
        <View style={s.geoRow}>
          <PinPicto />
          <Text style={s.geoT} numberOfLines={1}>
            {fiche.geoZone}
          </Text>
        </View>
      ) : null}

      {fiche.description ? <Text style={s.desc}>{fiche.description}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Vitrine — les images réelles des offres publiées, en grille fondu   */
/* ------------------------------------------------------------------ */

function GallerySection({ offers }: { offers: PartnerOffer[] }) {
  const photos = offers.filter((o) => o.imageUrl != null);
  if (photos.length === 0) return null;

  return (
    <View style={s.section}>
      <FadeInSection delay={120}>
        <Text style={s.sectionEyebrow}>
          {`Vitrine · ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
        </Text>
      </FadeInSection>
      {/* Grille 2 colonnes en cascade — chaque tuile est l'image RÉELLE
          d'une offre publiée (sa vitrine), en fondu au chargement. */}
      <Stagger initialDelay={160} style={s.galleryGrid} itemStyle={s.galleryItem}>
        {photos.map((o) => (
          <View
            key={o.id}
            style={s.galleryTile}
            accessibilityRole="image"
            accessibilityLabel={`Photo — ${o.title}`}
          >
            <FadeInImage
              source={{ uri: o.imageUrl as string }}
              style={s.galleryImg}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        ))}
      </Stagger>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Offres — cartes produit cohérentes avec le catalogue                */
/* ------------------------------------------------------------------ */

function OffersSection({
  fiche,
  requestedOffers,
  busyOfferId,
  onInterested,
}: {
  fiche: PartnerFiche;
  requestedOffers: Set<string>;
  busyOfferId: string | null;
  onInterested: (offer: PartnerOffer) => void;
}) {
  const count = fiche.offers.length;
  return (
    <View style={s.section}>
      <FadeInSection delay={200}>
        <Text style={s.sectionEyebrow}>{count > 0 ? `Offres · ${count}` : 'Offres'}</Text>
      </FadeInSection>
      {count === 0 ? (
        <FadeInSection delay={240}>
          <EmptyState
            label="À venir"
            message="Aucune offre publiée pour l’instant."
            source="partner_offers"
          />
        </FadeInSection>
      ) : (
        <Stagger initialDelay={240}>
          {fiche.offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              partnerName={fiche.displayName}
              partnerLogo={fiche.logoUrl}
              requested={requestedOffers.has(offer.id)}
              busy={busyOfferId === offer.id}
              onInterested={onInterested}
            />
          ))}
        </Stagger>
      )}
    </View>
  );
}

/**
 * Carte produit — patron exact du catalogue (hero image ou placeholder logo,
 * titre, prix, description, conditions, validité, CTA bleu partenaire), SANS
 * la rangée partenaire : toute la page est déjà la sienne.
 */
function OfferCard({
  offer,
  partnerName,
  partnerLogo,
  requested,
  busy,
  onInterested,
}: {
  offer: PartnerOffer;
  partnerName: string;
  partnerLogo: string | null;
  requested: boolean;
  busy: boolean;
  onInterested: (offer: PartnerOffer) => void;
}) {
  const soldOut = offer.quota === 0;
  const price = offer.priceEur != null ? formatEuros(offer.priceEur) : null;
  const validity = offer.validUntil ? `Jusqu’au ${formatDateShort(offer.validUntil)}` : null;
  const disabled = soldOut || busy;

  return (
    <View style={s.cardShadow}>
      <View style={s.cardClip}>
        {/* Hero : image réelle (cover) ou placeholder sobre (logo/monogramme). */}
        {offer.imageUrl ? (
          <FadeInImage
            source={{ uri: offer.imageUrl }}
            style={s.offerHero}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={s.offerHeroPlaceholder}>
            <View style={s.logoTint} pointerEvents="none" />
            {partnerLogo ? (
              <FadeInImage
                source={{ uri: partnerLogo }}
                style={s.offerHeroLogo}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={s.offerHeroMonogram}>{monogram(partnerName)}</Text>
            )}
          </View>
        )}

        <View style={s.offerBody}>
          <Text style={s.offerTitle}>{offer.title}</Text>

          {price ? <Text style={s.offerPrice}>{price}</Text> : null}

          {offer.description ? (
            <Text style={s.offerDesc} numberOfLines={4}>
              {offer.description}
            </Text>
          ) : null}

          {offer.conditions ? <Text style={s.offerConditions}>{offer.conditions}</Text> : null}

          {validity ? (
            <View style={s.chipsRow}>
              <View style={s.chip}>
                <Text style={s.chipT}>{validity}</Text>
              </View>
            </View>
          ) : null}

          {/* CTA — état « intérêt envoyé » (vert), « Complet », ou action bleue. */}
          <AnimatedPresence visible={requested}>
            <View style={s.sentBadge} accessibilityRole="text" accessibilityLabel="Intérêt envoyé">
              <Text style={s.sentBadgeT}>Intérêt envoyé</Text>
            </View>
          </AnimatedPresence>
          {!requested ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                soldOut
                  ? `Offre complète : ${offer.title}`
                  : `Je suis intéressé par ${offer.title}, de ${partnerName}`
              }
              accessibilityState={{ disabled }}
              disabled={disabled}
              haptic="tap"
              onPress={() => onInterested(offer)}
              style={[s.cta, disabled && s.ctaDisabled]}
            >
              <Text style={[s.ctaT, disabled && s.ctaTDisabled]}>
                {soldOut ? 'Complet' : busy ? 'Envoi…' : 'Je suis intéressé'}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Contact — coordonnées réelles publiées par le partenaire            */
/* ------------------------------------------------------------------ */

function ContactSection({ fiche }: { fiche: PartnerFiche }) {
  const email = fiche.contactEmail;
  if (!email && !fiche.contactPolicy) return null;

  return (
    <View style={s.section}>
      <FadeInSection delay={280}>
        <Text style={s.sectionEyebrow}>Contact</Text>
      </FadeInSection>
      <FadeInSection delay={320}>
        <View style={s.contactCard}>
          {email ? (
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`Écrire à ${fiche.displayName}`}
              haptic="tap"
              onPress={() => {
                Linking.openURL(`mailto:${email}`).catch(() => undefined);
              }}
              style={s.contactRow}
            >
              <MailPicto />
              <Text style={s.contactEmail} numberOfLines={1}>
                {email}
              </Text>
              <Text style={s.contactChevron}>›</Text>
            </PressableScale>
          ) : null}
          {/* Politique de contact : les mots du partenaire, tels quels. */}
          {fiche.contactPolicy ? <Text style={s.contactPolicy}>{fiche.contactPolicy}</Text> : null}
          <Text style={s.contactHint}>Contact direct, hors application. Vous décidez.</Text>
        </View>
      </FadeInSection>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 (surfaces card/card2, hairlines, accent  */
/* BLEU partenaire ; l'or est INTERDIT ici). Sentence-case, vouvoiement. */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  page: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // — Héros —
  hero: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  logoPanelWrap: { alignSelf: 'stretch' },
  logoPanel: {
    width: '100%',
    height: 170,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PARTNER_LINE,
    backgroundColor: palette.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PARTNER_TINT,
  },
  logo: {
    width: '58%',
    height: '58%',
  },
  logoMonogram: {
    fontFamily: fonts.mono,
    fontSize: 34,
    letterSpacing: 6,
    color: palette.creamSoft,
  },
  typeBadge: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm - 4,
    backgroundColor: PARTNER_TINT,
    borderWidth: 1,
    borderColor: PARTNER_LINE,
  },
  typeBadgeT: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: roleColors.partner,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  geoT: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  desc: {
    alignSelf: 'stretch',
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.lg,
  },

  // — Sections —
  section: { marginTop: spacing.xxl },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginBottom: spacing.md,
  },

  // — Vitrine (grille 2 colonnes) —
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  galleryItem: { width: '48.5%' },
  galleryTile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface3,
    overflow: 'hidden',
  },
  galleryImg: {
    width: '100%',
    height: '100%',
  },

  // — Carte produit (patron catalogue) —
  cardShadow: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardClip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  offerHero: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: palette.surface3,
  },
  offerHeroPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: palette.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  offerHeroLogo: {
    width: '52%',
    height: '44%',
  },
  offerHeroMonogram: {
    fontFamily: fonts.mono,
    fontSize: 30,
    letterSpacing: 5,
    color: palette.creamMute,
  },
  offerBody: { padding: spacing.lg },
  offerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    lineHeight: fontSize.h3 * 1.3,
    color: palette.cream,
  },
  offerPrice: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.value,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  offerDesc: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  offerConditions: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 11.5 * 1.5,
    color: palette.faint,
    marginTop: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm - 4,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  chipT: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // — CTA bleu partenaire (rempli, texte sombre pour le contraste) —
  cta: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: roleColors.partner,
    marginTop: spacing.lg,
  },
  ctaDisabled: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  ctaT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.night,
  },
  ctaTDisabled: {
    color: palette.faint,
  },

  // — Badge « intérêt envoyé » (vert validé, non recliquable) —
  sentBadge: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: 'rgba(79,201,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.4)',
    marginTop: spacing.lg,
  },
  sentBadgeT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.green,
  },

  // — Contact —
  contactCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  contactEmail: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.creamSoft,
  },
  contactChevron: {
    fontFamily: fonts.body,
    fontSize: 20,
    color: roleColors.partner,
    marginTop: -2,
  },
  contactPolicy: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  contactHint: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.md,
  },

  // — Note de confidentialité (même formule que la Découverte) —
  privacyNote: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: palette.faint,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
