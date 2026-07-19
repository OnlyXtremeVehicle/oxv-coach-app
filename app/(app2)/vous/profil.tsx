/**
 * PROFIL PUBLIC — écran 2/8 de la porte VOUS (V2-L4), route NOUVELLE.
 *
 * Deux visages sur un seul écran (patron aperçu Airbnb) :
 *   - CONSULTATION : ce que voient les autres — couverture, avatar chevauchant,
 *     nom, @handle, bio, chips véhicules (numéro de course + garage), réseaux.
 *   - ÉDITION inline (bouton MODIFIER, bord accent) : mêmes blocs, champs
 *     actifs, photo de couverture remplaçable, opt-in Pavillon ; bouton
 *     collant bas → sauvegarde → retour consultation en cross-fade.
 *
 * Données réelles câblées (write-path v1 réutilisé, aucun schéma neuf) :
 *   - identité/bio/réseaux/handle/pavillon : `@/lib/queries/profil` (whitelist
 *     stricte, RLS self) ;
 *   - couverture : la photo de PROFIL la plus récente (pilotMediaService,
 *     bucket privé pilot-media, URL signée), repli cover du véhicule principal,
 *     sinon fallback dessiné — jamais d'image stock ;
 *   - « changer la photo » = MÊME write-path que la v1 (`addMyPilotMedia`).
 *
 * HONNÊTETÉ SCHÉMA (repli documenté) :
 *   - pas de colonne cover dédiée → la couverture = photo de profil récente ;
 *   - l'avatar n'a aucun write-path dans l'app (géré hors app) → non éditable ;
 *   - bio / car_number / pavilion_name_optin : masqués tant que la migration
 *     profil/pavillon n'est pas appliquée (migrationPavillon = false).
 *
 * Doctrine : sobre, vouvoiement, zéro emoji, jamais prescriptif ; un seul
 * accent rouge par zone ; l'or reste au chrono (absent ici).
 */

import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  type DonneesProfil,
  changerNomPublic,
  getProfil,
  sauvegarderProfil,
  setPavillonOptin,
} from '@/lib/queries/profil';
import {
  type PilotMediaView,
  addMyPilotMedia,
  getMyVehicleCovers,
  listMyPilotMedia,
} from '@/services/pilotMediaService';
import {
  BIO_MAX,
  activeSocials,
  bioError,
  displayName,
  handleError,
  handleToPersist,
  identityChips,
  initials,
  isHttpUrl,
  memberSince,
  pickCoverUri,
} from '@/features/vous/profilLogic';
import {
  Chip,
  HeroPhoto,
  ListRow,
  Photo,
  PressScale,
  SectionHeader,
  StateView,
  colors,
  haptic,
  motionTokens,
  radius,
  space,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

const COVER_HEIGHT = 210;
const AVATAR = 84;

type Etat = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; donnees: DonneesProfil };

type Mode = 'view' | 'edit';

// ---------------------------------------------------------------------------
// Petits fragments (aucune flèche dans le registre d'icônes — trait local)
// ---------------------------------------------------------------------------

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Bouclier OXV — fallback dessiné de la couverture (jamais d'image stock). */
function InsigneFallback() {
  return (
    <Svg width={40} height={46} viewBox="0 0 24 26" fill="none">
      <Path
        d="M12 2 L20.5 5 L20.5 12 C20.5 17.4 16.6 21.2 12 22.8 C7.4 21.2 3.5 17.4 3.5 12 L3.5 5 Z"
        stroke={colors.text.dim}
        strokeWidth={1.4}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M8.5 9.5 L12 14.5 L15.5 9.5"
        stroke={colors.text.dim}
        strokeWidth={1.4}
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function ProfilPublicScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();

  const [etat, setEtat] = useState<Etat>({ phase: 'loading' });
  const [media, setMedia] = useState<PilotMediaView[]>([]);
  const [vehicleCover, setVehicleCover] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('view');

  // Champs d'édition (miroir des valeurs réelles, initialisés au chargement).
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [linkedin, setLinkedin] = useState('');

  const [handleErr, setHandleErr] = useState<string | null>(null);
  const [bioErr, setBioErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [pavillonBusy, setPavillonBusy] = useState(false);

  const charger = useCallback(() => {
    setEtat({ phase: 'loading' });
    Promise.all([getProfil(), listMyPilotMedia(), getMyVehicleCovers()])
      .then(([donnees, medias, covers]) => {
        setEtat({ phase: 'ready', donnees });
        setMedia(medias);
        const primaryId = donnees.vehicules[0]?.id;
        setVehicleCover(primaryId ? covers[primaryId] : undefined);
        setHandle(donnees.profil.handle ?? '');
        setBio(donnees.profil.bio ?? '');
        setInstagram(donnees.profil.reseaux.instagram ?? '');
        setYoutube(donnees.profil.reseaux.youtube ?? '');
        setLinkedin(donnees.profil.reseaux.linkedin ?? '');
        setHandleErr(null);
        setBioErr(null);
        setSaveErr(null);
      })
      .catch(() => setEtat({ phase: 'error' }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  const coverUri = useMemo(() => pickCoverUri(media, vehicleCover), [media, vehicleCover]);

  async function remplacerPhoto() {
    if (coverBusy) return;
    setCoverBusy(true);
    const res = await addMyPilotMedia('photo');
    setCoverBusy(false);
    if (res.ok) {
      setMedia(res.items);
    } else if (!('cancelled' in res)) {
      setSaveErr(res.error);
    }
  }

  async function basculerPavillon() {
    if (etat.phase !== 'ready' || pavillonBusy) return;
    const actuel = etat.donnees.profil.pavillonOptin ?? false;
    setPavillonBusy(true);
    const res = await setPavillonOptin(!actuel);
    setPavillonBusy(false);
    if (!res.ok) {
      setSaveErr(res.error);
      return;
    }
    haptic('tap');
    setEtat({
      phase: 'ready',
      donnees: {
        ...etat.donnees,
        profil: { ...etat.donnees.profil, pavillonOptin: !actuel },
      },
    });
  }

  async function enregistrer() {
    if (etat.phase !== 'ready' || saving) return;
    const migrationPavillon = etat.donnees.profil.migrationPavillon;
    const hErr = handleError(handle);
    const bErr = migrationPavillon ? bioError(bio) : null;
    setHandleErr(hErr);
    setBioErr(bErr);
    setSaveErr(null);
    if (hErr || bErr) return;

    setSaving(true);
    const nouveauHandle = handleToPersist(handle, etat.donnees.profil.handle);
    if (nouveauHandle) {
      const r = await changerNomPublic(nouveauHandle);
      if (!r.ok) {
        setSaving(false);
        setHandleErr(r.error);
        return;
      }
    }
    const r2 = await sauvegarderProfil(
      {
        ...(migrationPavillon ? { bio } : {}),
        reseaux: { instagram, youtube, linkedin },
      },
      { migrationPavillon }
    );
    setSaving(false);
    if (!r2.ok) {
      setSaveErr(r2.error);
      return;
    }

    haptic('tap');
    const nettoie = (v: string): string | null => (v.trim() ? v.trim() : null);
    setEtat({
      phase: 'ready',
      donnees: {
        ...etat.donnees,
        profil: {
          ...etat.donnees.profil,
          handle: nouveauHandle ?? etat.donnees.profil.handle,
          bio: migrationPavillon ? nettoie(bio) : etat.donnees.profil.bio,
          reseaux: {
            instagram: nettoie(instagram),
            youtube: nettoie(youtube),
            linkedin: nettoie(linkedin),
          },
        },
      },
    });
    setMode('view');
  }

  function annulerEdition() {
    if (etat.phase === 'ready') {
      const p = etat.donnees.profil;
      setHandle(p.handle ?? '');
      setBio(p.bio ?? '');
      setInstagram(p.reseaux.instagram ?? '');
      setYoutube(p.reseaux.youtube ?? '');
      setLinkedin(p.reseaux.linkedin ?? '');
    }
    setHandleErr(null);
    setBioErr(null);
    setSaveErr(null);
    setMode('view');
  }

  return (
    <Animated.View style={[styles.root, door]}>
      <Animated.View key={mode} entering={FadeIn.duration(motionTokens.door)} style={styles.fill}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: (mode === 'edit' ? 96 : space.xxl) + tabBarSpace(insets.bottom),
          }}
        >
          {etat.phase === 'loading' ? (
            <View style={[styles.body, { paddingTop: insets.top + 64 }]}>
              <StateView state="loading" shape="card" />
            </View>
          ) : etat.phase === 'error' ? (
            <View style={[styles.body, { paddingTop: insets.top + 64 }]}>
              <StateView
                state="error"
                errorMessage="Votre profil n'a pas pu se charger."
                onRetry={charger}
              />
            </View>
          ) : (
            <ProfilBody
              donnees={etat.donnees}
              mode={mode}
              coverUri={coverUri}
              coverBusy={coverBusy}
              pavillonBusy={pavillonBusy}
              handle={handle}
              bio={bio}
              instagram={instagram}
              youtube={youtube}
              linkedin={linkedin}
              handleErr={handleErr}
              bioErr={bioErr}
              saveErr={saveErr}
              onEdit={() => setMode('edit')}
              onReplacePhoto={remplacerPhoto}
              onTogglePavillon={basculerPavillon}
              onHandle={(v) => {
                setHandle(v);
                setHandleErr(null);
              }}
              onBio={(v) => {
                setBio(v.slice(0, BIO_MAX));
                setBioErr(null);
              }}
              onInstagram={setInstagram}
              onYoutube={setYoutube}
              onLinkedin={setLinkedin}
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* Bouton collant bas — édition uniquement. */}
      {mode === 'edit' && etat.phase === 'ready' ? (
        <View
          style={[styles.saveBar, { bottom: tabBarSpace(insets.bottom), paddingBottom: space.md }]}
        >
          <PressScale
            onPress={annulerEdition}
            accessibilityLabel="Annuler les modifications"
            containerStyle={styles.saveGhostContainer}
            style={styles.saveGhost}
          >
            <Text style={styles.saveGhostLabel}>Annuler</Text>
          </PressScale>
          <PressScale
            onPress={enregistrer}
            disabled={saving}
            accessibilityLabel="Enregistrer le profil"
            containerStyle={styles.saveContainer}
            style={[styles.savePrimary, saving && styles.savePrimaryDisabled]}
          >
            <Text style={styles.savePrimaryLabel}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Text>
          </PressScale>
        </View>
      ) : null}

      {/* Retour — au-dessus de tout, toujours accessible. */}
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        containerStyle={[styles.back, { top: insets.top + space.md }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.backDisc}>
          <BackChevron />
        </View>
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Corps — partagé consultation / édition (mêmes blocs, patron aperçu)
// ---------------------------------------------------------------------------

interface BodyProps {
  donnees: DonneesProfil;
  mode: Mode;
  coverUri?: string;
  coverBusy: boolean;
  pavillonBusy: boolean;
  handle: string;
  bio: string;
  instagram: string;
  youtube: string;
  linkedin: string;
  handleErr: string | null;
  bioErr: string | null;
  saveErr: string | null;
  onEdit: () => void;
  onReplacePhoto: () => void;
  onTogglePavillon: () => void;
  onHandle: (v: string) => void;
  onBio: (v: string) => void;
  onInstagram: (v: string) => void;
  onYoutube: (v: string) => void;
  onLinkedin: (v: string) => void;
}

function ProfilBody(props: BodyProps) {
  const { donnees, mode } = props;
  const { profil, vehicules } = donnees;
  const editing = mode === 'edit';

  const name = displayName(profil);
  const avatarInitials = initials(profil);
  const since = memberSince(profil.creeLe);
  const chips = identityChips({ vehicles: vehicules, carNumber: profil.carNumber });
  const socials = activeSocials(profil.reseaux);

  return (
    <View>
      {/* ── COUVERTURE ── */}
      <View>
        <HeroPhoto uri={props.coverUri} height={COVER_HEIGHT} fallback={<InsigneFallback />} />
        {editing ? (
          <PressScale
            onPress={props.onReplacePhoto}
            disabled={props.coverBusy}
            accessibilityLabel="Changer la photo de couverture"
            containerStyle={styles.coverEditContainer}
            style={styles.coverEditPill}
          >
            <Text style={styles.coverEditLabel}>
              {props.coverBusy ? 'Envoi…' : 'Changer la photo'}
            </Text>
          </PressScale>
        ) : null}
      </View>

      {/* ── IDENTITÉ (avatar chevauchant) ── */}
      <View style={styles.body}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            {profil.avatarUrl ? (
              <Photo uri={profil.avatarUrl} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarInitials}>{avatarInitials}</Text>
            )}
          </View>
          {!editing ? (
            <PressScale
              onPress={props.onEdit}
              accessibilityLabel="Modifier le profil"
              containerStyle={styles.modifyContainer}
              style={styles.modifyPill}
            >
              <Text style={styles.modifyLabel}>MODIFIER</Text>
            </PressScale>
          ) : null}
        </View>

        <Text style={styles.name} accessibilityRole="header">
          {name}
        </Text>

        {/* @handle — lecture, ou champ actif en édition. */}
        {editing ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NOM PUBLIC</Text>
            <TextInput
              value={props.handle}
              onChangeText={props.onHandle}
              placeholder="votre-nom"
              placeholderTextColor={colors.text.dim}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={styles.input}
              accessibilityLabel="Nom public"
            />
            {props.handleErr ? <Text style={styles.errorText}>{props.handleErr}</Text> : null}
            <Text style={styles.hint}>Le même nom vous suit sur oxvehicle.fr et dans l’app.</Text>
          </View>
        ) : profil.handle ? (
          <Text style={styles.handle}>@{profil.handle}</Text>
        ) : null}

        {since ? <Text style={styles.since}>{since}</Text> : null}

        {/* ── BIO ── */}
        {editing && profil.migrationPavillon ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>BIO</Text>
            <TextInput
              value={props.bio}
              onChangeText={props.onBio}
              placeholder="Quelques lignes sur votre parcours et votre rapport au circuit."
              placeholderTextColor={colors.text.dim}
              multiline
              maxLength={BIO_MAX}
              style={[styles.input, styles.inputMultiline]}
              accessibilityLabel="Votre bio"
            />
            <Text style={styles.counter}>
              {props.bio.length}/{BIO_MAX}
            </Text>
            {props.bioErr ? <Text style={styles.errorText}>{props.bioErr}</Text> : null}
          </View>
        ) : !editing && profil.bio ? (
          <Text style={styles.bio}>{profil.bio}</Text>
        ) : null}

        {/* ── CHIPS VÉHICULES (numéro de course + garage) ── */}
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((c) => (
              <Chip key={c.key} label={c.label} icon={c.key === 'car-number' ? undefined : 'cle'} />
            ))}
          </View>
        ) : null}

        {/* ── RÉSEAUX ── */}
        {editing ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="RÉSEAUX" />
            <View style={styles.reseauxEdit}>
              <ReseauField label="Instagram" value={props.instagram} onChange={props.onInstagram} />
              <ReseauField label="YouTube" value={props.youtube} onChange={props.onYoutube} />
              <ReseauField label="LinkedIn" value={props.linkedin} onChange={props.onLinkedin} />
            </View>
          </View>
        ) : socials.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="RÉSEAUX" />
            <View style={styles.reseauxView}>
              {socials.map((s) => (
                <ListRow
                  key={s.key}
                  label={s.label}
                  onPress={
                    isHttpUrl(s.url)
                      ? () => Linking.openURL(s.url).catch(() => undefined)
                      : undefined
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* ── OPT-IN PAVILLON — édition, si la migration est appliquée ── */}
        {editing && profil.migrationPavillon && profil.pavillonOptin !== null ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="LE PAVILLON" />
            <ListRow
              label="Afficher mon nom au Pavillon"
              sublabel="Votre nom apparaît sur l’écran d’accueil du paddock."
              divider={false}
              right={
                <Switch
                  value={profil.pavillonOptin}
                  onValueChange={props.onTogglePavillon}
                  disabled={props.pavillonBusy}
                  trackColor={{ true: colors.accent, false: colors.border.strong }}
                  thumbColor={colors.text.hi}
                  accessibilityLabel="Afficher mon nom au Pavillon"
                />
              }
            />
          </View>
        ) : null}

        {props.saveErr ? (
          <Text style={[styles.errorText, styles.saveErr]}>{props.saveErr}</Text>
        ) : null}
      </View>
    </View>
  );
}

function ReseauField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="https://…"
        placeholderTextColor={colors.text.dim}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
        accessibilityLabel={`Lien ${label}`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  fill: { flex: 1 },
  body: {
    paddingHorizontal: space.xl,
  },

  back: {
    position: 'absolute',
    left: space.lg,
    zIndex: 20,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Couverture
  coverEditContainer: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg + 44,
  },
  coverEditPill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.bg.scrim,
  },
  coverEditLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.hi,
  },

  // Identité
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -28,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: AVATAR, height: AVATAR },
  avatarInitials: {
    fontFamily: typo.display,
    fontSize: 24,
    letterSpacing: 1,
    color: colors.text.hi,
  },
  modifyContainer: { marginBottom: space.sm },
  modifyPill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  modifyLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },

  name: {
    fontFamily: typo.display,
    fontSize: 21,
    letterSpacing: 0.6,
    color: colors.text.hi,
    marginTop: space.lg,
  },
  handle: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  since: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: space.sm,
  },
  bio: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text.mid,
    marginTop: space.lg,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
  },

  section: { marginTop: space.xxl },
  reseauxView: { marginTop: space.sm },
  reseauxEdit: { marginTop: space.md, gap: space.md },

  // Champs d'édition
  field: { marginTop: space.lg },
  fieldLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.sm,
  },
  input: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  inputMultiline: {
    minHeight: 108,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  counter: {
    fontFamily: typo.mono,
    fontSize: 10,
    color: colors.text.dim,
    textAlign: 'right',
    marginTop: space.xs,
  },
  hint: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: space.xs,
  },
  errorText: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.accent,
    marginTop: space.xs,
  },
  saveErr: { marginTop: space.lg },

  // Barre de sauvegarde collante
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    backgroundColor: colors.bg.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
  },
  saveGhostContainer: { flex: 1 },
  saveGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  saveGhostLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
  saveContainer: { flex: 2 },
  savePrimary: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  savePrimaryDisabled: { opacity: 0.6 },
  savePrimaryLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    letterSpacing: 0.4,
    color: colors.text.hi,
  },
});
