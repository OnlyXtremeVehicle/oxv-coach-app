/**
 * Espace Partenaire — tableau de bord (§8, §21 Partner Dashboard).
 *
 * Fondation (PR-F1) : statut du compte, nombre d'offres, nombre de leads. La
 * création d'offres (F2) et le suivi des leads (F4) viennent ensuite. Lecture
 * seule ici. Aucune donnée pilote individuelle (aucune télémétrie) — par RLS.
 * Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { EmptyState } from '@/components/instruments/EmptyState';
import {
  type MyEventPartnership,
  eventTypeLabel,
  listMyEventPartnerships,
} from '@/services/eventsService';
import {
  type PartnerAccount,
  type PartnerLead,
  type PartnerOffer,
  listMyLeads,
  listMyOffers,
  loadMyPartnerAccount,
} from '@/services/partnerService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';

const STATUS_LABEL: Record<PartnerAccount['status'], string> = {
  pending: 'En attente de validation OXV',
  validated: 'Compte validé',
  disabled: 'Compte désactivé',
};

export default function PartnerHubScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const [account, setAccount] = useState<PartnerAccount | null>(null);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [myEvents, setMyEvents] = useState<MyEventPartnership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const acc = await loadMyPartnerAccount();
      if (cancelled) return;
      setAccount(acc);
      if (acc) {
        const [o, l, ev] = await Promise.all([
          listMyOffers(acc.id),
          listMyLeads(acc.id),
          listMyEventPartnerships(),
        ]);
        if (cancelled) return;
        setOffers(o);
        setLeads(l);
        setMyEvents(ev);
      }
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="PARTENAIRE OXV" leading={<Logo size={26} />} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  const newLeads = leads.filter((l) => l.status === 'new').length;
  const publishedOffers = offers.filter((o) => o.status === 'published').length;

  return (
    <Screen>
      <AppBar title="PARTENAIRE OXV" leading={<Logo size={26} />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {account ? (
          <>
            <Text style={s.eyebrow}>{STATUS_LABEL[account.status].toUpperCase()}</Text>
            <Text style={s.title} accessibilityRole="header">
              {account.displayName}
            </Text>

            <View
              style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xl }}
            >
              <Fact
                value={offers.length.toString()}
                label={offers.length > 1 ? 'offres' : 'offre'}
              />
              <Fact value={publishedOffers.toString()} label="publiée" />
              <Fact value={newLeads.toString()} label={newLeads > 1 ? 'leads' : 'lead'} />
            </View>

            {account.status === 'pending' ? (
              <Card style={{ marginTop: theme.spacing.xl }}>
                <Text style={s.note}>
                  Votre compte est en cours de validation par l&apos;équipe OXV. Vos offres seront
                  visibles des pilotes une fois le compte validé.
                </Text>
              </Card>
            ) : null}

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
              <Card
                onPress={() => router.push('/(partner)/offres' as never)}
                accessibilityLabel="Mes offres. Créer et publier vos offres."
              >
                <Text style={s.cardTitle}>Mes offres</Text>
                <Text style={s.cardHint}>Créer et publier vos offres.</Text>
              </Card>
              <Card
                onPress={() => router.push('/(partner)/rapports' as never)}
                accessibilityLabel="Mes rapports. Les rapports d'événement partagés par OXV."
              >
                <Text style={s.cardTitle}>Mes rapports</Text>
                <Text style={s.cardHint}>Les bilans d&apos;événement partagés par OXV.</Text>
              </Card>
            </View>

            {myEvents.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
                <Text style={s.eyebrow}>MES ÉVÉNEMENTS</Text>
                {myEvents.map((m) =>
                  m.event ? (
                    <Card key={m.id}>
                      <Text style={s.cardTitle}>{m.event.name}</Text>
                      <Text style={s.cardHint}>
                        {eventTypeLabel(m.event.eventType)} · {m.event.locationName}
                      </Text>
                    </Card>
                  ) : null
                )}
              </View>
            ) : null}
            {/* Suivi des leads (F4) à venir. */}
          </>
        ) : (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucun compte partenaire"
              message="Aucun compte partenaire n'est rattaché à cet utilisateur. Contactez l'équipe OXV."
              source="partner_accounts"
            />
          </View>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            onPress={() => signOut()}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
