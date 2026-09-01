/**
 * GARDE — la liste des modules sans consommateur ne s'allonge pas en silence.
 *
 * ===========================================================================
 * CE QU'ELLE ATTRAPE
 * ===========================================================================
 *
 * Le motif dominant de ce dépôt : du code écrit, testé, correct — et que
 * personne n'appelle. `src/render/ramp.ts` a vécu ainsi depuis le socle T1
 * jusqu'au 13/08/2026 ; `ribbon.ts`, sa voisine, y est encore.
 *
 * Il a une seconde forme, plus coûteuse : celle qu'on crée soi-même **en
 * supprimant un écran**. Le service reste, complet, sans appelant, et rien ne
 * casse à la compilation. C'est ce qui a failli arriver deux fois le 14/08 —
 * `triage` tenait seul la chaîne de freinage, `lecture` tient seul
 * `coachReadingService`.
 *
 * ===========================================================================
 * IL A FALLU TROIS ÉCRITURES POUR QUE LA MESURE SOIT JUSTE
 * ===========================================================================
 *
 * La première cherchait le nom du module dans les imports. Elle ratait les
 * chemins `@/services/v2/…` et rendait vingt-trois orphelins dont plusieurs
 * faux.
 *
 * La deuxième résolvait vraiment les spécificateurs, mais concaténait
 * `base + '/index.ts'` — donc, sous Windows, `…\ui\v2/index.ts` contre
 * `…\ui\v2\index.ts`. Tous les barils sortaient faussement orphelins.
 *
 * La troisième normalise les séparateurs des deux côtés. Elle a été FALSIFIÉE
 * sur trois cas avant d'être écrite ici : `@/types` n'est effectivement importé
 * par personne ; `ramp.ts`, câblé la veille, a bien quitté la liste ; et
 * `hauteSaintonge` en fait partie pour une raison qu'il fallait nommer — voir
 * ci-dessous.
 *
 * Une mesure fausse produit un verdict. Ce dépôt en a payé deux ce mois-ci.
 *
 * ===========================================================================
 * « SANS CONSOMMATEUR » VEUT DIRE : HORS TESTS
 * ===========================================================================
 *
 * Les dossiers `__tests__` sont écartés du parcours. `hauteSaintonge.ts` EST
 * importé — par deux tests, et par rien d'autre. Ce n'est donc pas « personne
 * ne l'importe », c'est « plus aucun code de production ne s'en sert ». La
 * nuance compte : un module que seuls ses tests appellent est un module dont
 * l'usage est mort sans que le test s'en aperçoive.
 *
 * ===========================================================================
 * CE QUE LA GARDE EXIGE, ET CE QU'ELLE N'EXIGE PAS
 * ===========================================================================
 *
 * Elle n'exige PAS que la liste soit vide. Quarante modules y figurent
 * aujourd'hui ; les nettoyer est un travail à part, qui demande de décider au
 * cas par cas entre brancher et supprimer.
 *
 * Elle exige que la liste ne BOUGE PAS sans qu'on le sache — dans les deux
 * sens. Un module qui y entre est un orphelin neuf, souvent le reste d'une
 * suppression. Un module qui en sort a été branché, et la liste doit maigrir
 * plutôt que de mentir.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, sep, dirname, resolve } from 'path';

const RACINE = process.cwd();

/** Chemin comparable : séparateurs uniformes, casse ignorée. */
function norm(p: string): string {
  return p.split(sep).join('/').split(String.fromCharCode(92)).join('/').toLowerCase();
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') fichiers(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))];
/**
 * Les scripts sont des RACINES, jamais des candidats : on cherche les modules
 * de `src/` que personne n'atteint, pas les scripts morts. Ils sont donc hors
 * de `TOUS` — mais il faut pouvoir LIRE leurs imports, sans quoi la racine
 * ajoutée le 01/09 ne mènerait nulle part.
 */
const SCRIPTS = fichiers(join(RACINE, 'scripts'));
const EXISTANTS = new Set(TOUS.map(norm));

/**
 * Un spécificateur d'import → le fichier réel, ou `null`.
 *
 * L'ordre des suffixes suit celui du résolveur de Metro : le fichier d'abord,
 * le baril ensuite.
 */
function resoudre(depuis: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(RACINE, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(depuis), spec);
  else return null; // paquet npm

  for (const suffixe of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const candidat = norm(base + suffixe);
    if (EXISTANTS.has(candidat)) return candidat;
  }
  return null;
}

const SPEC = /from\s+'([^']+)'|require\(\s*'([^']+)'\s*\)/g;

const PAR_NORM = new Map([...TOUS, ...SCRIPTS].map((f) => [norm(f), f]));

/** Ce qu'un module importe, résolu en chemins réels. */
function importsDe(fichierNorm: string): string[] {
  const reel = PAR_NORM.get(fichierNorm);
  if (reel === undefined) return [];
  const src = readFileSync(reel, 'utf8');
  const out: string[] = [];
  SPEC.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPEC.exec(src)) !== null) {
    const cible = resoudre(reel, m[1] ?? m[2]);
    if (cible !== null && cible !== fichierNorm) out.push(cible);
  }
  return out;
}

/**
 * Les modules de `src/` qu'on N'ATTEINT PAS depuis un écran.
 *
 * ===========================================================================
 * LA MESURE EST DEVENUE TRANSITIVE — 15/08/2026
 * ===========================================================================
 *
 * Elle comptait les importateurs : un module cité une fois sortait de la
 * liste. Mais un module importé par un MORT est mort aussi, et il restait
 * invisible. C'était le cas de cinq d'entre eux, dont deux qui méritent d'être
 * nommés :
 *
 *   `debriefRenderGuard` — la ceinture doctrinale de dernier mètre, qui refuse
 *   un texte prescriptif AU MOMENT DE L'AFFICHER. Son unique appelant est
 *   `DebriefMirror`, monté nulle part. Le bilan, lui, tient sa propre garde
 *   (`isDoctrineSafe` dans `bilanLogic`) : ce n'est donc pas un trou, c'est un
 *   doublon dormant. Il fallait quand même le voir.
 *
 *   `coachConsoleLogic` — la logique de la console, sous un service lui-même
 *   sans écran.
 *
 * On part donc des RACINES — `app/`, qu'expo-router charge par convention de
 * nom — et on suit les imports. Ce qui reste hors de l'atteinte est mort, quel
 * que soit le nombre de morts qui le citent.
 */
function orphelins(): string[] {
  const racineApp = `${norm(join(RACINE, 'app'))}/`;

  /**
   * DEUX RACINES, ET LA SECONDE A ÉTÉ AJOUTÉE LE 01/09/2026.
   *
   * `app/` reste la racine principale — expo-router la charge par convention de
   * nom. Mais un module lu par un SCRIPT DE CI n'est pas dormant pour autant :
   * `check-doctrine` s'exécute à chaque intégration et refuse la fusion. La
   * mesure d'origine le déclarait pourtant orphelin, faute de regarder ailleurs
   * que sous `app/`.
   *
   * Le cas concret : `src/lib/surfacesRestitution.ts`, le manifeste des deux
   * familles de surfaces, que le brief cite et que seule la garde doctrinale
   * consomme. L'inscrire à `CONNUS` aurait créé une entrée PERMANENTE — un
   * module qui ne peut jamais en sortir, alors que la liste est faite pour se
   * vider. Mieux vaut mesurer juste que tenir une exception éternelle.
   *
   * Les scripts sont racines, jamais candidats : on ne cherche pas les scripts
   * morts ici.
   */
  const racines = [
    ...TOUS.map(norm).filter((f) => f.startsWith(racineApp)),
    ...SCRIPTS.map(norm),
  ];

  const atteints = new Set<string>(racines);
  const pile = [...racines];
  while (pile.length > 0) {
    for (const cible of importsDe(pile.pop() as string)) {
      if (!atteints.has(cible)) {
        atteints.add(cible);
        pile.push(cible);
      }
    }
  }

  return TOUS.map(norm)
    .filter((f) => !f.startsWith(racineApp))
    .filter((f) => !atteints.has(f))
    .map((f) => f.replace(norm(RACINE), ''))
    .sort();
}

/**
 * L'état au 15/08/2026, mesuré en ATTEIGNABILITÉ depuis `app/`. Ce n'est pas
 * une cible : c'est un point de départ, pour que ce qui s'ajoute se voie.
 *
 * Quarante modules, dont cinq que la mesure de 1ᵉʳ rang ne voyait pas.
 */
const CONNUS: readonly string[] = [
  '/src/circuit/hautesaintonge.ts',
  '/src/components/dataconfidencebanner.tsx',
  '/src/components/debriefmirror.tsx',
  '/src/components/insighttransparencylogic.ts',
  '/src/components/lapscrubber.tsx',
  '/src/components/oxvpromiseblock.tsx',
  '/src/components/signature/radarempreinte.tsx',
  // LOT 9a — LE REGISTRE ET LE MOTEUR SONT SORTIS DE CETTE LISTE le 01/09/2026,
  // à la condition même que leur inscription annonçait : « ils sortiront au lot
  // des écrans ». Le bilan compose désormais ses lectures — `useBilan` appelle
  // `lireEntreeComposition` puis `composerPresentations`, et la section
  // LECTURES rend celles qui s'ouvrent d'elles-mêmes. C'est le sens de sortie
  // qu'on veut : une condition écrite six semaines plus tôt, tenue.
  // LOT 10c — le service de lecture EST SORTI avec ses deux voisins, le
  // 01/09/2026. Sa note disait « il sortira avec eux » et « ses quatre pièces
  // manquantes attendent la migration lot10c » : la migration a été appliquée
  // le 29/08, et `faitsSeanceService` lit désormais les onze faits restants —
  // cinq depuis la base, six déclarés absents avec leur raison.
  // LOT 11a — `features/vehicules/eligibiliteLogic.ts` et
  // `features/vehicules/referentielVehicules.ts` N'Y FIGURENT PAS, et il faut
  // dire pourquoi : ils ont été inscrits ici à l'écriture du lot, puis retirés
  // le jour même. `features/vous/ficheVehiculeLogic.ts`, posé en parallèle,
  // les atteint depuis `app/(app2)/vous/garage.tsx` — ils ont donc un appelant
  // de production, et les inscrire décrirait un état que le code a déjà quitté.
  // `prevollogic.ts` (lot M02) EST SORTI DE CETTE LISTE le 25/08/2026 : l'écran
  // de placement (`app/(app2)/rec/placement.tsx`) affiche désormais le prévol
  // avant l'armement — le module a son consommateur de production.
  '/src/hooks/detaillevellogic.ts',
  '/src/lib/queries/carteslogic.ts',
  '/src/media/thumbhash.ts',
  // Morts de 2ᵉ RANG, visibles depuis le 15/08 (mesure transitive) : chacun
  // n'était cité que par un module lui-même inatteignable.
  '/src/media/thumbhashcodec.ts',
  // `/src/perf/frametimes.ts` EST SORTI DE CETTE LISTE le 01/09/2026, sans qu'une
  // ligne de son code change : `scripts/juger-mesure.ts` l'importe, et les
  // scripts sont devenus des racines le même jour. Il n'a jamais ete dormant,
  // la mesure ne le voyait pas — c'est la troisieme fois que la mesure bouge
  // avant le code, et la troisieme fois qu'elle rend un module a la vie.
  '/src/render/decimate.ts',
  '/src/render/gg.ts',
  '/src/render/projection.ts',
  '/src/render/ribbon.ts',
  // `grammaireviz.ts` EST SORTI DE CETTE LISTE le 26/08/2026, et c'est le sens
  // de sortie qu'on veut : son inscription du 15/08 disait « à retirer au
  // premier écran migré ». Le voici — la carte des écarts sur le tracé
  // (lot 7b) consomme le rôle POLARITÉ (`couleurDelta`, `POLES_DELTA`) depuis
  // `src/features/data/carteOpportunitesLogic.ts` et
  // `app/(app2)/data/session/[id].tsx`.
  // Outil des GARDES : seuls des tests l'importent, par construction. C'est la
  // même nuance que `hauteSaintonge` — « plus aucun code de production ne s'en
  // sert » est ici l'état voulu, pas une dette.
  '/src/test-utils/codeseul.ts',
  '/src/test-utils/entreesoptionnelles.ts',
  '/src/services/coachbusinessservice.ts',
  '/src/services/coachconsolelogic.ts',
  '/src/services/coachconsoleservice.ts',
  '/src/services/datalablogic.ts',
  // La ceinture doctrinale de dernier mètre, sous un composant jamais monté.
  // Le bilan tient la sienne (`isDoctrineSafe`) : doublon dormant, pas trou.
  '/src/services/debriefrenderguard.ts',
  '/src/services/eventcontextlogic.ts',
  '/src/services/focuscorner.ts',
  '/src/services/laptimelinelogic.ts',
  '/src/services/maplayerslogic.ts',
  // `placesservice.ts` EST SORTI DE CETTE LISTE le 17/08/2026 : la sortie
  // d'écurie consomme `fetchRestaurantsSortie` pour composer son trajet. Le
  // module n'est donc plus orphelin — même si le reste de son contenu demeure
  // déprécié, ce que dit son en-tête.
  '/src/services/seasonstorylogic.ts',
  '/src/services/sessioninsightsengine.ts',
  // `videooverlaylogic.ts` et `videooverlayservice.ts` SONT SORTIS DE CETTE
  // LISTE le 26/08/2026, et c'est le sens de sortie qu'on veut. Le lot M24
  // (marge de synchronisation vidéo) les branche : `useBilan` lit
  // `getForSession` pour savoir s'il existe un alignement persisté sur la
  // séance, et `saveOffset` réécrit le décalage quand le pilote le recale.
  // La validation pure (`validateOverlayOffset`) redevient atteignable par
  // le service qui l'appelle.
  '/src/telemetry/accel.ts',
  // `calibration.ts` EST SORTI DE CETTE LISTE le 30/08/2026, le jour même de
  // son branchement — c'est le sens de sortie qu'on veut, et la règle R2 du
  // brief l'exige : un module branché sort de `CONNUS` dans le même commit.
  //
  // Ce qui l'a branché n'est PAS ce qu'on attendait. Le calcul reste débranché :
  // toucher les g qui alimentent le QDI demande toujours un incrément de
  // version et un recalcul de l'historique. C'est le PRÉVOL qui l'a atteint —
  // `prevolLogic` lui emprunte `SEUIL_ARRET_KMH` et `DUREE_ARRET_MIN_MS` pour
  // que l'écran qui demande l'immobilité pose exactement le seuil du calcul qui
  // l'exploitera. Deux copies auraient divergé, et c'est l'écran qui aurait
  // menti au pilote.
  '/src/telemetry/gg.ts',
  '/src/telemetry/segment.ts',
  '/src/types/index.ts',
  '/src/ui/chip.tsx',
  '/src/ui/doctrinefooter.tsx',
  '/src/ui/kpicard.tsx',
];

describe('modules sans consommateur de production', () => {
  const mesures = orphelins();

  it('le résolveur fonctionne — sinon TOUT sortirait orphelin', () => {
    // Un résolveur cassé rendrait la garde inutile en la rendant très verte
    // ou très rouge. On borne les deux côtés.
    expect(mesures.length).toBeGreaterThan(0);
    expect(mesures.length).toBeLessThan(TOUS.length / 4);
  });

  it('les barils sont bien résolus — aucun `index.ts` de kit n’est orphelin', () => {
    // C'était le défaut de la deuxième écriture : `…/ui/v2` + '/index.ts'
    // mélangeait les séparateurs sous Windows.
    expect(mesures).not.toContain('/src/ui/v2/index.ts');
    expect(mesures).not.toContain('/src/components/circuitmap/index.ts');
  });

  it('`ramp.ts`, câblé le 13/08, a bien quitté la liste', () => {
    expect(mesures).not.toContain('/src/render/ramp.ts');
  });

  /**
   * LE CŒUR. Un module qui ENTRE dans la liste est presque toujours le reste
   * d'une suppression : l'écran est parti, le service est resté.
   */
  it('aucun orphelin NEUF', () => {
    const neufs = mesures.filter((m) => !CONNUS.includes(m));
    expect(neufs).toEqual([]);
  });

  /**
   * Et un module qui en SORT doit quitter la liste écrite. Sans cela, elle
   * décrirait un état que le code a quitté — le défaut que ce dépôt corrige
   * depuis deux jours, appliqué à sa propre garde.
   */
  it('aucune entrée périmée dans la liste connue', () => {
    const branches = CONNUS.filter((c) => !mesures.includes(c));
    expect(branches).toEqual([]);
  });
});
