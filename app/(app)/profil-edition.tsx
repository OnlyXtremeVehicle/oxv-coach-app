// DIVERGENCE_SCHEMA: adaptations au repo réel (spec lot PROFIL_CARTES §3) —
//  - route `app/(app)/profil-edition.tsx` (espace pilote réel = groupe
//    `(app)`, pas `(pilote)/profil/edition.tsx`) ; appMap : zone 'compte' ;
//  - AVATAR / COUVERTURE : aucun write-path réel dans l'app (avatar_url géré
//    hors app ; aucune donnée de couverture — users.media est un TABLEAU de
//    médias de profil) → non éditables ici, rien d'inventé ;
//  - BIO : colonne de la migration 20260717000000_profil_pavillon.sql NON
//    APPLIQUÉE → champ masqué tant que la migration est absente (§5.4, repli
//    codé dans src/lib/queries/profil.ts) ;
//  - RÉSEAUX : users.socials (jsonb) — clés du lot instagram / youtube /
//    linkedin ; les autres clés existantes (website…) sont PRÉSERVÉES par la
//    fusion à l'écriture.
/**
 * Profil pilote — ÉDITION (lot PROFIL_CARTES) : bio, réseaux, galerie.
 *
 * Écriture en WHITELIST stricte (spec §7.5) : seuls bio et socials passent
 * par sauvegarderProfil — jamais role, is_admin, kyc_status ni aucun autre
 * champ. Le nom public s'édite sur l'écran Profil (consultation), l'opt-in
 * Pavillon aussi. Galerie : ajout/retrait réels via pilotMediaService
 * (bucket privé, URLs signées).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { PressableScale, Stagger } from '@/components/motion';
import { type DonneesProfil, getProfil, sauvegarderProfil } from '@/lib/queries/profil';
import {
  type PilotMediaType,
  type PilotMediaView,
  addMyPilotMedia,
  listMyPilotMedia,
  removeMyPilotMedia,
} from '@/services/pilotMediaService';
import { lotProfilTokens as t } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';

const BIO_MAX = 400;

/** Titre de section avec filet (même langage que la consultation). */
function SectionTitre({ children }: { children: string }) {
  return (
    <View style={s.sectionTitre}>
      <Text style={s.sectionTitreTexte}>{children}</Text>
      <View style={s.sectionTitreFilet} />
    </View>
  );
}

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur' }
  | { phase: 'pret'; donnees: DonneesProfil };

export default function ProfilEditionScreen() {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });

  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const [medias, setMedias] = useState<PilotMediaView[]>([]);
  const [mediaEnCours, setMediaEnCours] = useState(false);

  const charger = useCallback(() => {
    setEtat({ phase: 'chargement' });
    Promise.all([getProfil(), listMyPilotMedia()])
      .then(([donnees, mediasCharges]) => {
        setEtat({ phase: 'pret', donnees });
        setMedias(mediasCharges);
        setBio(donnees.profil.bio ?? '');
        setInstagram(donnees.profil.reseaux.instagram ?? '');
        setYoutube(donnees.profil.reseaux.youtube ?? '');
        setLinkedin(donnees.profil.reseaux.linkedin ?? '');
      })
      .catch(() => setEtat({ phase: 'erreur' }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  async function enregistrer() {
    if (etat.phase !== 'pret') return;
    const migrationPavillon = etat.donnees.profil.migrationPavillon;
    setEnregistrement(true);
    const res = await sauvegarderProfil(
      {
        ...(migrationPavillon ? { bio } : {}),
        reseaux: { instagram, youtube, linkedin },
      },
      { migrationPavillon }
    );
    setEnregistrement(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Profil enregistré.' });
    router.back();
  }

  async function ajouterMedia(type: PilotMediaType) {
    setMediaEnCours(true);
    const res = await addMyPilotMedia(type);
    setMediaEnCours(false);
    if (res.ok) {
      setMedias(res.items);
      Toast.show({
        type: 'success',
        text1: type === 'video' ? 'Vidéo ajoutée.' : 'Photo ajoutée.',
      });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  async function retirerMedia(id: string) {
    const res = await removeMyPilotMedia(id);
    if (res.ok) {
      setMedias(res.items);
    } else {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  if (etat.phase === 'chargement') {
    return (
      <View style={[s.ecran, { paddingTop: insets.top }]}>
        <AppBar title="Modifier le profil" onBack={() => router.back()} />
        <View style={s.centre}>
          <ActivityIndicator color={t.gris} accessibilityLabel="Chargement du profil" />
        </View>
      </View>
    );
  }

  if (etat.phase === 'erreur') {
    return (
      <View style={[s.ecran, { paddingTop: insets.top }]}>
        <AppBar title="Modifier le profil" onBack={() => router.back()} />
        <View style={s.centre}>
          <View style={s.bandeauErreur}>
            <Text style={s.erreurTexte}>
              Votre profil n&apos;a pas pu être chargé. Vérifiez votre connexion.
            </Text>
            <PressableScale
              onPress={charger}
              accessibilityRole="button"
              accessibilityLabel="Réessayer le chargement"
              pressedOpacity={0.7}
              style={s.boutonSecondaire}
            >
              <Text style={s.boutonSecondaireTexte}>Réessayer</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    );
  }

  const migrationPavillon = etat.donnees.profil.migrationPavillon;

  return (
    <View style={[s.ecran, { paddingTop: insets.top }]}>
      <AppBar title="Modifier le profil" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Stagger>
          {/* ── BIO — placeholder d'invitation en édition uniquement (§7.2). */}
          {migrationPavillon ? (
            <View style={s.section}>
              <SectionTitre>Bio</SectionTitre>
              <TextInput
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, BIO_MAX))}
                placeholder="Quelques lignes sur votre parcours et votre rapport au circuit."
                placeholderTextColor={t.grisSombre}
                multiline
                maxLength={BIO_MAX}
                style={s.champBio}
                accessibilityLabel="Votre bio"
              />
              <Text style={s.compteurBio}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
          ) : null}

          {/* ── RÉSEAUX */}
          <View style={s.section}>
            <SectionTitre>Réseaux</SectionTitre>
            {(
              [
                { libelle: 'Instagram', valeur: instagram, setValeur: setInstagram },
                { libelle: 'YouTube', valeur: youtube, setValeur: setYoutube },
                { libelle: 'LinkedIn', valeur: linkedin, setValeur: setLinkedin },
              ] as const
            ).map((champ) => (
              <View key={champ.libelle} style={s.champBloc}>
                <Text style={s.champLabel}>{champ.libelle}</Text>
                <TextInput
                  value={champ.valeur}
                  onChangeText={champ.setValeur}
                  placeholder="https://…"
                  placeholderTextColor={t.grisSombre}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={s.champ}
                  accessibilityLabel={`Lien ${champ.libelle}`}
                />
              </View>
            ))}
          </View>

          {/* ── GALERIE — ajout/retrait réels (bucket privé, URLs signées). */}
          <View style={s.section}>
            <SectionTitre>Galerie</SectionTitre>
            {medias.length > 0 ? (
              <View style={s.mediaListe}>
                {medias.map((m) => (
                  <View key={m.id} style={s.mediaLigne}>
                    <Text style={s.mediaType}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
                    <PressableScale
                      onPress={() => retirerMedia(m.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Retirer ce média"
                      hitSlop={8}
                      pressedOpacity={0.7}
                    >
                      <Text style={s.mediaRetirer}>Retirer</Text>
                    </PressableScale>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.mediaVide}>Aucun média pour l&apos;instant.</Text>
            )}
            <View style={s.mediaActions}>
              <PressableScale
                onPress={() => ajouterMedia('photo')}
                disabled={mediaEnCours}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une photo"
                pressedOpacity={0.7}
                style={[s.boutonSecondaire, mediaEnCours ? { opacity: 0.5 } : null]}
              >
                <Text style={s.boutonSecondaireTexte}>Ajouter une photo</Text>
              </PressableScale>
              <PressableScale
                onPress={() => ajouterMedia('video')}
                disabled={mediaEnCours}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une vidéo"
                pressedOpacity={0.7}
                style={[s.boutonSecondaire, mediaEnCours ? { opacity: 0.5 } : null]}
              >
                <Text style={s.boutonSecondaireTexte}>Ajouter une vidéo</Text>
              </PressableScale>
            </View>
            {mediaEnCours ? (
              <ActivityIndicator
                color={t.gris}
                style={{ marginTop: 12 }}
                accessibilityLabel="Envoi du média en cours"
              />
            ) : null}
          </View>

          {/* ── ENREGISTRER */}
          <View style={s.section}>
            <PressableScale
              onPress={enregistrer}
              disabled={enregistrement}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer le profil"
              pressedOpacity={0.7}
              style={[s.boutonPrincipal, enregistrement ? { opacity: 0.6 } : null]}
            >
              <Text style={s.boutonPrincipalTexte}>
                {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
              </Text>
            </PressableScale>
          </View>
        </Stagger>
      </ScrollView>
    </View>
  );
}

const s = {
  ecran: {
    flex: 1,
    backgroundColor: t.noir,
  },
  centre: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
  },
  section: {
    marginTop: 28,
    marginHorizontal: 20,
  },
  sectionTitre: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 14,
  },
  sectionTitreTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  sectionTitreFilet: {
    flex: 1,
    height: 1,
    backgroundColor: t.ligne,
  },

  champBio: {
    fontFamily: t.fonts.corps,
    fontSize: 14,
    lineHeight: 22,
    color: t.blanc,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    padding: 14,
    minHeight: 110,
    textAlignVertical: 'top' as const,
  },
  compteurBio: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    color: t.grisSombre,
    marginTop: 6,
    textAlign: 'right' as const,
  },

  champBloc: { marginBottom: 14 },
  champLabel: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: t.grisSombre,
    marginBottom: 6,
  },
  champ: {
    fontFamily: t.fonts.mono,
    fontSize: 12,
    color: t.blanc,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },

  mediaListe: { gap: 8 },
  mediaLigne: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mediaType: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.66,
    textTransform: 'uppercase' as const,
    color: t.deltaNeutre,
  },
  mediaRetirer: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  mediaVide: {
    fontFamily: t.fonts.corps,
    fontSize: 12,
    color: t.grisSombre,
  },
  mediaActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 14,
  },

  boutonSecondaire: {
    borderWidth: 1,
    borderColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  boutonSecondaireTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  boutonPrincipal: {
    backgroundColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 13,
    alignItems: 'center' as const,
  },
  boutonPrincipalTexte: {
    fontFamily: t.fonts.display,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },

  bandeauErreur: {
    alignSelf: 'stretch' as const,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 5,
    padding: 20,
    alignItems: 'center' as const,
    gap: 14,
  },
  erreurTexte: {
    fontFamily: t.fonts.corps,
    fontSize: 13,
    lineHeight: 21,
    color: t.gris,
    textAlign: 'center' as const,
  },
};
