/**
 * LE HUB À DEUX MODES (jalon 6, phase 5).
 *
 * *« Deux modes, comme l'admin terrain. Temporel le jour J, structuré le reste
 * du temps. »* — Arbre Coach, I.
 *
 * *« 1 239 lignes, quinze sorties. Quinze destinations, c'est un menu, pas un
 * poste de travail. »* — Arbre Coach, V.1.
 *
 * Module PUR : aucune dépendance React, RN ni Supabase.
 *
 * ---
 *
 * CE QUE LE MODE CHANGE
 *
 * *Jour J* — le temps commande. Les compteurs, les pilotes en piste avec leur
 * dernier tour, la file à débriefer. Les outils de fond disparaissent : personne
 * ne règle ses gabarits de facturation pendant qu'un pilote roule.
 *
 * *Hors journée* — la structure commande. Repères, gabarits, programmes,
 * économie, profil. C'est là qu'on prépare et qu'on range.
 *
 * ---
 *
 * DEUX SIGNAUX MESURÉS, JAMAIS UNE SUPPOSITION
 *
 * Le mode ne se devine pas au calendrier — une journée peut être annulée, un
 * pilote peut rouler un jour non prévu. Il se lit sur ce qui SE PASSE :
 *
 *   1. un pilote est en piste maintenant (roster de présence), ou
 *   2. une séance est arrivée aujourd'hui dans la file.
 *
 * L'un ou l'autre suffit. Aucun des deux → hors journée. Un hub qui se croit en
 * jour J un mardi soir affiche des compteurs vides et cache les outils qu'on
 * cherchait.
 */

export type ModeHub = 'jour-j' | 'hors-journee';

/** Familles d'outils du hub, telles que l'écran les range déjà. */
export type FamilleOutil = 'pilotes' | 'agenda' | 'lecture' | 'business';

export interface SignauxHub {
  /** Pilotes présents au roster, donc réellement en piste. */
  pilotesEnPiste: number;
  /** Séances arrivées dans la file AUJOURD'HUI. */
  seancesDuJour: number;
}

/**
 * Le mode du hub, lu sur les faits.
 *
 * Fail vers `hors-journee` : c'est le mode complet, celui qui ne cache rien. Se
 * tromper en affichant tous les outils coûte un écran chargé ; se tromper en
 * mode jour J cacherait ce que le coach est venu chercher.
 */
export function modeHub(signaux: SignauxHub): ModeHub {
  if (signaux === null || typeof signaux !== 'object') return 'hors-journee';

  const enPiste = signaux.pilotesEnPiste;
  const duJour = signaux.seancesDuJour;

  const aDesPilotes = typeof enPiste === 'number' && Number.isFinite(enPiste) && enPiste > 0;
  const aDesSeances = typeof duJour === 'number' && Number.isFinite(duJour) && duJour > 0;

  return aDesPilotes || aDesSeances ? 'jour-j' : 'hors-journee';
}

/**
 * Cette famille d'outils a-t-elle sa place dans ce mode ?
 *
 * Le jour J ne garde que ce qui sert AU BORD DE LA PISTE : les pilotes et la
 * lecture. L'agenda et l'économie attendent le soir — les afficher pendant un
 * roulage, c'est reconstituer le menu qu'on voulait défaire.
 */
export function familleVisible(famille: FamilleOutil, mode: ModeHub): boolean {
  if (mode === 'hors-journee') return true;
  return famille === 'pilotes' || famille === 'lecture';
}

/**
 * Ce que le hub annonce de son propre mode.
 *
 * Une phrase, pas un badge : le coach doit comprendre POURQUOI il voit moins
 * d'outils, sinon il croit à une panne. Aucune pression, aucun décompte.
 */
export function phraseMode(mode: ModeHub): string | null {
  // Hors journée, le hub est complet : rien à expliquer.
  return mode === 'jour-j' ? 'Journée en cours — les outils de fond reviennent ce soir.' : null;
}
