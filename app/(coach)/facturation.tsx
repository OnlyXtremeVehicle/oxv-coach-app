/**
 * Coach — Facturation (P2, VISION_COACH_STUDIO.md · décision fondateur 2026-07-04).
 *
 * L'app AIDE le coach à établir SES factures — le CHOIX lui appartient
 * (`invoicing_assist_enabled`). Le paiement de la prestation va DIRECTEMENT au
 * coach, hors OXV : pas de suivi d'encaissement ni de « déverrouillage payant »
 * ici (modèle abandonné). On expose : le choix, l'identité de facturation, le
 * chiffre d'affaires (somme des factures émises) et la liste des factures.
 *
 * Gaté par le flag `coach_billing` (INACTIF jusqu'au SIRET d'OXV). Émetteur =
 * le coach ; l'app est un outil. Le rendu PDF est une étape ultérieure.
 */

import { useCallback, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { canIssueInvoice } from '@/services/coachBillingLogic';
import {
  type CoachBillingProfile,
  type CoachInvoiceSummary,
  getInvoiceDetail,
  getMyBillingProfile,
  listMyInvoices,
  setInvoicingAssist,
} from '@/services/coachBillingService';
import { exportAndShareCoachInvoice } from '@/services/coachInvoicePdfService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const { palette, spacing } = theme;

/** Centimes → euros « 4 820 € » (espaces milliers, décimales si nécessaire). */
function formatEuros(cents: number): string {
  const euros = cents / 100;
  const hasCents = cents % 100 !== 0;
  const fixed = hasCents ? euros.toFixed(2).replace('.', ',') : String(Math.round(euros));
  const [int, dec] = fixed.split(',');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${grouped},${dec} €` : `${grouped} €`;
}

export default function FacturationScreen() {
  const [flagOn, setFlagOn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<CoachBillingProfile | null>(null);
  const [invoices, setInvoices] = useState<CoachInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Rechargé à chaque focus (une facture émise ailleurs réapparaît ici) et sur
  // retry (reloadKey change → nouvelle identité du callback).
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      const on = await isFlagEnabled('coach_billing');
      if (cancelled) return;
      setFlagOn(on);
      if (!on) {
        setLoading(false);
        return;
      }
      const [p, inv] = await Promise.all([getMyBillingProfile(), listMyInvoices()]);
      if (cancelled) return;
      setProfile(p);
      setInvoices(inv);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useFocusEffect(load);

  async function sharePdf(id: string) {
    setSharingId(id);
    const detail = await getInvoiceDetail(id);
    if (detail) await exportAndShareCoachInvoice(detail, profile?.paymentLink ?? null);
    setSharingId(null);
  }

  async function toggleAssist(next: boolean) {
    setSaving(true);
    setProfile((prev) => (prev ? { ...prev, invoicingAssistEnabled: next } : prev));
    const res = await setInvoicingAssist(next);
    setSaving(false);
    if (!res.ok) setReloadKey((k) => k + 1); // revert par relecture serveur
  }

  const screenState: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  const assistOn = profile?.invoicingAssistEnabled ?? false;
  const canIssue =
    profile != null &&
    canIssueInvoice({
      invoicingAssistEnabled: profile.invoicingAssistEnabled,
      billingName: profile.billingName,
      billingSiret: profile.billingSiret,
    });
  const totalCents = invoices.reduce((sum, i) => sum + i.amountTotalCents, 0);

  return (
    <Screen>
      <AppBar title="FACTURATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper
          state={screenState}
          skeletonLines={5}
          errorCause="La facturation n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {flagOn === false ? (
            <CockpitPanel plain style={{ marginTop: spacing.sm }}>
              <Text style={s.eyebrow}>Bientôt</Text>
              <Text style={s.body}>
                La facturation assistée s&apos;ouvrira avec l&apos;immatriculation d&apos;OXV. Le
                paiement de vos prestations vous revient directement, hors OXV — l&apos;app vous
                aidera seulement à établir vos factures.
              </Text>
            </CockpitPanel>
          ) : (
            <>
              {/* LE CHOIX du coach : aide à la facturation (switch vert = actif). */}
              <Card style={{ marginTop: spacing.sm }}>
                <View style={s.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={s.rowTitle}>Aide à la facturation</Text>
                    <Text style={s.rowHint}>
                      {assistOn
                        ? 'Activée : l’app vous aide à établir vos factures. Vous en restez l’émetteur.'
                        : 'Désactivée : vous éditez vos factures de votre côté, hors de l’app.'}
                    </Text>
                  </View>
                  <Switch
                    value={assistOn}
                    disabled={saving}
                    onValueChange={toggleAssist}
                    accessibilityRole="switch"
                    accessibilityLabel="Aide à la facturation"
                    accessibilityState={{ checked: assistOn }}
                    trackColor={{ false: '#26262B', true: palette.green }}
                    thumbColor={palette.cream}
                  />
                </View>
              </Card>

              {assistOn && !canIssue ? (
                <CockpitPanel plain style={{ marginTop: spacing.lg }}>
                  <Text style={s.eyebrow}>Identité de facturation</Text>
                  <Text style={s.body}>
                    Renseignez votre nom d&apos;émetteur et votre SIRET pour que l&apos;app vous
                    aide à établir vos factures. Vous en restez l&apos;émetteur et le responsable.
                  </Text>
                  <View style={{ marginTop: spacing.lg }}>
                    <Button
                      variant="ghost"
                      label="Compléter mon identité de facturation"
                      onPress={() => router.push('/(coach)/facturation-identite' as never)}
                    />
                  </View>
                </CockpitPanel>
              ) : null}

              {assistOn && canIssue ? (
                <>
                  {/* Chiffre roi : chiffre d'affaires (somme des factures émises). */}
                  <View style={{ marginTop: spacing.lg }}>
                    <CockpitPanel>
                      <Text style={s.eyebrow}>Chiffre d&apos;affaires</Text>
                      {/* Argent, pas un chrono → crème neutre (l'or = chrono/record). */}
                      <KingNumber value={formatEuros(totalCents)} color={palette.cream} />
                      <Text style={s.meta}>
                        {invoices.length} facture{invoices.length > 1 ? 's' : ''} émise
                        {invoices.length > 1 ? 's' : ''}
                      </Text>
                    </CockpitPanel>
                  </View>

                  {/* Émettre une facture (identité complète requise, déjà garantie ici). */}
                  <View style={{ marginTop: spacing.lg }}>
                    <Button
                      label="Émettre une facture"
                      onPress={() => router.push('/(coach)/facture-nouvelle' as never)}
                    />
                  </View>

                  {/* Liste des factures — vide honnête si aucune. Toucher = PDF. */}
                  <Text style={[s.sectionLabel, { marginTop: spacing.xxl }]}>FACTURES ÉMISES</Text>
                  {invoices.length === 0 ? (
                    <EmptyState
                      label="Aucune facture"
                      message="Vos factures apparaîtront ici une fois émises."
                      source="coach_invoices"
                    />
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      {invoices.map((iv) => (
                        <Card
                          key={iv.id}
                          style={s.invoiceRow}
                          onPress={() => sharePdf(iv.id)}
                          accessibilityLabel={`Facture ${iv.number}, générer le PDF`}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={s.invoiceNumber}>{iv.number}</Text>
                            <Text style={s.invoiceMeta}>
                              {iv.serviceDate
                                ? `Prestation du ${formatDateShort(iv.serviceDate)}`
                                : `Émise le ${formatDateShort(iv.issuedAt)}`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.invoiceAmount}>{formatEuros(iv.amountTotalCents)}</Text>
                            <Text style={s.invoicePdf}>{sharingId === iv.id ? 'PDF…' : 'PDF'}</Text>
                          </View>
                        </Card>
                      ))}
                    </View>
                  )}

                  {/* Honnêteté : le PDF est disponible ; le gabarit reste à faire valider. */}
                  <Text style={s.footnote}>
                    Touchez une facture pour en générer le PDF. Le gabarit et le régime de TVA
                    restent à faire valider par votre comptable ; vous demeurez l&apos;émetteur.
                  </Text>
                </>
              ) : null}
            </>
          )}
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
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  rowTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  rowHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: theme.fontSize.small * 1.5,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  invoiceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  invoiceNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  invoiceMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  invoiceAmount: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    // Montant encaissé (argent, pas un chrono) → crème neutre. Décision Gabin
    // 2026-07-11 : le CA reste NEUTRE (l'or = chrono/record uniquement) ; seuls
    // les TARIFS d'offre portent le heritageGold (registre offre).
    color: palette.cream,
  },
  invoicePdf: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: palette.creamMute,
    marginTop: 2,
  },
  footnote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
