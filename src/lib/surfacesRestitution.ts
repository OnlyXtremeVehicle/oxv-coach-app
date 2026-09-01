/**
 * LES DEUX NATURES DE FEUILLE — le manifeste que la règle des mots-clés suppose.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'EXISTAIT PAS
 * ===========================================================================
 *
 * Le brief de dépôt le cite depuis le 30/08/2026 : *« Le manifeste des deux
 * familles vit dans `src/lib/surfacesRestitution.ts` ; une surface absente des
 * deux est elle-même une violation. »* Il n'existait sous aucun nom — vérifié
 * par recherche sur `src/` et `app/` le jour même de l'installation du brief.
 *
 * Une règle qui s'appuie sur un manifeste absent n'arrête rien, et la session
 * qui la cite croit s'appuyer sur un cliquet.
 *
 * ===========================================================================
 * CE QUE LA SÉPARATION DÉCIDE
 * ===========================================================================
 *
 * **Feuille de DONNÉES** — elle ne montre que des mots-clés. Une chaîne y est
 * une phrase si elle compte plus de trois mots ET contient un mot outil ; la
 * garde la refuse. La phrase reste disponible, au second geste.
 *
 * **Feuille de RÉCIT** — la prose y est autorisée, sous le filtre doctrinal
 * existant (`aiSafetyFilter`, 52 termes). Le débrief rédigé, la phrase du
 * coach, les notes du pilote en sont. Décision du fondateur du 30/08 : réduire
 * le débrief à des mots-clés jetterait cinq mécanismes de sûreté — filtre des
 * 52 termes, repli local déterministe, garde de rendu, test de parité,
 * déclencheur SQL — pour gagner une ligne de style.
 *
 * ===========================================================================
 * L'ABSENCE EST UNE VIOLATION, PAS UNE EXEMPTION
 * ===========================================================================
 *
 * Une surface de restitution qui ne figure dans aucun des deux tableaux fait
 * échouer la garde. C'est délibéré : deviner à quelle famille appartient un
 * écran neuf reviendrait à l'exempter en silence, et c'est exactement ainsi que
 * les phrases reviennent sur les feuilles de données.
 */

/**
 * Les feuilles de DONNÉES en service. Chemins relatifs à la racine du dépôt,
 * séparateurs POSIX — la garde normalise avant de comparer.
 */
export const FEUILLES_DE_DONNEES: readonly string[] = [
  'app/(app2)/data/session/[id].tsx',
  'app/(app2)/bilan/[sessionId].tsx',
  'app/(app2)/data/index.tsx',
  'app/(app2)/data/comparer.tsx',
  'app/(app2)/data/carnet.tsx',
  'app/(app2)/signature.tsx',
  'app/(app2)/bilan/carte-souvenir.tsx',
  'app/(coach)/comparer.tsx',
  'app/(coach)/priorites.tsx',
  'app/(coach)/rapport.tsx',
  'app/(admin)/analyse-session/[id].tsx',
  'src/features/data/saison/SaisonSections.tsx',
  'src/features/data/saison/PetitsMultiples.tsx',
  'src/components/telemetry/NiveauxRestitution.tsx',
];

/**
 * Feuilles de données ATTENDUES — inscrites d'avance, pas encore écrites.
 *
 * Elles sont séparées des précédentes pour une raison pratique : la garde ne
 * doit pas échouer sur un fichier absent, et elle ne doit pas non plus oublier
 * de les surveiller le jour où ils apparaissent. Un chemin quitte cette liste
 * pour la précédente dans le commit qui crée l'écran.
 *
 * Vérifié le 01/09/2026 : les trois sont bien absents du dépôt.
 */
export const FEUILLES_DE_DONNEES_ATTENDUES: readonly string[] = [
  'app/(app2)/rec/stand.tsx',
  'app/(app2)/bilan/notes.tsx',
  'app/(app2)/bilan/debrief/[sessionId].tsx',
];

/**
 * Les feuilles de RÉCIT — la prose y est autorisée, sous le filtre existant.
 *
 * Le tableau est VIDE aujourd'hui, et ce n'est pas un oubli : le débrief rédigé
 * ne vit pas encore dans un écran qui lui soit propre. Il est composé par
 * `debriefGenerator` et rendu à l'intérieur du bilan — une feuille de données.
 * La cohabitation tient parce que le débrief passe par son propre filtre ; elle
 * cessera de tenir le jour où `bilan/debrief/[sessionId].tsx` existera, et ce
 * jour-là ce chemin descendra ici plutôt que dans la liste ci-dessus.
 */
export const FEUILLES_DE_RECIT: readonly string[] = [];

/** Toutes les surfaces déclarées, quelle que soit leur famille. */
export function surfacesDeclarees(): string[] {
  return [...FEUILLES_DE_DONNEES, ...FEUILLES_DE_DONNEES_ATTENDUES, ...FEUILLES_DE_RECIT];
}

/** Une surface est-elle soumise à la règle des mots-clés ? */
export function estFeuilleDeDonnees(chemin: string): boolean {
  const c = normaliser(chemin);
  return (
    FEUILLES_DE_DONNEES.some((f) => normaliser(f) === c) ||
    FEUILLES_DE_DONNEES_ATTENDUES.some((f) => normaliser(f) === c)
  );
}

/** La prose y est-elle autorisée ? */
export function estFeuilleDeRecit(chemin: string): boolean {
  const c = normaliser(chemin);
  return FEUILLES_DE_RECIT.some((f) => normaliser(f) === c);
}

/**
 * Une surface déclarée dans aucune des deux familles.
 *
 * `true` est une VIOLATION, pas une question ouverte.
 */
export function estNonDeclaree(chemin: string): boolean {
  return !estFeuilleDeDonnees(chemin) && !estFeuilleDeRecit(chemin);
}

/**
 * Sépare les chemins Windows des chemins POSIX, et retire un éventuel préfixe
 * de racine. Sans cela, la garde comparerait `app\(app2)\…` à `app/(app2)/…`
 * et n'aurait jamais trouvé aucune surface — le défaut classique de ce dépôt,
 * déjà payé par la garde des modules orphelins.
 */
function normaliser(chemin: string): string {
  return chemin.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}
