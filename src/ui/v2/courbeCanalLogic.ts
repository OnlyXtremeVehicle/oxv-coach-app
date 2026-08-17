/**
 * courbeCanalLogic — les graduations d'un canal, sans une ligne de rendu.
 *
 * ===========================================================================
 * CE QUI MANQUAIT, ET CE QUI NE MANQUAIT PAS
 * ===========================================================================
 *
 * Les canaux de l'écran de séance (vitesse, G longitudinal) sont tracés à la
 * main sur Skia, avec un curseur au doigt sur le thread UI et un rôle
 * `adjustable` pour le lecteur d'écran. Ils sont bons, et une bibliothèque de
 * graphes les remplacerait par moins bien.
 *
 * Ce qui leur manquait n'était pas le trait : c'était l'ÉCHELLE. Le canal
 * vitesse se normalisait sur son propre maximum — la courbe remplissait donc
 * toujours la hauteur, quelle que soit la vitesse atteinte. Une séance à
 * 90 km/h et une séance à 210 km/h dessinaient la même silhouette. Le pilote
 * voyait la forme, jamais le chiffre.
 *
 * ===========================================================================
 * POURQUOI L'AXE DÉBORDE LA DONNÉE
 * ===========================================================================
 *
 * `min + i * (max - min) / n` produit des repères comme 37,4 ou 82,6 : justes,
 * et illisibles. Les graduations lisibles tombent sur des pas 1-2-5 (10, 20,
 * 50, 100…), ce qui oblige l'axe à déborder l'extremum — une pointe à 187 km/h
 * gradue jusqu'à 200.
 *
 * C'est voulu, et c'est le seul endroit où l'axe s'écarte de la mesure : un axe
 * qui s'arrêterait pile sur 187 laisserait croire que c'est une limite du
 * système, alors que c'est ce que le pilote a fait ce jour-là.
 *
 * La conséquence doit être assumée : la courbe ne touche plus le haut du cadre.
 * C'est exactement le gain — la hauteur atteinte devient comparable d'une
 * séance à l'autre, au lieu d'être toujours pleine.
 *
 * Zéro dépendance React Native : testé en node, comme `grammaireViz`.
 */

/** Bornes d'un axe. */
export interface Domaine {
  readonly min: number;
  readonly max: number;
}

/**
 * Le pas « rond » immédiatement supérieur ou égal à `brut`, dans la famille
 * 1-2-5 × 10^n. C'est la convention des axes lisibles depuis les règles à
 * calcul : on gradue de 10 en 10, de 20 en 20, de 50 en 50 — jamais de 37 en 37.
 */
function pasArrondi(brut: number): number {
  if (!Number.isFinite(brut) || brut <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(brut)));
  const normalise = brut / magnitude;
  const pas = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
  return pas * magnitude;
}

/**
 * Coupe la traîne binaire d'un multiple de `pas`. `0.1 * 3` vaut
 * 0.30000000000000004 ; une graduation ne doit pas porter cette queue.
 */
function arrondiPropre(v: number, pas: number): number {
  const decimales = Math.max(0, Math.min(20, -Math.floor(Math.log10(pas))));
  return Number(v.toFixed(decimales));
}

/**
 * Graduations d'un axe, sur des valeurs rondes encadrant le domaine.
 *
 * `cible` est un NOMBRE VISÉ, pas un nombre garanti : arrondir le pas change
 * mécaniquement le compte. Viser 4 rend le plus souvent 3 à 6 repères.
 *
 * Domaine plat (`min === max`) : un seul repère, sur la valeur elle-même.
 * Fabriquer un intervalle autour d'elle dessinerait une variation inexistante.
 *
 * Domaine vide, inversé ou non fini : aucun repère. L'appelant doit rendre
 * l'absence — un axe gradué sous une courbe qui n'existe pas est un mensonge
 * plus coûteux qu'un blanc.
 */
export function graduations(d: Domaine, cible = 4): number[] {
  if (!Number.isFinite(d.min) || !Number.isFinite(d.max)) return [];
  if (d.max < d.min) return [];
  if (d.max === d.min) return [d.min];

  const n = Number.isFinite(cible) && cible >= 2 ? Math.floor(cible) : 4;
  const pas = pasArrondi((d.max - d.min) / n);

  const debut = Math.floor(d.min / pas) * pas;
  const fin = Math.ceil(d.max / pas) * pas;

  const out: number[] = [];
  // Le compteur est ENTIER : accumuler `v += pas` sur des flottants dérive
  // (0,1 + 0,2 ≠ 0,3), et l'axe finirait par afficher 79,99999999999999.
  const compte = Math.round((fin - debut) / pas);
  for (let i = 0; i <= compte; i++) {
    out.push(arrondiPropre(debut + i * pas, pas));
  }
  return out;
}

/**
 * Domaine symétrique autour de zéro, contenant toutes les valeurs mesurées.
 *
 * ===========================================================================
 * CE QU'IL EMPÊCHE : L'ÉCRÊTAGE SILENCIEUX
 * ===========================================================================
 *
 * Un canal signé (G longitudinal, delta) se dessine autour d'un zéro central,
 * et la tentation est de lui donner une pleine échelle FIXE — « ±1,5 g » — puis
 * de borner ce qui dépasse. C'est ce que faisait le canal des appuis : un
 * freinage à 1,8 g était tracé à 1,5 g, sans que rien ne le dise. La courbe
 * montrait une mesure qui n'était pas la mesure.
 *
 * L'échelle se déduit donc de la donnée, jamais l'inverse. Le prix est connu et
 * assumé : une pointe isolée comprime tout le canal. C'est le bon prix — un
 * canal comprimé se voit et s'interprète, un canal écrêté se lit comme une
 * limite physique du véhicule.
 *
 * La symétrie est CONSERVÉE même quand la donnée ne l'est pas : freiner à 1,8 g
 * et accélérer à 0,4 g gradue quand même de −2 à +2. Recentrer l'axe sur les
 * bornes réelles ferait glisser le zéro hors du milieu du canal, et le signe —
 * bas = freinage, haut = accélération — cesserait de se lire d'un coup d'œil.
 *
 * `null` quand aucune valeur n'est finie : l'appelant doit rendre l'absence, pas
 * un axe sous une courbe qui n'existe pas.
 */
export function domaineSymetrique(valeurs: readonly number[]): Domaine | null {
  let ampleur = 0;
  let vu = false;

  for (const v of valeurs) {
    if (!Number.isFinite(v)) continue;
    vu = true;
    const abs = Math.abs(v);
    if (abs > ampleur) ampleur = abs;
  }

  if (!vu) return null;
  // Toutes les valeurs à zéro : un domaine {0,0} est plat, et `graduations` sait
  // déjà n'en tirer qu'un seul repère plutôt qu'une variation inventée.
  //
  // Le ternaire n'est pas cosmétique : `-0` est ce que rend `-ampleur` quand
  // l'ampleur est nulle. Il s'égale à `0` par `===` mais s'en distingue par
  // `Object.is`, donc par `toEqual` — et un module qui laisse fuir un zéro
  // négatif fait échouer les tests de ses appelants sur une différence que
  // personne ne voit à l'écran.
  return { min: ampleur === 0 ? 0 : -ampleur, max: ampleur };
}

/**
 * Bornes de l'axe effectivement tracé — les extrémités des graduations.
 *
 * C'EST LA FONCTION QUI ÉVITE LE DÉCALAGE. Normaliser la courbe sur le maximum
 * OBSERVÉ pendant qu'on affiche des repères ARRONDIS mettrait chaque étiquette
 * en face d'une mauvaise hauteur : « 150 » se retrouverait là où passent 140.
 * La courbe et les repères doivent partager le même dénominateur, et c'est
 * celui-ci.
 */
export function domaineGradue(d: Domaine, cible = 4): Domaine {
  const g = graduations(d, cible);
  if (g.length === 0) return d;
  if (g.length === 1) return { min: g[0], max: g[0] };
  return { min: g[0], max: g[g.length - 1] };
}
