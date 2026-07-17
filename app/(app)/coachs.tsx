/**
 * Découverte — racine de la zone (onglet 4), reskin refonte-v2 §7.10,
 * élargie en VRAI HUB (retour fondateur build 23 : « on n'a pas toutes les
 * options — le social manque »).
 *
 * Maquette (10-decouverte.png) : titre « Découverte » inline (sans retour) +
 * onglets PILLS « Coachs / Partenaires / Roulages » (état local, Coachs actif
 * par défaut). Onglet Coachs : cartes coach à ACCENT HAUT rouge coach
 * (`palette.coachAccent`), photo réelle du coach (repli : initiales cerclées
 * rouge), nom, spécialités réelles, PRIX À LA SESSION réel en heritageGold
 * (décision fondateur 2026-07-16 — saison en secondaire discret si renseignée,
 * prix absent = pas de ligne), boutons « Voir la fiche » (bordé) /
 * « Contacter » (plein rouge).
 * Onglet Partenaires : cartes à accent haut BLEU (`roleColors.partner`), logo
 * réel s'il existe, badge catégorie, bouton bleu « Demander le contact » (lead
 * CONSENTI §8.1, flux existant) + note de confidentialité. Onglet Roulages :
 * invitations réelles du pilote (accepter / décliner), restylées v2.
 *
 * HUB (build 23) — sous les onglets, la richesse EXISTANTE de la zone est
 * réexposée (routes déjà mappées `decouverte` dans appMap, RIEN d'ajouté) :
 *   - LE CLUB (teinte violette de section) : Galerie (première photo réelle en
 *     vignette via listAllPilotMedia, compte réel de médias), Amis (compte réel
 *     d'amitiés acceptées), La carte OXV (pictogramme, pas de fausse carte).
 *   - ROUTES (teinte verte, déjà portée par « Certifiée OXV ») : Belles routes,
 *     Mes routes, Créer une route, Créer un tracé (import OSM).
 * Animations (kit src/components/motion) : cartes en cascade (Stagger), hub en
 * fondu décalé (FadeInSection), toutes les actions en PressableScale (haptique
 * incluse), images distantes en fondu au chargement. Courbes et durées du kit,
 * reduce-motion respecté. Compteurs RÉELS uniquement — un compte indisponible
 * ou nul est remplacé par un libellé descriptif, jamais inventé.
 *
 * Données RÉELLES uniquement : coachs publiés (coachMarketplaceService, RLS
 * `is_published`), partenaires validés + offres publiées (partnerService),
 * invitations roulages (roulagesService), amitiés (friendshipsService), médias
 * (sessionMediaService). Donnée absente = masquée/EmptyState.
 * Doctrine : vouvoiement, aucun emoji, aucun classement, ton descriptif.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Text,
  View,
  type ImageProps,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import { FadeInSection, PressableScale, Stagger, useReduceMotion } from '@/components/motion';
import { ReportButton } from '@/components/ReportButton';
import * as haptics from '@/lib/haptics';
import { type CoachListing, listPublishedCoaches } from '@/services/coachMarketplaceService';
import { listAcceptedFriends } from '@/services/friendshipsService';
import {
  type MarketplacePartner,
  listMarketplace,
  listMyPilotLeads,
  requestPartnerContact,
} from '@/services/partnerService';
import { INVITATION_STATUS_LABELS } from '@/services/roulagesLogic';
import {
  type PilotInvitation,
  listMyInvitations,
  respondToInvitation,
} from '@/services/roulagesService';
import { type SessionMediaItem, listAllPilotMedia } from '@/services/sessionMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, roleColors, dataColors, fonts, fontSize, spacing, radius } = theme;

/**
 * Teinte du CLUB — violet du thème (dataColors.regularity), employée ici comme
 * IDENTITÉ DE SECTION (navigation/hub), pas comme donnée QDI : aucune valeur de
 * régularité n'apparaît sur ces cartes, aucune ambiguïté possible. C'est la
 * seule teinte vive du thème qui n'est ni le rouge coach, ni le bleu
 * partenaire, ni le cyan admin — et jamais l'or (chrono/record uniquement).
 */
const CLUB_TINT = dataColors.regularity;

/**
 * Teinte des ROUTES — vert du thème, déjà porté par « Certifiée OXV » dans
 * Mes routes. Identité de section, pas une donnée d'accélération ici.
 */
const ROUTES_TINT = dataColors.accel;

type DiscoverTab = 'coachs' | 'partenaires' | 'roulages';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'coachs', label: 'Coachs' },
  { key: 'partenaires', label: 'Partenaires' },
  { key: 'roulages', label: 'Roulages' },
];

/**
 * Image distante en fondu au chargement — opacity 0 → 1 sur onLoad (400 ms
 * ease-out cubic, mêmes courbes/durées que le kit motion, useNativeDriver).
 * Locale à l'écran : le kit ne porte pas de composant image et cette passe se
 * limite aux écrans de la zone. Reduce-motion : l'image apparaît sans fondu.
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

export default function DecouverteScreen() {
  const profileId = useAuthStore((st) => st.profile?.id ?? null);
  const [tab, setTab] = useState<DiscoverTab>('coachs');
  const [loading, setLoading] = useState(true);

  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [invitations, setInvitations] = useState<PilotInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Hub — compteurs et vignettes RÉELS. null = indisponible (jamais inventé).
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [media, setMedia] = useState<SessionMediaItem[]>([]);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listPublishedCoaches(),
      listMarketplace(),
      listMyPilotLeads(),
      listMyInvitations(),
      // Hub : chaque source échoue en silence SANS bloquer le reste.
      profileId
        ? listAcceptedFriends(profileId)
            .then((l) => l.length)
            .catch(() => null)
        : Promise.resolve(null),
      listAllPilotMedia().catch(() => [] as SessionMediaItem[]),
    ])
      .then(([coachList, partnerList, leads, invits, friends, mediaList]) => {
        if (cancelled) return;
        setCoaches(coachList);
        setPartners(partnerList);
        setRequested(new Set(leads.map((l) => l.partnerId)));
        setInvitations(invits);
        setFriendCount(friends);
        setMedia(mediaList);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useFocusEffect(reload);

  /** Demande de contact partenaire — lead CONSENTI uniquement (§8.1). */
  function askPartner(partner: MarketplacePartner) {
    Alert.alert(
      'Demander le contact ?',
      `En confirmant, vous autorisez ${partner.displayName} à vous contacter. Vous restez libre de ne pas donner suite.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const res = await requestPartnerContact({
              partnerId: partner.id,
              offerId: partner.offers[0]?.id ?? null,
            });
            if (!res.ok) {
              Toast.show({ type: 'error', text1: 'La demande a échoué.' });
              return;
            }
            haptics.success();
            Toast.show({ type: 'success', text1: 'Demande envoyée.' });
            const leads = await listMyPilotLeads();
            setRequested(new Set(leads.map((l) => l.partnerId)));
          },
        },
      ]
    );
  }

  /** Réponse à une invitation roulage (accepter / décliner). */
  async function respond(invitationId: string, accepted: boolean) {
    if (busyId) return;
    setBusyId(invitationId);
    await respondToInvitation(invitationId, accepted, new Date().toISOString());
    setInvitations(await listMyInvitations());
    setBusyId(null);
  }

  return (
    <Screen>
      <AppBar title="Découverte" />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Onglets pills (maquette) — état local, Coachs actif par défaut. */}
        <View style={s.pillsRow} accessibilityRole="tablist">
          {TABS.map(({ key, label }) => {
            const active = key === tab;
            return (
              <PressableScale
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                hitSlop={theme.hitSlop}
                haptic="tap"
                onPress={() => setTab(key)}
                style={[s.pill, active && s.pillActive]}
              >
                <Text style={[s.pillT, active && s.pillActiveT]}>{label}</Text>
              </PressableScale>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : (
          <>
            {/* Cascade d'entrée sobre : les cartes de l'onglet gèrent leur
                propre Stagger (rejoué au changement d'onglet), le club puis
                les routes suivent en fondu décalé — ease-out, jamais de bounce. */}
            {tab === 'coachs' ? (
              <CoachsTab coaches={coaches} />
            ) : tab === 'partenaires' ? (
              <PartenairesTab partners={partners} requested={requested} onAsk={askPartner} />
            ) : (
              <RoulagesTab invitations={invitations} busyId={busyId} onRespond={respond} />
            )}
            <FadeInSection delay={120}>
              <ClubSection friendCount={friendCount} media={media} />
            </FadeInSection>
            <FadeInSection delay={240}>
              <RoutesSection />
            </FadeInSection>
          </>
        )}
      </View>
    </Screen>
  );
}

/** Navigation du hub — routes toutes existantes (zone `decouverte` de
 *  l'appMap). Le retour haptique léger est porté par PressableScale. */
function openHubRoute(path: string): void {
  router.push(path as never);
}

/* ------------------------------------------------------------------ */
/* Onglet Coachs                                                       */
/* ------------------------------------------------------------------ */

function CoachsTab({ coaches }: { coaches: CoachListing[] }) {
  return (
    <View style={s.tabBody}>
      {/* Compteur RÉEL (coachs publiés chargés) — masqué à zéro. */}
      <FadeInSection>
        <Text style={s.sectionEyebrow}>
          {coaches.length > 0 ? `Coachs · ${coaches.length}` : 'Coachs'}
        </Text>
      </FadeInSection>
      {coaches.length === 0 ? (
        <FadeInSection delay={80}>
          <EmptyState
            label="À venir"
            message="Les coachs apparaîtront ici dès qu’ils ouvriront leur fiche."
            source="coach_profiles"
          />
        </FadeInSection>
      ) : (
        <Stagger initialDelay={80} style={{ gap: spacing.md }}>
          {coaches.map((coach) => (
            <CoachCard key={coach.coachId} coach={coach} />
          ))}
        </Stagger>
      )}
    </View>
  );
}

function initialsOf(headline: string | null): string {
  const base = (headline ?? '').trim();
  if (!base) return 'OXV';
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'OXV';
}

function CoachCard({ coach }: { coach: CoachListing }) {
  const name = coach.headline ?? 'Coach OXV';
  // Sous-titre maquette « spécialité · circuit » : premières valeurs réelles.
  const subtitle = [...coach.specialties, ...coach.circuits].slice(0, 2).join(' · ');
  // Prix RÉELS (décision fondateur 2026-07-16, session_price_eur en prod) :
  // LE prix affiché est À LA SESSION, registre d'offre heritageGold ; la
  // saison reste en secondaire discret si renseignée. Un prix absent n'a pas
  // de ligne (jamais inventé).
  const sessionPrice =
    coach.sessionPriceEur !== null
      ? `${Math.round(coach.sessionPriceEur).toLocaleString('fr-FR')} €`
      : null;
  const seasonPrice =
    coach.seasonPriceEur !== null
      ? `${Math.round(coach.seasonPriceEur).toLocaleString('fr-FR')} €`
      : null;

  const openFiche = () =>
    router.push({ pathname: '/(app)/coach/[id]', params: { id: coach.coachId } } as never);
  // « Contacter » ouvre la fiche, où vit la demande de séance réelle
  // (`requestBooking`). Le paramètre `demande` permettra à la fiche d'ouvrir
  // directement le formulaire (cf. sharedChangesNeeded).
  const openContact = () =>
    router.push({
      pathname: '/(app)/coach/[id]',
      params: { id: coach.coachId, demande: '1' },
    } as never);

  return (
    <Card style={s.coachCard}>
      <View style={s.coachHead}>
        {coach.photoUrl ? (
          <FadeInImage
            source={{ uri: coach.photoUrl }}
            style={s.avatar}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{initialsOf(coach.headline)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.coachName} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={s.coachMeta} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {sessionPrice || seasonPrice ? (
          <View style={{ alignItems: 'flex-end' }}>
            {sessionPrice ? (
              // LE prix : à la session, registre d'offre heritageGold (l'or
              // système #FFB703 reste réservé au chrono/record).
              <View
                style={{ alignItems: 'flex-end' }}
                accessibilityLabel={`${sessionPrice} par session`}
              >
                <Text style={s.coachPrice}>{sessionPrice}</Text>
                <Text style={s.coachPriceLabel}>/ session</Text>
              </View>
            ) : null}
            {seasonPrice ? (
              <Text
                style={[s.coachSeason, sessionPrice ? { marginTop: spacing.xs } : null]}
                accessibilityLabel={`Saison ${seasonPrice}`}
              >
                saison {seasonPrice}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={s.coachActions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Voir la fiche de ${name}`}
          haptic="tap"
          onPress={openFiche}
          style={s.btnGhost}
        >
          <Text style={s.btnGhostT}>Voir la fiche</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Contacter ${name}`}
          haptic="tap"
          onPress={openContact}
          style={s.btnCoach}
        >
          <Text style={s.btnCoachT}>Contacter</Text>
        </PressableScale>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet Partenaires                                                  */
/* ------------------------------------------------------------------ */

function PartenairesTab({
  partners,
  requested,
  onAsk,
}: {
  partners: MarketplacePartner[];
  requested: Set<string>;
  onAsk: (partner: MarketplacePartner) => void;
}) {
  // Compteur RÉEL : total des offres publiées chargées, masqué à zéro.
  const offerCount = partners.reduce((n, p) => n + p.offers.length, 0);
  return (
    <View style={s.tabBody}>
      <FadeInSection>
        <Text style={s.sectionEyebrow}>
          {offerCount > 0
            ? `Partenaires · ${offerCount} ${offerCount > 1 ? 'offres' : 'offre'}`
            : 'Partenaires'}
        </Text>
      </FadeInSection>
      {partners.length > 0 ? (
        <FadeInSection delay={80}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Voir le catalogue des partenaires"
            haptic="tap"
            onPress={() => router.push('/(app)/catalogue' as never)}
            style={s.catalogueLink}
          >
            <Text style={s.catalogueLinkT}>Voir le catalogue</Text>
            <Text style={s.catalogueLinkChevron}>›</Text>
          </PressableScale>
        </FadeInSection>
      ) : null}
      {partners.length === 0 ? (
        <FadeInSection delay={80}>
          <EmptyState
            label="À venir"
            message="Les partenaires OXV apparaîtront ici."
            source="partner_accounts"
          />
        </FadeInSection>
      ) : (
        <Stagger initialDelay={160} style={{ gap: spacing.md }}>
          {partners.map((p) => {
            const done = requested.has(p.id);
            return (
              // La carte OUVRE la fiche partenaire (build 23 : « le partenaire
              // en lui-même ») ; le bouton « Demander le contact » reste
              // prioritaire au toucher (pressable enfant).
              <Card
                key={p.id}
                style={s.partnerCard}
                accessibilityLabel={`Ouvrir la fiche de ${p.displayName}`}
                onPress={() =>
                  router.push({
                    pathname: '/(app)/partenaire/[id]',
                    params: { id: p.id },
                  } as never)
                }
              >
                <View style={s.partnerHead}>
                  <View style={{ flex: 1 }}>
                    <View style={s.partnerBadge}>
                      <Text style={s.partnerBadgeT} numberOfLines={1}>
                        {TYPE_LABEL[p.type] ?? 'Partenaire'}
                      </Text>
                    </View>
                    <Text style={s.partnerName}>{p.displayName}</Text>
                  </View>
                  {/* Logo RÉEL du partenaire s'il existe — jamais d'image factice. */}
                  {p.logoUrl ? (
                    <FadeInImage
                      source={{ uri: p.logoUrl }}
                      style={s.partnerLogo}
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                </View>
                {p.description ? <Text style={s.partnerDesc}>{p.description}</Text> : null}

                {p.offers.length > 0 ? (
                  <View style={s.offerList}>
                    {p.offers.map((o) => (
                      <View key={o.id} style={s.offerRow}>
                        <Text style={s.offerTitle} numberOfLines={1}>
                          {o.title}
                        </Text>
                        <View style={s.offerTrailing}>
                          {o.priceEur != null ? (
                            <Text style={s.offerPrice}>{o.priceEur.toLocaleString('fr-FR')} €</Text>
                          ) : null}
                          <ReportButton targetType="partner_offer" targetId={o.id} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    done ? 'Demande déjà envoyée' : `Demander le contact de ${p.displayName}`
                  }
                  accessibilityState={{ disabled: done }}
                  disabled={done}
                  haptic="tap"
                  onPress={() => onAsk(p)}
                  style={s.btnPartner}
                >
                  <Text style={[s.btnPartnerT, done && { color: palette.faint }]}>
                    {done ? 'Demande envoyée' : 'Demander le contact'}
                  </Text>
                </PressableScale>
                <Text style={s.privacyNote}>
                  Vous choisissez de partager. Ni votre télémétrie, ni votre identité.
                </Text>
              </Card>
            );
          })}
        </Stagger>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet Roulages                                                     */
/* ------------------------------------------------------------------ */

function RoulagesTab({
  invitations,
  busyId,
  onRespond,
}: {
  invitations: PilotInvitation[];
  busyId: string | null;
  onRespond: (invitationId: string, accepted: boolean) => void;
}) {
  return (
    <View style={s.tabBody}>
      {/* Compteur RÉEL (invitations chargées) — masqué à zéro. */}
      <FadeInSection>
        <Text style={s.sectionEyebrow}>
          {invitations.length > 0 ? `Roulages · ${invitations.length}` : 'Roulages'}
        </Text>
      </FadeInSection>
      {invitations.length === 0 ? (
        <FadeInSection delay={80}>
          <EmptyState
            label="À venir"
            message="Vos invitations aux roulages apparaîtront ici."
            source="roulage_invitations"
          />
        </FadeInSection>
      ) : (
        <Stagger initialDelay={80} style={{ gap: spacing.md }}>
          {invitations.map(({ invitation, roulage }) => {
            const pending = invitation.status === 'invited' && roulage.status === 'open';
            return (
              <Card key={invitation.id} style={s.roulageCard}>
                <Text style={s.roulageTitle}>{roulage.title}</Text>
                <Text style={s.roulageMeta}>
                  {formatDateTime(roulage.startsAt)} · {roulage.circuitName}
                </Text>
                {roulage.location ? <Text style={s.roulageMeta}>{roulage.location}</Text> : null}
                {roulage.pricePerPilot != null ? (
                  <Text style={s.roulagePrice}>
                    {formatPriceCents(roulage.pricePerPilot)} par place
                  </Text>
                ) : null}

                {roulage.status === 'cancelled' ? (
                  <Text style={s.roulageStatus} accessibilityRole="text">
                    Ce roulage a été annulé.
                  </Text>
                ) : pending ? (
                  <View style={s.roulageActions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Accepter"
                        onPress={() => onRespond(invitation.id, true)}
                        disabled={busyId != null && busyId !== invitation.id}
                        loading={busyId === invitation.id}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Décliner"
                        variant="ghost"
                        onPress={() => onRespond(invitation.id, false)}
                        disabled={busyId != null}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={s.roulageStatus} accessibilityRole="text">
                    Votre réponse : {INVITATION_STATUS_LABELS[invitation.status]}
                  </Text>
                )}
              </Card>
            );
          })}
        </Stagger>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Hub — LE CLUB (social) : Galerie, Amis, La carte OXV                */
/* ------------------------------------------------------------------ */

/** Pictogramme deux silhouettes — décoratif, teinte club. */
function PeoplePicto() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Circle cx={9.5} cy={8.5} r={3.6} stroke={CLUB_TINT} strokeWidth={1.5} fill="none" />
      <Path
        d="M3 21.5c0-3.7 2.9-6 6.5-6s6.5 2.3 6.5 6"
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      <Circle
        cx={18.5}
        cy={9.5}
        r={2.8}
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
        opacity={0.55}
      />
      <Path
        d="M17.5 15.6c3.2.4 5.5 2.5 5.5 5.4"
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
    </Svg>
  );
}

/** Pictogramme repère de carte — décoratif, teinte club. */
function PinPicto() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d="M13 3.2c-3.8 0-6.6 2.8-6.6 6.4 0 4.7 6.6 12.6 6.6 12.6s6.6-7.9 6.6-12.6c0-3.6-2.8-6.4-6.6-6.4z"
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
      <Circle cx={13} cy={9.8} r={2.4} stroke={CLUB_TINT} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

/** Pictogramme cadre photo — décoratif, pour la galerie sans média. */
function PhotoPicto() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Rect
        x={4}
        y={8.5}
        width={22}
        height={16}
        rx={3}
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
      />
      <Circle cx={15} cy={16.5} r={4.2} stroke={CLUB_TINT} strokeWidth={1.5} fill="none" />
      <Path
        d="M11.4 8.5l1.5-2.5h4.2l1.5 2.5"
        stroke={CLUB_TINT}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * LE CLUB — cartes d'accès riches vers la vie sociale de la zone :
 * Galerie (première photo RÉELLE en vignette, compte réel de médias),
 * Amis (compte RÉEL d'amitiés acceptées), La carte OXV (pictogramme —
 * on ne fabrique pas de mini-carte). Compteur nul/indisponible = libellé
 * descriptif, jamais un chiffre inventé.
 */
function ClubSection({
  friendCount,
  media,
}: {
  friendCount: number | null;
  media: SessionMediaItem[];
}) {
  const cover = media.find((m) => m.mediaType === 'photo' && m.signedUrl);
  const mediaCount = media.length;

  return (
    <View style={s.hubSection}>
      <Text style={s.sectionEyebrow}>Le club</Text>

      {/* Galerie — vitrine : votre première photo réelle en couverture. */}
      <PressableScale
        onPress={() => openHubRoute('/(app)/galerie')}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la galerie"
        haptic="tap"
      >
        <Card style={s.clubCard}>
          {cover?.signedUrl ? (
            <FadeInImage
              source={{ uri: cover.signedUrl }}
              style={s.galleryCover}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[s.galleryCover, s.galleryCoverEmpty]}>
              <PhotoPicto />
            </View>
          )}
          <View style={s.hubCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.hubCardTitle}>Galerie</Text>
              <Text style={s.hubCardMeta} numberOfLines={1}>
                {mediaCount > 0
                  ? `${mediaCount} ${mediaCount > 1 ? 'médias' : 'média'}`
                  : 'Vos photos et vidéos de journées OXV'}
              </Text>
            </View>
            <Text style={s.hubChevron}>›</Text>
          </View>
        </Card>
      </PressableScale>

      <View style={s.tileRow}>
        <PressableScale
          onPress={() => openHubRoute('/(app)/amis')}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir vos amis"
          haptic="tap"
          style={{ flex: 1 }}
        >
          <Card style={[s.clubCard, s.tile]}>
            <PeoplePicto />
            <Text style={s.tileTitle}>Amis</Text>
            <Text style={s.tileMeta} numberOfLines={1}>
              {friendCount != null && friendCount > 0
                ? `${friendCount} ${friendCount > 1 ? 'amis' : 'ami'}`
                : 'Pilote à pilote'}
            </Text>
          </Card>
        </PressableScale>
        <PressableScale
          onPress={() => openHubRoute('/(app)/carte-oxv')}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir la carte OXV"
          haptic="tap"
          style={{ flex: 1 }}
        >
          <Card style={[s.clubCard, s.tile]}>
            <PinPicto />
            <Text style={s.tileTitle}>La carte OXV</Text>
            <Text style={s.tileMeta} numberOfLines={1}>
              Circuits et territoire
            </Text>
          </Card>
        </PressableScale>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Hub — ROUTES : belles routes, mes routes, création                  */
/* ------------------------------------------------------------------ */

const ROUTE_LINKS: { path: string; title: string; desc: string; create: boolean }[] = [
  {
    path: '/(app)/belle-route',
    title: 'Belles routes',
    desc: 'Les routes certifiées OXV, hors chrono.',
    create: false,
  },
  {
    path: '/(app)/mes-routes',
    title: 'Mes routes',
    desc: 'Vos routes enregistrées et leur statut.',
    create: false,
  },
  {
    path: '/(app)/creer-route',
    title: 'Créer une route',
    desc: 'Votre itinéraire de balade, à composer.',
    create: true,
  },
  {
    path: '/(app)/creer-trace',
    title: 'Créer un tracé',
    desc: 'Un circuit importé depuis OpenStreetMap.',
    create: true,
  },
];

/** ROUTES — accès direct aux quatre écrans routes de la zone. */
function RoutesSection() {
  return (
    <View style={s.hubSection}>
      <Text style={s.sectionEyebrow}>Routes</Text>
      <Card style={s.routesCard}>
        {ROUTE_LINKS.map(({ path, title, desc, create }, i) => (
          <PressableScale
            key={path}
            accessibilityRole="button"
            accessibilityLabel={title}
            haptic="tap"
            onPress={() => openHubRoute(path)}
            style={[s.routeRow, i > 0 && s.routeRowBorder]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.routeTitle}>{title}</Text>
              <Text style={s.routeDesc} numberOfLines={1}>
                {desc}
              </Text>
            </View>
            <Text style={create ? s.routePlus : s.hubChevron}>{create ? '+' : '›'}</Text>
          </PressableScale>
        ))}
      </Card>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 (surfaces card/card2, hairlines,        */
/* eyebrows mono, accent haut 2 px couleur du contexte).               */
/* ------------------------------------------------------------------ */

const s = {
  pillsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center' as const,
    borderRadius: radius.pill,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
  },
  pillActive: {
    backgroundColor: palette.cream,
    borderColor: palette.cream,
  },
  pillT: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    color: palette.creamMute,
  },
  pillActiveT: {
    fontFamily: fonts.bodySemi,
    color: palette.night,
  },
  tabBody: { marginTop: spacing.xl },
  sectionEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginBottom: spacing.md,
  },

  // — Carte coach (accent haut rouge coach) —
  coachCard: {
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    padding: spacing.lg,
  },
  coachHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card2,
  },
  // Sans photo : initiales CERCLÉES ROUGE (repli identitaire, build 23).
  avatarFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: palette.coachAccent,
  },
  avatarInitials: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  coachName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  coachMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  // LE prix (à la session) : registre d'offre heritageGold — l'or système
  // (#FFB703) reste réservé au chrono/record.
  coachPrice: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    color: palette.heritageGold,
  },
  coachPriceLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginTop: 2,
  },
  // La saison, secondaire discret (si renseignée).
  coachSeason: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: palette.faint,
  },
  coachActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btnGhost: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  btnGhostT: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.creamSoft,
  },
  btnCoach: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    backgroundColor: palette.coachAccent,
  },
  btnCoachT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.cream,
  },

  // — Lien vers le catalogue (paddock des partenaires) —
  catalogueLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(91,141,239,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91,141,239,0.35)',
    marginBottom: spacing.md,
  },
  catalogueLinkT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: roleColors.partner,
  },
  catalogueLinkChevron: {
    fontFamily: fonts.body,
    fontSize: 20,
    color: roleColors.partner,
    marginTop: -2,
  },

  // — Carte partenaire (accent haut bleu) —
  partnerCard: {
    borderTopWidth: 2,
    borderTopColor: roleColors.partner,
    padding: spacing.lg,
  },
  partnerHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  partnerLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
  },
  partnerBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm - 4,
    backgroundColor: 'rgba(91,141,239,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91,141,239,0.35)',
  },
  partnerBadgeT: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: roleColors.partner,
  },
  partnerName: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    marginTop: spacing.md,
  },
  partnerDesc: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.xs,
  },
  offerList: {
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  offerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  offerTitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    flex: 1,
  },
  offerTrailing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  offerPrice: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
    color: palette.cream,
  },
  btnPartner: {
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(91,141,239,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91,141,239,0.35)',
    marginTop: spacing.lg,
  },
  btnPartnerT: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: roleColors.partner,
  },
  privacyNote: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    color: palette.faint,
    textAlign: 'center' as const,
    marginTop: spacing.md,
  },

  // — Carte roulage (contexte coach) —
  roulageCard: {
    borderTopWidth: 2,
    borderTopColor: palette.coachAccent,
    padding: spacing.lg,
  },
  roulageTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  roulageMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  roulagePrice: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    marginTop: spacing.xs,
  },
  roulageStatus: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  roulageActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  // — Hub (build 23) : sections LE CLUB (violet) et ROUTES (vert) —
  hubSection: { marginTop: spacing.xxl },
  clubCard: {
    borderTopWidth: 2,
    borderTopColor: CLUB_TINT,
    padding: spacing.md,
  },
  galleryCover: {
    width: '100%' as const,
    height: 110,
    borderRadius: radius.sm,
    backgroundColor: palette.surface3,
  },
  galleryCoverEmpty: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: palette.line,
  },
  hubCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  hubCardTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  hubCardMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  hubChevron: {
    fontFamily: fonts.body,
    fontSize: 20,
    color: palette.creamMute,
    marginTop: -2,
  },
  tileRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  tile: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'flex-start' as const,
  },
  tileTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  tileMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 2,
  },
  routesCard: {
    borderTopWidth: 2,
    borderTopColor: ROUTES_TINT,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  routeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.md,
  },
  routeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  routeTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  routeDesc: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  routePlus: {
    fontFamily: fonts.mono,
    fontSize: fontSize.h3,
    color: ROUTES_TINT,
    marginTop: -2,
  },
};
