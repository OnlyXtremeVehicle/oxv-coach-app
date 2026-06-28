/**
 * Pilote — Partenaires OXV (§8, F3).
 *
 * Le pilote découvre les partenaires VALIDÉS et leurs offres PUBLIÉES, et peut
 * « demander à être contacté » — un lead CONSENTI uniquement (§8.1) : le
 * consentement est explicite (confirmation) avant toute création. Le partenaire
 * ne reçoit que ce contact ; il ne voit jamais la donnée pilote.
 * Doctrine : sobre, vouvoiement, pas d'emoji, pas de promo agressive.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import * as haptics from '@/lib/haptics';
import {
  type MarketplacePartner,
  listMarketplace,
  listMyPilotLeads,
  requestPartnerContact,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

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

export default function PartenairesScreen() {
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([listMarketplace(), listMyPilotLeads()])
      .then(([list, leads]) => {
        setPartners(list);
        setRequested(new Set(leads.map((l) => l.partnerId)));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function ask(partner: MarketplacePartner, offerId: string | null) {
    Alert.alert(
      'Demander à être contacté ?',
      `En confirmant, vous autorisez ${partner.displayName} à vous contacter. Vous restez libre de ne pas donner suite.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            const res = await requestPartnerContact({ partnerId: partner.id, offerId });
            if (!res.ok) {
              Toast.show({ type: 'error', text1: 'La demande a échoué.' });
              return;
            }
            haptics.success();
            Toast.show({ type: 'success', text1: 'Demande envoyée.' });
            reload();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="PARTENAIRES" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="PARTENAIRES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>AUTOUR DE VOS SORTIES</Text>
        <Text style={s.title} accessibilityRole="header">
          Les partenaires OXV
        </Text>

        {partners.length === 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <EmptyState
              label="À venir"
              message="Les partenaires OXV apparaîtront ici."
              source="partner_accounts"
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            {partners.map((p) => {
              const done = requested.has(p.id);
              return (
                <Card key={p.id}>
                  <Text style={s.partnerName}>{p.displayName}</Text>
                  <Text style={s.partnerType}>{TYPE_LABEL[p.type] ?? 'Partenaire'}</Text>
                  {p.description ? <Text style={s.partnerDesc}>{p.description}</Text> : null}

                  {p.offers.length > 0 ? (
                    <View style={{ gap: 4, marginTop: theme.spacing.md }}>
                      {p.offers.map((o) => (
                        <View key={o.id} style={s.offerRow}>
                          <Text style={s.offerTitle} numberOfLines={1}>
                            {o.title}
                          </Text>
                          {o.priceEur != null ? (
                            <Text style={s.offerPrice}>{o.priceEur} €</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      done
                        ? 'Demande déjà envoyée'
                        : `Demander à être contacté par ${p.displayName}`
                    }
                    disabled={done}
                    hitSlop={theme.hitSlop}
                    onPress={() => ask(p, p.offers[0]?.id ?? null)}
                    style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={[s.ctaT, done && { color: theme.palette.faint }]}>
                      {done ? 'Demande envoyée' : 'Demander à être contacté'}
                    </Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}
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
  partnerName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  partnerType: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  partnerDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  offerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  offerTitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    flex: 1,
  },
  offerPrice: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  cta: {
    marginTop: theme.spacing.lg,
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  ctaT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
};
