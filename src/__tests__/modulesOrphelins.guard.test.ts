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
 * Elle n'exige PAS que la liste soit vide. Trente-deux modules y figurent
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

/** Les modules de `src/` qu'aucun fichier de production n'importe. */
function orphelins(): string[] {
  const compte = new Map<string, number>(TOUS.map((f) => [norm(f), 0]));

  for (const f of TOUS) {
    const src = readFileSync(f, 'utf8');
    SPEC.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SPEC.exec(src)) !== null) {
      const cible = resoudre(f, m[1] ?? m[2]);
      if (cible !== null && cible !== norm(f)) {
        compte.set(cible, (compte.get(cible) ?? 0) + 1);
      }
    }
  }

  // `app/` est fait d'écrans : expo-router les charge par convention de nom, ils
  // n'ont pas à être importés. Seul `src/` est concerné.
  const racineApp = `${norm(join(RACINE, 'app'))}/`;
  return TOUS.map(norm)
    .filter((f) => !f.startsWith(racineApp))
    .filter((f) => compte.get(f) === 0)
    .map((f) => f.replace(norm(RACINE), ''))
    .sort();
}

/**
 * L'état au 14/08/2026, mesuré. Ce n'est pas une cible : c'est un point de
 * départ, pour que ce qui s'ajoute se voie.
 */
const CONNUS: readonly string[] = [
  '/src/circuit/hautesaintonge.ts',
  '/src/components/dataconfidencebanner.tsx',
  '/src/components/debriefmirror.tsx',
  '/src/components/insighttransparencylogic.ts',
  '/src/components/lapscrubber.tsx',
  '/src/components/oxvpromiseblock.tsx',
  '/src/components/signature/radarempreinte.tsx',
  '/src/hooks/detaillevellogic.ts',
  '/src/lib/queries/carteslogic.ts',
  '/src/media/thumbhash.ts',
  '/src/perf/frametimes.ts',
  '/src/render/decimate.ts',
  '/src/render/gg.ts',
  '/src/render/ribbon.ts',
  // Outil des GARDES : seuls des tests l'importent, par construction. C'est la
  // même nuance que `hauteSaintonge` — « plus aucun code de production ne s'en
  // sert » est ici l'état voulu, pas une dette.
  '/src/test-utils/codeseul.ts',
  '/src/test-utils/entreesoptionnelles.ts',
  '/src/services/coachbusinessservice.ts',
  '/src/services/coachconsoleservice.ts',
  '/src/services/datalablogic.ts',
  '/src/services/eventcontextlogic.ts',
  '/src/services/focuscorner.ts',
  '/src/services/laptimelinelogic.ts',
  '/src/services/maplayerslogic.ts',
  '/src/services/placesservice.ts',
  '/src/services/seasonstorylogic.ts',
  '/src/services/sessioninsightsengine.ts',
  '/src/services/v2/videooverlayservice.ts',
  '/src/telemetry/accel.ts',
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
