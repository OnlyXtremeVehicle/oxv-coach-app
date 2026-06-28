/**
 * Espace Partenaire — Mes offres (§8, F2).
 *
 * Le partenaire crée / édite / publie / archive ses offres. Écriture réservée à
 * son compte (RLS `owns_partner_account`). Le prix est AFFICHÉ, pas encaissé.
 * Doctrine : sobre, vouvoiement, pas d'emoji. Deux vues : liste puis formulaire.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type OfferStatus,
  type PartnerOffer,
  type UpsertOfferInput,
  deleteOffer,
  listMyOffers,
  loadMyPartnerAccount,
  upsertOffer,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const STATUS_OPTIONS: { v: OfferStatus; label: string }[] = [
  { v: 'draft', label: 'Brouillon' },
  { v: 'published', label: 'Publiée' },
  { v: 'archived', label: 'Archivée' },
];

interface Draft {
  id: string | null;
  title: string;
  description: string;
  priceEur: string;
  quota: string;
  status: OfferStatus;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  title: '',
  description: '',
  priceEur: '',
  quota: '',
  status: 'draft',
};

function draftFromOffer(o: PartnerOffer): Draft {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? '',
    priceEur: o.priceEur != null ? String(o.priceEur) : '',
    quota: o.quota != null ? String(o.quota) : '',
    status: o.status,
  };
}

export default function PartnerOffersScreen() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    loadMyPartnerAccount()
      .then(async (acc) => {
        if (!acc) {
          setPartnerId(null);
          setOffers([]);
          return;
        }
        setPartnerId(acc.id);
        setOffers(await listMyOffers(acc.id));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function onSave() {
    if (!draft || !partnerId) return;
    const title = draft.title.trim();
    if (!title) {
      Toast.show({ type: 'error', text1: 'Le titre est requis.' });
      return;
    }
    const priceEur = draft.priceEur.trim() ? Number(draft.priceEur.replace(',', '.')) : null;
    const quota = draft.quota.trim() ? Number(draft.quota) : null;
    if (priceEur != null && !Number.isFinite(priceEur)) {
      Toast.show({ type: 'error', text1: 'Le prix doit être un nombre.' });
      return;
    }
    if (quota != null && !Number.isFinite(quota)) {
      Toast.show({ type: 'error', text1: 'Le quota doit être un nombre.' });
      return;
    }
    const input: UpsertOfferInput = {
      id: draft.id,
      partnerId,
      title,
      description: draft.description.trim() ? draft.description.trim() : null,
      priceEur: priceEur != null ? Math.round(priceEur) : null,
      quota: quota != null ? Math.round(quota) : null,
      status: draft.status,
    };
    setSaving(true);
    const res = await upsertOffer(input);
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Échec de l’enregistrement.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Offre enregistrée.' });
    setDraft(null);
    reload();
  }

  async function onDelete() {
    const id = draft?.id;
    if (!id) return;
    const res = await deleteOffer(id);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'La suppression a échoué.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Offre supprimée.' });
    setDraft(null);
    reload();
  }

  // ── Vue formulaire ──
  if (draft) {
    return (
      <Screen>
        <AppBar title="OFFRE" onBack={() => setDraft(null)} />
        <View style={s.body}>
          <Text style={s.h1} accessibilityRole="header">
            {draft.id ? 'Modifier l’offre' : 'Nouvelle offre'}
          </Text>

          <View style={{ marginTop: theme.spacing.lg }}>
            <Field
              label="Titre"
              value={draft.title}
              onChangeText={(v) => update({ title: v })}
              placeholder="Ex. Shooting photo en piste"
              maxLength={120}
            />
            <Field
              label="Description"
              optional
              value={draft.description}
              onChangeText={(v) => update({ description: v })}
              placeholder="Quelques mots sur l’offre…"
              multiline
              maxLength={600}
            />
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Prix (€)"
                  optional
                  value={draft.priceEur}
                  onChangeText={(v) => update({ priceEur: v })}
                  placeholder="120"
                  keyboardType="number-pad"
                  helper="Affiché, non encaissé."
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Quota"
                  optional
                  value={draft.quota}
                  onChangeText={(v) => update({ quota: v })}
                  placeholder="10"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.md }}>
            <SectionLabel>Statut</SectionLabel>
            <View style={s.pills}>
              {STATUS_OPTIONS.map((o) => {
                const on = draft.status === o.v;
                return (
                  <Pressable
                    key={o.v}
                    onPress={() => update({ status: o.v })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={o.label}
                    hitSlop={6}
                    style={[s.pill, on ? s.pillOn : null]}
                  >
                    <Text style={[s.pillT, on ? s.pillTOn : null]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>
              Une offre « publiée » est visible des pilotes une fois votre compte validé.
            </Text>
          </View>

          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Enregistrer l’offre" loading={saving} onPress={onSave} />
          </View>
          {draft.id ? (
            <View style={{ marginTop: theme.spacing.md, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer cette offre"
                onPress={onDelete}
                hitSlop={theme.hitSlop}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={s.delete}>Supprimer cette offre</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Screen>
    );
  }

  // ── Vue liste ──
  return (
    <Screen>
      <AppBar title="MES OFFRES" onBack={() => router.back()} />
      <View style={s.body}>
        <Text style={s.h1} accessibilityRole="header">
          Vos offres
        </Text>

        {partnerId ? (
          <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
            <Button label="Nouvelle offre" onPress={() => setDraft({ ...EMPTY_DRAFT })} />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        ) : !partnerId ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyT}>Aucun compte partenaire.</Text>
            <Text style={s.emptyH}>Contactez l’équipe OXV pour activer votre compte.</Text>
          </Card>
        ) : offers.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyT}>Aucune offre pour l’instant.</Text>
            <Text style={s.emptyH}>Créez la première avec « Nouvelle offre ».</Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {offers.map((o) => (
              <Card
                key={o.id}
                onPress={() => setDraft(draftFromOffer(o))}
                accessibilityLabel={`${o.title}. ${o.status}.`}
              >
                <View style={s.rowBetween}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {o.title}
                  </Text>
                  <Text style={[s.status, o.status === 'published' ? s.statusOn : null]}>
                    {o.status.toUpperCase()}
                  </Text>
                </View>
                {o.priceEur != null ? <Text style={s.cardMeta}>{o.priceEur} €</Text> : null}
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = {
  body: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  h1: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.sm,
  },
  twoCol: { flexDirection: 'row' as const, gap: theme.spacing.md },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  delete: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.red,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  statusOn: { color: theme.palette.cream },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  emptyT: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyH: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
};
