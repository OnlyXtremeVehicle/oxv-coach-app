/**
 * Découverte — racine de la zone (onglet 4), reskin refonte-v2 §7.10.
 *
 * Maquette (10-decouverte.png) : titre « Découverte » inline (sans retour) +
 * onglets PILLS « Coachs / Partenaires / Roulages » (état local, Coachs actif
 * par défaut). Onglet Coachs : cartes coach à ACCENT HAUT rouge coach
 * (`palette.coachAccent`), avatar initiales, nom, spécialité, prix réel s'il
 * existe, boutons « Voir la fiche » (bordé) / « Contacter » (plein rouge).
 * Onglet Partenaires : cartes à accent haut BLEU (`roleColors.partner`), badge
 * catégorie, bouton bleu « Demander le contact » (lead CONSENTI §8.1, flux
 * existant) + note de confidentialité. Onglet Roulages : invitations réelles
 * du pilote (accepter / décliner), restylées v2.
 *
 * Données RÉELLES uniquement : coachs publiés (coachMarketplaceService, RLS
 * `is_published`), partenaires validés + offres publiées (partnerService),
 * invitations roulages (roulagesService). Donnée absente = masquée/EmptyState.
 * Doctrine : vouvoiement, aucun emoji, aucun classement, ton descriptif.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import { ReportButton } from '@/components/ReportButton';
import * as haptics from '@/lib/haptics';
import { type CoachListing, listPublishedCoaches } from '@/services/coachMarketplaceService';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, roleColors, fonts, fontSize, spacing, radius } = theme;

type DiscoverTab = 'coachs' | 'partenaires' | 'roulages';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'coachs', label: 'Coachs' },
  { key: 'partenaires', label: 'Partenaires' },
  { key: 'roulages', label: 'Roulages' },
];

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
  const [tab, setTab] = useState<DiscoverTab>('coachs');
  const [loading, setLoading] = useState(true);

  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [invitations, setInvitations] = useState<PilotInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listPublishedCoaches(),
      listMarketplace(),
      listMyPilotLeads(),
      listMyInvitations(),
    ])
      .then(([coachList, partnerList, leads, invits]) => {
        if (cancelled) return;
        setCoaches(coachList);
        setPartners(partnerList);
        setRequested(new Set(leads.map((l) => l.partnerId)));
        setInvitations(invits);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                hitSlop={theme.hitSlop}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  s.pill,
                  active && s.pillActive,
                  pressed && !active && { opacity: 0.8 },
                ]}
              >
                <Text style={[s.pillT, active && s.pillActiveT]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : tab === 'coachs' ? (
          <CoachsTab coaches={coaches} />
        ) : tab === 'partenaires' ? (
          <PartenairesTab partners={partners} requested={requested} onAsk={askPartner} />
        ) : (
          <RoulagesTab invitations={invitations} busyId={busyId} onRespond={respond} />
        )}
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Onglet Coachs                                                       */
/* ------------------------------------------------------------------ */

function CoachsTab({ coaches }: { coaches: CoachListing[] }) {
  return (
    <View style={s.tabBody}>
      <Text style={s.sectionEyebrow}>Coachs</Text>
      {coaches.length === 0 ? (
        <EmptyState
          label="À venir"
          message="Les coachs apparaîtront ici dès qu’ils ouvriront leur fiche."
          source="coach_profiles"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {coaches.map((coach) => (
            <CoachCard key={coach.coachId} coach={coach} />
          ))}
        </View>
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
  // Tarif réel (season_price_eur). Absent = rien (jamais inventé). Le libellé
  // « saison » est honnête : c'est un tarif de saison, pas de séance.
  const price = coach.seasonPriceEur !== null ? `${Math.round(coach.seasonPriceEur)} €` : null;

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
          <Image
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
        {price ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.coachPrice}>{price}</Text>
            <Text style={s.coachPriceLabel}>saison</Text>
          </View>
        ) : null}
      </View>

      <View style={s.coachActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir la fiche de ${name}`}
          onPress={openFiche}
          style={({ pressed }) => [s.btnGhost, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.btnGhostT}>Voir la fiche</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Contacter ${name}`}
          onPress={openContact}
          style={({ pressed }) => [s.btnCoach, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.btnCoachT}>Contacter</Text>
        </Pressable>
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
  return (
    <View style={s.tabBody}>
      <Text style={s.sectionEyebrow}>Partenaires</Text>
      {partners.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir le catalogue des partenaires"
          onPress={() => router.push('/(app)/catalogue' as never)}
          style={({ pressed }) => [s.catalogueLink, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.catalogueLinkT}>Voir le catalogue</Text>
          <Text style={s.catalogueLinkChevron}>›</Text>
        </Pressable>
      ) : null}
      {partners.length === 0 ? (
        <EmptyState
          label="À venir"
          message="Les partenaires OXV apparaîtront ici."
          source="partner_accounts"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {partners.map((p) => {
            const done = requested.has(p.id);
            return (
              <Card key={p.id} style={s.partnerCard}>
                <View style={s.partnerBadge}>
                  <Text style={s.partnerBadgeT} numberOfLines={1}>
                    {TYPE_LABEL[p.type] ?? 'Partenaire'}
                  </Text>
                </View>
                <Text style={s.partnerName}>{p.displayName}</Text>
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

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    done ? 'Demande déjà envoyée' : `Demander le contact de ${p.displayName}`
                  }
                  accessibilityState={{ disabled: done }}
                  disabled={done}
                  onPress={() => onAsk(p)}
                  style={({ pressed }) => [s.btnPartner, pressed && !done && { opacity: 0.85 }]}
                >
                  <Text style={[s.btnPartnerT, done && { color: palette.faint }]}>
                    {done ? 'Demande envoyée' : 'Demander le contact'}
                  </Text>
                </Pressable>
                <Text style={s.privacyNote}>
                  Vous choisissez de partager. Ni votre télémétrie, ni votre identité.
                </Text>
              </Card>
            );
          })}
        </View>
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
      <Text style={s.sectionEyebrow}>Roulages</Text>
      {invitations.length === 0 ? (
        <EmptyState
          label="À venir"
          message="Vos invitations aux roulages apparaîtront ici."
          source="roulage_invitations"
        />
      ) : (
        <View style={{ gap: spacing.md }}>
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
        </View>
      )}
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
  avatarFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: palette.line,
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
  coachPrice: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  coachPriceLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
    marginTop: 2,
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
};
