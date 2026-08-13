/**
 * VOTRE ÉCURIE — porte CLUB. Route `club/ecurie`. Phase 5ter du jalon 6.
 *
 * ===========================================================================
 * CE QUI EXISTAIT, ET QUI NE SERVAIT À RIEN
 * ===========================================================================
 *
 * `crews` et `crew_members` sont en production depuis le 04/07, avec quatre
 * fonctions serveur et une cinquième pour l'annuaire. Mesuré le 14/08 :
 *
 *   • `nameMyCrew` — le baptême — **aucun appelant** ;
 *   • `crews_public_rows` — l'annuaire — **aucun appelant**.
 *
 * Une écurie ne pouvait donc pas être nommée, et l'annuaire n'existait nulle
 * part. Le service était écrit, testé, documenté. Il ne manquait qu'un écran.
 *
 * ===========================================================================
 * LES TROIS RÈGLES QUI TIENNENT CET ÉCRAN
 * ===========================================================================
 *
 * **Aucun chrono, nulle part.** Pas un temps au tour, pas une vitesse, pas un
 * « meilleur ». L'écurie est un objet d'appartenance : *« l'écurie affiche des
 * faits, jamais une mise en regard chiffrée »*. Une garde de test le vérifie
 * sur ce fichier, parce qu'un commentaire ne retient personne.
 *
 * **L'ordre porte l'information, le numéro déclarerait un verdict.** L'annuaire
 * est trié par taille et ne porte aucun rang. Le lecteur voit qu'une écurie est
 * plus grande ; il ne lit pas qu'elle est « première ».
 *
 * **L'absence se dit.** L'annuaire restera vide toute la première saison — le
 * dossier de travail le prévoit noir sur blanc. Une liste vide sans phrase se
 * lirait comme une panne : la règle du seuil est donc énoncée.
 *
 * ===========================================================================
 * CE QUE CET ÉCRAN NE PORTE PAS, ET POURQUOI
 * ===========================================================================
 *
 * Le plan prévoit aussi le logo téléversé par le capitaine, l'exclusion par le
 * capitaine et l'invitation par tous. **Les fonctions serveur n'existent pas** :
 * `crews` n'expose que le code, le rattachement, l'appartenance, le baptême et
 * l'annuaire. Aucun bucket de logo n'est déclaré.
 *
 * Les poser ici supposerait d'écrire dans `crew_members` en direct — ce que la
 * RLS refuse, à juste titre : c'est au serveur d'arbitrer qui exclut qui. Un
 * bouton qui échouerait serait exactement le défaut que ce lot corrige.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { memberDisplayName, type CrewMemberProfile } from '@/features/club/clubHubLogic';
import {
  ANNUAIRE_VIDE,
  estCapitaine,
  libelleMembres,
  NOM_MAX,
  validerNomEcurie,
  type LigneAnnuaire,
} from '@/features/club/ecurieLogic';
import { useEcurie } from '@/features/club/useEcurie';
import {
  colors,
  radius,
  SectionHeader,
  space,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

export default function EcurieScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { loading, ecurie, erreur, annuaire, annuaireErreur, userId, baptiser, recharger } =
    useEcurie();

  const capitaine = ecurie ? estCapitaine(ecurie.membres, userId) : false;

  return (
    <Animated.View style={[s.root, door]}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">
          ÉCURIE
        </Text>
        <View style={s.headerSpacer} />
      </View>

      {loading ? (
        <View style={s.pad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : erreur ? (
        <View style={s.centered}>
          <StateView
            state="error"
            errorMessage="Votre écurie n'a pas pu se charger."
            onRetry={recharger}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          }}
        >
          {ecurie ? (
            <>
              <View style={s.bloc}>
                <Text style={s.titre}>{ecurie.titre}</Text>
                <Text style={s.sousTitre}>{libelleMembres(ecurie.membres.length)}</Text>
              </View>

              {/* Le baptême — capitaine seul, comme le serveur l'impose. Un
                  membre ordinaire ne voit pas un champ qu'on lui refuserait. */}
              {capitaine ? <Bapteme nomActuel={ecurie.nom} onBaptiser={baptiser} /> : null}

              <View style={s.bloc}>
                <SectionHeader eyebrow="LES PILOTES" />
                {ecurie.membres.map((m) => (
                  <Membre key={m.userId} membre={m} moi={m.userId === userId} />
                ))}
              </View>
            </>
          ) : (
            <View style={s.bloc}>
              {/* Pas d'écurie n'est pas une panne : c'est l'état de presque
                  tout le monde. On dit ce que c'est, sans pousser à recruter —
                  le parrainage vit dans VOUS, pas ici. */}
              <SectionHeader eyebrow="VOTRE APPARTENANCE" />
              <Text style={s.corps}>
                Vous n'appartenez à aucune écurie. Une écurie se rejoint avec le code d'un pilote
                qui en fait déjà partie.
              </Text>
            </View>
          )}

          <View style={s.bloc}>
            <SectionHeader eyebrow="LES ÉCURIES" />
            {annuaireErreur ? (
              <Text style={s.corps}>L'annuaire n'a pas pu se charger.</Text>
            ) : annuaire.length === 0 ? (
              <Text style={s.corps}>{ANNUAIRE_VIDE}</Text>
            ) : (
              annuaire.map((e) => <LigneEcurie key={e.name} ligne={e} />)
            )}
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

/**
 * Le baptême. Le champ part du nom actuel : renommer est la même opération que
 * nommer côté serveur, et repartir d'un champ vide donnerait à croire l'inverse.
 */
function Bapteme({
  nomActuel,
  onBaptiser,
}: {
  nomActuel: string | null;
  onBaptiser: (nom: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [saisie, setSaisie] = useState(nomActuel ?? '');
  const [envoi, setEnvoi] = useState(false);
  const probleme = validerNomEcurie(saisie);
  const inchange = saisie.trim() === (nomActuel ?? '').trim();

  async function valider() {
    if (probleme || envoi || inchange) return;
    setEnvoi(true);
    const res = await onBaptiser(saisie);
    setEnvoi(false);
    Toast.show(
      res.ok
        ? { type: 'success', text1: 'Le nom de votre écurie est enregistré.' }
        : { type: 'error', text1: 'Nom non enregistré.', text2: res.error }
    );
  }

  return (
    <View style={s.bloc}>
      <SectionHeader eyebrow={nomActuel ? 'RENOMMER VOTRE ÉCURIE' : 'NOMMER VOTRE ÉCURIE'} />
      <TextInput
        value={saisie}
        onChangeText={setSaisie}
        maxLength={NOM_MAX}
        placeholder="Le nom de votre écurie"
        placeholderTextColor={colors.text.dim}
        style={s.champ}
        accessibilityLabel="Nom de votre écurie"
      />
      {/* Le motif du refus est dit AVANT l'envoi : apprendre qu'on a tapé deux
          lettres après un aller-retour serveur est une perte de temps. */}
      {saisie.length > 0 && probleme ? <Text style={s.probleme}>{probleme}</Text> : null}
      <Pressable
        onPress={valider}
        disabled={!!probleme || envoi || inchange}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!probleme || envoi || inchange, busy: envoi }}
        style={({ pressed }) => [
          s.bouton,
          (!!probleme || inchange) && s.boutonInactif,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={s.boutonTexte}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</Text>
      </Pressable>
      <Text style={s.note}>Vous êtes capitaine : vous seul pouvez nommer cette écurie.</Text>
    </View>
  );
}

/** Un membre : son nom d'affichage et son rôle. Aucune mesure, jamais. */
function Membre({ membre, moi }: { membre: CrewMemberProfile; moi: boolean }) {
  return (
    <View style={s.ligne}>
      <Text style={s.ligneNom}>
        {memberDisplayName(membre)}
        {moi ? ' · vous' : ''}
      </Text>
      {membre.role === 'captain' ? <Text style={s.ligneRole}>CAPITAINE</Text> : null}
    </View>
  );
}

/**
 * Une écurie de l'annuaire.
 *
 * Le nombre de membres est un FAIT, affiché tel quel. Aucun index, aucune
 * médaille, aucun « 1er » : c'est la position dans la liste qui informe.
 */
function LigneEcurie({ ligne }: { ligne: LigneAnnuaire }) {
  return (
    <View style={s.ligne}>
      <Text style={s.ligneNom}>{ligne.name}</Text>
      <Text style={s.ligneRole}>{libelleMembres(ligne.validated_members)}</Text>
    </View>
  );
}

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 15,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  pad: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },

  bloc: { marginTop: space.xl },
  titre: {
    fontFamily: typo.display,
    fontSize: 26,
    color: colors.text.hi,
    letterSpacing: 0.2,
  },
  sousTitre: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginTop: space.xs,
    textTransform: 'uppercase',
  },
  corps: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
    gap: space.md,
  },
  ligneNom: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
  },
  ligneRole: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.low,
    textTransform: 'uppercase',
  },

  champ: {
    fontFamily: typo.body,
    fontSize: 16,
    color: colors.text.hi,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.bg.card,
  },
  probleme: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.low,
    marginTop: space.sm,
  },
  bouton: {
    marginTop: space.md,
    alignSelf: 'flex-start',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  boutonInactif: { opacity: 0.45 },
  boutonTexte: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text.hi,
    textTransform: 'uppercase',
  },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.dim,
    marginTop: space.sm,
  },
});
