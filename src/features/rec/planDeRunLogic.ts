/**
 * CARTE DU RUN (M01 « Plan de run ») — composition PURE de ce que le pilote
 * emporte en piste. Aucune dépendance React ni react-native.
 *
 * ===========================================================================
 * CE QUE LA RECONNAISSANCE A TROUVÉ, ET QU'IL FALLAIT RÉPARER
 * ===========================================================================
 *
 * La brique d'intention existait tout entière — écriture (`CarteProchaineFois`,
 * montée par `rec/fin`), rattachement à la séance (file de capture, op
 * `attach_intention`), relecture au Bilan et au Carnet, lecture coach en
 * opt-in. Une seule chose manquait, et c'était la moitié qui donne son sens à
 * l'autre : **l'entrée**.
 *
 * Le hub PISTE annonce « Conditions, check-list, intention » ; l'écran de
 * préparation ne portait AUCUNE occurrence du mot. Le pilote posait donc ce
 * qu'il voulait regarder en SORTANT de piste, pour « la prochaine fois », et
 * ne le revoyait qu'après avoir roulé. Ce module compose la carte que l'écran
 * de préparation lui rend avant qu'il entre en piste.
 *
 * ===========================================================================
 * CE QUE M01 DEMANDE, ET CE QU'ON N'EN PREND PAS
 * ===========================================================================
 *
 * La fiche M01 du cahier veille écrit : « objectif, 1–2 virages cibles,
 * comportement à tester, référence, critères et conditions », avec « validation
 * coach » et « objectif formulé en action mesurable », le coach « verrouillant
 * les indicateurs de réussite ».
 *
 * Le mapping du 25/08 avait déjà rendu l'arbitrage : « compatible doctrine si
 * formulé en OBSERVATION (« ce que je veux regarder »), pas en consigne ». On
 * s'y tient, et on nomme ce qu'on laisse dehors :
 *
 *   • **Pas de critères de réussite verrouillés par un coach.** Un critère
 *     qu'un tiers verrouille est une consigne, et l'app cesserait d'être un
 *     miroir. Le coach LIT l'intention partagée (RLS `SELECT` seul) ; il ne
 *     l'écrit pas, il ne la borne pas.
 *   • **Pas de score d'atteinte.** L'application ne sait pas ce que le pilote
 *     voulait dire par sa phrase : la noter serait juger un texte qu'elle n'a
 *     pas compris. La garde `intentionJuxtaposee` interdit déjà ce vocabulaire
 *     au Bilan ; rien ici ne doit le réintroduire en amont.
 *   • **Pas de verbe d'action imposé.** Le module ne fabrique aucun texte
 *     d'intention : il transporte celui du pilote, tel quel.
 *
 * ===========================================================================
 * LA RÉFÉRENCE N'EST PAS ICI, ET C'EST DÉLIBÉRÉ
 * ===========================================================================
 *
 * M01 cite une « référence ». Le dépôt n'en porte AUCUNE avant de rouler :
 * `choixPaireTours` désigne la référence d'une séance DÉJÀ courue (meilleur
 * tour chronométré, ou deuxième meilleur si le tour lu est le meilleur), et
 * rien ne persiste un repère choisi en amont. Inventer une ligne « Référence »
 * qu'aucune donnée ne remplit — ou la remplir d'un tour d'un autre jour, d'une
 * autre piste — serait exactement le chiffre fabriqué que la doctrine
 * interdit. La carte ne porte donc que ce qui existe.
 *
 * Le jour où un repère se pose et se range, une clé s'ajoute à `CleLignePlan`
 * et une entrée à `EntreesPlanDeRun`. D'ici là, l'absence est dite en n'étant
 * pas affichée.
 *
 * ===========================================================================
 * RÈGLE DE COMPOSITION
 * ===========================================================================
 *
 * Une entrée absente ne produit AUCUNE ligne — jamais une ligne vide, jamais
 * un tiret qui occupe la place d'une mesure, jamais un zéro. C'est la même
 * règle que la météo de l'écran de préparation (A-WEATHER-1) : ce qui n'a pas
 * été lu ne se rend pas.
 */

/** Version de la composition — à incrémenter dès qu'une règle change. */
export const VERSION_PLAN_DE_RUN = '1.0.0';

/**
 * Ce que la carte ne sait pas, dit une fois, près d'elle. Fiche M01 :
 * « Conditions/réglages non captés à saisir ». La phrase énonce un fait sur
 * l'application, jamais une consigne au pilote.
 */
export const RAPPEL_PLAN_DE_RUN =
  "Réglages du véhicule et état réel de la piste ne sont pas mesurés par l'application.";

/** Les postes de contexte que la carte peut porter aujourd'hui. */
export type CleLignePlan = 'circuit' | 'creneau' | 'conditions';

/** Libellés rendus au pilote — vouvoiement, sans emoji, jamais prescriptifs. */
export const LIBELLES_LIGNES: Record<CleLignePlan, string> = {
  circuit: 'Circuit',
  creneau: 'Créneau',
  conditions: 'Conditions',
};

/**
 * Conditions de piste telles que `trackConditions` les rend.
 *
 * `mesure` porte tout le poids : à `false`, `label` DÉCRIT UNE ABSENCE et
 * n'est pas un verdict — la carte n'en fait alors aucune ligne, plutôt que
 * d'annoncer un état de piste que personne n'a lu.
 */
export interface ConditionsPlan {
  label: string;
  mesure: boolean;
  /** Température, en °C. `null` = non mesurée — jamais 0. */
  temperatureC: number | null;
}

/**
 * Les entrées de la carte. Toutes REQUISES et nullables : l'appelant dit
 * explicitement ce qu'il ne sait pas, il ne l'omet pas.
 */
export interface EntreesPlanDeRun {
  /** Ce que le pilote a écrit. `null` = rien de posé. */
  intention: string | null;
  /** Nom du circuit de la journée. `null` = aucune journée, ou nom inconnu. */
  circuitNom: string | null;
  /** Créneau déjà mis en forme par l'appelant. `null` = non annoncé. */
  creneau: string | null;
  /** Conditions mesurées, ou `null` si aucune mesure n'a été lue. */
  conditions: ConditionsPlan | null;
}

export interface LignePlanDeRun {
  cle: CleLignePlan;
  libelle: string;
  valeur: string;
}

export interface PlanDeRun {
  version: string;
  /**
   * Le texte du pilote, tel quel — bords rognés, rien d'autre. Ni complété,
   * ni reformulé, ni suggéré. `null` = rien de posé.
   */
  intention: string | null;
  /** Le contexte réellement connu. Une entrée absente n'y figure pas. */
  lignes: readonly LignePlanDeRun[];
  /** Ni intention, ni contexte : la carte n'a rien à montrer. */
  vide: boolean;
}

/** Une chaîne utile, ou `null` — le vide typographié n'est pas une valeur. */
function texteOuNull(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * La valeur rendue pour les conditions, ou `null` si rien n'a été mesuré.
 *
 * La température ne s'ajoute que si elle a été lue : absente, la ligne dit
 * l'état de piste seul plutôt qu'un « — » collé à un libellé.
 */
function valeurConditions(c: ConditionsPlan | null): string | null {
  if (c === null || !c.mesure) return null;
  const label = texteOuNull(c.label);
  if (label === null) return null;
  const t = c.temperatureC;
  return t !== null && Number.isFinite(t) ? `${label} · ${Math.round(t)}°` : label;
}

/**
 * Compose la carte du run à partir de ce qui est réellement connu.
 *
 * Pure : mêmes entrées, même sortie, aucun accès réseau ni horloge.
 */
export function composerPlanDeRun(entrees: EntreesPlanDeRun): PlanDeRun {
  const intention = texteOuNull(entrees.intention);

  const brutes: readonly { cle: CleLignePlan; valeur: string | null }[] = [
    { cle: 'circuit', valeur: texteOuNull(entrees.circuitNom) },
    { cle: 'creneau', valeur: texteOuNull(entrees.creneau) },
    { cle: 'conditions', valeur: valeurConditions(entrees.conditions) },
  ];

  const lignes: LignePlanDeRun[] = [];
  for (const b of brutes) {
    if (b.valeur === null) continue;
    lignes.push({ cle: b.cle, libelle: LIBELLES_LIGNES[b.cle], valeur: b.valeur });
  }

  return {
    version: VERSION_PLAN_DE_RUN,
    intention,
    lignes,
    vide: intention === null && lignes.length === 0,
  };
}
