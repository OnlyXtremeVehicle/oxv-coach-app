/**
 * RÉFÉRENTIEL VÉHICULES OXV — millésime 2026, 93 entrées. Donnée PURE.
 *
 * Source : `docs/produit/OXV_Referentiel_Vehicules_2026.csv`, révision 2026,
 * produit par `docs/produit/gen_referentiel.py`. Ce module en est la
 * transcription TypeScript, versionnée et relue — jamais un parseur de CSV à
 * l'exécution : un fichier de données lu au démarrage est un fichier qu'on peut
 * remplacer sans revue, et le référentiel est une pièce contractuelle (CGV 5.3).
 *
 * ===========================================================================
 * AUCUNE CLASSE N'EST ÉCRITE ICI, ET C'EST LA RÈGLE
 * ===========================================================================
 *
 * Le document canonique est formel : « La classe est calculée à partir du
 * rapport masse / puissance. Elle n'est jamais saisie manuellement, jamais
 * négociée, jamais ajustée au cas par cas. » (§3) et « Aucune valeur de classe
 * n'est saisie en dur. » (§5).
 *
 * La table ci-dessous ne porte donc NI `classe`, NI `ratio_kg_ch` — deux
 * colonnes qui existent pourtant dans le CSV publié. Les recopier ferait de
 * chacune une seconde source de vérité, qui dériverait au premier chiffre de
 * masse corrigé sans que rien ne le dise. `classeReferentiel()` et
 * `ratioReferentiel()` les recalculent depuis masse et puissance, par le même
 * `classeDepuisRatio` que le reste de l'application.
 *
 * La CONCORDANCE avec le CSV publié n'est pas supposée pour autant : le test
 * `referentielVehicules.test.ts` relit le fichier sur le disque et compare, ligne
 * à ligne, les 93 classes et les 93 ratios publiés à ceux que le code recalcule.
 * C'est le seul endroit où les deux se rencontrent, et il échoue si elles
 * divergent.
 *
 * ÉTAT DE LA VÉRIFICATION AU 26/08/2026 — 93 lignes sur 93 concordantes, sur la
 * classe comme sur le ratio. Aucune divergence à rapporter, aucune correction
 * silencieuse n'a été faite. Le CSV et ce module disent la même chose.
 *
 * ===========================================================================
 * CE QUE LA PRÉSENCE AU RÉFÉRENTIEL VEUT DIRE — ET SURTOUT CE QU'ELLE NE VEUT
 * PAS DIRE
 * ===========================================================================
 *
 * Le référentiel est l'APPLICATION des conditions C1 à C5, jamais leur
 * substitut. Un véhicule absent de cette table n'est pas hors du périmètre : il
 * est hors référentiel, ce qui ouvre un examen individuel sous 72 heures
 * ouvrées (CGV 5.3). `chercheAuReferentiel` rend donc `null` sans verdict, et
 * c'est `evalueEligibilite` — via `presenceReferentiel: 'absente'` — qui inscrit
 * l'examen sans toucher au verdict.
 *
 * ===========================================================================
 * LES DEUX COLONNES QUI NE SONT PAS ICI
 * ===========================================================================
 *
 * `statut` et `motif_exclusion` du CSV valent respectivement `actif` et vide sur
 * les 93 lignes : le générateur écarte les entrées hors bornes AVANT d'écrire le
 * fichier. Les transcrire reviendrait à porter 93 fois la même constante et à
 * suggérer qu'un statut « exclu » puisse un jour se lire ici — alors qu'une
 * entrée hors bornes n'entre tout simplement pas au référentiel.
 */

import type { Carrosserie, ClasseRoulage, Motorisation } from './eligibiliteLogic';
import { classeDepuisRatio, ratioKgCh } from './eligibiliteLogic';

/** Millésime du référentiel publié. Révisé annuellement (CGV 5.3). */
export const REVISION_REFERENTIEL = '2026';

/** Une entrée du référentiel, telle qu'elle se lit. */
export interface EntreeReferentiel {
  readonly marque: string;
  readonly modele: string;
  /** Génération ou finition — ce qui distingue deux entrées d'un même modèle. */
  readonly generation: string;
  /** Première année de commercialisation de la génération. */
  readonly anneeDebut: number;
  /** Dernière année, ou `null` si la génération est toujours commercialisée. */
  readonly anneeFin: number | null;
  readonly puissanceCh: number;
  /** Masse en ordre de marche, en kg. */
  readonly masseKg: number;
  readonly carrosserie: Carrosserie;
  readonly motorisation: Motorisation;
}

/**
 * La table brute — l'ordre des colonnes est celui du type ci-dessous, et il ne
 * change pas sans que les 93 lignes soient régénérées depuis le CSV.
 *
 *   marque, modèle, génération, année début, année fin, ch, kg, carrosserie,
 *   motorisation
 *
 * Triée par marque, modèle, génération. Ce tri est alphabétique et non par
 * classe : ranger la table par classe encoderait dans l'ordre des lignes la
 * valeur qu'on refuse d'y écrire.
 */
type LigneReferentiel = readonly [
  string,
  string,
  string,
  number,
  number | null,
  number,
  number,
  Carrosserie,
  Motorisation,
];

const TABLE: readonly LigneReferentiel[] = [
  ['Abarth', '595', 'Competizione', 2012, 2023, 180, 1035, 'fermee', 'thermique'],
  ['Alfa Romeo', '4C', '960', 2013, 2020, 240, 1025, 'fermee', 'thermique'],
  ['Alfa Romeo', 'Giulia', 'Quadrifoglio', 2016, null, 510, 1620, 'fermee', 'thermique'],
  ['Alpine', 'A110', 'Base', 2017, null, 252, 1110, 'fermee', 'thermique'],
  ['Alpine', 'A110', 'R', 2022, null, 300, 1082, 'fermee', 'thermique'],
  ['Alpine', 'A110', 'S', 2019, null, 300, 1114, 'fermee', 'thermique'],
  ['Aston Martin', 'Vantage', 'V8 2018', 2018, null, 510, 1630, 'fermee', 'thermique'],
  ['Audi', 'R8', '4S V10', 2015, null, 570, 1660, 'fermee', 'thermique'],
  ['Audi', 'RS e-tron GT', 'J1', 2021, null, 598, 2347, 'fermee', 'electrique'],
  ['Audi', 'RS3', '8V', 2015, 2020, 367, 1520, 'fermee', 'thermique'],
  ['Audi', 'RS3', '8Y', 2021, null, 400, 1570, 'fermee', 'thermique'],
  ['Audi', 'RS4', 'B9 Avant', 2017, null, 450, 1790, 'fermee', 'thermique'],
  ['Audi', 'RS6', 'C8 Avant', 2019, null, 600, 2075, 'fermee', 'thermique'],
  ['Audi', 'TT RS', '8S', 2016, 2022, 400, 1450, 'fermee', 'thermique'],
  ['BMW', 'M135i', 'F40', 2019, null, 306, 1550, 'fermee', 'thermique'],
  ['BMW', 'M2', 'F87', 2016, 2021, 370, 1495, 'fermee', 'thermique'],
  ['BMW', 'M2', 'G87', 2023, null, 460, 1725, 'fermee', 'thermique'],
  ['BMW', 'M240i', 'G42', 2021, null, 374, 1690, 'fermee', 'thermique'],
  ['BMW', 'M3', 'E46', 2000, 2006, 343, 1570, 'fermee', 'thermique'],
  ['BMW', 'M3', 'E92', 2007, 2013, 420, 1655, 'fermee', 'thermique'],
  ['BMW', 'M3', 'F80', 2014, 2018, 431, 1595, 'fermee', 'thermique'],
  ['BMW', 'M3', 'G80', 2021, null, 510, 1730, 'fermee', 'thermique'],
  ['BMW', 'M4', 'F82', 2014, 2020, 431, 1572, 'fermee', 'thermique'],
  ['BMW', 'M5', 'F10', 2011, 2016, 560, 1870, 'fermee', 'thermique'],
  ['BMW', 'Z4', 'M40i G29', 2018, null, 340, 1610, 'decouvrable', 'thermique'],
  ['Caterham', 'Seven', '310', 2017, null, 152, 540, 'decouvrable', 'thermique'],
  ['Caterham', 'Seven', '420', 2017, null, 210, 560, 'decouvrable', 'thermique'],
  ['Chevrolet', 'Corvette', 'C7 Stingray', 2014, 2019, 466, 1560, 'fermee', 'thermique'],
  ['Cupra', 'Leon', 'VZ 300', 2020, null, 300, 1450, 'fermee', 'thermique'],
  ['Ferrari', '296', 'GTB', 2022, null, 830, 1470, 'fermee', 'hybride'],
  ['Ferrari', '458', 'Italia', 2009, 2015, 570, 1485, 'fermee', 'thermique'],
  ['Ferrari', '488', 'GTB', 2015, 2019, 670, 1475, 'fermee', 'thermique'],
  ['Ferrari', 'F8', 'Tributo', 2019, 2023, 720, 1435, 'fermee', 'thermique'],
  ['Ford', 'Mustang', 'VI GT V8', 2015, 2023, 450, 1740, 'fermee', 'thermique'],
  ['Honda', 'Civic Type R', 'FK8', 2017, 2021, 320, 1380, 'fermee', 'thermique'],
  ['Honda', 'Civic Type R', 'FL5', 2022, null, 329, 1429, 'fermee', 'thermique'],
  ['Honda', 'S2000', 'AP1 AP2', 1999, 2009, 240, 1260, 'decouvrable', 'thermique'],
  ['Hyundai', 'i30 N', 'PD Performance', 2017, null, 275, 1429, 'fermee', 'thermique'],
  ['Jaguar', 'F-Type', 'R Coupe', 2014, null, 550, 1730, 'fermee', 'thermique'],
  ['Lamborghini', 'Gallardo', 'LP560-4', 2008, 2013, 560, 1430, 'fermee', 'thermique'],
  ['Lamborghini', 'Huracan', 'LP610-4', 2014, null, 610, 1422, 'fermee', 'thermique'],
  ['Lotus', 'Elise', 'S2 111S', 2004, 2011, 192, 860, 'decouvrable', 'thermique'],
  ['Lotus', 'Elise', 'S3 S 220', 2011, 2021, 220, 924, 'decouvrable', 'thermique'],
  ['Lotus', 'Emira', 'V6', 2022, null, 405, 1458, 'fermee', 'thermique'],
  ['Lotus', 'Evora', 'S', 2010, 2021, 350, 1437, 'fermee', 'thermique'],
  ['Lotus', 'Exige', 'S V6', 2012, 2021, 350, 1176, 'fermee', 'thermique'],
  ['Mazda', 'MX-5', 'ND2', 2018, null, 184, 1050, 'decouvrable', 'thermique'],
  ['McLaren', '570S', 'P13', 2015, 2021, 570, 1440, 'fermee', 'thermique'],
  ['McLaren', '720S', 'P14', 2017, 2023, 720, 1419, 'fermee', 'thermique'],
  ['Mercedes-AMG', 'A45', 'W176', 2015, 2018, 381, 1480, 'fermee', 'thermique'],
  ['Mercedes-AMG', 'A45 S', 'W177', 2019, null, 421, 1550, 'fermee', 'thermique'],
  ['Mercedes-AMG', 'C63 S', 'W205', 2015, 2021, 510, 1745, 'fermee', 'thermique'],
  ['Mercedes-AMG', 'GT', 'C190', 2015, 2021, 476, 1615, 'fermee', 'thermique'],
  ['Mini', 'John Cooper Works', 'F56', 2015, null, 231, 1275, 'fermee', 'thermique'],
  ['Nissan', '350Z', 'Z33', 2003, 2009, 280, 1530, 'fermee', 'thermique'],
  ['Nissan', '370Z', 'Z34', 2009, 2020, 328, 1520, 'fermee', 'thermique'],
  ['Nissan', 'GT-R', 'R35', 2008, null, 570, 1752, 'fermee', 'thermique'],
  ['Peugeot', '208', 'GTi 30th', 2015, 2019, 208, 1160, 'fermee', 'thermique'],
  ['Peugeot', '308', 'GTi 270', 2015, 2021, 272, 1205, 'fermee', 'thermique'],
  ['Porsche', '911', '964 Carrera', 1989, 1994, 250, 1350, 'fermee', 'thermique'],
  ['Porsche', '911', '991 Carrera S', 2011, 2019, 420, 1440, 'fermee', 'thermique'],
  ['Porsche', '911', '991 GT3', 2013, 2019, 500, 1430, 'fermee', 'thermique'],
  ['Porsche', '911', '992 Carrera', 2019, null, 385, 1505, 'fermee', 'thermique'],
  ['Porsche', '911', '992 GT3', 2021, null, 510, 1418, 'fermee', 'thermique'],
  ['Porsche', '911', '992 Turbo', 2020, null, 580, 1640, 'fermee', 'thermique'],
  ['Porsche', '911', '993 Carrera', 1994, 1998, 272, 1370, 'fermee', 'thermique'],
  ['Porsche', '911', '996 Carrera', 1998, 2004, 300, 1320, 'fermee', 'thermique'],
  ['Porsche', '911', '996 GT3', 1999, 2005, 360, 1350, 'fermee', 'thermique'],
  ['Porsche', '911', '997 Carrera S', 2004, 2012, 355, 1425, 'fermee', 'thermique'],
  ['Porsche', '911', '997 GT3', 2006, 2011, 415, 1395, 'fermee', 'thermique'],
  ['Porsche', 'Boxster', '718', 2016, null, 300, 1385, 'decouvrable', 'thermique'],
  ['Porsche', 'Boxster', '986 S', 1999, 2004, 252, 1320, 'decouvrable', 'thermique'],
  ['Porsche', 'Cayman', '718', 2016, null, 300, 1365, 'fermee', 'thermique'],
  ['Porsche', 'Cayman', '718 GT4', 2019, null, 420, 1420, 'fermee', 'thermique'],
  ['Porsche', 'Cayman', '718 GTS 4.0', 2020, null, 400, 1405, 'fermee', 'thermique'],
  ['Porsche', 'Cayman', '718 S', 2016, null, 350, 1385, 'fermee', 'thermique'],
  ['Porsche', 'Cayman', '981 S', 2012, 2016, 325, 1350, 'fermee', 'thermique'],
  ['Porsche', 'Cayman', '987 S', 2005, 2012, 295, 1350, 'fermee', 'thermique'],
  ['Porsche', 'Taycan', '4S J1', 2020, null, 530, 2220, 'fermee', 'electrique'],
  ['Porsche', 'Taycan', 'Turbo S J1', 2020, null, 761, 2320, 'fermee', 'electrique'],
  ['Renault', 'Clio', 'IV RS Trophy', 2015, 2019, 220, 1204, 'fermee', 'thermique'],
  ['Renault', 'Megane', 'IV RS 280', 2018, 2023, 280, 1430, 'fermee', 'thermique'],
  ['Renault', 'Megane', 'IV RS Trophy', 2019, 2023, 300, 1430, 'fermee', 'thermique'],
  ['Subaru', 'BRZ', 'ZD8', 2021, null, 234, 1280, 'fermee', 'thermique'],
  ['Tesla', 'Model 3', 'Performance', 2019, null, 510, 1850, 'fermee', 'electrique'],
  ['Tesla', 'Model S', 'Plaid', 2021, null, 1020, 2190, 'fermee', 'electrique'],
  ['Toyota', 'GR Supra', 'A90 3.0', 2019, null, 340, 1520, 'fermee', 'thermique'],
  ['Toyota', 'GR Yaris', 'XP210', 2020, null, 261, 1280, 'fermee', 'thermique'],
  ['Toyota', 'GR86', 'ZN8', 2021, null, 234, 1280, 'fermee', 'thermique'],
  ['Volkswagen', 'Golf', 'VII GTI Performance', 2013, 2020, 245, 1350, 'fermee', 'thermique'],
  ['Volkswagen', 'Golf', 'VII R', 2013, 2020, 310, 1476, 'fermee', 'thermique'],
  ['Volkswagen', 'Golf', 'VIII GTI Clubsport', 2020, null, 300, 1462, 'fermee', 'thermique'],
  ['Volkswagen', 'Golf', 'VIII R', 2020, null, 320, 1551, 'fermee', 'thermique'],
];

/** Le référentiel publié, 93 entrées, immuable. */
export const REFERENTIEL_VEHICULES: readonly EntreeReferentiel[] = TABLE.map(
  ([
    marque,
    modele,
    generation,
    anneeDebut,
    anneeFin,
    puissanceCh,
    masseKg,
    carrosserie,
    motorisation,
  ]) => ({
    marque,
    modele,
    generation,
    anneeDebut,
    anneeFin,
    puissanceCh,
    masseKg,
    carrosserie,
    motorisation,
  })
);

/** Nombre d'entrées publiées — 93 au millésime 2026. */
export const NOMBRE_ENTREES = REFERENTIEL_VEHICULES.length;

/**
 * Le rapport masse / puissance d'une entrée, recalculé. Jamais `null` sur une
 * entrée du référentiel — masse et puissance y sont toutes deux renseignées et
 * positives — mais le type l'admet parce que `ratioKgCh` le rend, et parce
 * qu'un jour de saisie fautive vaut mieux qu'un `!` qui plante.
 */
export function ratioReferentiel(entree: EntreeReferentiel): number | null {
  return ratioKgCh(entree.masseKg, entree.puissanceCh);
}

/** La classe d'une entrée, recalculée. Voir l'en-tête : jamais lue d'une colonne. */
export function classeReferentiel(entree: EntreeReferentiel): ClasseRoulage | null {
  return classeDepuisRatio(entree.masseKg, entree.puissanceCh);
}

/**
 * Clé de rapprochement : minuscules, accents retirés, ponctuation et espaces
 * réduits. « Mercedes-AMG » et « mercedes amg » se rejoignent, « A45 » et
 * « A45 S » restent distincts.
 *
 * La normalisation retire les accents parce que le parc réel les porte de façon
 * instable (une saisie clavier, un copier-coller d'un site constructeur), et que
 * rater un rapprochement pour un accent inscrirait un véhicule au référentiel
 * comme « hors référentiel » — un examen individuel ouvert pour rien.
 */
function cle(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * L'entrée du référentiel correspondant à un triplet marque / modèle /
 * génération, ou `null`.
 *
 * `null` ne vaut PAS décision de non-éligibilité : il vaut « hors référentiel »,
 * et ouvre un examen individuel sous 72 heures ouvrées. L'appelant traduit ce
 * `null` en `presenceReferentiel: 'absente'`, jamais en verdict.
 */
export function chercheAuReferentiel(
  marque: string,
  modele: string,
  generation: string
): EntreeReferentiel | null {
  const [m, mo, g] = [cle(marque), cle(modele), cle(generation)];
  return (
    REFERENTIEL_VEHICULES.find(
      (e) => cle(e.marque) === m && cle(e.modele) === mo && cle(e.generation) === g
    ) ?? null
  );
}

/** Les entrées d'une marque, dans l'ordre du référentiel. Sélection en cascade. */
export function modelesDeLaMarque(marque: string): readonly EntreeReferentiel[] {
  const m = cle(marque);
  return REFERENTIEL_VEHICULES.filter((e) => cle(e.marque) === m);
}

/** Les marques du référentiel, dédoublonnées, dans l'ordre alphabétique. */
export function marquesDuReferentiel(): readonly string[] {
  return [...new Set(REFERENTIEL_VEHICULES.map((e) => e.marque))];
}

/**
 * Le millésime d'un véhicule est-il couvert par la génération de l'entrée ?
 *
 * `anneeFin === null` signifie « toujours commercialisée » : la borne haute est
 * alors ouverte. Une année antérieure au début n'est jamais couverte — c'est une
 * autre génération, donc une autre masse et une autre classe.
 */
export function millesimeCouvert(entree: EntreeReferentiel, annee: number): boolean {
  if (!Number.isFinite(annee)) return false;
  if (annee < entree.anneeDebut) return false;
  return entree.anneeFin === null || annee <= entree.anneeFin;
}

/** Libellé d'une entrée : « Porsche Cayman 718 GT4 ». Aucun qualificatif. */
export function libelleEntree(entree: EntreeReferentiel): string {
  return `${entree.marque} ${entree.modele} ${entree.generation}`;
}
