/**
 * GARDE — un seul générateur de tracé à l'écran, et il rend la même géométrie.
 *
 * ===========================================================================
 * CINQ IMPLÉMENTATIONS, DONT DEUX PIÈGES
 * ===========================================================================
 *
 * Le dépôt portait cinq façons de transformer une polyligne en chaîne `d` :
 * `components/motion/pathMath`, `lib/geoToSvg`, `ui/v2/uiLogic`, une copie
 * LOCALE dans l'écran de séance, et une ligne en dur dans `DebriefMirror`.
 *
 * La mise en forme différait — `M 1.00 2.00`, `M 1.00,2.00`, `M1 2` — mais ce
 * n'était pas le problème : SVG traite l'espace et la virgule à l'identique.
 *
 * Les deux vrais pièges :
 *
 *   1. **`polylineLength` existait deux fois, avec des valeurs par défaut
 *      OPPOSÉES** — `closed = true` dans `uiLogic`, `close = false` dans
 *      `pathMath`. Changer un import déplaçait la longueur d'un segment
 *      entier, en silence. Et cette longueur pilote le `strokeDasharray` de
 *      toutes les animations de tracé : le trait se serait dessiné aux quatre
 *      cinquièmes, ou aurait bouclé avant la fin, sans qu'aucun test ne bouge.
 *
 *   2. **L'écran de séance portait sa copie pour UNE différence** : elle rendait
 *      `''` sous deux points, là où la version partagée rendait `M x y` — un
 *      « déplace-toi ici » sans ordre de tracé, que SVG rend par du vide. Le
 *      commentaire de l'écran s'appuyait explicitement dessus.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE PROUVE
 * ===========================================================================
 *
 * Pas que les chaînes se ressemblent : **que la géométrie est la même**. Elle
 * relit le `d` produit et le compare aux points d'origine, nombre par nombre.
 * Une garde qui compare des chaînes tomberait au premier changement de
 * précision et laisserait passer une coordonnée inversée.
 *
 * Et elle fige la longueur du motif de circuit générique — celui de huit
 * écrans — mesurée AVANT la consolidation.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { polylineLength, polylineToPathD, type Point2D } from '../pathMath';
import { EMPTY_CIRCUIT_LENGTH, EMPTY_CIRCUIT_PATH, EMPTY_CIRCUIT_POINTS } from '@/ui/v2/uiLogic';

const RACINE = process.cwd();

/** Relit une chaîne `d` (M/L, Z optionnel) en suite de points. */
function pointsDuChemin(d: string): Point2D[] {
  const nombres = d
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const out: Point2D[] = [];
  for (let i = 0; i + 1 < nombres.length; i += 2) out.push({ x: nombres[i], y: nombres[i + 1] });
  return out;
}

describe('un seul générateur de tracé', () => {
  describe('la géométrie survit à l’aller-retour', () => {
    it('les points relus sont les points donnés', () => {
      const pts: Point2D[] = [
        { x: 0, y: 0 },
        { x: 12.5, y: 40.25 },
        { x: 100, y: 7 },
      ];
      expect(pointsDuChemin(polylineToPathD(pts))).toEqual(pts);
    });

    it('la fermeture ajoute un Z, pas un point', () => {
      const pts: Point2D[] = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ];
      expect(polylineToPathD(pts, 2, true)).toMatch(/Z$/);
      expect(pointsDuChemin(polylineToPathD(pts, 2, true))).toHaveLength(2);
    });

    /**
     * LE COMPORTEMENT POUR LEQUEL L'ÉCRAN DE SÉANCE PORTAIT SA COPIE. Une
     * séance GPS-only n'a pas de canal de freinage : le tableau est vide ou
     * n'a qu'un point, et le `<Path>` ne doit pas être peint.
     */
    it('sous deux points, aucune chaîne — donc aucun tracé', () => {
      expect(polylineToPathD([])).toBe('');
      expect(polylineToPathD([{ x: 5, y: 5 }])).toBe('');
    });
  });

  describe('le motif de circuit générique n’a pas bougé', () => {
    /**
     * Mesurée sur l'implémentation d'AVANT la consolidation, le 15/08/2026.
     * Ce nombre pilote le `strokeDasharray` de `StateView` : s'il change, le
     * tracé ne se dessine plus entièrement.
     */
    it('sa longueur vaut toujours 509,942…', () => {
      expect(EMPTY_CIRCUIT_LENGTH).toBeCloseTo(509.9420161615615, 9);
    });

    it('et il est fermé, avec ses dix-huit points', () => {
      expect(EMPTY_CIRCUIT_PATH).toMatch(/Z$/);
      expect(pointsDuChemin(EMPTY_CIRCUIT_PATH)).toHaveLength(EMPTY_CIRCUIT_POINTS.length);
    });

    it('ses coordonnées sont celles d’origine, à l’unité', () => {
      const relus = pointsDuChemin(EMPTY_CIRCUIT_PATH);
      const attendus = EMPTY_CIRCUIT_POINTS.map(([x, y]) => ({ x, y }));
      expect(relus).toEqual(attendus);
    });

    /** Et la longueur passe bien par le générateur unique. */
    it('la longueur se recalcule à l’identique depuis pathMath', () => {
      const xy = EMPTY_CIRCUIT_POINTS.map(([x, y]) => ({ x, y }));
      expect(polylineLength(xy, true)).toBeCloseTo(EMPTY_CIRCUIT_LENGTH, 9);
    });
  });

  describe('plus de copie locale dans un écran', () => {
    /**
     * Une fonction de tracé déclarée DANS un écran est une divergence en
     * attente : elle n'a ni test ni relecteur, et elle survit aux corrections
     * apportées à la version partagée.
     */
    it('aucun écran ne déclare son propre générateur', () => {
      const fautifs: string[] = [];
      const parcourir = (dossier: string): void => {
        for (const e of readdirSync(dossier, { withFileTypes: true })) {
          const chemin = join(dossier, e.name);
          if (e.isDirectory()) parcourir(chemin);
          else if (/\.tsx?$/.test(e.name)) {
            const src = readFileSync(chemin, 'utf8');
            if (/function\s+polyline(Path|ToPathD|Length)\s*\(/.test(src)) {
              fautifs.push(chemin.replace(RACINE, '').split('\\').join('/'));
            }
          }
        }
      };
      parcourir(join(RACINE, 'app'));
      expect(fautifs).toEqual([]);
    });

    /**
     * `lib/geoToSvg` garde la sienne, et c'est délibéré : elle écrit dans
     * `user_circuits.svg_path`, en base. Une chaîne persistée ne change pas de
     * forme sans raison. La garde le sait, pour qu'on ne la « corrige » pas.
     */
    it('l’exception de persistance est nommée, pas oubliée', () => {
      const geo = readFileSync(join(RACINE, 'src', 'lib', 'geoToSvg.ts'), 'utf8');
      expect(geo).toContain('polylineToPathD');
      const ui = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'uiLogic.ts'), 'utf8');
      expect(ui).toMatch(/geoToSvg` garde la sienne/);
    });
  });
});
