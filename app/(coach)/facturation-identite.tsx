/**
 * Coach — Identité de facturation (P2, aide à la facture · émetteur = le coach).
 *
 * Le coach renseigne l'identité qui figurera comme ÉMETTEUR sur ses factures :
 * nom, forme juridique, adresse, SIRET, régime de TVA. Ces valeurs sont copiées
 * (snapshot) sur chaque facture au moment de son émission. Le SIRET est validé en
 * douceur (Luhn) — indice, jamais bloquant : le coach reste responsable.
 *
 * Doctrine : vouvoiement, sans emoji ; honnêteté (l'app aide, elle n'émet pas et
 * n'encaisse pas). Chiffres en mono via le kit ; labels lisibles (Field).
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

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
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, fonts, fontSize } = theme;

const REGIME_OPTIONS = ['Franchise', 'Assujetti'] as const;

export default function FacturationIdentiteScreen() {
  const [state, setState] = useState<ScreenState>('loading');
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
  }, []);

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

  return (
    <Screen>
      <AppBar title="IDENTITÉ DE FACTURATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper state={state} skeletonLines={6} errorCause="Profil de facturation illisible.">
          <Text style={s.intro}>
            Ces informations figureront comme émetteur sur vos factures. Vous en restez l’unique
            responsable — l’app vous aide seulement à les établir.
          </Text>

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
            style={{ marginBottom: spacing.lg }}
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
          <View style={{ marginBottom: spacing.lg }}>
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
          />

          <CockpitPanel plain style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            <Text style={s.note}>
              Le gabarit et le régime de TVA restent à faire valider par votre comptable. OXV n’émet
              pas et n’encaisse pas à votre place.
            </Text>
          </CockpitPanel>

          <Button label="Enregistrer" onPress={onSave} disabled={!canSave} loading={saving} />
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
    marginBottom: spacing.lg,
  },
  blockLabelWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
  regimeHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.5,
  },
  note: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },
};
