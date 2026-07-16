/**
 * Écran Pilote — Mon profil (reskin fidèle refonte-v2 §7bis, 38-profil.png).
 *
 * Maquette : carte d'identité en tête (avatar initiales, nom, @handle), puis une
 * liste de champs en lecture (nom affiché, identifiant, ville, niveau déclaré) et
 * une note de visibilité amis. Ce que le maquette montre en « lecture » est ici
 * gardé au réel ; l'édition existante (niveau, expérience, licence, véhicule,
 * réseaux, médias) est PRÉSERVÉE dessous, restylée au langage v2.
 *
 * Données réelles uniquement :
 *  - identité (nom, @handle, ville, avatar) : `users` (RLS self-read/self-update) ;
 *  - niveau/expérience/licence/véhicule/réseaux : pilotProfileService ;
 *  - médias : pilotMediaService (bucket privé `pilot-media`, URLs signées).
 * Toute valeur absente est rendue « — » (jamais inventée).
 *
 * Nom public unifié site/app : `users.public_handle` (TEXT UNIQUE) est LA source
 * du pseudo partagé entre oxvehicle.fr et l'app — éditable ici. Validation via
 * la règle handle existante (src/utils/validation.ts), normalisation minuscules.
 * L'unicité est garantie par la contrainte UNIQUE : pas de vérification
 * préalable (racée) — une violation renvoie Postgres 23505, rendu « Ce nom est
 * déjà pris. ». Voir docs/COORDINATION_SITE_HANDLE.md pour le contrat côté site.
 *
 * Note visibilité amis : le périmètre RLS réel n'ouvre AUCUNE lecture de la ligne
 * `users` à un ami (policy `users_select_own_or_admin`). Ce qu'un ami accepté peut
 * lire, ce sont les bilans de séance partagés (are_friends), jamais les
 * coordonnées. La phrase est formulée à ce réel.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, descriptif jamais prescriptif ;
 * l'or reste au chrono (absent ici). Le vocabulaire de niveau est figé.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { supabase } from '@/lib/supabase';
import {
  PILOT_LEVELS,
  getMyPilotProfile,
  pilotLevelLabel,
  updateMyPilotProfile,
} from '@/services/pilotProfileService';
import {
  addMyPilotMedia,
  type PilotMediaType,
  type PilotMediaView,
  listMyPilotMedia,
  removeMyPilotMedia,
} from '@/services/pilotMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { isValidHandle } from '@/utils/validation';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Identité en lecture (source `users`, RLS self-read). */
interface Identity {
  handle: string | null;
  city: string | null;
  avatarUrl: string | null;
}

const EMPTY_IDENTITY: Identity = { handle: null, city: null, avatarUrl: null };

/** Valeur d'une ligne de la carte d'identité — « — » si absente. */
function readValue(v: string | null | undefined): string {
  const t = v?.trim();
  return t && t.length > 0 ? t : '—';
}

/** Ligne de lecture (label à gauche, valeur factuelle à droite). */
function ReadRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={[s.readRow, !last && s.readRowSep]}
      accessibilityRole="text"
      accessibilityLabel={`${label} : ${value}`}
    >
      <Text style={s.readLabel}>{label}</Text>
      <Text style={s.readValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function PilotProfileScreen() {
  const profile = useAuthStore((state) => state.profile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [identity, setIdentity] = useState<Identity>(EMPTY_IDENTITY);
  const [handleInput, setHandleInput] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [experience, setExperience] = useState('');
  const [ffsa, setFfsa] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [media, setMedia] = useState<PilotMediaView[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  const userId = profile?.id;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);

      listMyPilotMedia().then((m) => {
        if (!cancelled) setMedia(m);
      });

      // Identité en lecture (users.public_handle / address_city / avatar_url,
      // RLS self-read) — même pattern que le hub Compte.
      if (userId) {
        (async () => {
          const { data } = await supabase
            .from('users')
            .select('public_handle, address_city, avatar_url')
            .eq('id', userId)
            .maybeSingle();
          if (cancelled) return;
          const row = data as {
            public_handle?: string | null;
            address_city?: string | null;
            avatar_url?: string | null;
          } | null;
          setIdentity({
            handle: row?.public_handle ?? null,
            city: row?.address_city ?? null,
            avatarUrl: row?.avatar_url ?? null,
          });
          setHandleInput(row?.public_handle ?? '');
          setHandleError(null);
        })().catch(() => undefined);
      }

      getMyPilotProfile()
        .then((p) => {
          if (cancelled) return;
          setLevel(p.pilotLevel);
          setExperience(p.experienceYears ?? '');
          setFfsa(p.ffsaLicense ?? '');
          setVehicle(p.vehicle ?? '');
          setWebsite(p.socials.website ?? '');
          setInstagram(p.socials.instagram ?? '');
          setYoutube(p.socials.youtube ?? '');
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  async function onSave() {
    // Nom public — normalisation minuscules (la base stocke la forme minuscule,
    // le @ est un préfixe d'affichage, jamais stocké).
    const nextHandle = handleInput.trim().replace(/^@+/, '').toLowerCase();
    const currentHandle = identity.handle ?? '';
    const handleChanged = nextHandle !== currentHandle;

    // Validation locale (règle partagée site/app, src/utils/validation.ts).
    // Un champ vidé alors qu'un nom existe échoue aussi : le nom public se
    // remplace, il ne se retire pas depuis l'app.
    if (handleChanged && !isValidHandle(nextHandle)) {
      setHandleError('3 à 20 caractères : minuscules, chiffres, tiret ou underscore.');
      return;
    }

    setSaving(true);

    // Écriture users.public_handle (RLS self-update). Pas de vérification
    // préalable d'unicité — racée : la contrainte UNIQUE est la vérité, une
    // violation renvoie Postgres 23505.
    if (handleChanged && userId) {
      const { error } = await supabase
        .from('users')
        .update({ public_handle: nextHandle })
        .eq('id', userId);
      if (error) {
        setSaving(false);
        if (error.code === '23505') {
          setHandleError('Ce nom est déjà pris.');
          return;
        }
        console.warn('[OXV][profil] update public_handle :', error.message);
        Toast.show({
          type: 'error',
          text1: "Votre nom public n'a pas pu être enregistré. Réessayez dans un instant.",
        });
        return;
      }
      setIdentity((prev) => ({ ...prev, handle: nextHandle }));
      setHandleInput(nextHandle);
      setHandleError(null);
    }

    const res = await updateMyPilotProfile({
      pilotLevel: level,
      experienceYears: experience,
      ffsaLicense: ffsa,
      vehicle,
      socials: { website, instagram, youtube },
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Profil enregistré.' });
  }

  async function onAddMedia(type: PilotMediaType) {
    setMediaBusy(true);
    const res = await addMyPilotMedia(type);
    setMediaBusy(false);
    if (res.ok) {
      setMedia(res.items);
      Toast.show({
        type: 'success',
        text1: type === 'video' ? 'Vidéo ajoutée.' : 'Photo ajoutée.',
      });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  async function onRemoveMedia(id: string) {
    const res = await removeMyPilotMedia(id);
    if (res.ok) {
      setMedia(res.items);
    } else {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Profil" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  // Identité affichée — nom réel (users via authStore), initiales, @handle.
  const firstName = profile?.first_name?.trim() ?? '';
  const lastName = profile?.last_name?.trim() ?? '';
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    (profile?.email?.charAt(0).toUpperCase() ?? '—');
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || (profile?.email ?? '—');
  const handleLabel = identity.handle ? `@${identity.handle}` : '—';

  return (
    <Screen>
      <AppBar title="Profil" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Carte d'identité — avatar initiales (convention app), nom, @handle. */}
        <View style={s.hero}>
          <View style={s.avatar} accessibilityElementsHidden importantForAccessibility="no">
            {identity.avatarUrl ? (
              <Image
                source={{ uri: identity.avatarUrl }}
                style={s.avatarImg}
                resizeMode="cover"
                accessibilityLabel="Votre photo de profil"
              />
            ) : (
              <Text style={s.avatarText}>{initials}</Text>
            )}
          </View>
          <Text style={s.name} accessibilityRole="header">
            {fullName}
          </Text>
          <Text style={s.handle}>{handleLabel}</Text>
        </View>

        {/* Liste de lecture — reprise fidèle des lignes du maquette, au réel. */}
        <Card style={s.readCard}>
          <ReadRow label="Nom affiché" value={fullName} />
          <ReadRow label="Identifiant" value={handleLabel} />
          <ReadRow label="Ville" value={readValue(identity.city)} />
          <ReadRow label="Niveau déclaré" value={level ? pilotLevelLabel(level) : '—'} last />
        </Card>

        {/* Note de visibilité — formulée au périmètre RLS réel (aucune lecture de
            la ligne users par un ami ; seuls les bilans partagés le sont). */}
        <Text style={s.privacyNote}>
          Vos coordonnées restent privées. Vos amis ne voient que les bilans de séance que vous
          partagez avec eux.
        </Text>

        {/* ---- Nom public unifié site/app (users.public_handle, UNIQUE) ---- */}
        <View style={s.editBlock}>
          <SectionLabel>Identité publique</SectionLabel>
          {identity.handle === null ? (
            <View style={s.handleInvite} accessibilityRole="text">
              <Text style={s.handleInviteTitle}>Choisissez votre nom public</Text>
              <Text style={s.handleInviteBody}>
                Le même nom vous suit sur oxvehicle.fr et dans l&apos;app.
              </Text>
            </View>
          ) : null}
          <Field
            label="Nom public"
            value={handleInput}
            onChangeText={(t) => {
              setHandleInput(t.toLowerCase());
              setHandleError(null);
            }}
            placeholder="votre-nom"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            error={handleError}
            helper={
              identity.handle
                ? "Le même nom vous suit sur oxvehicle.fr et dans l'app."
                : '3 à 20 caractères : minuscules, chiffres, tiret ou underscore.'
            }
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* ---- Édition (CRUD existant, restylé v2) ---- */}
        <View style={s.editBlock}>
          <SectionLabel>Niveau</SectionLabel>
          <View style={s.pillRow}>
            {PILOT_LEVELS.map((l) => {
              const on = level === l.value;
              return (
                <Pressable
                  key={l.value}
                  onPress={() => setLevel(l.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={l.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillT, on ? s.pillTOn : null]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Field
            label="Années d'expérience"
            optional
            value={experience}
            onChangeText={setExperience}
            placeholder="ex. 5 ans, débuts en 2019…"
          />
          <Field
            label="Licence FFSA"
            optional
            value={ffsa}
            onChangeText={setFfsa}
            placeholder="Numéro de licence"
          />
          <Field
            label="Véhicule"
            optional
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="Marque, modèle, préparation…"
            multiline
            maxLength={200}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <SectionLabel>Réseaux</SectionLabel>
          <View style={{ marginTop: spacing.md }}>
            <Field
              label="Site web"
              optional
              value={website}
              onChangeText={setWebsite}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="Instagram"
              optional
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="YouTube"
              optional
              value={youtube}
              onChangeText={setYoutube}
              placeholder="https://youtube.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionLabel>Médias</SectionLabel>
          <Text style={s.mediaHint}>
            Photos et vidéos de votre profil, visibles par votre coach.
          </Text>

          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.md }}
              contentContainerStyle={{ gap: spacing.sm }}
            >
              {media.map((m) => (
                <View key={m.id} style={s.mediaTile}>
                  {m.type === 'photo' && m.signedUrl ? (
                    <Image
                      source={{ uri: m.signedUrl }}
                      style={s.mediaThumb}
                      resizeMode="cover"
                      accessibilityLabel="Photo du profil"
                    />
                  ) : (
                    <View style={[s.mediaThumb, s.mediaCenter]}>
                      <Text style={s.mediaTileT}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retirer ce média"
                    hitSlop={6}
                    onPress={() => onRemoveMedia(m.id)}
                    style={s.mediaRemove}
                  >
                    <Text style={s.mediaRemoveT}>Retirer</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.mediaEmpty}>Aucun média pour l&apos;instant.</Text>
          )}

          <View style={s.mediaActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une photo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('photo')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une vidéo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('video')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une vidéo</Text>
            </Pressable>
          </View>

          {mediaBusy ? (
            <ActivityIndicator
              color={palette.creamMute}
              style={{ marginTop: spacing.md }}
              accessibilityLabel="Envoi du média en cours"
            />
          ) : null}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button label="Enregistrer mon profil" loading={saving} onPress={onSave} />
        </View>
      </View>
    </Screen>
  );
}

const s = {
  /* Carte d'identité (hero) — avatar centré, nom, @handle. */
  hero: {
    alignItems: 'center' as const,
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    marginBottom: spacing.sm,
  },
  avatarImg: { width: 88, height: 88 },
  avatarText: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.value,
    letterSpacing: 1,
    color: palette.creamSoft,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.2,
    color: palette.cream,
    textAlign: 'center' as const,
  },
  handle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },

  /* Liste de lecture. */
  readCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
  },
  readRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  readRowSep: {
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  readLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
  },
  readValue: {
    flex: 1,
    textAlign: 'right' as const,
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  privacyNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.6,
    color: palette.eyebrow,
    marginTop: spacing.lg,
  },

  /* Nom public — invite visible tant que le pilote n'a pas choisi. */
  handleInvite: {
    borderWidth: 1,
    borderColor: palette.edge,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  handleInviteTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  handleInviteBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
  },

  /* Édition. */
  editBlock: { marginTop: spacing.xxl, gap: spacing.md },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  pillOn: { borderColor: palette.edge, backgroundColor: palette.card },
  pillT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamMute,
  },
  pillTOn: { color: palette.cream },

  /* Médias. */
  mediaHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.xs,
  },
  mediaEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.faint,
    marginTop: spacing.md,
  },
  mediaTile: { width: 120 },
  mediaThumb: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  mediaCenter: { alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaTileT: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  mediaRemove: {
    minHeight: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: spacing.xs,
  },
  mediaRemoveT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  mediaActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  mediaBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.edge,
  },
  mediaBtnT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.cream,
  },
};
