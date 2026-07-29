/**
 * Les cinq niveaux de restitution, à l'écran — jalon 4, phase 4septies.
 * Arbre `app/(app2)`, kit V2.
 *
 * *« Cinq niveaux ouverts par la donnée. Un niveau fermé reste visible, éteint,
 * avec son compteur. »* — `OXV_Mirror_V3_Plan_Montage.md`, phase 4septies.
 *
 * ---
 *
 * CE QUE CETTE SECTION APPREND, ET CE QU'ELLE N'APPREND PAS
 *
 * Chaque niveau ouvert dit ce que sa lecture DEMANDE DE SAVOIR — « se lit en
 * base distance, jamais en base temps », « la forme du nuage porte plus que ses
 * extrêmes ». C'est de la pédagogie de LECTURE, jamais de pilotage. On apprend
 * au pilote à lire sa donnée ; on ne lui dit pas où freiner.
 *
 * ---
 *
 * AUCUN SIGNE DE VERROU, ET C'EST DÉLIBÉRÉ
 *
 * Pas de cadenas, pas de barre qui se remplit, pas de « 3 sur 5 ». Ces trois
 * formes disent la même chose — « avancez pour mériter » — et la doctrine
 * interdit toute mécanique de progression.
 *
 * Un niveau fermé est simplement ÉTEINT : filet et texte passent en gris
 * faible, et son compteur énonce le fait qui le ferme. Rien n'invite à
 * l'ouvrir, parce que rien de ce que fait le pilote ne l'ouvre — c'est la
 * donnée présente qui décide, et pour deux d'entre eux c'est le boîtier.
 *
 * ---
 *
 * L'ORDRE N'EST PAS UN CLASSEMENT
 *
 * Les niveaux sont rangés du moins au plus technique et s'ouvrent
 * INDÉPENDAMMENT : `niveaux.ts` le garantit, son test le démontre en
 * construisant une séance où le rang 4 est ouvert sous un rang 2 fermé.
 *
 * On peut donc voir un niveau ouvert sous un niveau éteint. Ce n'est pas une
 * anomalie d'affichage : c'est la preuve qu'il n'y a pas d'échelle.
 */

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typo } from '@/ui/v2';
import { etatsNiveaux, type EtatSeance } from '@/telemetry/niveaux';

export interface NiveauxRestitutionProps {
  /** Ce que la séance contient réellement — des faits comptés. */
  seance: EtatSeance;
}

/** « TROIS LECTURES OUVERTES ». En lettres : « 3/5 » se lirait comme une jauge. */
const EN_LETTRES = ['', 'UNE', 'DEUX', 'TROIS', 'QUATRE', 'CINQ'] as const;
function compte(n: number): string {
  if (n === 0) return 'AUCUNE LECTURE OUVERTE';
  const mot = EN_LETTRES[n] ?? String(n);
  return n === 1 ? 'UNE LECTURE OUVERTE' : `${mot} LECTURES OUVERTES`;
}

function NiveauxRestitutionBrut({ seance }: NiveauxRestitutionProps) {
  const etats = etatsNiveaux(seance);
  const ouverts = etats.filter((e) => e.etat.ouvert).length;

  return (
    <View style={styles.panneau}>
      <View style={styles.entete}>
        <Text style={styles.titre}>CE QUE CETTE SÉANCE PERMET DE LIRE</Text>
        <Text style={styles.compte}>{compte(ouverts)}</Text>
      </View>

      {etats.map(({ niveau, etat }, i) => {
        const ouvert = etat.ouvert;
        return (
          <View
            key={niveau.cle}
            style={[styles.ligne, i > 0 && styles.ligneSuivante]}
            accessibilityRole="text"
            accessibilityLabel={
              ouvert
                ? `${niveau.nom}. ${niveau.contenu} ${niveau.lecture}`
                : `${niveau.nom}, pas de lecture possible sur cette séance. ${etat.compteur}`
            }
          >
            <View style={[styles.filet, ouvert ? styles.filetOuvert : styles.filetEteint]} />
            <View style={styles.corps}>
              <Text style={[styles.nom, ouvert ? styles.nomOuvert : styles.nomEteint]}>
                {niveau.nom}
              </Text>
              <Text style={[styles.contenu, ouvert ? styles.contenuOuvert : styles.contenuEteint]}>
                {niveau.contenu}
              </Text>
              <Text style={styles.pied}>{ouvert ? niveau.lecture : etat.compteur}</Text>
            </View>
          </View>
        );
      })}

      <Text style={styles.note}>
        Ces lectures s’ouvrent selon ce que la séance a mesuré, chacune de son côté. Elles ne
        s’enchaînent pas : l’une peut s’ouvrir pendant qu’une autre reste éteinte.
      </Text>
    </View>
  );
}

export const NiveauxRestitution = memo(NiveauxRestitutionBrut);

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingTop: space.lg,
    paddingBottom: space.md,
    paddingHorizontal: space.md,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.md,
  },
  titre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.mid,
    flexShrink: 1,
  },
  compte: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.text.dim,
  },
  ligne: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
  },
  ligneSuivante: {
    borderTopWidth: 1,
    borderTopColor: colors.border.hairline,
  },
  /**
   * Un FILET, pas une pastille ni un cadenas. Un filet est une marque de
   * structure : il sépare, il ne récompense pas.
   */
  filet: {
    width: 2,
    borderRadius: 1,
    alignSelf: 'stretch',
  },
  filetOuvert: { backgroundColor: colors.text.low },
  filetEteint: { backgroundColor: colors.border.card },
  corps: { flex: 1, gap: 3 },
  nom: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  nomOuvert: { color: colors.text.hi },
  nomEteint: { color: colors.text.dim },
  contenu: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
  },
  contenuOuvert: { color: colors.text.mid },
  contenuEteint: { color: colors.text.dim },
  /**
   * Ouvert : ce que la lecture demande de savoir — de la pédagogie.
   * Fermé : le fait qui la ferme — jamais un objectif, jamais une jauge.
   * Même style : ni l'un ni l'autre n'est une récompense.
   */
  pied: {
    fontFamily: typo.mono,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: colors.text.dim,
    marginTop: 1,
  },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },
});
