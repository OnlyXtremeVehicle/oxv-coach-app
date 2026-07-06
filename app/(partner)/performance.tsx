/**
 * Espace Partenaire — Performance (PR-79).
 *
 * Agrégats DÉRIVÉS des leads et des offres du partenaire — aucune nouvelle table,
 * aucun tracking PII, aucune donnée pilote. Le partenaire voit le volume de
 * demandes reçues, leur suivi, et ses offres publiées. Lecture seule. Doctrine :
 * sobre, vouvoiement, pas d'emoji, pas de classement entre partenaires.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  type LeadStatus,
  listMyLeads,
  listMyOffers,
  loadMyPartnerAccount,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

interface PartnerPerf {
  leadsTotal: number;
  byStatus: Record<LeadStatus, number>;
  offersTotal: number;
  offersPublished: number;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Nouveaux',
  contacted: 'Contactés',
  booked: 'Réservés',
  lost: 'Perdus',
  archived: 'Archivés',
};
const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'booked', 'lost', 'archived'];

export default function PartnerPerformanceScreen() {
  const [perf, setPerf] = useState<PartnerPerf | null>(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadMyPartnerAccount()
      .then(async (acc) => {
        if (cancelled) return;
        if (!acc) {
          setHasAccount(false);
          setLoading(false);
          return;
        }
        const [leads, offers] = await Promise.all([listMyLeads(acc.id), listMyOffers(acc.id)]);
        if (cancelled) return;
        const byStatus: Record<LeadStatus, number> = {
          new: 0,
          contacted: 0,
          booked: 0,
          lost: 0,
          archived: 0,
        };
        for (const l of leads) byStatus[l.status] += 1;
        setPerf({
          leadsTotal: leads.length,
          byStatus,
          offersTotal: offers.length,
          offersPublished: offers.filter((o) => o.status === 'published').length,
        });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // reloadKey pilote la reprise manuelle (bouton Réessayer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useFocusEffect(reload);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !hasAccount || !perf
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="PERFORMANCE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="partner" />
        </View>
        <Text style={s.eyebrow}>VOTRE ACTIVITÉ</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos demandes, en chiffres.
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucun compte partenaire"
          emptyMessage="Aucun compte partenaire n'est rattaché à cet utilisateur."
          emptySource="partner_accounts"
          errorCause="Votre activité n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {perf ? (
            <>
              {/* Chiffre dominant : total des demandes. */}
              <View style={s.heroRow}>
                <Text style={s.hero}>{perf.leadsTotal}</Text>
                <Text style={s.heroLabel}>
                  demande{perf.leadsTotal > 1 ? 's' : ''} reçue{perf.leadsTotal > 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={s.subline}>
                {perf.offersPublished} offre{perf.offersPublished > 1 ? 's' : ''} publiée
                {perf.offersPublished > 1 ? 's' : ''} · {perf.offersTotal} au total
              </Text>

              {/* Suivi des demandes par statut. */}
              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>Suivi des demandes</SectionLabel>
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {STATUS_ORDER.map((st) => (
                    <Card key={st}>
                      <View style={s.rowBetween}>
                        <Text style={s.statusLabel}>{STATUS_LABEL[st]}</Text>
                        <Text style={s.statusValue}>{perf.byStatus[st]}</Text>
                      </View>
                    </Card>
                  ))}
                </View>
              </View>

              <Text style={s.note}>
                Des volumes issus de vos propres demandes et offres. Aucune donnée pilote, aucun
                classement entre partenaires.
              </Text>
            </>
          ) : null}
        </StateWrapper>
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
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  hero: {
    fontFamily: theme.fonts.display,
    fontSize: 56,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  heroLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    flex: 1,
  },
  subline: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  statusLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  statusValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.xxl,
  },
};
