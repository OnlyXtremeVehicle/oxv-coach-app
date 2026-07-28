/**
 * Coach — Facturation (P2, VISION_COACH_STUDIO.md · décision fondateur 2026-07-04).
 * Reskin refonte-v2 §12 (maquette `coach/23-facturation`), RESPONSIVE deux formats.
 *
 * L'app AIDE le coach à établir SES factures — le CHOIX lui appartient
 * (`invoicing_assist_enabled`). Le paiement de la prestation va DIRECTEMENT au
 * coach, hors OXV : pas de suivi d'encaissement ni de « déverrouillage payant »
 * (modèle abandonné). On expose : le choix, l'identité de facturation, le chiffre
 * d'affaires (somme des factures émises) et la liste des factures. Émetteur = le
 * coach ; l'app est un outil. Gaté par le flag `coach_billing` (INACTIF jusqu'au
 * SIRET d'OXV). Le rendu PDF est une étape ultérieure (partage via share sheet).
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette `coach/23-facturation`) :
 *     header (eyebrow FACTURATION + titre + CTA rouge coach « Nouvelle facture »)
 *     puis 2 colonnes — le registre (chiffre d'affaires + factures récentes) à
 *     gauche, le rappel « vous êtes l'émetteur » + réglage + numérotation à droite.
 *   - COMPAGNON (téléphone) : 1 colonne compacte, mêmes éléments empilés.
 * Le rail (console) / les onglets (téléphone) viennent du layout : cet écran
 * n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Adaptations honnêtes vis-à-vis de la maquette (backend inchangé, ZÉRO table) :
 *   - la maquette montre des tuiles « encaissé » / « en attente » et des badges
 *     PAYÉE / ENVOYÉE : OXV NE SUIT PAS le paiement (n'encaisse rien), aucun statut
 *     de règlement n'existe → on ne l'invente pas. Les tuiles portent des valeurs
 *     RÉELLES (chiffre d'affaires émis + montant émis ce mois, dérivé de `issued_at`) ;
 *     la ligne montre le montant + l'accès PDF, sans badge de règlement.
 *   - le destinataire (« Adrien M. ») n'est pas porté par le résumé de facture ;
 *     on le résout parmi les binômes consentis (`listMyPilots`) quand c'est possible,
 *     sinon on affiche la date de prestation/émission. Aucune coordonnée exposée.
 *   - l'or reste réservé au chrono/record : le chiffre d'affaires (argent) est en
 *     crème neutre, jamais doré (décision fondateur 2026-07-11).
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
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
import { listMyPilots } from '@/services/coachService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { KingNumber } from '@/ui/KingNumber';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Centimes → euros « 4 820 € » (espaces milliers, décimales si nécessaire, virgule fr). */
function formatEuros(cents: number): string {
  const euros = cents / 100;
  const hasCents = cents % 100 !== 0;
  const fixed = hasCents ? euros.toFixed(2).replace('.', ',') : String(Math.round(euros));
  const [int, dec] = fixed.split(',');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${grouped},${dec} €` : `${grouped} €`;
}

/** Nom d'affichage court d'un binôme (« Adrien M. »), ou null si vide. Aucune coordonnée. */
function pilotShortName(firstName: string | null, lastName: string | null): string | null {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f && l) return `${f} ${l[0].toUpperCase()}.`;
  return f || l || null;
}

export default function FacturationScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [flagOn, setFlagOn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<CoachBillingProfile | null>(null);
  const [invoices, setInvoices] = useState<CoachInvoiceSummary[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  // `if (detail)` sans branche d'échec : quand la facture ne se relisait pas,
  // le coach touchait la ligne et rien ne se passait — indiscernable d'un
  // geste mal enregistré.
  const [erreurPdf, setErreurPdf] = useState(false);

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
      // Les binômes servent seulement à nommer les factures (résolu si possible) —
      // leur absence ne fait pas échouer l'écran (RLS déjà appliquée côté service).
      const [p, inv, pilots] = await Promise.all([
        getMyBillingProfile(),
        listMyInvoices(),
        listMyPilots().catch(() => []),
      ]);
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const pilot of pilots) {
        const name = pilotShortName(pilot.firstName, pilot.lastName);
        if (name) map.set(pilot.pilotId, name);
      }
      setProfile(p);
      setInvoices(inv);
      setNames(map);
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
    setErreurPdf(false);
    const detail = await getInvoiceDetail(id);
    if (detail) {
      await exportAndShareCoachInvoice(detail, profile?.paymentLink ?? null);
    } else {
      setErreurPdf(true);
    }
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
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  const monthCents = invoices.reduce((sum, i) => {
    const d = new Date(i.issuedAt);
    return d.getFullYear() === nowY && d.getMonth() === nowM ? sum + i.amountTotalCents : sum;
  }, 0);
  const monthName = now.toLocaleDateString('fr-FR', { month: 'long' });

  const goNew = () => router.push('/(coach)/facture-nouvelle' as never);

  // — Pièces réutilisées entre les deux formats —
  const toggleCard = <AssistToggle assistOn={assistOn} saving={saving} onToggle={toggleAssist} />;
  const reassure = <ReassurePanel />;
  const numbering = <Text style={s.numbering}>Numérotation automatique par année.</Text>;

  const ledger = (
    <View>
      <SummaryTiles
        totalCents={totalCents}
        monthCents={monthCents}
        count={invoices.length}
        monthName={monthName}
        isConsole={isConsole}
      />

      {/* Console : le CTA vit dans le header. Compagnon : bloc rouge sous les tuiles. */}
      {!isConsole ? (
        <View style={{ marginTop: spacing.lg }}>
          <CoachCTA label="+ Nouvelle facture" onPress={goNew} block />
        </View>
      ) : null}

      <Text style={[s.sectionLabel, { marginTop: spacing.xxl }]}>RÉCENTES</Text>
      {invoices.length === 0 ? (
        <EmptyState
          label="Aucune facture"
          message="Vos factures apparaîtront ici une fois émises."
          source="coach_invoices"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {invoices.map((iv) => (
            <InvoiceRow
              key={iv.id}
              iv={iv}
              name={iv.pilotId ? (names.get(iv.pilotId) ?? null) : null}
              sharing={sharingId === iv.id}
              onPress={() => sharePdf(iv.id)}
            />
          ))}
        </View>
      )}

      {erreurPdf ? (
        <Text style={s.erreurPdfTxt} accessibilityLiveRegion="assertive">
          Cette facture n&apos;a pas pu être relue : son PDF n&apos;a pas été produit. Réessayez
          dans un instant.
        </Text>
      ) : null}
      <Text style={s.footnote}>
        Touchez une facture pour en générer le PDF. Le gabarit et le régime de TVA restent à faire
        valider par votre comptable ; vous demeurez l’émetteur.
      </Text>
    </View>
  );

  const identityPrompt = (
    <CockpitPanel plain>
      <Text style={s.panelEyebrow}>Identité de facturation</Text>
      <Text style={s.body}>
        Renseignez votre nom d’émetteur et votre SIRET pour que l’app vous aide à établir vos
        factures. Vous en restez l’émetteur et le responsable.
      </Text>
      <View style={{ marginTop: spacing.lg }}>
        <Button
          variant="ghost"
          label="Compléter mon identité de facturation"
          onPress={() => router.push('/(coach)/facturation-identite' as never)}
        />
      </View>
    </CockpitPanel>
  );

  const calmNote = (
    <Text style={s.calmNote}>
      Aide désactivée : vous éditez vos factures de votre côté, hors de l’app. Activez l’aide pour
      que l’app vous aide à les établir.
    </Text>
  );

  const stateMain = canIssue ? ledger : assistOn ? identityPrompt : calmNote;

  // — Corps selon l'état / le format —
  let bodyContent: React.ReactNode;
  if (flagOn === false) {
    bodyContent = (
      <View style={isConsole ? s.narrow : undefined}>
        <CockpitPanel plain>
          <Text style={s.panelEyebrow}>Bientôt</Text>
          <Text style={s.body}>
            La facturation assistée s’ouvrira avec l’immatriculation d’OXV. Le paiement de vos
            prestations vous revient directement, hors OXV — l’app vous aidera seulement à établir
            vos factures.
          </Text>
        </CockpitPanel>
      </View>
    );
  } else if (isConsole && canIssue) {
    // Console pleine : registre à gauche, contexte + réglage + numérotation à droite.
    bodyContent = (
      <View style={s.cols}>
        <View style={s.mainCol}>{ledger}</View>
        <View style={s.aside}>
          {reassure}
          {toggleCard}
          {numbering}
        </View>
      </View>
    );
  } else {
    // Console réduite (non prêt) OU compagnon : une colonne empilée.
    bodyContent = (
      <View style={[isConsole ? s.narrow : undefined, { gap: spacing.xl }]}>
        {toggleCard}
        {stateMain}
        {reassure}
        {numbering}
      </View>
    );
  }

  return (
    <Screen>
      {isConsole ? null : <AppBar title="FACTURATION" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>FACTURATION</Text>
              <Text style={s.title} accessibilityRole="header">
                Vos factures
              </Text>
            </View>
            {canIssue ? <CoachCTA label="+ Nouvelle facture" onPress={goNew} /> : null}
          </View>
        ) : (
          <>
            <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>L’émetteur, c’est vous</Text>
            <Text style={s.title} accessibilityRole="header">
              Vos factures
            </Text>
          </>
        )}

        <View style={{ marginTop: isConsole ? spacing.xl : spacing.lg }}>
          <StateWrapper
            state={screenState}
            skeletonLines={5}
            errorCause="La facturation n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {bodyContent}
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Tuiles de synthèse — chiffre d'affaires (roi, crème) + montant émis ce mois. */
function SummaryTiles({
  totalCents,
  monthCents,
  count,
  monthName,
  isConsole,
}: {
  totalCents: number;
  monthCents: number;
  count: number;
  monthName: string;
  isConsole: boolean;
}) {
  return (
    <View style={[s.tiles, isConsole ? s.tilesRow : s.tilesCol]}>
      <CockpitPanel style={isConsole ? { flex: 1.4 } : undefined}>
        <Text style={s.panelEyebrow}>Chiffre d’affaires</Text>
        {/* Argent, pas un chrono → crème neutre (l'or = chrono/record). */}
        <KingNumber value={formatEuros(totalCents)} color={palette.cream} />
        <Text style={s.heroMeta}>
          {count} facture{count > 1 ? 's' : ''} émise{count > 1 ? 's' : ''}
        </Text>
      </CockpitPanel>
      <CockpitPanel plain style={isConsole ? { flex: 1 } : undefined}>
        <Text style={s.panelEyebrow}>Émises · {monthName}</Text>
        <Text style={s.monthValue}>{formatEuros(monthCents)}</Text>
      </CockpitPanel>
    </View>
  );
}

/** Ligne de facture — toucher = génère le PDF (share sheet). Aucun badge de règlement. */
function InvoiceRow({
  iv,
  name,
  sharing,
  onPress,
}: {
  iv: CoachInvoiceSummary;
  name: string | null;
  sharing: boolean;
  onPress: () => void;
}) {
  const dateLabel = iv.serviceDate
    ? `Prestation du ${formatDateShort(iv.serviceDate)}`
    : `Émise le ${formatDateShort(iv.issuedAt)}`;
  const primary = name ?? dateLabel;
  const a11y = `Facture ${iv.number}${name ? `, ${name}` : ''}, ${formatEuros(
    iv.amountTotalCents
  )}, générer le PDF`;

  return (
    <Card style={s.invoiceRow} onPress={onPress} accessibilityLabel={a11y}>
      <View style={{ flex: 1 }}>
        <Text style={s.invNumber}>{iv.number}</Text>
        <Text style={s.invPrimary} numberOfLines={1}>
          {primary}
        </Text>
        {name ? (
          <Text style={s.invMeta} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      <View style={s.invRight}>
        <Text style={s.invAmount}>{formatEuros(iv.amountTotalCents)}</Text>
        <Text style={s.invPdf}>{sharing ? 'PDF…' : 'PDF'}</Text>
      </View>
    </Card>
  );
}

/** Rappel doctrinal (état rassuré, vert de validation) : le coach est l'émetteur. */
function ReassurePanel() {
  return (
    <View style={s.reassure} accessibilityRole="summary">
      <View style={s.reassureRow}>
        <View style={s.reassureRing} />
        <Text style={s.reassureHead}>Vous êtes l’émetteur</Text>
      </View>
      <Text style={s.reassureBody}>
        OXV vous aide à établir vos factures. Le paiement se fait en direct avec votre pilote — OXV
        n’encaisse rien.
      </Text>
    </View>
  );
}

/** LE CHOIX du coach : aide à la facturation (switch vert = actif/validé). */
function AssistToggle({
  assistOn,
  saving,
  onToggle,
}: {
  assistOn: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <Card style={s.toggleRow}>
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
        onValueChange={onToggle}
        accessibilityRole="switch"
        accessibilityLabel="Aide à la facturation"
        accessibilityState={{ checked: assistOn }}
        trackColor={{ false: '#26262B', true: palette.green }}
        thumbColor={palette.cream}
      />
    </Card>
  );
}

/** CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le rouge. */
function CoachCTA({
  label,
  onPress,
  block,
}: {
  label: string;
  onPress: () => void;
  block?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Émettre une nouvelle facture"
      onPress={onPress}
      style={({ pressed }) => [s.cta, block ? s.ctaBlock : null, pressed ? { opacity: 0.9 } : null]}
    >
      <Text style={s.ctaTxt}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  erreurPdfTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.cream,
    marginBottom: spacing.sm,
  },
  // — Gouttières —
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },

  // — En-têtes —
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

  // — Tuiles de synthèse —
  tiles: { gap: spacing.md },
  tilesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tilesCol: { flexDirection: 'column' },
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  heroMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.5,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  monthValue: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.value,
    letterSpacing: -0.5,
    color: palette.cream,
    marginTop: spacing.xs,
  },

  // — Liste des factures —
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  invNumber: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.eyebrow,
  },
  invPrimary: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    marginTop: 2,
  },
  invMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  invRight: { alignItems: 'flex-end' },
  invAmount: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.h3,
    // Montant émis (argent, pas un chrono) → crème neutre. L'or reste au chrono/record.
    color: palette.cream,
  },
  invPdf: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: palette.creamMute,
    marginTop: 2,
  },

  // — Rappel « vous êtes l'émetteur » (vert de validation, jamais l'or ni le rouge mal placé) —
  reassure: {
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.28)',
    backgroundColor: 'rgba(79,201,138,0.06)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  reassureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reassureRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: palette.green,
  },
  reassureHead: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.green,
  },
  reassureBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamSoft,
    marginTop: spacing.sm,
  },
  numbering: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
  },

  // — Réglage (switch) —
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  rowHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: fontSize.small * 1.5,
  },

  // — Panneaux d'état (bientôt / identité) —
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },
  calmNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
  footnote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.xxl,
    lineHeight: fontSize.small * 1.5,
  },

  // — CTA rouge coach —
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBlock: { alignSelf: 'stretch', minHeight: 48 },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
});
