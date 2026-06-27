/**
 * Écran Admin — Points de La carte OXV (social_pings).
 *
 * Créer / éditer / publier les lieux, partenaires et événements affichés sur la
 * carte. Écriture réservée aux admins (RLS `social_pings_admin_all`). Le layout
 * (admin) garde déjà la section sur `is_admin`.
 *
 * Doctrine : sobre, vouvoiement, accent bronze (rôle admin), aucun emoji. Deux
 * vues dans le même écran : liste des points, puis formulaire d'un point.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type SocialPing,
  type SocialPingKind,
  type UpsertPingInput,
  PING_KIND_LABELS,
  deletePing,
  listAllPings,
  upsertPing,
} from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

// Bronze = couleur de RÔLE admin (doctrine).
const BRONZE = '#B87333';

const KIND_ORDER: SocialPingKind[] = [
  'event_oxv',
  'event_partner',
  'soiree',
  'partner_location',
  'filming_location',
  'host_experience',
];

interface Draft {
  id: string | null;
  kind: SocialPingKind;
  title: string;
  description: string;
  lat: string;
  lon: string;
  address: string;
  startsAt: string;
  imageUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  liveUrl: string;
  eventUrl: string;
  contactEmail: string;
  isPublished: boolean;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  kind: 'partner_location',
  title: '',
  description: '',
  lat: '',
  lon: '',
  address: '',
  startsAt: '',
  imageUrl: '',
  websiteUrl: '',
  instagramUrl: '',
  facebookUrl: '',
  youtubeUrl: '',
  liveUrl: '',
  eventUrl: '',
  contactEmail: '',
  isPublished: false,
};

function draftFromPing(p: SocialPing): Draft {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    description: p.description ?? '',
    lat: String(p.lat),
    lon: String(p.lon),
    address: p.address ?? '',
    startsAt: p.startsAt ?? '',
    imageUrl: p.imageUrl ?? '',
    websiteUrl: p.websiteUrl ?? '',
    instagramUrl: p.instagramUrl ?? '',
    facebookUrl: p.facebookUrl ?? '',
    youtubeUrl: p.youtubeUrl ?? '',
    liveUrl: p.liveUrl ?? '',
    eventUrl: p.eventUrl ?? '',
    contactEmail: p.contactEmail ?? '',
    isPublished: p.isPublished,
  };
}

export default function AdminCartePointsScreen() {
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null); // null = vue liste
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listAllPings()
      .then((list) => {
        setPings(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function onSave() {
    if (!draft) return;
    const title = draft.title.trim();
    const lat = Number(draft.lat.replace(',', '.'));
    const lon = Number(draft.lon.replace(',', '.'));
    if (!title) {
      Toast.show({ type: 'error', text1: 'Le nom est requis.' });
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      Toast.show({ type: 'error', text1: 'Latitude et longitude doivent être des nombres.' });
      return;
    }
    const clean = (v: string): string | null => (v.trim() ? v.trim() : null);
    const input: UpsertPingInput = {
      id: draft.id,
      kind: draft.kind,
      title,
      description: clean(draft.description),
      lat,
      lon,
      address: clean(draft.address),
      startsAt: clean(draft.startsAt),
      imageUrl: clean(draft.imageUrl),
      websiteUrl: clean(draft.websiteUrl),
      instagramUrl: clean(draft.instagramUrl),
      facebookUrl: clean(draft.facebookUrl),
      youtubeUrl: clean(draft.youtubeUrl),
      liveUrl: clean(draft.liveUrl),
      eventUrl: clean(draft.eventUrl),
      contactEmail: clean(draft.contactEmail),
      isPublished: draft.isPublished,
    };
    setSaving(true);
    const res = await upsertPing(input);
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Point enregistré.' });
    setDraft(null);
    reload();
  }

  function onDelete() {
    const id = draft?.id;
    if (!id) return;
    Alert.alert('Supprimer ce point ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deletePing(id);
          if (!res.ok) {
            Toast.show({ type: 'error', text1: 'La suppression a échoué.' });
            return;
          }
          Toast.show({ type: 'success', text1: 'Point supprimé.' });
          setDraft(null);
          reload();
        },
      },
    ]);
  }

  // ── Vue formulaire ──
  if (draft) {
    return (
      <Screen>
        <AppBar title="POINT DE LA CARTE" onBack={() => setDraft(null)} />
        <View style={s.body}>
          <Text style={s.h1} accessibilityRole="header">
            {draft.id ? 'Modifier le point' : 'Nouveau point'}
          </Text>

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionLabel>Type</SectionLabel>
            <View style={s.pills}>
              {KIND_ORDER.map((k) => {
                const on = draft.kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => update({ kind: k })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={PING_KIND_LABELS[k]}
                    hitSlop={6}
                    style={[s.pill, on ? s.pillOn : null]}
                  >
                    <Text style={[s.pillT, on ? s.pillTOn : null]}>{PING_KIND_LABELS[k]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <Field
              label="Nom"
              value={draft.title}
              onChangeText={(v) => update({ title: v })}
              placeholder="Nom du lieu / de l'événement"
              maxLength={120}
            />
            <Field
              label="Description"
              optional
              value={draft.description}
              onChangeText={(v) => update({ description: v })}
              placeholder="Quelques mots…"
              multiline
              maxLength={600}
            />
          </View>

          <View style={{ marginTop: theme.spacing.md }}>
            <SectionLabel>Localisation</SectionLabel>
            <View style={s.latlon}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Latitude"
                  value={draft.lat}
                  onChangeText={(v) => update({ lat: v })}
                  placeholder="45.6280"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Longitude"
                  value={draft.lon}
                  onChangeText={(v) => update({ lon: v })}
                  placeholder="-0.2767"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Field
              label="Adresse"
              optional
              value={draft.address}
              onChangeText={(v) => update({ address: v })}
              placeholder="Adresse postale"
            />
            <Field
              label="Date (ISO)"
              optional
              value={draft.startsAt}
              onChangeText={(v) => update({ startsAt: v })}
              placeholder="2026-07-15T18:00:00Z"
              autoCapitalize="none"
              autoCorrect={false}
              helper="Pour un événement. Laissez vide pour un lieu."
            />
          </View>

          <View style={{ marginTop: theme.spacing.md }}>
            <SectionLabel>Liens & média</SectionLabel>
            <View style={{ marginTop: theme.spacing.md }}>
              <Field
                label="Image (URL)"
                optional
                value={draft.imageUrl}
                onChangeText={(v) => update({ imageUrl: v })}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Site web"
                optional
                value={draft.websiteUrl}
                onChangeText={(v) => update({ websiteUrl: v })}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Instagram"
                optional
                value={draft.instagramUrl}
                onChangeText={(v) => update({ instagramUrl: v })}
                placeholder="https://instagram.com/…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Facebook"
                optional
                value={draft.facebookUrl}
                onChangeText={(v) => update({ facebookUrl: v })}
                placeholder="https://facebook.com/…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="YouTube"
                optional
                value={draft.youtubeUrl}
                onChangeText={(v) => update({ youtubeUrl: v })}
                placeholder="https://youtube.com/…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Lien direct"
                optional
                value={draft.liveUrl}
                onChangeText={(v) => update({ liveUrl: v })}
                placeholder="https://… (live)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Page détails"
                optional
                value={draft.eventUrl}
                onChangeText={(v) => update({ eventUrl: v })}
                placeholder="https://… (billetterie, infos)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="Email de contact"
                optional
                value={draft.contactEmail}
                onChangeText={(v) => update({ contactEmail: v })}
                placeholder="contact@…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionLabel>Publication</SectionLabel>
            <View style={s.pubRow}>
              {[
                { v: true, label: 'Publié' },
                { v: false, label: 'Masqué' },
              ].map((o) => {
                const on = draft.isPublished === o.v;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => update({ isPublished: o.v })}
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
            <Text style={s.hint}>Un point publié apparaît sur La carte OXV des membres.</Text>
          </View>

          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Enregistrer le point" loading={saving} onPress={onSave} />
          </View>
          {draft.id ? (
            <View style={{ marginTop: theme.spacing.md, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer ce point"
                onPress={onDelete}
                hitSlop={theme.hitSlop}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={s.delete}>Supprimer ce point</Text>
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
      <AppBar title="POINTS DE LA CARTE" onBack={() => router.back()} />
      <View style={s.body}>
        <Text style={s.eyebrow}>LA CARTE OXV</Text>
        <Text style={s.h1} accessibilityRole="header">
          Lieux, partenaires & événements
        </Text>

        <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
          <Button label="Nouveau point" onPress={() => setDraft({ ...EMPTY_DRAFT })} />
        </View>

        {loading ? (
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        ) : pings.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyT}>Aucun point pour l&apos;instant.</Text>
            <Text style={s.emptyH}>Créez le premier avec « Nouveau point ».</Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pings.map((p) => (
              <Card
                key={p.id}
                onPress={() => setDraft(draftFromPing(p))}
                accessibilityLabel={`${p.title}. ${PING_KIND_LABELS[p.kind]}. ${
                  p.isPublished ? 'Publié' : 'Masqué'
                }`}
                style={{ borderColor: BRONZE }}
              >
                <View style={s.rowBetween}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={[s.status, p.isPublished ? s.statusOn : null]}>
                    {p.isPublished ? 'PUBLIÉ' : 'MASQUÉ'}
                  </Text>
                </View>
                <Text style={s.cardMeta}>{PING_KIND_LABELS[p.kind]}</Text>
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
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  h1: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.sm,
  },
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
  pillOn: { borderColor: BRONZE, backgroundColor: 'rgba(184,115,51,0.12)' },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  latlon: { flexDirection: 'row' as const, gap: theme.spacing.md, marginTop: theme.spacing.md },
  pubRow: { flexDirection: 'row' as const, gap: theme.spacing.sm, marginTop: theme.spacing.md },
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
  statusOn: { color: BRONZE },
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
