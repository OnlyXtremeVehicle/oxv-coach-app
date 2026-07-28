/**
 * Moyenne glissante de vitesse — l'entrée du seuil de roulage. Logique PURE.
 *
 * ---
 *
 * À QUOI ELLE SERT
 *
 * `determineState` bascule en `S6_roulage` quand
 * `activeRecording.recentAverageSpeedKmh` dépasse 60 km/h
 * (`STATE_THRESHOLDS.drivingMinSpeedKmh`), et c'est cette bascule qui arme le
 * silence en piste — Principe 3.
 *
 * Or `setActiveRecording` n'avait aucun appelant : le champ restait nul, l'état
 * restait `S1_decouverte`, et `setSilenceMode` ne recevait jamais autre chose
 * que `false`. Le garde-fou existait sans jamais se déclencher.
 *
 * ---
 *
 * POURQUOI UNE MOYENNE, ET PAS LA VITESSE INSTANTANÉE
 *
 * Le RaceBox émet à 25 Hz. Une trame isolée à 61 km/h — un rebond GPS, une
 * sortie de stand un peu vive — ferait basculer l'état, puis le ferait revenir
 * à la trame suivante. Le silence s'armerait et se désarmerait plusieurs fois
 * par seconde, et chaque bascule déclenche un recalcul d'état.
 *
 * Une moyenne sur une fenêtre courte lisse ce bruit sans retarder la bascule.
 *
 * ---
 *
 * LE CHOIX DE LA FENÊTRE, ET CE QU'IL COÛTE
 *
 * Cinq secondes. C'est un compromis, et il a un prix qu'il faut nommer.
 *
 * Le fondateur a tranché pour le seuil de vitesse plutôt que pour « capture en
 * cours » : le silence s'arme donc quand le pilote roule, pas quand il arme.
 * Il reste par construction une fenêtre entre les deux — l'entrée en piste. Une
 * moyenne sur cinq secondes ajoute environ trois secondes à cette fenêtre pour
 * une entrée à 100 km/h. Plus long lisserait mieux et retarderait davantage ;
 * plus court laisserait passer le bruit.
 *
 * L'unité est le km/h, comme le seuil : le parseur UBX rend déjà
 * `(gSpeed_mm_s × 3,6) / 1000`, vérifié avant d'écrire cette comparaison.
 */

/** Fenêtre de lissage, en millisecondes. Voir l'en-tête pour l'arbitrage. */
export const FENETRE_MS = 5_000;

/** Un relevé horodaté. */
export interface Releve {
  /** Millisecondes depuis une origine quelconque, mais monotone. */
  ts: number;
  /** Vitesse en km/h. */
  kmh: number;
}

/**
 * Ajoute un relevé et écarte ceux qui sont sortis de la fenêtre.
 *
 * Rend un NOUVEAU tableau — l'appelant garde un état immuable, ce qui évite le
 * piège classique d'un tampon partagé entre deux abonnements.
 *
 * Les relevés non finis sont ignorés : une trame GPS sans fix peut porter un
 * `NaN`, et un `NaN` dans une somme contamine la moyenne entière.
 */
export function ajouter(fenetre: readonly Releve[], r: Releve, maintenant = r.ts): Releve[] {
  const suite = Number.isFinite(r.kmh) && Number.isFinite(r.ts) ? [...fenetre, r] : [...fenetre];
  const debut = maintenant - FENETRE_MS;
  return suite.filter((x) => x.ts >= debut);
}

/**
 * Moyenne de la fenêtre, ou `null` si elle est vide.
 *
 * `null` et non `0` : une fenêtre vide n'est pas une vitesse nulle, c'est une
 * absence de mesure. Zéro ferait croire à l'arrêt, et l'arrêt est une
 * information que le pilote lirait comme un fait.
 */
export function moyenne(fenetre: readonly Releve[]): number | null {
  if (fenetre.length === 0) return null;
  const somme = fenetre.reduce((acc, r) => acc + r.kmh, 0);
  return somme / fenetre.length;
}
