/**
 * Espace Partenaire — Ma fiche (PR-36).
 *
 * Le partenaire enrichit sa fiche : zone géographique desservie + description.
 * Le nom, le type et le statut restent gérés par OXV (admin). Ecriture limitée à
 * son compte (RLS owns_partner_account). Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { Pressable } from 'react-native';
import {
  type PartnerAccount,
  type PartnerDocument,
  loadMyPartnerAccount,
  parsePartnerDocuments,
  updateMyPartnerAccount,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

export default function PartnerProfilScreen() {
  const [account, setAccount] = useState<PartnerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [geoZone, setGeoZone] = useState('');
  const [description, setDescription] = useState('');
  const [docs, setDocs] = useState<PartnerDocument[]>([]);
  const [docLabel, setDocLabel] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadMyPartnerAccount()
      .then((acc) => {
        if (!cancelled) {
          setAccount(acc);
          setGeoZone(acc?.geoZone ?? '');
          setDescription(acc?.description ?? '');
          setDocs(parsePartnerDocuments(acc?.documents));
          setLoading(false);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useFocusEffect(reload);

  const state: ScreenState = loading ? 'loading' : error ? 'error' : !account ? 'empty' : 'nominal';

  async function onSave() {
    if (!account || saving) return;
    setSaving(true);
    const res = await updateMyPartnerAccount(account.id, {
      geoZone: geoZone.trim() ? geoZone.trim() : null,
      description: description.trim() ? description.trim() : null,
    });
    setSaving(false);
    Toast.show({
      type: res.ok ? 'success' : 'error',
      text1: res.ok ? 'Fiche enregistrée.' : (res.error ?? 'Échec.'),
    });
  }

  async function saveDocs(next: PartnerDocument[]) {
    if (!account) return;
    setDocs(next);
    const res = await updateMyPartnerAccount(account.id, { documents: next });
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'Échec de l’enregistrement du document.' });
      reload();
    }
  }

  function onAddDoc() {
    const url = docUrl.trim();
    if (!url) {
      Toast.show({ type: 'error', text1: 'L’adresse du document est requise.' });
      return;
    }
    const label = docLabel.trim() || url;
    setDocLabel('');
    setDocUrl('');
    void saveDocs([...docs, { label, url }]);
  }

  function onRemoveDoc(i: number) {
    void saveDocs(docs.filter((_, j) => j !== i));
  }

  return (
    <Screen>
      <AppBar title="MA FICHE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md, marginTop: theme.spacing.sm }}>
          <RoleBadge role="partner" />
        </View>
        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucun compte partenaire"
          emptyMessage="Aucun compte partenaire n'est rattaché à cet utilisateur."
          emptySource="partner_accounts"
          errorCause="Votre fiche n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <>
            <Text style={s.eyebrow}>VOTRE FICHE</Text>
            <Text style={s.title} accessibilityRole="header">
              {account?.displayName}
            </Text>

            <Card style={{ marginTop: theme.spacing.lg }}>
              <Text style={s.note}>
                Le nom, le type et le statut de votre compte sont gérés par OXV. Vous pouvez
                enrichir votre zone et votre description.
              </Text>
            </Card>

            <View style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>Votre fiche</SectionLabel>
              <Field
                label="Zone desservie"
                optional
                value={geoZone}
                onChangeText={setGeoZone}
                placeholder="Ex. Charente, Nouvelle-Aquitaine…"
                maxLength={120}
              />
              <Field
                label="Description"
                optional
                value={description}
                onChangeText={setDescription}
                placeholder="Présentez votre activité…"
                multiline
                maxLength={600}
              />
              <View style={{ marginTop: theme.spacing.md }}>
                <Button label="Enregistrer ma fiche" loading={saving} onPress={onSave} />
              </View>
            </View>

            {/* Documents (PR-31) — liens vers vos documents (plaquette, conditions…).
                Liens externes, sans hébergement de fichier côté OXV pour l'instant. */}
            <View style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>Documents</SectionLabel>
              {docs.length > 0 ? (
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {docs.map((d, i) => (
                    <Card key={`${d.url}-${i}`}>
                      <View style={s.docRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.docLabel} numberOfLines={1}>
                            {d.label}
                          </Text>
                          <Text style={s.docUrl} numberOfLines={1}>
                            {d.url}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Retirer ${d.label}`}
                          hitSlop={6}
                          onPress={() => onRemoveDoc(i)}
                          style={({ pressed }) => [s.removeBtn, pressed && { opacity: 0.8 }]}
                        >
                          <Text style={s.removeT}>Retirer</Text>
                        </Pressable>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : (
                <Text style={s.note}>Aucun document pour l’instant.</Text>
              )}
              <View style={{ marginTop: theme.spacing.md }}>
                <Field
                  label="Intitulé"
                  optional
                  value={docLabel}
                  onChangeText={setDocLabel}
                  placeholder="Ex. Plaquette 2026"
                  maxLength={80}
                />
                <Field
                  label="Adresse (URL)"
                  optional
                  value={docUrl}
                  onChangeText={setDocUrl}
                  placeholder="https://…"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <View style={{ marginTop: theme.spacing.sm }}>
                  <Button label="Ajouter le document" variant="ghost" onPress={onAddDoc} />
                </View>
              </View>
            </View>
          </>
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
  },
  docRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  docLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  docUrl: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  removeBtn: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  removeT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
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
    lineHeight: theme.fontSize.small * 1.6,
  },
};
