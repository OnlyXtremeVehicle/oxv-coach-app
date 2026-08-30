# À coller dans Claude Code — P4, les quarante mots-clés

*Décision du fondateur, 30/08/2026 : champ `court` obligatoire. La phrase
existante reste, inchangée, au second geste.*

---

## Contexte à donner à Claude Code

> Règle produit : **toute feuille de données ne montre que des mots-clés, jamais
> de phrase.** Une chaîne est une phrase si elle compte plus de trois mots ET
> contient un mot outil (`le la les un une des du de` · `vous votre vos` ·
> `est sont a ont était sera` · `dans avec pour que qui sur sans` ·
> `plus moins ce cette`).
>
> Trois modules produisent aujourd'hui des chaînes d'écran qui sont des phrases.
> Elles ne sont pas mauvaises — elles viennent de la charte anti-jargon et elles
> répondent à « pourquoi je ne vois pas cette lecture ? ». **On ne les supprime
> pas : on leur ajoute un mot-clé.** La feuille de données affiche le mot-clé ;
> la phrase reste disponible au second geste.
>
> Contrainte de type : le champ `court` est **obligatoire**. Un libellé sans
> `court` ne doit pas compiler. C'est le même principe que le `Pick` de
> `sourcesCompositionService` — une absence doit casser à la compilation, pas
> s'afficher.
>
> **Quatre** règles d'écriture, à respecter pour toute chaîne future :
> 1. Majuscules, forme `SUJET` ou `SUJET · PRÉCISION`, jamais de verbe conjugué.
> 2. Trois mots au plus de chaque côté du point médian.
> 3. Le mot-clé résume le **sujet** ; il ne paraphrase pas la phrase. S'il ne se
>    comprend qu'après avoir lu la phrase, il est mauvais.
> 4. **Aucun mot outil, jamais** — pas même dans un mot-clé de trois mots que la
>    règle laisserait passer. Raison : les mots-clés se COMPOSENT
>    (`DONNÉE ABSENTE · <libellé>`), et deux fragments licites peuvent produire
>    une chaîne qui ne l'est plus. La quatrième règle rend la composition sûre
>    par construction. Les quarante-quatre chaînes ci-dessous la respectent, et
>    les cinquante-quatre compositions qu'elles engendrent ont été vérifiées.

---

## 1 · `src/features/presentations/registrePresentations.ts` — 27 libellés

Changer le type :

```ts
export const LIBELLES_DONNEES: Readonly<Record<CleDonnee, string>> = {
```

en :

```ts
/**
 * Ce que chaque donnée s'appelle DEVANT LE PILOTE, en deux registres.
 *
 * `court` est ce que la FEUILLE DE DONNÉES affiche : un mot-clé, jamais une
 * phrase (règle G-0). `long` est la formulation de la charte anti-jargon, qui
 * reste et qui s'ouvre au second geste — elle répond à « pourquoi je ne vois pas
 * cette lecture ? », et cette question mérite une phrase.
 *
 * Les deux champs sont REQUIS. Un libellé sans `court` ne compile pas : c'est la
 * seule manière d'empêcher qu'une phrase reparaisse sur une feuille de données
 * par simple oubli.
 */
export interface LibelleDonnee {
  readonly court: string;
  readonly long: string;
}

export const LIBELLES_DONNEES: Readonly<Record<CleDonnee, LibelleDonnee>> = {
```

Et les vingt-sept entrées :

```ts
  intention:              { court: 'INTENTION',                 long: 'ce que vous aviez posé avant de rouler' },
  ressenti:               { court: 'RESSENTI',                  long: 'ce que vous avez nommé après le run' },
  'repere-piste':         { court: 'REPÈRE PISTE',              long: 'un repère réel sur la piste' },
  'sante-chaine':         { court: 'SANTÉ CHAÎNE',              long: 'l’état de la chaîne de mesure' },
  'etat-traitement':      { court: 'TRAITEMENT',                long: 'l’avancement du traitement de ce run' },
  'confiance-mesure':     { court: 'CONFIANCE',                 long: 'la fiabilité de la mesure sur ce tour' },
  'tour-chronometre':     { court: 'TOUR CHRONOMÉTRÉ',          long: 'un tour chronométré' },
  'tours-comparables':    { court: 'DEUX TOURS COMPARABLES',    long: 'deux tours qui couvrent la même distance' },
  delta:                  { court: 'ÉCART ENTRE TOURS',         long: 'l’écart entre vos tours' },
  'trace-position':       { court: 'PASSAGE LOCALISÉ',          long: 'votre passage situé sur le tracé' },
  repetition:             { court: 'PASSAGE RÉPÉTÉ',            long: 'un même passage retrouvé sur plusieurs tours' },
  freinage:               { court: 'DÉBUT DÉCÉLÉRATION',        long: 'le début de décélération observée' },
  'segmentation-virages': { court: 'DÉCOUPAGE TOUR',            long: 'le découpage du tour en droites et virages' },
  gyroscope:              { court: 'ROTATION',                  long: 'le moment où la voiture tourne' },
  accelerations:          { court: 'APPUIS',                    long: 'les appuis de la voiture' },
  video:                  { court: 'VIDÉO',                     long: 'une vidéo du run' },
  'coach-lie':            { court: 'COACH RATTACHÉ',            long: 'un coach rattaché à votre compte' },
  'consigne-coach':       { court: 'CONSIGNE COACH',            long: 'une consigne posée par votre coach' },
  'voix-coach':           { court: 'VOIX COACH',                long: 'un message vocal de votre coach' },
  acquis:                 { court: 'ACQUIS VALIDÉ',             long: 'un acquis déjà validé' },
  'reference-partagee':   { court: 'RÉFÉRENCE PARTAGÉE',        long: 'une référence publiée et consentie' },
  'plusieurs-runs':       { court: 'PLUSIEURS RUNS',            long: 'plusieurs runs dans la journée' },
  'plusieurs-evenements': { court: 'PLUSIEURS JOURNÉES',        long: 'plusieurs journées de piste' },
  'plusieurs-circuits':   { court: 'PLUSIEURS CIRCUITS',        long: 'plusieurs circuits roulés' },
  live:                   { court: 'DIRECT',                    long: 'le direct de votre run' },
  'flotte-live':          { court: 'DIRECT · PLUSIEURS PILOTES', long: 'le direct de plusieurs pilotes' },
  'canaux-vehicule':      { court: 'CANAUX VÉHICULE',           long: 'les canaux du véhicule' },
};
```

**Appelants à mettre à jour** : `compositionLogic` lit `LIBELLES_DONNEES[cle]`
dans deux motifs d'écart (voir §3). Partout ailleurs où le libellé est rendu,
la feuille de données prend `.court` et le second geste `.long`.

---

## 2 · `src/components/insights/disponibilite.ts` — 6 raisons

Chercher :

```ts
const RAISONS = {
  aucuneMesure: 'Aucune mesure sur cette séance',
  pasDeVirage: 'Aucun virage exploitable',
  pasAssezDeTours: 'Pas assez de tours pour comparer',
  pasDeChrono: 'Chronos de secteur non calculés',
  pasDInertiel: 'Signal inertiel absent',
  pasDeGyroscope: 'Gyroscope absent',
} as const;
```

Remplacer par :

```ts
/**
 * Raisons d'absence, en deux registres (règle G-0).
 *
 * `court` est affiché sur la feuille ; `long` s'ouvre au second geste. Une
 * seule formulation par cause, pour que deux lectures absentes pour la même
 * raison le disent avec les mêmes mots — dans les deux registres.
 */
const RAISONS = {
  aucuneMesure:    { court: 'AUCUNE MESURE',          long: 'Aucune mesure sur cette séance' },
  pasDeVirage:     { court: 'AUCUN VIRAGE',           long: 'Aucun virage exploitable' },
  pasAssezDeTours: { court: 'TOURS INSUFFISANTS',     long: 'Pas assez de tours pour comparer' },
  pasDeChrono:     { court: 'CHRONOS SECTEUR ABSENTS', long: 'Chronos de secteur non calculés' },
  pasDInertiel:    { court: 'SIGNAL INERTIEL ABSENT', long: 'Signal inertiel absent' },
  pasDeGyroscope:  { court: 'GYROSCOPE ABSENT',       long: 'Gyroscope absent' },
} as const;
```

Et le type porteur :

```ts
export interface Disponibilite {
  key: ReadingKey;
  etat: EtatLecture;
  /**
   * Pourquoi c'est absent. Descriptif, jamais prescriptif — on ne dit pas au
   * pilote quoi faire pour l'obtenir. Renseigné seulement si `etat = 'absent'`.
   * Deux registres : `court` sur la feuille, `long` au second geste.
   */
  raison?: { readonly court: string; readonly long: string };
}
```

Trois des six libellés `long` étaient déjà des mots-clés (`Aucun virage
exploitable`, `Signal inertiel absent`, `Gyroscope absent`) : le `court` les
reprend en majuscules, sans les réécrire.

---

## 3 · `src/features/presentations/compositionLogic.ts` — 7 motifs

Les motifs sont aujourd'hui construits en ligne. Les remonter dans une table
nommée, au-dessus de `composerPresentations` :

```ts
/**
 * Les motifs de présence et d'écart, en deux registres (règle G-0).
 *
 * Ils vivent ici, nommés, et non plus en ligne dans la boucle : une chaîne
 * écrite au point d'usage échappe à la garde, et c'est ainsi que les phrases
 * reviennent.
 */
const MOTIFS = {
  donneePorte:      { court: 'DONNÉE PRÉSENTE',      long: 'la séance porte ce que cette lecture demande' },
  themeNomme:       { court: 'THÈME NOMMÉ',          long: (t: string) => `vous avez nommé ${t} après ce run` },
  travailOuvert:    { court: 'TRAVAIL EN COURS',     long: 'le travail ouvert sur cette zone' },
  seuleZone:        { court: 'ZONE UNIQUE',         long: 'seule zone à explorer pour l’instant' },
  dejaOuverte:      { court: 'DÉJÀ OUVERTE',         long: 'déjà ouverte lors d’une séance précédente' },
  niveauAuDessus:   { court: (n: string) => `NIVEAU ${n.toUpperCase()}`,
                      long: (n: string) => `lecture ${n} — elle s’ouvre d’un geste` },
  horsBudget:       { court: 'HORS BUDGET',          long: 'au-delà des cartes du débrief — elle s’ouvre d’un geste' },
} as const;

const ECARTS = {
  surfaceCoach:     { court: 'SURFACE COACH',        long: 'moteur de preuve du coach et du Lab' },
  autreSurface:     { court: 'AUTRE SURFACE',        long: 'lecture d’une autre surface que la vôtre' },
  donneeAbsente:    { court: (d: string) => `DONNÉE ABSENTE · ${d}`,
                      long:  (d: string) => `donnée absente : ${d}` },
  confianceFaible:  { court: (d: string) => `CONFIANCE FAIBLE · ${d}`,
                      long:  (d: string) => `confiance de mesure faible sur ce tour : ${d}` },
  travailEnCours:   { court: 'TRAVAIL EN COURS',     long: 'un travail est en cours ; les autres zones restent fermées' },
  uneSeuleZone:     { court: 'ZONE UNIQUE',         long: 'une seule zone à explorer à la fois' },
} as const;
```

Les deux fonctions à paramètre prennent `LIBELLES_DONNEES[cle].court` pour le
mot-clé et `.long` pour la phrase — jamais l'inverse. Exemple attendu :

```
DONNÉE ABSENTE · DEUX TOURS COMPARABLES
CONFIANCE FAIBLE · DÉBUT DÉCÉLÉRATION
DONNÉE ABSENTE · PASSAGE LOCALISÉ
NIVEAU PREUVE
```

Les cinquante-quatre compositions possibles (deux préfixes × vingt-sept
libellés) ont été passées à la définition G-2 : **aucune n'est une phrase.**

Les types de sortie deviennent :

```ts
export interface MotifRendu {
  readonly court: string;
  readonly long: string;
}

export interface PresentationComposee {
  // …
  /** Pourquoi elle est là, et à ce rang. Factuel, jamais un jugement. */
  motifs: readonly MotifRendu[];
}

export interface PresentationEcartee {
  id: IdPresentation;
  /** Le fait qui l'écarte. Une seule cause, la première rencontrée. */
  motif: MotifRendu;
}
```

---

## 4 · La garde — seconde passe de `check-doctrine.ts`

`scripts/check-doctrine.ts` existe déjà, parcourt `app/**/*.tsx`, porte
`FORBIDDEN_PATTERNS` et un type `Portee = 'ligne' | 'prose'`, et sort en 1 sous
CI. **On lui ajoute une passe, on n'écrit pas un second outil.**

La passe lit un manifeste `src/lib/surfacesRestitution.ts` :

```ts
/**
 * LES DEUX NATURES DE FEUILLE.
 *
 * Une surface de restitution absente des deux tableaux est elle-même une
 * violation : la garde refuse de deviner à quelle famille appartient un écran
 * neuf, parce que deviner reviendrait à l'exempter en silence.
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
  // à créer, inscrits d'avance pour que la garde les attende
  'app/(app2)/rec/stand.tsx',
  'app/(app2)/bilan/notes.tsx',
  'app/(app2)/bilan/debrief/[sessionId].tsx',
];

/**
 * Les feuilles de RÉCIT — la prose y est autorisée, sous le filtre existant.
 *
 * Décision du fondateur, 30/08/2026 : le débrief rédigé reste une feuille de
 * récit. Le réduire à des mots-clés jetterait cinq mécanismes de sûreté (filtre
 * des 52 termes, repli local déterministe, garde de rendu, test de parité,
 * déclencheur SQL) pour gagner une ligne de style.
 */
export const FEUILLES_DE_RECIT: readonly string[] = [
  // le débrief rédigé, la phrase du coach, les notes du pilote
];
```

Les six contrôles de la passe :

1. Toute surface de restitution est dans l'un des deux tableaux, sinon échec.
2. Sur une feuille de données, aucun littéral de chaîne n'est une phrase au sens
   de la définition ci-dessus.
3. Les chaînes construites à l'exécution ne sont pas contrôlées — on ne peut pas
   les lire statiquement, et prétendre le contraire donnerait une garde qui ment.
4. Sont toujours autorisés : nombres, unités, horodatages, noms propres,
   verbatim humain, et la liste blanche `LIBELLES_RESTITUTION`.
5. Les exceptions vivent dans `restitutionSansPhrase.exceptions.ts`, **nommées,
   justifiées en français et datées**. Trois seulement à ce jour : le verbatim,
   l'état `erreur` (une phrase écrite de reprise), et la provenance.
6. **Bloquante d'abord sur les écrans du Mans**, avertissante ailleurs, le temps
   que les surfaces existantes passent.

---

## 5 · Recette

```
npx tsc --noEmit            # le champ `court` manquant doit casser ici
npm test
npx tsx scripts/check-doctrine.ts
```

Et un test qui **remet volontairement une phrase** sur une feuille de données
pour vérifier que la garde passe au rouge. Une garde qu'on n'a jamais vue
échouer n'est pas une garde.

---

## 6 · Ce qu'il ne faut PAS toucher

- Le champ `source` du catalogue des lectures : le jargon y est le mot juste
  (arbitrage du 26/08).
- Le débrief rédigé et sa chaîne de sûreté.
- Les verbatim humains — notes du pilote, phrase du coach.
- Les motifs `long` : ils restent mot pour mot ce qu'ils sont aujourd'hui.
