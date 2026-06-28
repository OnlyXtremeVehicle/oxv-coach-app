/**
 * Admin — Partenaires (§7).
 *
 * Valider / désactiver les comptes partenaires et superviser les leads. Écriture
 * réservée aux admins (RLS `is_admin` + trigger : seul l'admin change le statut).
 * Doctrine : sobre, accent bronze (rôle admin), vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  type LeadStatus,
  type PartnerAccount,
  countLeadsByStatus,
  listAllPartnerAccounts,
  setPartnerStatus,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const BRONZE = '#B87333';

const STATUS_LABEL: Record<PartnerAccount['status'], string> = {
  pending: 'EN ATTENTE',
  validated: 'VALIDÉ',
  disabled: 'DÉSACTIVÉ',
};

export default function AdminPartnersScreen() {
  const [partners, setPartners] = useState<PartnerAccount[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<LeadStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([listAllPartnerAccounts(), countLeadsByStatus()])
      .then(([list, counts]) => {
        setPartners(list);
        setLeadCounts(counts);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function changeStatus(p: PartnerAccount, status: PartnerAccount['status']) {
    const res = await setPartnerStatus(p.id, status);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'Action impossible.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Statut mis à jour.' });
    reload();
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

  const newLeads = leadCounts?.new ?? 0;

  return (
    <Screen>
      <AppBar title="PARTENAIRES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ÉCOSYSTÈME</Text>
        <Text style={s.title} accessibilityRole="header">
          Comptes & leads
        </Text>
        <Text style={s.summary}>
          <Text style={s.summaryNum}>{newLeads}</Text> lead{newLeads > 1 ? 's' : ''} nouveau
          {newLeads > 1 ? 'x' : ''} à traiter.
        </Text>

        {partners.length === 0 ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <EmptyState
              label="Aucun partenaire"
              message="Aucun compte partenaire pour l'instant."
              source="partner_accounts"
            />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            {partners.map((p) => (
              <Card key={p.id} style={{ borderColor: BRONZE }}>
                <View style={s.rowBetween}>
                  <Text style={s.name} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  <Text style={[s.status, p.status === 'validated' ? s.statusOn : null]}>
                    {STATUS_LABEL[p.status]}
                  </Text>
                </View>
                <Text style={s.type}>{p.type}</Text>

                <View style={s.actions}>
                  {p.status !== 'validated' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Valider ${p.displayName}`}
                      hitSlop={theme.hitSlop}
                      onPress={() => changeStatus(p, 'validated')}
                      style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={s.btnT}>Valider</Text>
                    </Pressable>
                  ) : null}
                  {p.status === 'validated' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Désactiver ${p.displayName}`}
                      hitSlop={theme.hitSlop}
                      onPress={() => changeStatus(p, 'disabled')}
                      style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={s.btnT}>Désactiver</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ))}
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
    color: BRONZE,
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
  summary: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  summaryNum: { fontFamily: theme.fonts.mono, color: theme.palette.cream },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: theme.palette.faint,
  },
  statusOn: { color: BRONZE },
  type: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  btn: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  btnT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
};
