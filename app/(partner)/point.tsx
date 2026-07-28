/**
 * Espace Partenaire — « Mon point sur la carte » (build 23, décision
 * fondateur 2026-07-16).
 *
 * Le partenaire VALIDÉ crée son point (titre, catégorie fondateur, adresse,
 * position par géolocalisation de l'appareil ou saisie, description). L'INSERT
 * porte partner_id et la RLS force is_published=false : le point part
 * « En attente de validation OXV » ; l'admin valide pour l'afficher sur La
 * carte OXV. Toute modification repasse par la validation.
 *
 * Un partenaire non validé voit un état explicatif (la RLS refuserait de
 * toute façon l'écriture). Doctrine : sobre, vouvoiement, descriptif jamais
 * prescriptif, zéro emoji ; identités de catégorie partagées avec la carte
 * pilote (src/ui/carteIdentity.ts — jamais l'or).
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import {
  type SocialPing,
  type SocialPingKind,
  PING_KIND_LABELS,
  categoryOfKind,
  listMyPartnerPings,
  upsertMyPartnerPing,
} from '@/services/socialPingsService';
import { type PartnerAccount, loadMyPartnerAccount } from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CARTE_CATEGORY_COLOR, CARTE_CATEGORY_GLYPH } from '@/ui/carteIdentity';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { StatusPill } from '@/ui/StatusPill';

// Catégories ouvertes au partenaire (les cinq onglets fondateur : événement,
// garage, restaurant, hôtel, autre).
const PARTNER_KINDS: SocialPingKind[] = ['event_partner', 'garage', 'restaurant', 'hotel', 'autre'];

interface Draft {
  id: string | null;
  kind: SocialPingKind;
  title: string;
  description: string;
  address: string;
  lat: string;
  lon: string;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  kind: 'garage',
  title: '',
  description: '',
  address: '',
  lat: '',
  lon: '',
};

function draftFromPing(p: SocialPing): Draft {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    description: p.description ?? '',
    address: p.address ?? '',
    lat: String(p.lat),
    lon: String(p.lon),
  };
}

export default function PartnerPointScreen() {
  const [account, setAccount] = useState<PartnerAccount | null>(null);
  const [points, setPoints] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null); // null = vue liste
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    loadMyPartnerAccount()
      .then(async (acc) => {
        setAccount(acc);
        if (acc && acc.status === 'validated') {
          setPoints(await listMyPartnerPings(acc.id));
        } else {
          setPoints([]);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  /** Remplit lat/lon depuis la position de l'appareil (foreground uniquement). */
  async function useMyPosition() {
    setLocating(true);
    setGeoNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        setGeoNote(
          "La position de l'appareil n'est pas accessible. Les coordonnées restent saisissables."
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      update({
        lat: pos.coords.latitude.toFixed(6),
        lon: pos.coords.longitude.toFixed(6),
      });
      setGeoNote('Position de l’appareil relevée.');
    } catch {
      setGeoNote("La position n'a pas pu être relevée. Les coordonnées restent saisissables.");
    } finally {
      setLocating(false);
    }
  }

  async function onSave() {
    if (!draft || !account) return;
    const title = draft.title.trim();
    const lat = Number(draft.lat.replace(',', '.'));
    const lon = Number(draft.lon.replace(',', '.'));
    if (!title) {
      Toast.show({ type: 'error', text1: 'Le nom est requis.' });
      return;
    }
    // Champ vide → Number('') vaut 0 : on exige une saisie explicite des deux.
    if (
      draft.lat.trim() === '' ||
      draft.lon.trim() === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      Toast.show({ type: 'error', text1: 'La position (latitude, longitude) est requise.' });
      return;
    }
    const clean = (v: string): string | null => (v.trim() ? v.trim() : null);
    setSaving(true);
    const res = await upsertMyPartnerPing({
      id: draft.id,
      partnerId: account.id,
      kind: draft.kind,
      title,
      description: clean(draft.description),
      address: clean(draft.address),
      lat,
      lon,
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Point transmis à OXV pour validation.' });
    setDraft(null);
    setGeoNote(null);
    reload();
  }

  // ── Vue formulaire ──
  if (draft && account) {
    return (
      <Screen>
        <AppBar title="MON POINT SUR LA CARTE" onBack={() => setDraft(null)} />
        <View style={s.body}>
          <FadeInSection>
            <Text style={s.h1} accessibilityRole="header">
              {draft.id ? 'Modifier le point' : 'Nouveau point'}
            </Text>

            <View style={{ marginTop: theme.spacing.lg }}>
              <SectionLabel>Catégorie</SectionLabel>
              <View style={s.pills}>
                {PARTNER_KINDS.map((k) => {
                  const on = draft.kind === k;
                  const color = CARTE_CATEGORY_COLOR[categoryOfKind(k)];
                  return (
                    <PressableScale
                      key={k}
                      onPress={() => update({ kind: k })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={PING_KIND_LABELS[k]}
                      hitSlop={6}
                      haptic="tap"
                      style={[s.pill, on ? { borderColor: color } : null]}
                    >
                      <View
                        style={[s.pillDot, { backgroundColor: color }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                      <Text style={[s.pillT, on ? s.pillTOn : null]}>{PING_KIND_LABELS[k]}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: theme.spacing.lg }}>
              <Field
                label="Nom"
                value={draft.title}
                onChangeText={(v) => update({ title: v })}
                placeholder="Nom de votre établissement"
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
                showCounter
              />
            </View>

            <View style={{ marginTop: theme.spacing.md }}>
              <SectionLabel>Localisation</SectionLabel>
              <View style={{ marginTop: theme.spacing.md }}>
                <Field
                  label="Adresse"
                  optional
                  value={draft.address}
                  onChangeText={(v) => update({ address: v })}
                  placeholder="Adresse postale"
                />
              </View>
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
              <Button
                label="Relever ma position"
                variant="ghost"
                loading={locating}
                onPress={useMyPosition}
              />
              {geoNote ? <Text style={s.hint}>{geoNote}</Text> : null}
            </View>

            <View style={{ marginTop: theme.spacing.xl }}>
              <Button label="Transmettre pour validation" loading={saving} onPress={onSave} />
              <Text style={s.hint}>
                Chaque enregistrement repasse par la validation OXV avant affichage sur La carte
                OXV.
              </Text>
            </View>
          </FadeInSection>
        </View>
      </Screen>
    );
  }

  // ── Vue liste / états de compte ──
  const state: ScreenState = loading ? 'loading' : error ? 'error' : !account ? 'empty' : 'nominal';

  return (
    <Screen>
      <AppBar title="MON POINT SUR LA CARTE" onBack={() => router.back()} />
      <View style={s.body}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="partner" />
        </View>
        <StateWrapper
          state={state}
          skeletonLines={4}
          emptyLabel="Aucun compte partenaire"
          emptyMessage="Aucun compte partenaire n'est rattaché à cet utilisateur. Contactez l'équipe OXV."
          emptySource="partner_accounts"
          errorCause="Votre point sur la carte n'a pas pu être chargé."
          onRetry={reload}
        >
          {account ? (
            account.status !== 'validated' ? (
              <FadeInSection>
                <Text style={s.eyebrow}>LA CARTE OXV</Text>
                <Text style={s.h1} accessibilityRole="header">
                  Votre établissement sur la carte
                </Text>
                <Card style={{ marginTop: theme.spacing.xl }}>
                  <StatusPill
                    label={
                      account.status === 'pending'
                        ? 'En attente de validation OXV'
                        : 'Compte désactivé'
                    }
                    tone="neutral"
                  />
                  <Text style={[s.note, { marginTop: theme.spacing.md }]}>
                    {account.status === 'pending'
                      ? 'Votre compte partenaire est en cours de validation par l’équipe OXV. La création de votre point sur La carte OXV ouvrira dès la validation.'
                      : 'Votre compte partenaire est désactivé. Votre point n’apparaît plus sur La carte OXV.'}
                  </Text>
                </Card>
              </FadeInSection>
            ) : (
              <>
                <FadeInSection>
                  <Text style={s.eyebrow}>LA CARTE OXV</Text>
                  <Text style={s.h1} accessibilityRole="header">
                    Votre établissement sur la carte
                  </Text>
                  <Text style={s.note}>
                    Votre point apparaît aux membres OXV sur la carte du territoire, dans son onglet
                    de catégorie, une fois validé par l’équipe OXV.
                  </Text>
                  <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
                    <Button
                      label="Nouveau point"
                      onPress={() => {
                        setGeoNote(null);
                        setDraft({ ...EMPTY_DRAFT });
                      }}
                    />
                  </View>
                </FadeInSection>

                {points.length > 0 ? (
                  <Stagger interval={80} style={{ gap: theme.spacing.sm }}>
                    {points.map((p) => {
                      const catKey = categoryOfKind(p.kind);
                      const color = CARTE_CATEGORY_COLOR[catKey];
                      const statusLabel = p.isPublished ? 'Publié' : 'En attente de validation OXV';
                      return (
                        <Card
                          key={p.id}
                          onPress={() => {
                            setGeoNote(null);
                            setDraft(draftFromPing(p));
                          }}
                          accessibilityLabel={`${p.title}. ${PING_KIND_LABELS[p.kind]}. ${statusLabel}.`}
                          style={[s.pointCard, { borderLeftColor: color }]}
                        >
                          <View style={s.rowBetween}>
                            <View style={s.glyphAndTitle}>
                              <View style={[s.glyphBadge, { borderColor: color }]}>
                                <Text style={[s.glyphT, { color }]}>
                                  {CARTE_CATEGORY_GLYPH[catKey]}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle} numberOfLines={1}>
                                  {p.title}
                                </Text>
                                <Text style={s.cardMeta}>{PING_KIND_LABELS[p.kind]}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ marginTop: theme.spacing.md }}>
                            <StatusPill
                              label={statusLabel}
                              tone={p.isPublished ? 'connected' : 'neutral'}
                            />
                          </View>
                        </Card>
                      );
                    })}
                  </Stagger>
                ) : (
                  <FadeInSection delay={120}>
                    <Card>
                      <Text style={s.note}>
                        Aucun point pour l’instant. « Nouveau point » place votre établissement sur
                        La carte OXV, après validation.
                      </Text>
                    </Card>
                  </FadeInSection>
                )}

                {points.length > 0 ? (
                  <Text style={s.hint}>
                    Toute modification repasse par la validation OXV avant affichage.
                  </Text>
                ) : null}
              </>
            )
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  body: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.roleColors.partner,
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
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.md,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  latlon: { flexDirection: 'row' as const, gap: theme.spacing.md },
  // Liseré gauche = identité de catégorie (partagée avec la carte pilote).
  pointCard: {
    backgroundColor: theme.palette.card2,
    borderLeftWidth: 2,
    padding: theme.spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  glyphAndTitle: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  glyphBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    backgroundColor: theme.palette.card,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  glyphT: {
    fontFamily: theme.fonts.monoSemi,
    fontSize: 12,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
};
