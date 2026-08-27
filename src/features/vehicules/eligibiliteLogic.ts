/**
 * PÉRIMÈTRE DE SERVICE VÉHICULE — conditions C1 à C5, classe de roulage,
 * ouverture des offres. Logique PURE, aucun accès réseau, aucun rendu.
 *
 * Référence doctrinale : `docs/produit/claude_OXV_Eligibilite_Vehicules_2026-08-26.md`
 * (document canonique, millésime 2026) et son article de CGV dérivé.
 *
 * ===========================================================================
 * LE MOT « REFUS » N'APPARAÎT NULLE PART, ET CE N'EST PAS UNE COQUETTERIE
 * ===========================================================================
 *
 * L'article L121-11 du code de la consommation interdit de refuser une
 * prestation à un consommateur sans motif légitime. Un périmètre publié,
 * objectif, appliqué uniformément n'est pas un refus : c'est la définition du
 * service vendu. Toute la valeur juridique du dispositif tient dans cette
 * distinction, et elle se perd à la première chaîne de caractères qui dit
 * « refusé ».
 *
 * Le vocabulaire de ce module est donc verrouillé, et une garde le vérifie :
 * « dans le périmètre », « hors du périmètre », « non établi ». Jamais
 * « refus », « rejet », « interdit », « autorisé ».
 *
 * ===========================================================================
 * TROIS ÉTATS, PAS DEUX — « NON ÉTABLI » N'EST PAS UN REFUS DÉGUISÉ
 * ===========================================================================
 *
 * Un véhicule dont la masse n'est pas renseignée n'est pas hors du périmètre :
 * on ne sait pas. Confondre les deux serait la faute la plus coûteuse de ce
 * module — elle transformerait une lacune de saisie en décision commerciale,
 * exactement ce que L121-11 sanctionne.
 *
 *   'dans_le_perimetre'  les cinq conditions sont satisfaites, sur des faits
 *   'hors_du_perimetre'  au moins une condition est démentie par un fait
 *   'non_etabli'         aucune condition n'est démentie, mais il en manque
 *
 * L'ordre de résolution compte : un fait qui dément l'emporte sur une donnée
 * qui manque. Un véhicule de 2 700 kg dont la puissance est inconnue est hors
 * du périmètre — la masse suffit à le dire, et attendre la puissance pour le
 * dire serait une fausse prudence.
 *
 * ===========================================================================
 * « HORS RÉFÉRENTIEL » N'EST PAS « HORS PÉRIMÈTRE »
 * ===========================================================================
 *
 * Le référentiel des 93 entrées est l'APPLICATION des conditions C1 à C5,
 * jamais leur substitut. Les CGV l'écrivent (art. 5.3) :
 *
 *   « L'absence d'un véhicule du référentiel ne vaut pas décision de
 *     non-éligibilité. Le membre peut solliciter un examen individuel ; le
 *     Club répond dans un délai de soixante-douze heures ouvrées. »
 *
 * Conséquence directe dans le code : `presenceReferentiel: 'absente'`
 * n'influence JAMAIS le verdict. Elle ouvre un examen individuel, et rien
 * d'autre. Un test le verrouille explicitement — c'est la voie de recours, et
 * sans elle les réservations légitimes non anticipées par le référentiel se
 * perdent en silence, sans mesure possible du manque à gagner.
 *
 * ===========================================================================
 * CE QUE CE MODULE NE FAIT PAS
 * ===========================================================================
 *
 * • Il ne lit pas HistoVec. La concordance est une information RESTITUÉE au
 *   pilote, pas un contrôle applicatif — le contrôle réel a lieu au paddock.
 *   La brancher ici en condition bloquante ferait de l'app le garant d'une
 *   vérification qu'elle n'opère pas.
 * • Il ne connaît ni le niveau sonore ni le contrôle technique. Ces contrôles
 *   relèvent de la seule responsabilité de l'opérateur du circuit (CGV 6.2), et
 *   OXV n'en est à aucun moment garant.
 * • Il ne décide d'aucune retenue financière. La matrice d'annulation relève de
 *   l'administration, jamais de l'application.
 */

// ===========================================================================
// Typographie
// ===========================================================================

/**
 * Espace fine insécable (U+202F) — séparateur de milliers et espace avant les
 * ponctuations doubles, typographie française. « 2 400 kg » ne se coupe pas.
 */
const NBSP = ' ';

/** Un entier en typographie française : 2400 → « 2 400 ». */
function entierFr(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Un décimal en typographie française : 6 → « 6,0 » ; 5.75 → « 5,75 ». */
function decimalFr(n: number, decimales: number): string {
  return n.toFixed(decimales).replace('.', ',');
}

/**
 * Une masse telle qu'elle a été mesurée : entière si elle l'est, à la décimale
 * sinon. « 2 400 » ou « 2 400,4 », jamais l'un pour l'autre.
 *
 * `vehicles.mass_kg` est un `numeric(6,1)` : les décimales existent en base.
 * C4 compare la masse BRUTE, ce qui est juste — 2 400,4 kg est bien au-delà de
 * 2 400. Mais le motif l'énonçait via `entierFr`, donc arrondie, et produisait
 * littéralement « Masse de 2 400 kg, au-delà du plafond de 2 400 kg. »
 *
 * Un motif d'écart qui affiche deux fois le même nombre en affirmant que l'un
 * dépasse l'autre ne se contente pas d'être laid : il se détruit lui-même. Or
 * toute la parade de l'article L121-11 repose sur des motifs objectifs et
 * VÉRIFIABLES par celui qu'ils concernent. Un motif invérifiable ne vaut pas
 * mieux qu'une absence de motif.
 *
 * `decimalFr` ne suffisait pas : il ne pose pas les séparateurs de milliers, et
 * rendrait « 2400,4 ».
 */
function masseFr(kg: number): string {
  if (Number.isInteger(kg)) return entierFr(kg);
  const [entiere, decimale] = kg.toFixed(1).split('.');
  return `${entierFr(Number(entiere))},${decimale}`;
}

// ===========================================================================
// Les bornes du périmètre — C3 et C4
// ===========================================================================

/** C3 — rapport masse / puissance maximal, en kg/ch. Borne INCLUSE. */
export const RATIO_MAX_KG_CH = 6.0;

/** C4 — masse en ordre de marche maximale, en kg. Borne INCLUSE. */
export const MASSE_MAX_KG = 2400;

/** Frontière classe II / classe I, en kg/ch. Voir la convention de bornes. */
export const SEUIL_CLASSE_I_KG_CH = 5.0;

/** Frontière classe III / classe II, en kg/ch. Voir la convention de bornes. */
export const SEUIL_CLASSE_II_KG_CH = 3.5;

// ===========================================================================
// Classes de roulage
// ===========================================================================

/** Les trois classes. La classe est CALCULÉE, jamais saisie, jamais négociée. */
export type ClasseRoulage = 'I' | 'II' | 'III';

/** Dénomination publiée de chaque classe — libellé neutre, jamais un rang. */
export const DENOMINATION_CLASSE: Readonly<Record<ClasseRoulage, string>> = {
  I: 'Sport',
  II: 'GT',
  III: 'Supersport',
};

/** « Classe II — GT ». Libellé d'affichage, sans qualificatif ni position. */
export function libelleClasse(classe: ClasseRoulage): string {
  return `Classe ${classe} — ${DENOMINATION_CLASSE[classe]}`;
}

/**
 * Facteur de mise à l'échelle entière. `vehicles.mass_kg` est un `numeric(6,1)`
 * et la puissance s'exprime en chevaux entiers : un facteur de 1 000 couvre le
 * domaine réel avec deux décimales de marge.
 */
const ECHELLE = 1000;

/**
 * Le rapport masse / puissance ARRONDI au centième, ou `null`.
 *
 * ===========================================================================
 * POURQUOI L'ARRONDI FAIT PARTIE DE LA RÈGLE, ET NON DE L'AFFICHAGE
 * ===========================================================================
 *
 * Le référentiel publié porte `ratio_kg_ch` à deux décimales, et c'est ce
 * chiffre-là que le pilote lit sur sa fiche véhicule. Si la classe se calculait
 * sur le quotient non arrondi, un véhicule à 4,996 kg/ch afficherait « 5,00 » et
 * « Classe II » — une contradiction visible à l'écran, indéfendable au comptoir,
 * et qu'aucune explication ne rattrape.
 *
 * La classe se calcule donc sur le chiffre MONTRÉ. C'est aussi la convention de
 * `gen_referentiel.py`, qui a produit les 93 entrées publiées : les deux
 * lectures coïncident sur les 93 (vérifié, aucun écart de classe), mais elles ne
 * coïncident pas par construction, et il fallait choisir laquelle fait foi.
 *
 * ===========================================================================
 * LES ÉGALITÉS SE TRANCHENT AU PAIR — ET CE N'ÉTAIT PAS LE PREMIER CHOIX
 * ===========================================================================
 *
 * Ce module a d'abord été écrit `Math.round((masse / puissance) * 100) / 100`.
 * Il rendait alors 3,93 et 3,63 sur deux véhicules dont le référentiel publié
 * porte 3,92 et 3,62 — et ce sont les DEUX SEULES entrées sur 93 qui tombent
 * exactement au demi-centième :
 *
 *     Audi RS3 8Y     1 570 / 400 = 3,925  → publié 3,92
 *     Audi TT RS 8S   1 450 / 400 = 3,625  → publié 3,62
 *
 * La cause est une divergence de convention, pas une erreur de calcul :
 * `Math.round` de JavaScript tranche au demi-SUPÉRIEUR (vers +∞), quand le
 * `round()` de Python — celui de `gen_referentiel.py`, qui a produit le CSV —
 * tranche au PAIR, mode par défaut d'IEEE 754. Deux fonctions justes, deux
 * réponses.
 *
 * On retient le pair, parce que le référentiel est une pièce contractuelle
 * (CGV 5.3) : afficher 3,93 quand le document publié dit 3,92 crée un écart
 * visible entre l'application et le contrat, sur une valeur que le pilote lit
 * sur sa fiche. Les 93 ratios publiés sont ainsi reproduits à l'identique —
 * c'est `referentielVehicules.test.ts` qui l'établit, en relisant le CSV sur le
 * disque, et non ce commentaire.
 *
 * L'arithmétique est ENTIÈRE, et pas seulement par goût. Masse et puissance
 * sont des rationnels de dénominateur connu : `q` et `r` sont le quotient et le
 * reste, et l'égalité se reconnaît à `2r === den` — un FAIT exact. Passer par
 * le quotient flottant ferait dépendre la détection d'égalité de la position du
 * double le plus proche : celui de 3,925 vaut 3,92499999999999982…, donc sous
 * l'égalité, et `x * 100` le ramène par chance à 392,5 pile. Une chance n'est
 * pas une règle.
 *
 * La convention ne touche jamais la CLASSE : une égalité au demi-centième est à
 * un demi-centième d'un seuil, donc ses deux arrondis tombent du même côté de
 * 3,50 comme de 5,00.
 *
 * `null` quand une donnée manque, est non finie, ou n'est pas strictement
 * positive. Jamais de valeur de repli : une masse absente reste absente.
 */
export function ratioKgCh(masseKg: number | null, puissanceCh: number | null): number | null {
  if (masseKg === null || puissanceCh === null) return null;
  if (!Number.isFinite(masseKg) || !Number.isFinite(puissanceCh)) return null;
  if (masseKg <= 0 || puissanceCh <= 0) return null;

  // ratio × 100 = (masse × échelle × 100) / (puissance × échelle), entiers.
  const num = Math.round(masseKg * ECHELLE) * 100;
  const den = Math.round(puissanceCh * ECHELLE);
  if (den <= 0) return null;

  const q = Math.floor(num / den);
  const r = num - q * den;

  const double = 2 * r;
  const centiemes = double < den ? q : double > den ? q + 1 : q % 2 === 0 ? q : q + 1;
  return centiemes / 100;
}

/**
 * La classe de roulage d'un couple masse / puissance, ou `null`.
 *
 * ===========================================================================
 * LA CONVENTION DE BORNES — LE DOCUMENT EST AMBIGU, ON TRANCHE ICI
 * ===========================================================================
 *
 * Le document canonique écrit :
 *
 *     Classe I    5,0 à 6,0 kg/ch
 *     Classe II   3,5 à 5,0 kg/ch
 *     Classe III  inférieur à 3,5 kg/ch
 *
 * 5,0 appartient donc à la fois à I et à II ; 3,5 à la fois à II et à III. Deux
 * valeurs de bord, deux classes possibles, aucune règle écrite pour départager.
 *
 * CONVENTION RETENUE — borne BASSE incluse, borne HAUTE exclue :
 *
 *     III   ratio < 3,5
 *     II    3,5 ≤ ratio < 5,0
 *     I     5,0 ≤ ratio ≤ 6,0      (borne haute INCLUSE, exception assumée)
 *
 * Trois raisons, dans l'ordre de leur poids :
 *
 * 1. C'est la convention de `gen_referentiel.py`, donc celle des 93 entrées
 *    DÉJÀ publiées. Un module qui trancherait autrement reclasserait des
 *    véhicules du référentiel en vigueur — et une classe qui bouge après coup
 *    est précisément ce que le document interdit.
 * 2. Le sens du classement va du plus lourd au plus léger. « 5,0 à 6,0 » se lit
 *    naturellement comme le haut de l'échelle, borne d'entrée comprise.
 * 3. La borne haute de la classe I fait exception parce qu'elle N'EST PAS une
 *    frontière entre deux classes : c'est C3, « inférieur ou égal à 6,0 kg/ch ».
 *    Le texte de la condition est explicite sur l'inclusion, et le périmètre ne
 *    peut pas s'arrêter un centième avant la borne qu'il publie.
 *
 * Au-delà de 6,0 kg/ch, il n'existe AUCUNE classe : la fonction rend `null`.
 * `null` signifie « aucune classe ne s'applique », que ce soit faute de donnée
 * ou faute de périmètre — c'est `evalueEligibilite` qui distingue les deux, et
 * c'est le seul endroit où cette distinction a un sens.
 *
 * La masse n'entre PAS dans le calcul de la classe : le plafond de 2 400 kg
 * (C4) s'applique aux trois classes indifféremment, et le mêler ici rendrait
 * `classeDepuisRatio(2500, 500)` faussement identique à un ratio hors bornes.
 */
export function classeDepuisRatio(
  masseKg: number | null,
  puissanceCh: number | null
): ClasseRoulage | null {
  const ratio = ratioKgCh(masseKg, puissanceCh);
  if (ratio === null) return null;
  if (ratio > RATIO_MAX_KG_CH) return null;
  if (ratio < SEUIL_CLASSE_II_KG_CH) return 'III';
  if (ratio < SEUIL_CLASSE_I_KG_CH) return 'II';
  return 'I';
}

// ===========================================================================
// Ouverture des offres
// ===========================================================================

/**
 * Les formules dont ce module connaît l'ouverture.
 *
 * `offer_type_enum` en production porte une quatrième valeur, `promotion`, dont
 * le document canonique ne dit rien. Elle n'est donc pas listée : une offre dont
 * l'ouverture n'est pas écrite ne s'ouvre pas ici par déduction.
 */
export type OffreOxv = 'access' | 'signature' | 'heritage';

/** Libellé publié de chaque formule. */
export const LIBELLE_OFFRE: Readonly<Record<OffreOxv, string>> = {
  access: 'Access',
  signature: 'Signature',
  heritage: 'Heritage',
};

/**
 * Les formules ouvertes à une classe. Ordre stable, du plus ouvert au plus
 * engageant — c'est l'ordre d'affichage du bloc « Accès » de la fiche véhicule.
 *
 * Access est ouverte aux trois classes ; Signature et Heritage aux classes II
 * et III. La justification économique de cette répartition existe et est
 * documentée — elle est INTERNE, et n'a rien à faire dans un libellé
 * d'interface. Ce module ne rend que des clés de formule.
 *
 * `null` (classe non établie) rend une liste VIDE, jamais une liste par défaut.
 * Une classe qu'on n'a pas pu calculer n'ouvre rien, et surtout n'ouvre pas
 * « au moins Access » par charité : ce serait inventer un droit.
 */
export function offresOuvertes(classe: ClasseRoulage | null): readonly OffreOxv[] {
  if (classe === null) return [];
  if (classe === 'I') return ['access'];
  return ['access', 'signature', 'heritage'];
}

/** Une formule est-elle ouverte à cette classe ? Classe non établie → false. */
export function offreOuverteA(offre: OffreOxv, classe: ClasseRoulage | null): boolean {
  return offresOuvertes(classe).includes(offre);
}

// ===========================================================================
// Le véhicule examiné
// ===========================================================================

/** C2 — architecture de carrosserie déclarée. */
export type Carrosserie = 'fermee' | 'decouvrable';

/** Motorisation déclarée. Les électrifiées sont admises (assurance dédiée). */
export type Motorisation = 'thermique' | 'hybride' | 'electrique';

/**
 * C5 — l'acte de déclaration, et non l'existence d'une modification.
 *
 * La condition C5 est « toute modification est DÉCLARÉE à la réservation ».
 * Elle est donc satisfaite dans les deux cas renseignés : déclarer qu'il n'y a
 * rien la satisfait autant que déclarer des modifications. Une modification
 * déclarée n'écarte personne — elle ouvre un examen sous 72 heures.
 */
export type DeclarationModifications = 'aucune' | 'declarees';

/** Le véhicule a-t-il été retrouvé au référentiel publié ? */
export type PresenceReferentiel = 'presente' | 'absente' | 'non_recherchee';

/**
 * Les faits déclarés sur un véhicule. Aucune entrée optionnelle : ce qui n'est
 * pas connu se déclare `null` explicitement, et se lit « non établi ». Un champ
 * absent du contrat serait un champ que personne ne pense à renseigner.
 */
export interface VehiculeAExaminer {
  /** C4 — masse en ordre de marche, en kg. */
  readonly masseKg: number | null;
  /** C3 — puissance, en ch. */
  readonly puissanceCh: number | null;
  /** C2 — carrosserie fermée ou découvrable. */
  readonly carrosserie: Carrosserie | null;
  /** C2 — protection anti-tonneau d'origine (n'a de sens que sur découvrable). */
  readonly protectionAntiTonneau: boolean | null;
  /** C1 — homologué pour la circulation routière. */
  readonly homologueRoute: boolean | null;
  /** C1 — immatriculé, certificat et attestation d'assurance en cours de validité. */
  readonly immatricule: boolean | null;
  /** C5 — état de la déclaration de modifications. */
  readonly declarationModifications: DeclarationModifications | null;
  /** Motorisation déclarée — restituée, jamais bloquante. */
  readonly motorisation: Motorisation | null;
  /** Présence au référentiel publié. N'influence JAMAIS le verdict. */
  readonly presenceReferentiel: PresenceReferentiel;
}

// ===========================================================================
// Le verdict
// ===========================================================================

/** Le code d'une des cinq conditions d'accès. */
export type CodeCondition = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';

/** L'état d'UNE condition. Trois états, pour la même raison que le verdict. */
export type EtatCondition = 'satisfaite' | 'hors_du_perimetre' | 'non_etablie';

/** Le verdict d'ensemble. Aucun de ces mots n'est un refus. */
export type VerdictPerimetre = 'dans_le_perimetre' | 'hors_du_perimetre' | 'non_etabli';

/**
 * Ce qui ouvre un examen individuel sous 72 heures ouvrées. Un examen n'est ni
 * un refus ni une réserve : c'est une voie, et elle doit être visible.
 */
export type MotifExamen = 'hors_referentiel' | 'modifications_declarees';

/**
 * Une dépendance bloquante non levée, au sens du §6 du document canonique :
 * l'opérateur du circuit n'a pas encore répondu par écrit. Elle ne change AUCUN
 * verdict — elle dit qu'une réponse manque avant publication au client.
 */
export type ReserveOperateur = 'admission_decouvrables' | 'masse_admise_en_piste';

/** Le résultat d'examen d'une condition. `motif` est `null` si satisfaite. */
export interface ResultatCondition {
  readonly code: CodeCondition;
  readonly intitule: string;
  readonly etat: EtatCondition;
  /** Fait constaté, jamais une consigne. `null` quand la condition est satisfaite. */
  readonly motif: string | null;
}

/** Le résultat complet — les cinq conditions y figurent toujours, dans l'ordre. */
export interface ResultatPerimetre {
  readonly verdict: VerdictPerimetre;
  readonly conditions: readonly ResultatCondition[];
  /** Rapport masse / puissance arrondi au centième, ou `null`. */
  readonly ratioKgCh: number | null;
  /** Classe calculée, ou `null` si aucune ne s'applique. */
  readonly classe: ClasseRoulage | null;
  /** Formules ouvertes à cette classe. Vide si la classe n'est pas établie. */
  readonly offres: readonly OffreOxv[];
  /** Examens individuels ouverts (72 h ouvrées). Ne change pas le verdict. */
  readonly examens: readonly MotifExamen[];
  /** Dépendances opérateur non levées. Ne change pas le verdict. */
  readonly reserves: readonly ReserveOperateur[];
}

const INTITULES: Readonly<Record<CodeCondition, string>> = {
  C1: 'Homologation et immatriculation',
  C2: 'Architecture',
  C3: 'Performance',
  C4: 'Masse',
  C5: 'Conformité à l’origine',
};

function condition(
  code: CodeCondition,
  etat: EtatCondition,
  motif: string | null
): ResultatCondition {
  return { code, intitule: INTITULES[code], etat, motif };
}

/** Une masse exploitable : renseignée, finie, strictement positive. */
function masseLisible(masseKg: number | null): boolean {
  return masseKg !== null && Number.isFinite(masseKg) && masseKg > 0;
}

/** C1 — homologué pour la route ET immatriculé, les deux déclarés. */
function evalueC1(v: VehiculeAExaminer): ResultatCondition {
  if (v.homologueRoute === false) {
    return condition(
      'C1',
      'hors_du_perimetre',
      'Véhicule déclaré non homologué pour la circulation routière.'
    );
  }
  if (v.immatricule === false) {
    return condition('C1', 'hors_du_perimetre', 'Véhicule déclaré non immatriculé.');
  }
  if (v.homologueRoute === null) {
    return condition('C1', 'non_etablie', 'Homologation route non renseignée.');
  }
  if (v.immatricule === null) {
    return condition('C1', 'non_etablie', 'Immatriculation non renseignée.');
  }
  return condition('C1', 'satisfaite', null);
}

/**
 * C2 — carrosserie fermée, ou découvrable avec protection anti-tonneau
 * d'origine. Sur une carrosserie fermée, `protectionAntiTonneau` n'est pas lue :
 * exiger sa saisie mettrait « non établi » sur tout le parc fermé.
 */
function evalueC2(v: VehiculeAExaminer): ResultatCondition {
  if (v.carrosserie === null) {
    return condition('C2', 'non_etablie', 'Architecture de carrosserie non renseignée.');
  }
  if (v.carrosserie === 'fermee') return condition('C2', 'satisfaite', null);
  if (v.protectionAntiTonneau === false) {
    return condition(
      'C2',
      'hors_du_perimetre',
      'Carrosserie découvrable sans protection anti-tonneau d’origine.'
    );
  }
  if (v.protectionAntiTonneau === null) {
    return condition(
      'C2',
      'non_etablie',
      'Protection anti-tonneau d’origine non renseignée sur une carrosserie découvrable.'
    );
  }
  return condition('C2', 'satisfaite', null);
}

/** C3 — rapport masse / puissance inférieur ou égal à 6,0 kg/ch. */
function evalueC3(v: VehiculeAExaminer): ResultatCondition {
  const ratio = ratioKgCh(v.masseKg, v.puissanceCh);
  if (ratio === null) {
    const quoi = !masseLisible(v.masseKg) ? 'Masse' : 'Puissance';
    return condition(
      'C3',
      'non_etablie',
      `${quoi} non renseignée${NBSP}: rapport masse / puissance non calculable.`
    );
  }
  if (ratio > RATIO_MAX_KG_CH) {
    return condition(
      'C3',
      'hors_du_perimetre',
      `Rapport masse / puissance de ${decimalFr(ratio, 2)} kg/ch, au-delà du périmètre de ${decimalFr(RATIO_MAX_KG_CH, 1)} kg/ch.`
    );
  }
  return condition('C3', 'satisfaite', null);
}

/** C4 — masse en ordre de marche inférieure ou égale à 2 400 kg. */
function evalueC4(v: VehiculeAExaminer): ResultatCondition {
  if (!masseLisible(v.masseKg)) {
    return condition('C4', 'non_etablie', 'Masse en ordre de marche non renseignée.');
  }
  const masse = v.masseKg as number;
  if (masse > MASSE_MAX_KG) {
    return condition(
      'C4',
      'hors_du_perimetre',
      `Masse de ${masseFr(masse)} kg, au-delà du plafond de ${entierFr(MASSE_MAX_KG)} kg.`
    );
  }
  return condition('C4', 'satisfaite', null);
}

/**
 * C5 — la déclaration est faite. Les deux valeurs renseignées la satisfont :
 * déclarer des modifications n'écarte personne, cela ouvre un examen.
 */
function evalueC5(v: VehiculeAExaminer): ResultatCondition {
  if (v.declarationModifications === null) {
    return condition('C5', 'non_etablie', 'Déclaration de modifications non renseignée.');
  }
  return condition('C5', 'satisfaite', null);
}

/**
 * Le périmètre de service pour un véhicule déclaré.
 *
 * Les cinq conditions sont TOUJOURS présentes dans le résultat, dans l'ordre C1
 * à C5, y compris satisfaites : une fiche qui n'affiche que ce qui manque ne dit
 * pas ce qui a été vérifié.
 *
 * Le verdict se résout dans cet ordre, et l'ordre est la règle :
 *   1. une condition démentie par un fait  → 'hors_du_perimetre'
 *   2. sinon, une condition non établie    → 'non_etabli'
 *   3. sinon                               → 'dans_le_perimetre'
 *
 * Ni `presenceReferentiel`, ni `examens`, ni `reserves` n'entrent dans ce
 * calcul. C'est délibéré, et verrouillé par les tests.
 */
export function evalueEligibilite(v: VehiculeAExaminer): ResultatPerimetre {
  const conditions: readonly ResultatCondition[] = [
    evalueC1(v),
    evalueC2(v),
    evalueC3(v),
    evalueC4(v),
    evalueC5(v),
  ];

  const verdict: VerdictPerimetre = conditions.some((c) => c.etat === 'hors_du_perimetre')
    ? 'hors_du_perimetre'
    : conditions.some((c) => c.etat === 'non_etablie')
      ? 'non_etabli'
      : 'dans_le_perimetre';

  const examens: MotifExamen[] = [];
  if (v.presenceReferentiel === 'absente') examens.push('hors_referentiel');
  if (v.declarationModifications === 'declarees') examens.push('modifications_declarees');

  const reserves: ReserveOperateur[] = [];
  if (v.carrosserie === 'decouvrable') reserves.push('admission_decouvrables');
  if (masseLisible(v.masseKg)) reserves.push('masse_admise_en_piste');

  const classe = classeDepuisRatio(v.masseKg, v.puissanceCh);

  return {
    verdict,
    conditions,
    ratioKgCh: ratioKgCh(v.masseKg, v.puissanceCh),
    classe,
    offres: offresOuvertes(classe),
    examens,
    reserves,
  };
}

/**
 * Les motifs factuels des conditions non remplies, dans l'ordre C1 à C5. Les
 * conditions satisfaites n'y figurent pas — c'est la liste qu'on affiche sous la
 * fiche, pas le détail complet.
 */
export function motifsNonRemplis(resultat: ResultatPerimetre): readonly string[] {
  return resultat.conditions
    .filter((c) => c.etat !== 'satisfaite' && c.motif !== null)
    .map((c) => c.motif as string);
}
