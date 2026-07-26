/**
 * Coach — Émettre une facture (P2, aide à la facture · émetteur = le coach).
 * Reskin refonte-v2 §12, RESPONSIVE deux formats (pas de maquette dédiée : on
 * applique le langage v2 des écrans frères de facturation — `coach/23-facturation`).
 *
 * Le coach saisit ses lignes de prestation, choisit un destinataire parmi SES
 * binômes (optionnel) et une date. L'app calcule HT/TVA/TTC selon le régime
 * déclaré (coachBillingLogic), alloue un numéro atomique côté serveur, écrit la
 * facture, puis propose le PDF. Aucun montant inventé ; le coach reste émetteur
 * et responsable. Paiement direct au coach, hors OXV.
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : header (eyebrow FACTURATION +
 *     titre « Nouvelle facture » + insigne coach) puis 2 colonnes — l'éditeur de
 *     lignes à gauche, le récapitulatif (totaux + CTA « Émettre » + rappel) à droite,
 *     à la manière d'un bon de facturation.
 *   - COMPAGNON (téléphone) : AppBar de retour + 1 colonne empilée (mêmes blocs).
 * Le rail (console) / les onglets (téléphone) viennent du layout : cet écran
 * n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Doctrine : vouvoiement, sans emoji ; chiffres en mono (JetBrains) ; honnêteté
 * (l'app aide, elle n'émet ni n'encaisse). Le CTA porte le ROUGE coach (identité
 * de rôle) ; l'argent n'est jamais en or (l'or reste réservé au chrono/record).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
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
import { KingNumber } from '@/ui/KingNumber';
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

/** Centimes → euros « 1 200,00 € » (espaces milliers, virgule fr). */
function euros(cents: number): string {
  const fixed = (cents / 100).toFixed(2).replace('.', ',');
  const [int, dec] = fixed.split(',');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec} €`;
}

/** Date du jour en ISO court (YYYY-MM-DD) pour préremplir la date de prestation. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Le motif d'échec, dit au coach dans ses mots.
 *
 * Les codes viennent de `issueInvoice`. Un code inconnu ne doit jamais produire
 * une phrase vide : on retombe sur une formulation honnête plutôt que muette.
 */
function messageEchecEmission(code: string | undefined): string {
  switch (code) {
    case 'vat_rate_missing':
      return "Votre régime indique que vous facturez la TVA, mais aucun taux exploitable n'est enregistré. Complétez votre identité de facturation avant d'émettre.";
    case 'billing_profile_incomplete':
      return "Votre identité de facturation est incomplète : il faut au minimum l'aide à la facture activée, un nom d'émetteur et un SIRET.";
    case 'not_authenticated':
      return 'Votre session a expiré. Reconnectez-vous, puis réessayez.';
    case 'numbering_failed':
      return "Le numéro de facture n'a pas pu être attribué. Aucune facture n'a été émise.";
    default:
      return "La facture n'a pas été émise. Votre saisie est conservée : vous pouvez réessayer.";
  }
}

export default function FactureNouvelleScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [state, setState] = useState<ScreenState>('loading');
  const [profile, setProfile] = useState<CoachBillingProfile | null>(null);
  const [pilots, setPilots] = useState<PilotOption[]>([]);

  const [pilotId, setPilotId] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [lines, setLines] = useState<LineDraft[]>([{ label: '', qty: '1', pu: '' }]);

  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ number: string; id?: string } | null>(null);
  // L'échec d'émission était TOTALEMENT muet : l'écran ne bougeait pas, et le
  // coach ne pouvait pas savoir si sa facture existait. Pire, le numéro peut
  // avoir été consommé — la séquence légale a avancé sans facture derrière.
  const [echec, setEchec] = useState<{ motif: string; numeroReserve?: string } | null>(null);
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
    setEchec(null);
    // La séquence légale suit l'année d'ÉMISSION (aujourd'hui), jamais la date de
    // prestation — sinon une prestation de décembre facturée en janvier casse la
    // continuité de numérotation.
    const year = new Date().getFullYear();
    // Nom du destinataire figé maintenant (conformité) — la facture restera
    // régénérable à l'identique même si le binôme change plus tard.
    const buyerName = pilotId ? (pilots.find((p) => p.id === pilotId)?.name ?? null) : null;
    const res = await issueInvoice({
      pilotId,
      buyerName,
      serviceDate: serviceDate.trim() || null,
      lines: validLines,
      year,
    });
    setIssuing(false);
    if (res.ok && res.number) {
      setIssued({ number: res.number, id: res.id });
      return;
    }
    setEchec({ motif: messageEchecEmission(res.error), numeroReserve: res.number });
  }

  async function onSharePdf() {
    if (!issued?.id) return;
    setSharing(true);
    const detail = await getInvoiceDetail(issued.id);
    if (detail) await exportAndShareCoachInvoice(detail, profile?.paymentLink ?? null);
    setSharing(false);
  }

  // — En-tête commun aux deux états (console : eyebrow + titre + insigne coach) —
  const consoleHead = (heading: string) => (
    <View style={s.consoleHead}>
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>FACTURATION</Text>
        <Text style={s.title} accessibilityRole="header">
          {heading}
        </Text>
      </View>
      <RoleBadge role="coach" />
    </View>
  );

  // ── Succès : la facture est écrite, on propose le PDF sans surprise. ──────────
  if (issued) {
    const summary = (
      <>
        <CockpitPanel>
          <Text style={s.panelEyebrow}>Facture émise</Text>
          <Text style={s.issuedNumber}>{issued.number}</Text>
          <Text style={s.issuedMeta}>
            {euros(totals.amountTotal)} · {validLines.length} ligne
            {validLines.length > 1 ? 's' : ''}
          </Text>
        </CockpitPanel>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <CoachCTA
            label="Générer le PDF"
            onPress={onSharePdf}
            loading={sharing}
            disabled={!issued.id}
            block
          />
          <Button label="Retour à la facturation" variant="ghost" onPress={() => router.back()} />
        </View>
      </>
    );

    return (
      <Screen>
        {isConsole ? null : <AppBar title="FACTURE ÉMISE" onBack={() => router.back()} />}
        <View style={isConsole ? s.consolePad : s.companionPad}>
          {isConsole ? consoleHead('Facture émise') : null}
          <View
            style={[
              isConsole ? s.narrow : undefined,
              { marginTop: isConsole ? spacing.xl : spacing.lg },
            ]}
          >
            {summary}
          </View>
        </View>
      </Screen>
    );
  }

  // ── Éditeur ──────────────────────────────────────────────────────────────────

  // Identité de facturation manquante : on oriente vers l'écran d'identité.
  const identityRequired = (
    <CockpitPanel plain>
      <Text style={s.panelEyebrow}>Identité requise</Text>
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
  );

  // L'éditeur (colonne gauche console / haut de pile compagnon) : destinataire,
  // date, lignes de prestation.
  const editor = (
    <>
      <Text style={s.sectionLabel}>DESTINATAIRE · OPTIONNEL</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}
        style={{ marginBottom: spacing.lg }}
      >
        <SelectPill label="Aucun" active={pilotId === null} onPress={() => setPilotId(null)} />
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
                accessibilityLabel={`Retirer la ligne ${i + 1}`}
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
        accessibilityLabel="Ajouter une ligne de prestation"
        style={s.addBtn}
        hitSlop={theme.hitSlop}
      >
        <Text style={s.addTxt}>+ Ajouter une ligne</Text>
      </Pressable>
    </>
  );

  // Récapitulatif (colonne droite console / bas de pile compagnon) : le chiffre
  // roi de l'écran = le total à régler (crème neutre — l'argent n'est jamais en or).
  const totalsPanel = (
    <CockpitPanel>
      <Text style={s.panelEyebrow}>Total à régler</Text>
      <KingNumber value={euros(totals.amountTotal)} color={palette.cream} size={38} />
      <View style={s.totBreak}>
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
      </View>
    </CockpitPanel>
  );

  const emitBlock = (
    <View>
      <CoachCTA
        label="Émettre la facture"
        onPress={onIssue}
        loading={issuing}
        disabled={validLines.length === 0}
        block
      />
      {echec ? (
        <View style={s.echecBloc} accessibilityLiveRegion="assertive">
          <Text style={s.echecTxt}>{echec.motif}</Text>
          {echec.numeroReserve ? (
            <Text style={s.echecTxt}>
              {`Le numéro ${echec.numeroReserve} a été réservé mais aucune facture ne le porte : la séquence comporte donc un trou. Signalez-le à votre comptable.`}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={s.footnote}>
        Vous restez l’émetteur et le responsable de cette facture. OXV n’émet pas et n’encaisse pas
        à votre place.
      </Text>
    </View>
  );

  let bodyContent: React.ReactNode;
  if (!canIssue) {
    bodyContent = <View style={isConsole ? s.narrow : undefined}>{identityRequired}</View>;
  } else if (isConsole) {
    // Console pleine : éditeur à gauche, récapitulatif + action à droite.
    bodyContent = (
      <View style={s.cols}>
        <View style={s.mainCol}>{editor}</View>
        <View style={s.aside}>
          {totalsPanel}
          {emitBlock}
        </View>
      </View>
    );
  } else {
    // Compagnon : une colonne empilée.
    bodyContent = (
      <View>
        {editor}
        <View style={{ marginTop: spacing.lg }}>{totalsPanel}</View>
        <View style={{ marginTop: spacing.xl }}>{emitBlock}</View>
      </View>
    );
  }

  return (
    <Screen>
      {isConsole ? null : <AppBar title="ÉMETTRE UNE FACTURE" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          consoleHead('Nouvelle facture')
        ) : (
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>
        )}

        <View style={{ marginTop: isConsole ? spacing.xl : 0 }}>
          <StateWrapper state={state} skeletonLines={6} errorCause="Facturation illisible.">
            {bodyContent}
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

/** CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le
 *  rouge. État désactivé honnête (atténué + non cliquable, jamais un contrôle mort). */
function CoachCTA({
  label,
  onPress,
  loading,
  disabled,
  block,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
}) {
  const inert = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={inert ? undefined : onPress}
      disabled={inert}
      style={({ pressed }) => [
        s.cta,
        block ? s.ctaBlock : null,
        disabled ? s.ctaDisabled : null,
        pressed && !inert ? { opacity: 0.9 } : null,
      ]}
    >
      <View style={s.ctaContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={[s.ctaTxt, disabled ? s.ctaTxtDisabled : null]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  echecBloc: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.edge,
    gap: spacing.sm,
  },
  echecTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.cream,
  },
  // — Gouttières —
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // — En-tête console —
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.sm,
  },

  // — Colonnes console —
  cols: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1.7 },
  aside: { flex: 1, maxWidth: 340, gap: spacing.lg },
  narrow: { maxWidth: 560, alignSelf: 'center', width: '100%' },

  // — Libellés de section —
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },

  // — Lignes de prestation —
  lineCard: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: palette.card,
  },
  lineRow: { flexDirection: 'row', gap: spacing.md },
  qtyField: { flex: 1, marginBottom: 0 },
  puField: { flex: 2, marginBottom: 0 },
  removeBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
  },
  removeTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textDecorationLine: 'underline',
  },
  addBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.creamSoft,
  },

  // — Récapitulatif des totaux —
  totBreak: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  totRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  totLabel: { fontFamily: fonts.body, fontSize: fontSize.body, color: palette.creamSoft },
  totValue: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.cream },
  totValueMute: { fontFamily: fonts.mono, fontSize: fontSize.small, color: palette.creamMute },

  // — Succès —
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
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.lg,
    lineHeight: fontSize.small * 1.5,
  },

  // — Pastilles de sélection (destinataire) —
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillOn: { borderColor: palette.cream, backgroundColor: 'rgba(255,255,255,0.07)' },
  pillTxt: { fontFamily: fonts.body, fontSize: fontSize.small, color: palette.creamMute },
  pillTxtOn: { color: palette.cream },

  // — CTA rouge coach —
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBlock: { alignSelf: 'stretch' },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaDisabled: { backgroundColor: '#2A2A2E' },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
  ctaTxtDisabled: { color: '#6A6A73' },
});
