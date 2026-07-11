/**
 * Coach — Émettre une facture (P2, aide à la facture · émetteur = le coach).
 *
 * Le coach saisit ses lignes de prestation, choisit un destinataire parmi SES
 * binômes (optionnel) et une date. L'app calcule HT/TVA/TTC selon le régime
 * déclaré (coachBillingLogic), alloue un numéro atomique côté serveur, écrit la
 * facture, puis propose le PDF. Aucun montant inventé ; le coach reste émetteur
 * et responsable. Paiement direct au coach, hors OXV.
 *
 * Doctrine : vouvoiement, sans emoji ; chiffres en mono ; honnêteté (l'app aide,
 * elle n'émet ni n'encaisse). L'argent n'est jamais en or (or = chrono).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  canIssueInvoice,
  computeInvoiceTotals,
  linesAmountHtCents,
  parseEurosToCents,
} from '@/services/coachBillingLogic';
import {
  type CoachBillingProfile,
  getInvoiceDetail,
  getMyBillingProfile,
  issueInvoice,
} from '@/services/coachBillingService';
import { exportAndShareCoachInvoice } from '@/services/coachInvoicePdfService';
import { listMyPilots } from '@/services/coachService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, fonts, fontSize, radius } = theme;

interface LineDraft {
  label: string;
  qty: string;
  pu: string;
}

interface PilotOption {
  id: string;
  name: string;
}

/** Centimes → euros « 1 200,00 € ». */
function euros(cents: number): string {
  const fixed = (cents / 100).toFixed(2).replace('.', ',');
  const [int, dec] = fixed.split(',');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec} €`;
}

/** Date du jour en ISO court (YYYY-MM-DD) pour préremplir la date de prestation. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FactureNouvelleScreen() {
  const [state, setState] = useState<ScreenState>('loading');
  const [profile, setProfile] = useState<CoachBillingProfile | null>(null);
  const [pilots, setPilots] = useState<PilotOption[]>([]);

  const [pilotId, setPilotId] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [lines, setLines] = useState<LineDraft[]>([{ label: '', qty: '1', pu: '' }]);

  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ number: string; id?: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, pl] = await Promise.all([getMyBillingProfile(), listMyPilots()]);
      if (cancelled) return;
      setProfile(p);
      setPilots(
        pl.map((x) => ({
          id: x.pilotId,
          name: [x.firstName, x.lastName].filter(Boolean).join(' ') || 'Pilote',
        }))
      );
      setState('nominal');
    })().catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canIssue =
    profile != null &&
    canIssueInvoice({
      invoicingAssistEnabled: profile.invoicingAssistEnabled,
      billingName: profile.billingName,
      billingSiret: profile.billingSiret,
    });

  const validLines = useMemo(
    () =>
      lines
        .map((l) => ({
          label: l.label.trim(),
          quantity: parseInt(l.qty, 10),
          unitPriceCents: parseEurosToCents(l.pu),
        }))
        .filter(
          (l): l is { label: string; quantity: number; unitPriceCents: number } =>
            l.label.length > 0 &&
            Number.isFinite(l.quantity) &&
            l.quantity > 0 &&
            l.unitPriceCents != null &&
            l.unitPriceCents > 0
        ),
    [lines]
  );

  const totals = useMemo(() => {
    const ht = linesAmountHtCents(validLines);
    return computeInvoiceTotals(ht, profile?.vatRegime ?? 'franchise', profile?.vatRate ?? null);
  }, [validLines, profile]);

  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { label: '', qty: '1', pu: '' }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function onIssue() {
    if (validLines.length === 0) return;
    setIssuing(true);
    // La séquence légale suit l'année d'ÉMISSION (aujourd'hui), jamais la date de
    // prestation — sinon une prestation de décembre facturée en janvier casse la
    // continuité de numérotation.
    const year = new Date().getFullYear();
    const res = await issueInvoice({
      pilotId,
      serviceDate: serviceDate.trim() || null,
      lines: validLines,
      year,
    });
    setIssuing(false);
    if (res.ok && res.number) setIssued({ number: res.number, id: res.id });
  }

  async function onSharePdf() {
    if (!issued?.id) return;
    setSharing(true);
    const detail = await getInvoiceDetail(issued.id);
    if (detail) await exportAndShareCoachInvoice(detail, profile?.paymentLink ?? null);
    setSharing(false);
  }

  // Succès : la facture est écrite, on propose le PDF sans surprise.
  if (issued) {
    return (
      <Screen>
        <AppBar title="FACTURE ÉMISE" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <CockpitPanel style={{ marginTop: spacing.lg }}>
            <Text style={s.eyebrow}>Facture émise</Text>
            <Text style={s.issuedNumber}>{issued.number}</Text>
            <Text style={s.issuedMeta}>
              {euros(totals.amountTotal)} · {validLines.length} ligne
              {validLines.length > 1 ? 's' : ''}
            </Text>
          </CockpitPanel>
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Button
              label="Générer le PDF"
              onPress={onSharePdf}
              loading={sharing}
              disabled={!issued.id}
            />
            <Button label="Retour à la facturation" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="ÉMETTRE UNE FACTURE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper state={state} skeletonLines={6} errorCause="Facturation illisible.">
          {!canIssue ? (
            <CockpitPanel plain style={{ marginTop: spacing.sm }}>
              <Text style={s.eyebrow}>Identité requise</Text>
              <Text style={s.body}>
                Renseignez votre identité de facturation (nom et SIRET) avant d’émettre une facture.
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  variant="ghost"
                  label="Compléter mon identité"
                  onPress={() => router.replace('/(coach)/facturation-identite' as never)}
                />
              </View>
            </CockpitPanel>
          ) : (
            <>
              {/* Destinataire optionnel : un binôme du coach. */}
              <Text style={s.sectionLabel}>DESTINATAIRE · OPTIONNEL</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}
                style={{ marginBottom: spacing.lg }}
              >
                <SelectPill
                  label="Aucun"
                  active={pilotId === null}
                  onPress={() => setPilotId(null)}
                />
                {pilots.map((p) => (
                  <SelectPill
                    key={p.id}
                    label={p.name}
                    active={pilotId === p.id}
                    onPress={() => setPilotId(p.id)}
                  />
                ))}
              </ScrollView>

              <Field
                label="Date de prestation"
                value={serviceDate}
                onChangeText={setServiceDate}
                placeholder="AAAA-MM-JJ"
                optional
                helper="Date de la prestation facturée."
                maxLength={10}
              />

              {/* Lignes de prestation. */}
              <Text style={s.sectionLabel}>PRESTATIONS</Text>
              <View style={{ gap: spacing.md }}>
                {lines.map((l, i) => (
                  <View key={i} style={s.lineCard}>
                    <Field
                      label={`Ligne ${i + 1}`}
                      value={l.label}
                      onChangeText={(t) => updateLine(i, { label: t })}
                      placeholder="Séance de coaching, analyse…"
                      maxLength={120}
                      containerStyle={{ marginBottom: spacing.md }}
                    />
                    <View style={s.lineRow}>
                      <Field
                        label="Quantité"
                        value={l.qty}
                        onChangeText={(t) => updateLine(i, { qty: t.replace(/\D/g, '') })}
                        keyboardType="number-pad"
                        maxLength={4}
                        containerStyle={s.qtyField}
                      />
                      <Field
                        label="Prix unitaire HT"
                        value={l.pu}
                        onChangeText={(t) => updateLine(i, { pu: t })}
                        keyboardType="decimal-pad"
                        unit="€"
                        placeholder="0,00"
                        maxLength={10}
                        containerStyle={s.puField}
                      />
                    </View>
                    {lines.length > 1 ? (
                      <Pressable
                        onPress={() => removeLine(i)}
                        accessibilityRole="button"
                        hitSlop={theme.hitSlop}
                        style={s.removeBtn}
                      >
                        <Text style={s.removeTxt}>Retirer cette ligne</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>

              <Pressable
                onPress={addLine}
                accessibilityRole="button"
                style={s.addBtn}
                hitSlop={theme.hitSlop}
              >
                <Text style={s.addTxt}>+ Ajouter une ligne</Text>
              </Pressable>

              {/* Aperçu des totaux — argent en crème neutre (l'or reste au chrono). */}
              <CockpitPanel style={{ marginTop: spacing.lg }}>
                <View style={s.totRow}>
                  <Text style={s.totLabel}>Total HT</Text>
                  <Text style={s.totValue}>{euros(totals.amountHt)}</Text>
                </View>
                <View style={s.totRow}>
                  <Text style={s.totLabel}>
                    TVA{totals.vatRate != null ? ` (${totals.vatRate} %)` : ''}
                  </Text>
                  <Text style={s.totValueMute}>
                    {totals.vatNote ? totals.vatNote : euros(totals.vatAmount)}
                  </Text>
                </View>
                <View style={[s.totRow, s.totGrand]}>
                  <Text style={s.totGrandLabel}>Total à régler</Text>
                  <Text style={s.totGrandValue}>{euros(totals.amountTotal)}</Text>
                </View>
              </CockpitPanel>

              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label="Émettre la facture"
                  onPress={onIssue}
                  loading={issuing}
                  disabled={validLines.length === 0}
                />
              </View>
              <Text style={s.footnote}>
                Vous restez l’émetteur et le responsable de cette facture. OXV n’émet pas et
                n’encaisse pas à votre place.
              </Text>
            </>
          )}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function SelectPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={theme.hitSlop}
      style={[s.pill, active ? s.pillOn : null]}
    >
      <Text style={[s.pillTxt, active ? s.pillTxtOn : null]}>{label}</Text>
    </Pressable>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },
  lineCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: palette.card,
  },
  lineRow: { flexDirection: 'row' as const, gap: spacing.md },
  qtyField: { flex: 1, marginBottom: 0 },
  puField: { flex: 2, marginBottom: 0 },
  removeBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' as const },
  removeTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  addBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.creamSoft,
  },
  totRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
  },
  totLabel: { fontFamily: fonts.body, fontSize: fontSize.body, color: palette.creamSoft },
  totValue: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.cream },
  totValueMute: { fontFamily: fonts.mono, fontSize: fontSize.small, color: palette.creamMute },
  totGrand: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  totGrandLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSize.bodyLg, color: palette.cream },
  totGrandValue: { fontFamily: fonts.mono, fontSize: fontSize.h3, color: palette.cream },
  issuedNumber: {
    fontFamily: fonts.mono,
    fontSize: fontSize.value,
    color: palette.cream,
    letterSpacing: 1,
  },
  issuedMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  footnote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    marginTop: spacing.lg,
    lineHeight: fontSize.small * 1.5,
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  pillOn: { borderColor: palette.cream, backgroundColor: 'rgba(255,255,255,0.07)' },
  pillTxt: { fontFamily: fonts.body, fontSize: fontSize.small, color: palette.creamMute },
  pillTxtOn: { color: palette.cream },
};
