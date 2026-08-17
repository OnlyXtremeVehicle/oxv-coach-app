/**
 * GARDE — LA CARTE NE PORTE PAS DE DONNÉE.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE
 * ===========================================================================
 *
 * Décision fondateur du 17/08/2026 : la carte montre un territoire, jamais une
 * donnée de conduite.
 *
 * La règle était déjà ÉCRITE avant d'être décidée — `composer-route` portait le
 * commentaire « couleurs de CATÉGORIE POI (identité de lieu, jamais de la donnée
 * de conduite) », juste au-dessus d'une table qui empruntait
 * `colors.qdi.regularite` pour les cols et `colors.qdi.acceleration` pour les
 * étapes. Un commentaire ne retient personne.
 *
 * Pire : l'unification des paliers du même jour avait aggravé l'infraction sans
 * que rien ne le signale. La Régularité passant au cyan, la catégorie « Col »
 * est devenue cyan le jour même — exactement la teinte de la branche de donnée,
 * sans qu'une seule ligne de l'écran ait bougé. C'est le genre de dérive qu'une
 * garde attrape et qu'une relecture manque.
 *
 * ===========================================================================
 * CE QUE LA GARDE REGARDE, ET CE QU'ELLE NE REGARDE PAS
 * ===========================================================================
 *
 * Elle lit le CODE EXÉCUTABLE des fichiers de carte — commentaires retirés, pour
 * qu'un paragraphe explicatif comme celui-ci ne la fasse pas échouer.
 *
 * Elle vise deux choses :
 *   1. les références symboliques `colors.qdi.*` et `dataColors.*` ;
 *   2. les hex des cinq branches et des couleurs réservées, écrits en dur —
 *      c'est par là que `#60A5FA` (l'ancien bleu trajectoire) s'était installé.
 *
 * Elle ne juge PAS le fond de plan de `styleOxv` : celui-ci n'emploie que des
 * gris de `palette`, et c'est sa propre documentation qui le tient.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { codeExecutable } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

/** Les fichiers de carte — le module partagé et les deux écrans qui l'emploient. */
const FICHIERS_CARTE = [
  ...readdirSync(join(RACINE, 'src', 'features', 'carte'), { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx')))
    .map((e) => join(RACINE, 'src', 'features', 'carte', e.name)),
  join(RACINE, 'app', '(app2)', 'club', 'territoire.tsx'),
  join(RACINE, 'app', '(app2)', 'club', 'composer-route.tsx'),
];

/**
 * Les hex interdits sur une carte : les cinq branches QDI, les deux ors et le
 * rouge de marque. `#60A5FA` et `#A783F2` figurent en ANCIENNES valeurs — la
 * première était le bleu trajectoire du baril V2 et traînait encore dans
 * `composer-route` ; la seconde était la Régularité jusqu'au 17/08.
 *
 * `#A783F2` est EXPRESSÉMENT AUTORISÉ depuis : il a été libéré par le passage de
 * la Régularité au cyan, et sert désormais la navigation et la catégorie « Col ».
 * Il n'est donc pas dans cette liste — le noter ici évite qu'on l'y remette par
 * réflexe.
 */
const HEX_INTERDITS = [
  '#4F9DF7', // Trajectoire
  '#60A5FA', // ancien bleu trajectoire (baril V2) — trop proche
  '#F65B5B', // Freinage
  '#4FC98A', // Accélération
  '#F2CE3B', // Fluidité
  '#66E4F3', // Régularité
  '#FFB703', // or du chrono
  '#C4A459', // or Heritage
  '#C8102E', // rouge de marque
];

function codeDe(f: string): string {
  return codeExecutable(readFileSync(f, 'utf8'));
}

describe('la carte ne porte aucune couleur de donnée', () => {
  it('aucun fichier de carte ne référence `colors.qdi.*`', () => {
    const fautifs = FICHIERS_CARTE.filter((f) => /\bcolors\.qdi\./.test(codeDe(f))).map((f) =>
      f.replace(RACINE, '')
    );
    expect(fautifs).toEqual([]);
  });

  it('aucun fichier de carte ne référence `dataColors`', () => {
    const fautifs = FICHIERS_CARTE.filter((f) => /\bdataColors\b/.test(codeDe(f))).map((f) =>
      f.replace(RACINE, '')
    );
    expect(fautifs).toEqual([]);
  });

  it('aucun hex de branche QDI ni de couleur réservée n’est écrit en dur', () => {
    const fautifs: string[] = [];
    for (const f of FICHIERS_CARTE) {
      const code = codeDe(f);
      for (const hex of HEX_INTERDITS) {
        if (new RegExp(hex, 'i').test(code)) {
          fautifs.push(`${f.replace(RACINE, '')} :: ${hex}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * Et la garde ne doit pas être verte pour n'avoir rien cherché : le motif DOIT
   * reconnaître la forme fautive quand on la lui présente. Sans ce test, une
   * liste de fichiers devenue vide — un dossier renommé, par exemple — rendrait
   * la garde silencieusement inopérante.
   */
  it('la garde regarde bien des fichiers, et reconnaît la forme interdite', () => {
    expect(FICHIERS_CARTE.length).toBeGreaterThanOrEqual(4);
    const faux = 'const c = colors.qdi.freinage;';
    expect(/\bcolors\.qdi\./.test(faux)).toBe(true);
    expect(new RegExp('#4F9DF7', 'i').test('const c = "#4f9df7";')).toBe(true);
  });
});

/**
 * L'AUTRE SENS DE LA RÈGLE — et il compte autant.
 *
 * « La carte sert à tout sauf à la data » se lit dans les deux directions :
 * aucune donnée sur la carte (ci-dessus), et AUCUNE CARTE dans la restitution.
 *
 * La restitution a déjà son moteur, et il n'est pas cartographique : le circuit
 * est dessiné en Skia à partir de tracés OXV (`CircuitMap`, `TraceCircuit`,
 * `src/render/`). Un fond de plan y apporterait des routes, des villages et des
 * noms de lieux — c'est-à-dire du bruit autour d'une trajectoire, là où l'écran
 * ne doit montrer que la trajectoire.
 */
describe('la restitution ne porte aucune carte', () => {
  const ZONES_AUTORISEES = ['/src/features/carte/', '/app/(app2)/club/', '/archive/'];

  function fichiers(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') fichiers(p, acc);
      } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
        acc.push(p);
      }
    }
    return acc;
  }

  it('seuls la fonctionnalité carte et la porte CLUB montent un moteur de carte', () => {
    const fautifs: string[] = [];
    for (const f of [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))]) {
      const chemin = f.replace(RACINE, '').split(/[\\/]/).join('/');
      if (ZONES_AUTORISEES.some((z) => chemin.includes(z))) continue;
      if (/@maplibre\/maplibre-react-native|features\/carte\/CarteOxv/.test(codeDe(f))) {
        fautifs.push(chemin);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
