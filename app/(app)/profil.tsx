// DIVERGENCE_SCHEMA: adaptations au repo réel (spec lot PROFIL_CARTES §3) —
//  - espace pilote réel = `app/(app)/` (pas `(pilote)/profil/index.tsx`) :
//    cet écran EXISTANT devient la CONSULTATION fidèle à profil.html ;
//    l'ÉDITION vit dans `app/(app)/profil-edition.tsx` (appMap : compte) ;
//  - COUVERTURE : aucune donnée réelle (users.media est un TABLEAU de médias,
//    pas d'objet { cover_url }) → fond dégradé par défaut du HTML, aucune clé
//    inventée, pas de bouton « Modifier la couverture » (aucun write-path) ;
//  - GALERIE : médias de PROFIL réels (pilotMediaService, URLs signées) ;
//  - bio / car_number / pavilion_name_optin : migration
//    20260717000000_profil_pavillon.sql NON APPLIQUÉE → repli §5.4 (blocs
//    masqués + console.warn), codé dans src/lib/queries/profil.ts ;
//  - l'édition du @handle est CONSERVÉE là où la référence met le pseudo
//    (users.public_handle, nom public unifié site/app).
/**
 * Profil pilote — CONSULTATION (référence profil.html, pixel par pixel).
 *
 * Doctrine Miroir : aucun chrono, aucun classement, aucune donnée
 * télémétrique sur le profil. Seul le NOMBRE de cartes est public — et
 * l'odomètre est LE point d'entrée du Panel de cartes (/(app)/cartes).
 *
 * Données réelles uniquement (RLS self-read, filtres user_id explicites) :
 * identité `users`, garage `vehicles`, compteur telemetry_sessions
 * (status 'completed'), circuit principal `circuits`, galerie
 * pilotMediaService, réseaux `users.socials`. Valeur absente → bloc masqué.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { AnimatedPresence, PressableScale, Stagger } from '@/components/motion';
import { CompteurCartes } from '@/components/profil/CompteurCartes';
import { GalerieGrille } from '@/components/profil/GalerieGrille';
import { GarageListe } from '@/components/profil/GarageListe';
import { OptinPavillon } from '@/components/profil/OptinPavillon';
import {
  type DonneesProfil,
  changerNomPublic,
  getProfil,
  setPavillonOptin,
} from '@/lib/queries/profil';
import {
  addMyPilotMedia,
  listMyPilotMedia,
  type PilotMediaView,
} from '@/services/pilotMediaService';
import { lotProfilTokens as t } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { isValidHandle } from '@/utils/validation';

const MOIS_LONGS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** « depuis avril 2027 » — mois/année de users.created_at. */
function depuisTexte(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `depuis ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Insigne OXV (placeholder géométrique de la référence — asset à venir). */
function InsigneOxv() {
  return (
    <Svg width={26} height={30} viewBox="0 0 26 30" fill="none">
      <Path
        d="M2 4 L13 1 L24 4 L24 16 Q24 25 13 29 Q2 25 2 16 Z"
        stroke={t.rouge}
        strokeWidth={1.6}
      />
      <Path d="M8 10 L18 20 M18 10 L8 20" stroke={t.rouge} strokeWidth={1.6} />
      <Path d="M13 20 L13 24" stroke={t.rouge} strokeWidth={1.6} />
    </Svg>
  );
}

/** Titre de section avec filet (référence .section-titre). */
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

export default function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [medias, setMedias] = useState<PilotMediaView[]>([]);
  const [mediaEnCours, setMediaEnCours] = useState(false);

  // Édition inline du nom public (conservée là où la référence met le pseudo).
  const [editionHandle, setEditionHandle] = useState(false);
  const [handleSaisie, setHandleSaisie] = useState('');
  const [handleErreur, setHandleErreur] = useState<string | null>(null);
  const [handleEnCours, setHandleEnCours] = useState(false);

  const [pavillonEnCours, setPavillonEnCours] = useState(false);

  const charger = useCallback(() => {
    setEtat({ phase: 'chargement' });
    Promise.all([getProfil(), listMyPilotMedia()])
      .then(([donnees, mediasCharges]) => {
        setEtat({ phase: 'pret', donnees });
        setMedias(mediasCharges);
        setHandleSaisie(donnees.profil.handle ?? '');
        setHandleErreur(null);
      })
      .catch(() => setEtat({ phase: 'erreur' }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  async function enregistrerHandle() {
    if (etat.phase !== 'pret') return;
    const prochain = handleSaisie.trim().replace(/^@+/, '').toLowerCase();
    if (prochain === (etat.donnees.profil.handle ?? '')) {
      setEditionHandle(false);
      return;
    }
    if (!isValidHandle(prochain)) {
      setHandleErreur('3 à 20 caractères : minuscules, chiffres, tiret ou underscore.');
      return;
    }
    setHandleEnCours(true);
    const res = await changerNomPublic(prochain);
    setHandleEnCours(false);
    if (!res.ok) {
      setHandleErreur(res.error);
      return;
    }
    setEtat({
      phase: 'pret',
      donnees: {
        ...etat.donnees,
        profil: { ...etat.donnees.profil, handle: prochain },
      },
    });
    setHandleSaisie(prochain);
    setHandleErreur(null);
    setEditionHandle(false);
    Toast.show({ type: 'success', text1: 'Nom public enregistré.' });
  }

  async function basculerPavillon() {
    if (etat.phase !== 'pret') return;
    const actuel = etat.donnees.profil.pavillonOptin ?? false;
    setPavillonEnCours(true);
    const res = await setPavillonOptin(!actuel);
    setPavillonEnCours(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    setEtat({
      phase: 'pret',
      donnees: {
        ...etat.donnees,
        profil: { ...etat.donnees.profil, pavillonOptin: !actuel },
      },
    });
  }

  async function ajouterPhoto() {
    setMediaEnCours(true);
    const res = await addMyPilotMedia('photo');
    setMediaEnCours(false);
    if (res.ok) {
      setMedias(res.items);
      Toast.show({ type: 'success', text1: 'Photo ajoutée.' });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  if (etat.phase === 'chargement') {
    return (
      <View style={[s.ecran, { paddingTop: insets.top }]}>
        <AppBar onBack={() => router.back()} />
        <View style={s.centre}>
          <ActivityIndicator color={t.gris} accessibilityLabel="Chargement du profil" />
        </View>
      </View>
    );
  }

  if (etat.phase === 'erreur') {
    return (
      <View style={[s.ecran, { paddingTop: insets.top }]}>
        <AppBar onBack={() => router.back()} />
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
              style={s.boutonReessayer}
            >
              <Text style={s.boutonReessayerTexte}>Réessayer</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    );
  }

  const { profil, vehicules, compteurCartes, circuitPrincipal } = etat.donnees;

  const nomComplet =
    [profil.prenom, profil.nom].filter(Boolean).join(' ').trim() || (profil.handle ?? '—');
  const initiales =
    `${profil.prenom?.charAt(0) ?? ''}${profil.nom?.charAt(0) ?? ''}`.toUpperCase() || '—';
  const depuis = depuisTexte(profil.creeLe);

  // Sous-ligne du compteur : lieu officiel · tracé (valeurs réelles `circuits`).
  const sousLigneCompteur = circuitPrincipal
    ? [circuitPrincipal.officialName, circuitPrincipal.name]
        .filter((v, i, tab): v is string => Boolean(v) && tab.indexOf(v) === i)
        .join(' · ') || null
    : null;

  const reseaux = [
    { cle: 'instagram', libelle: 'Instagram', url: profil.reseaux.instagram },
    { cle: 'youtube', libelle: 'YouTube', url: profil.reseaux.youtube },
    { cle: 'linkedin', libelle: 'LinkedIn', url: profil.reseaux.linkedin },
  ].filter((r) => r.url !== null);

  return (
    <View style={[s.ecran, { paddingTop: insets.top }]}>
      <AppBar onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── COVER — dégradé par défaut de la référence (aucune donnée cover
            en base) + filigrane du tracé RÉEL du circuit principal. */}
        <View style={s.cover}>
          <Svg width="100%" height="100%" style={s.coverFond}>
            <Defs>
              <LinearGradient id="coverGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#101010" />
                <Stop offset="1" stopColor={t.noir} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverGrad)" />
          </Svg>
          {circuitPrincipal?.trackSvgPath ? (
            <View style={s.coverTrace} pointerEvents="none">
              <Svg width={340} height={340} viewBox="0 0 1000 1000">
                <Path
                  d={circuitPrincipal.trackSvgPath}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          ) : null}
          <View style={s.insigne} pointerEvents="none">
            <InsigneOxv />
          </View>
        </View>

        {/* ── IDENTITÉ */}
        <View style={s.identite}>
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              {profil.avatarUrl ? (
                <Image
                  source={{ uri: profil.avatarUrl }}
                  style={s.avatarImg}
                  resizeMode="cover"
                  accessibilityLabel="Votre photo de profil"
                />
              ) : (
                <Text style={s.avatarInitiales}>{initiales}</Text>
              )}
            </View>
            <PressableScale
              onPress={() => router.push('/(app)/profil-edition' as never)}
              accessibilityRole="button"
              accessibilityLabel="Modifier le profil"
              pressedOpacity={0.7}
              style={s.btnModifier}
            >
              <Text style={s.btnModifierTexte}>Modifier le profil</Text>
            </PressableScale>
          </View>

          <Text style={s.nom} accessibilityRole="header">
            {nomComplet}
          </Text>

          <View style={s.pseudoRow}>
            {profil.carNumber !== null ? (
              <View style={s.badgeNum}>
                <Text style={s.badgeNumTexte}>N° {profil.carNumber}</Text>
              </View>
            ) : null}
            <PressableScale
              onPress={() => {
                setEditionHandle((v) => !v);
                setHandleErreur(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                profil.handle
                  ? `Votre pseudonyme, ${profil.handle}. Modifier`
                  : 'Choisir votre nom public'
              }
              hitSlop={8}
              pressedOpacity={0.7}
            >
              <Text style={s.pseudo}>
                {profil.handle ? `@${profil.handle}` : 'Choisir un nom public'}
              </Text>
            </PressableScale>
          </View>

          {/* Édition inline du nom public — validation partagée site/app. */}
          <AnimatedPresence visible={editionHandle}>
            <View style={s.handleEditeur}>
              <TextInput
                value={handleSaisie}
                onChangeText={(v) => {
                  setHandleSaisie(v.toLowerCase());
                  setHandleErreur(null);
                }}
                placeholder="votre-nom"
                placeholderTextColor={t.grisSombre}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                style={s.handleChamp}
                accessibilityLabel="Nom public"
              />
              <PressableScale
                onPress={enregistrerHandle}
                disabled={handleEnCours}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer le nom public"
                pressedOpacity={0.7}
                style={[s.handleBouton, handleEnCours ? { opacity: 0.5 } : null]}
              >
                <Text style={s.handleBoutonTexte}>Enregistrer</Text>
              </PressableScale>
            </View>
            {handleErreur ? <Text style={s.handleErreur}>{handleErreur}</Text> : null}
            <Text style={s.handleAide}>
              Le même nom vous suit sur oxvehicle.fr et dans l&apos;app.
            </Text>
          </AnimatedPresence>

          {/* TODO_ARBITRAGE: statut Fondateur — colonne ou table dédiée à trancher
              (spec §5.5 : « Membre · depuis {mois année} », sans la mention). */}
          <Text style={s.membreDepuis}>{depuis ? `Membre · ${depuis}` : 'Membre'}</Text>
        </View>

        <Stagger>
          {/* ── COMPTEUR CARTES — seule statistique publique, entrée du panel. */}
          <View style={s.blocCompteur}>
            <CompteurCartes
              total={compteurCartes}
              sousLigne={sousLigneCompteur}
              onPress={() => router.push('/(app)/cartes' as never)}
            />
          </View>

          {/* ── BIO (migration requise ; masquée si vide — l'invitation vit en
              mode édition uniquement). */}
          {profil.bio ? (
            <View style={s.section}>
              <SectionTitre>Bio</SectionTitre>
              <Text style={s.bio}>{profil.bio}</Text>
            </View>
          ) : null}

          {/* ── GARAGE — masqué sans véhicule. */}
          {vehicules.length > 0 ? (
            <View style={s.section}>
              <SectionTitre>Garage</SectionTitre>
              <GarageListe vehicules={vehicules} />
            </View>
          ) : null}

          {/* ── GALERIE — médias de profil réels + ajout réel. */}
          <View style={s.section}>
            <SectionTitre>Galerie</SectionTitre>
            <GalerieGrille medias={medias} onAjouter={ajouterPhoto} ajoutEnCours={mediaEnCours} />
          </View>

          {/* ── RÉSEAUX — seules les clés renseignées apparaissent. */}
          {reseaux.length > 0 ? (
            <View style={s.section}>
              <SectionTitre>Réseaux</SectionTitre>
              <View style={s.reseaux}>
                {reseaux.map((r) => (
                  <PressableScale
                    key={r.cle}
                    onPress={() => {
                      if (r.url && /^https?:\/\//i.test(r.url)) {
                        Linking.openURL(r.url).catch(() => undefined);
                      }
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={`Ouvrir votre profil ${r.libelle}`}
                    pressedOpacity={0.7}
                    style={s.reseau}
                  >
                    <Text style={s.reseauTexte}>{r.libelle}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── RÉGLAGE PAVILLON — monté seulement si la migration est là. */}
          {profil.migrationPavillon && profil.pavillonOptin !== null ? (
            <View style={s.section}>
              <SectionTitre>Affichage Pavillon</SectionTitre>
              <OptinPavillon
                actif={profil.pavillonOptin}
                enCours={pavillonEnCours}
                onBasculer={basculerPavillon}
              />
            </View>
          ) : null}

          {/* ── MANIFESTE */}
          <View style={s.manifeste}>
            <Text style={s.manifesteTexte}>
              « Vous ne pilotez contre personne d&apos;autre que vous-même. »
            </Text>
            <Text style={s.manifestePrincipe}>Le principe OXV</Text>
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

  /* ── Cover */
  cover: {
    height: 210,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  coverFond: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coverTrace: {
    position: 'absolute' as const,
    top: -10,
    right: -40,
    opacity: 0.16,
  },
  insigne: {
    position: 'absolute' as const,
    top: 18,
    left: 20,
  },

  /* ── Identité */
  identite: {
    paddingHorizontal: 20,
    marginTop: -52,
    zIndex: 2,
  },
  avatarRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: t.rouge,
    backgroundColor: t.surface2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  avatarImg: { width: 92, height: 92, borderRadius: 46 },
  avatarInitiales: {
    fontFamily: t.fonts.display,
    fontSize: 24,
    letterSpacing: 1,
    color: t.blanc,
  },
  btnModifier: {
    borderWidth: 1,
    borderColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  btnModifierTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  nom: {
    fontFamily: t.fonts.display,
    fontSize: 21,
    letterSpacing: 0.84,
    lineHeight: 26,
    textTransform: 'uppercase' as const,
    color: t.blanc,
    marginTop: 16,
  },
  pseudoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginTop: 6,
  },
  badgeNum: {
    backgroundColor: t.blanc,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 2,
  },
  badgeNumTexte: {
    fontFamily: t.fonts.monoBold,
    fontSize: 11,
    letterSpacing: 0.44,
    color: t.noir,
  },
  pseudo: {
    fontFamily: t.fonts.mono,
    fontSize: 12,
    color: t.gris,
    letterSpacing: 0.72,
  },
  membreDepuis: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    color: t.grisSombre,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginTop: 10,
  },

  /* ── Édition inline du nom public */
  handleEditeur: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 12,
  },
  handleChamp: {
    flex: 1,
    fontFamily: t.fonts.mono,
    fontSize: 12,
    color: t.blanc,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  handleBouton: {
    borderWidth: 1,
    borderColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 14,
    justifyContent: 'center' as const,
  },
  handleBoutonTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  handleErreur: {
    fontFamily: t.fonts.corps,
    fontSize: 11,
    color: t.rouge,
    marginTop: 6,
  },
  handleAide: {
    fontFamily: t.fonts.corps,
    fontSize: 11,
    color: t.grisSombre,
    marginTop: 6,
  },

  /* ── Compteur + sections */
  blocCompteur: {
    marginTop: 24,
    marginHorizontal: 20,
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
  bio: {
    fontFamily: t.fonts.corps,
    fontSize: 14,
    lineHeight: 23,
    color: t.deltaNeutre,
  },
  reseaux: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  reseau: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  reseauTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.66,
    color: t.deltaNeutre,
  },

  /* ── Manifeste */
  manifeste: {
    marginTop: 36,
    marginHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: t.ligne,
    alignItems: 'center' as const,
  },
  manifesteTexte: {
    fontFamily: t.fonts.corpsItalique,
    fontSize: 12,
    lineHeight: 19,
    color: t.gris,
    textAlign: 'center' as const,
  },
  manifestePrincipe: {
    fontFamily: t.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.44,
    textTransform: 'uppercase' as const,
    color: t.grisSombre,
    marginTop: 8,
  },

  /* ── Erreur */
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
  boutonReessayer: {
    borderWidth: 1,
    borderColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  boutonReessayerTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
};
