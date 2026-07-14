/**
 * Coach — Identité de facturation (P2, aide à la facture · émetteur = le coach).
 * Reskin refonte-v2 §12, RESPONSIVE deux formats (décision fondateur 2026-07-13).
 *
 * Le coach renseigne l'identité qui figurera comme ÉMETTEUR sur ses factures :
 * nom, forme juridique, adresse, SIRET, régime de TVA. Ces valeurs sont copiées
 * (snapshot) sur chaque facture au moment de son émission. Le SIRET est validé en
 * douceur (Luhn) — indice, jamais bloquant : le coach reste responsable.
 *
 * Pas de maquette dédiée → on applique le langage v2 des écrans FRÈRES du flux
 * facturation (coach/23-facturation, facture-nouvelle) : en-tête eyebrow rouge
 * coach + titre + manifeste, corps de formulaire, et l'encart vert « l'émetteur,
 * c'est vous » propre au flux. Cohérence, pas fidélité pixel.
 *
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes — à
 *     gauche le formulaire (émetteur, régime, règlement), à droite l'encart vert
 *     + le rappel comptable + Enregistrer.
 *   - COMPAGNON téléphone : une colonne, les mêmes blocs empilés.
 * Le rail §12 / les onglets sont portés par (coach)/_layout ; l'écran n'adapte que
 * son corps et garde toujours le retour ‹ (sous-écran, pas racine de rail).
 *
 * Données réelles : chaque champ trace 1:1 vers coach_profiles (billing_name /
 * billing_legal_form / billing_siret / billing_address / vat_regime / vat_rate /
 * payment_link) via coachBillingService — ZÉRO colonne nouvelle. Absent = champ
 * vide, aucune valeur inventée, aucun contrôle mort. Identité COACH rouge
 * (#E23A4E) ; pas d'or (aucun chrono ici) ; couleurs QDI non convoquées.
 * Doctrine : vouvoiement, sans emoji ; honnêteté (l'app aide, elle n'émet pas et
 * n'encaisse pas). Chiffres en mono via le kit ; labels lisibles (Field).
 * Logique, services, états et navigation inchangés.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  COACH_LEGAL_FORMS,
  isValidSiret,
  normalizeSiret,
  type VatRegime,
} from '@/services/coachBillingLogic';
import { getMyBillingProfile, updateMyBillingProfile } from '@/services/coachBillingService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, fonts, fontSize, radius } = theme;

const REGIME_OPTIONS = ['Franchise', 'Assujetti'] as const;

export default function FacturationIdentiteScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [state, setState] = useState<ScreenState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [siret, setSiret] = useState('');
  const [address, setAddress] = useState('');
  const [legalForm, setLegalForm] = useState('');
  const [regime, setRegime] = useState<VatRegime>('franchise');
  const [vatRate, setVatRate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      const p = await getMyBillingProfile();
      if (cancelled) return;
      if (p) {
        setName(p.billingName ?? '');
        setSiret(p.billingSiret ?? '');
        setAddress(p.billingAddress ?? '');
        setLegalForm(p.billingLegalForm ?? '');
        setRegime(p.vatRegime);
        setVatRate(p.vatRate != null ? String(p.vatRate) : '');
        setPaymentLink(p.paymentLink ?? '');
      }
      setState('nominal');
    })().catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const siretTouched = siret.trim().length > 0;
  const siretLooksWrong = siretTouched && !isValidSiret(siret);
  const canSave = name.trim().length > 0 && siret.trim().length > 0 && !saving;

  async function onSave() {
    setSaving(true);
    const parsedRate = regime === 'assujetti' ? Number(vatRate.replace(',', '.')) : null;
    const res = await updateMyBillingProfile({
      billingName: name.trim() || null,
      billingSiret: normalizeSiret(siret) || null,
      billingAddress: address.trim() || null,
      billingLegalForm: legalForm || null,
      vatRegime: regime,
      vatRate:
        parsedRate != null && Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null,
      paymentLink: paymentLink.trim() || null,
    });
    setSaving(false);
    if (res.ok) router.back();
  }

  // — Fragments partagés par les deux formats (une seule source de vérité) —

  const formFields = (
    <View>
      <Field
        label="Nom de l’émetteur"
        value={name}
        onChangeText={setName}
        placeholder="Votre nom ou raison sociale"
        maxLength={120}
      />

      <View style={s.blockLabelWrap}>
        <Text style={s.blockLabel}>Forme juridique</Text>
        <Text style={s.blockOptional}> · optionnel</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.formsScroll}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <Segmented options={[...COACH_LEGAL_FORMS]} value={legalForm} onChange={setLegalForm} />
      </ScrollView>

      <Field
        label="SIRET"
        value={siret}
        onChangeText={setSiret}
        placeholder="14 chiffres"
        keyboardType="number-pad"
        maxLength={17}
        error={siretLooksWrong ? 'Ce SIRET semble incorrect (14 chiffres attendus).' : null}
        helper="Identifiant de votre structure. Vérifié en douceur, sans vous bloquer."
      />

      <Field
        label="Adresse"
        value={address}
        onChangeText={setAddress}
        placeholder="Adresse de facturation"
        optional
        multiline
        maxLength={240}
      />

      <View style={s.blockLabelWrap}>
        <Text style={s.blockLabel}>Régime de TVA</Text>
      </View>
      <View style={s.regimeBlock}>
        <Segmented
          options={[...REGIME_OPTIONS]}
          value={regime === 'franchise' ? 'Franchise' : 'Assujetti'}
          onChange={(v) => setRegime(v === 'Franchise' ? 'franchise' : 'assujetti')}
        />
        <Text style={s.regimeHint}>
          {regime === 'franchise'
            ? 'Franchise en base (micro) : pas de TVA. Mention « art. 293 B du CGI » portée automatiquement.'
            : 'Assujetti : la TVA au taux indiqué sera ajoutée au total.'}
        </Text>
      </View>

      {regime === 'assujetti' ? (
        <Field
          label="Taux de TVA"
          value={vatRate}
          onChangeText={setVatRate}
          placeholder="20"
          keyboardType="decimal-pad"
          unit="%"
          maxLength={5}
        />
      ) : null}

      <Field
        label="Coordonnées de règlement"
        value={paymentLink}
        onChangeText={setPaymentLink}
        placeholder="IBAN, lien de paiement…"
        optional
        helper="Figurera sur la facture. Le règlement vous revient directement, hors OXV."
        maxLength={200}
        containerStyle={{ marginBottom: 0 }}
      />
    </View>
  );

  // Encart vert « l'émetteur, c'est vous » — propre au flux facturation (cf.
  // coach/23-facturation, écran frère). Vert = état sûr/validé ; jamais l'or.
  const reassurePanel = (
    <Card style={s.reassure} accessibilityLabel="Vous êtes l’émetteur de vos factures">
      <View style={s.reassureRow}>
        <View style={s.reassureRing} />
        <Text style={s.reassureHead}>Vous êtes l’émetteur</Text>
      </View>
      <Text style={s.reassureBody}>
        Ces informations figurent comme émetteur sur vos factures. OXV vous aide à les établir — le
        paiement se fait en direct avec votre pilote, OXV n’encaisse rien.
      </Text>
    </Card>
  );

  const accountantNote = (
    <Text style={s.note}>
      Le gabarit et le régime de TVA restent à faire valider par votre comptable. Vous demeurez
      l’émetteur et le responsable.
    </Text>
  );

  const saveBlock = (
    <Button label="Enregistrer" onPress={onSave} disabled={!canSave} loading={saving} />
  );

  return (
    <Screen scroll={false}>
      <AppBar title="IDENTITÉ DE FACTURATION" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isConsole ? spacing.xl : spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>

          <Text style={s.eyebrow}>IDENTITÉ DE FACTURATION</Text>
          <Text style={s.title} accessibilityRole="header">
            Votre identité d’émetteur.
          </Text>
          <Text style={s.manifest}>
            Ces informations figurent comme émetteur sur vos factures. Vous en restez l’unique
            responsable — l’app vous aide seulement à les établir.
          </Text>

          <StateWrapper
            state={state}
            skeletonLines={6}
            errorCause="Profil de facturation illisible."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {isConsole ? (
              <View style={s.columns}>
                <View style={s.colLeft}>{formFields}</View>
                <View style={s.colRight}>
                  {reassurePanel}
                  <View style={{ marginTop: spacing.lg }}>{accountantNote}</View>
                  <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.xl }}>
                {formFields}
                <View style={{ marginTop: spacing.xl }}>{reassurePanel}</View>
                <View style={{ marginTop: spacing.lg }}>{accountantNote}</View>
                <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
              </View>
            )}
          </StateWrapper>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  // — En-tête (eyebrow rouge coach, cf. écrans frères §12) —
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },

  // — Colonnes console —
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  colLeft: { flex: 1.4 },
  colRight: { flex: 1, maxWidth: 340 },

  // — Libellés de bloc (lisibles, jamais un séparateur pâle) —
  blockLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  blockLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    letterSpacing: 0.2,
  },
  blockOptional: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.faint,
  },
  formsScroll: { marginBottom: spacing.lg },
  regimeBlock: { marginBottom: spacing.lg },
  regimeHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.5,
  },

  // — Encart « vous êtes l'émetteur » (vert = état sûr/validé ; jamais l'or) —
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

  note: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
});
