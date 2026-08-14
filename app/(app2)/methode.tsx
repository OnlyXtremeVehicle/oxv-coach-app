/**
 * LA MÉTHODE — comment chaque chiffre de cette application est obtenu.
 *
 * ===========================================================================
 * POURQUOI CET ÉCRAN EXISTE
 * ===========================================================================
 *
 * Le programme le range parmi les six nouveautés, et le dossier le désigne
 * comme l'item le plus différenciant : *« méthode publiée »*. Une application
 * qui montre des chiffres à un pilote lui doit de dire d'où ils viennent.
 *
 * La matière était écrite depuis longtemps, en quatre endroits, et affichée
 * nulle part :
 *
 *   • `src/telemetry/provenance.ts` — un registre de 27 grandeurs, chacune
 *     avec sa source, son hypothèse nommée et sa convention de seuil, verrouillé
 *     par test, et rendu à l'écran en UN seul point ;
 *   • `ProvenanceTag` porte même une prop `toujours`, commentée « utile dans un
 *     écran de méthode » — jamais passée par personne ;
 *   • `catalogue.ts` donne aux six lectures un champ `source` documenté
 *     « MÉTHODE », protégé par un test qui exige plus de vingt caractères et
 *     interdit les verbes prescriptifs, et la feuille ne l'affiche jamais ;
 *   • l'en-tête de `qdiLogic.ts` réclame un « bloc méthode obligatoire à
 *     l'affichage » qui n'existait pas.
 *
 * Quatre briques de transparence pointaient toutes vers un écran qui n'avait
 * jamais été écrit.
 *
 * ===========================================================================
 * LES TROIS NIVEAUX, ET POURQUOI ILS SONT SÉPARÉS
 * ===========================================================================
 *
 * **Mesuré** — le boîtier l'a lu. **Déduit** — l'application l'a calculé à
 * partir de mesures, par de l'arithmétique. **Inféré** — il a fallu une
 * HYPOTHÈSE sur le monde, et elle est nommée.
 *
 * C'est un ordre de confiance décroissante, pas une hiérarchie de valeur : un
 * chiffre inféré peut être le plus utile de l'écran. Il ne doit simplement
 * jamais régner seul — `peutEtreChiffreRoi` le refuse.
 *
 * ===========================================================================
 * CE QUE CET ÉCRAN NE FAIT PAS
 * ===========================================================================
 *
 * Il n'enseigne pas le pilotage et ne dit à personne quoi faire de ces
 * chiffres. Il décrit une méthode de calcul, rien d'autre — c'est le miroir
 * appliqué à lui-même.
 */

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  BANQUE,
  etiquette,
  libelleProvenance,
  type Grandeur,
  type Provenance,
} from '@/telemetry/provenance';
import {
  colors,
  radius,
  SectionHeader,
  space,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

/** L'ordre du registre : confiance décroissante. */
const NIVEAUX: readonly Provenance[] = ['M', 'D', 'I'];

/**
 * Ce que chaque niveau veut dire, en une phrase, pour le pilote.
 *
 * Le registre porte les libellés courts (« Mesuré », « Déduit », « Inféré ») ;
 * ils ne suffisent pas seuls à comprendre ce qui les sépare.
 */
const EXPLICATIONS: Readonly<Record<Provenance, string>> = {
  M: 'Le boîtier l’a lu. Aucun calcul entre le capteur et vous.',
  D: 'L’application l’a calculé à partir de mesures. De l’arithmétique, pas une supposition.',
  I: 'Il a fallu une hypothèse sur le monde pour l’obtenir. Elle est écrite ci-dessous, à chaque fois.',
};

export default function MethodeScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();

  const parNiveau = useMemo(() => {
    const m = new Map<Provenance, Grandeur[]>();
    for (const n of NIVEAUX) m.set(n, []);
    for (const g of BANQUE) m.get(g.prov)?.push(g);
    return m;
  }, []);

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
          MÉTHODE
        </Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        <Text style={s.chapeau}>
          Chaque chiffre de cette application vient d’un capteur, d’un calcul, ou d’une hypothèse.
          Voici lequel, pour chacun.
        </Text>

        {NIVEAUX.map((niveau) => {
          const grandeurs = parNiveau.get(niveau) ?? [];
          if (grandeurs.length === 0) return null;
          return (
            <View key={niveau} style={s.bloc}>
              <SectionHeader
                eyebrow={`${etiquette(niveau)} ${libelleProvenance(niveau).toUpperCase()}`}
                count={grandeurs.length}
              />
              <Text style={s.explication}>{EXPLICATIONS[niveau]}</Text>
              {grandeurs.map((g) => (
                <LigneGrandeur key={g.cle} g={g} />
              ))}
            </View>
          );
        })}

        {/*
          LA LIMITE, DITE À LA FIN.

          Une méthode publiée qui tairait ses bornes serait une méthode
          publiée à moitié. Ces trois phrases sont des faits mesurés du
          produit, pas des précautions de style.
        */}
        <View style={s.bloc}>
          <SectionHeader eyebrow="CE QUE CETTE MÉTHODE NE SAIT PAS" />
          <Text style={s.limite}>
            Le boîtier mesure la voiture, pas vos gestes : rien ici ne sait où étaient vos mains ni
            à quel moment vous avez décidé.
          </Text>
          <Text style={s.limite}>
            Les seuils sont des choix. Un freinage retenu sous −0,3 g resterait un freinage à −0,28
            g ; le nombre est une convention, pas une frontière du monde.
          </Text>
          <Text style={s.limite}>
            Une valeur absente n’est jamais remplacée par zéro. Quand un chiffre manque, c’est qu’il
            n’a pas été mesuré — et l’écran vous dit pourquoi.
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

/**
 * Une grandeur : son nom, sa source, et sa convention s'il y en a une.
 *
 * La convention est distinguée de la source parce qu'elles ne se valent pas :
 * la source dit d'où vient le chiffre, la convention dit quel choix humain
 * borne le résultat. Les confondre laisserait croire qu'un seuil est une
 * mesure.
 */
function LigneGrandeur({ g }: { g: Grandeur }) {
  return (
    <View style={s.ligne}>
      <Text style={s.nom}>{g.nom}</Text>
      <Text style={s.source}>{g.source}</Text>
      {g.convention ? <Text style={s.convention}>{g.convention}</Text> : null}
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

  chapeau: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.mid,
    marginTop: space.md,
  },
  bloc: { marginTop: space.xl },
  explication: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.low,
    marginBottom: space.md,
  },

  ligne: {
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
  },
  nom: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  source: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: 2,
  },
  /** La convention est en retrait : c'est une borne, pas la source. */
  convention: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xs,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border.card,
  },
  limite: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.mid,
    marginBottom: space.md,
  },
  card: { borderRadius: radius.cell },
});
