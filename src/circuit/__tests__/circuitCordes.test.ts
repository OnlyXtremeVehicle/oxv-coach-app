/**
 * Les cordes de virage — et la garde contre le tableau vide qui a tenu deux
 * semaines.
 *
 * `resoudreMarqueur` accepte un quatrième argument `cordes` depuis toujours.
 * Ses DEUX appelants de production lui passaient `[]`. Résultat : `virage` et
 * `distanceAvantCordeM` valaient TOUJOURS `null`, quel que soit le marqueur.
 * Le calcul était juste, complet, testé — il n'avait jamais reçu de quoi
 * travailler, et un commentaire affirmait que c'était normal.
 *
 * C'est le motif dominant du dépôt : la garde posée, non armée, avec un texte
 * qui affirme qu'elle fonctionne. Les deux derniers tests de ce fichier lisent
 * les appelants pour que le tableau vide ne puisse pas revenir en silence.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';

import { cordesDepuisCenterline, cordesForCircuit, hauteSaintongeCordes } from '../circuitCorners';
import { projectToMeters, unprojectFromMeters, type LatLon } from '../circuitGenerator';

describe('l’inverse de la projection', () => {
  /**
   * La détection de virages travaille en MÈTRES, la résolution d'un marqueur
   * en DEGRÉS. Si ce passage n'est pas exact, une corde se retrouve à côté du
   * virage — et l'application situerait le geste du coach à un endroit où le
   * pilote n'est jamais passé.
   */
  it('un aller-retour rend le point de départ', () => {
    const pts: LatLon[] = [
      { lat: 45.2390749, lon: -0.0908906 },
      { lat: 45.2424763, lon: -0.0967393 },
      { lat: 45.24, lon: -0.093 },
    ];
    const retour = unprojectFromMeters(projectToMeters(pts), pts[0]);
    for (let i = 0; i < pts.length; i++) {
      // Un dix-millionième de degré : environ un centimètre.
      expect(retour[i].lat).toBeCloseTo(pts[i].lat, 7);
      expect(retour[i].lon).toBeCloseTo(pts[i].lon, 7);
    }
  });

  it('aucun point, aucun retour — rien d’inventé', () => {
    expect(unprojectFromMeters([], { lat: 45, lon: 0 })).toEqual([]);
  });
});

describe('Haute Saintonge — des relevés, pas des dérivations', () => {
  it('les sept cordes portent leurs coordonnées GPS réelles', () => {
    const c = hauteSaintongeCordes();
    expect(c).toHaveLength(BELTOISE_CORNERS.length);
    expect(c).toHaveLength(7);
    for (let i = 0; i < c.length; i++) {
      // On ne recalcule pas ce qui a été mesuré (OSM way 54412766).
      expect(c[i].lat).toBe(BELTOISE_CORNERS[i].apexLat);
      expect(c[i].lon).toBe(BELTOISE_CORNERS[i].apexLon);
      expect(c[i].numero).toBe(BELTOISE_CORNERS[i].index);
    }
  });

  it('les cordes tombent bien sur le circuit, pas ailleurs', () => {
    // Garde grossière mais utile : une inversion lat/lon, une erreur de signe
    // ou un mauvais tracé enverraient les cordes à des centaines de kilomètres.
    for (const c of hauteSaintongeCordes()) {
      expect(c.lat).toBeGreaterThan(45.23);
      expect(c.lat).toBeLessThan(45.25);
      expect(c.lon).toBeGreaterThan(-0.1);
      expect(c.lon).toBeLessThan(-0.08);
    }
  });

  it('la reconnaissance du circuit ignore casse et accents', async () => {
    const a = await cordesForCircuit({ id: 'x', name: 'Circuit de Haute Saintonge' });
    const b = await cordesForCircuit({ id: 'x', name: 'HAUTE SAINTONGE (BACKUP)' });
    expect(a).toHaveLength(7);
    expect(b).toHaveLength(7);
  });
});

describe('les autres circuits — dérivés de leur tracé réel', () => {
  /** Un ovale : deux extrémités courbes, deux longues droites. */
  const ovale = (): LatLon[] => {
    const pts: LatLon[] = [];
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      pts.push({ lat: 45.5 + 0.0018 * Math.sin(t), lon: 4.5 + 0.006 * Math.cos(t) });
    }
    return pts;
  };

  it('un tracé courbe rend des cordes, et elles sont dans son voisinage', () => {
    const c = cordesDepuisCenterline(ovale());
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) {
      // Sur le tracé, pas à l'autre bout du monde : la borne vaut quelques
      // centaines de mètres autour de l'ovale.
      expect(Math.abs(x.lat - 45.5)).toBeLessThan(0.01);
      expect(Math.abs(x.lon - 4.5)).toBeLessThan(0.02);
    }
  });

  it('les numéros de virage se suivent, sans doublon', () => {
    const nums = cordesDepuisCenterline(ovale()).map((c) => c.numero);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('un tracé dégénéré ne fabrique aucune corde', () => {
    expect(cordesDepuisCenterline([])).toEqual([]);
    expect(
      cordesDepuisCenterline([
        { lat: 45, lon: 4 },
        { lat: 45.1, lon: 4.1 },
      ])
    ).toEqual([]);
  });

  it('un circuit sans centerline rend une absence, pas une corde devinée', async () => {
    const c = await cordesForCircuit({ id: 'inconnu', name: 'Circuit X' }, async () => null);
    expect(c).toEqual([]);
  });
});

describe('la garde — le tableau vide ne doit pas revenir', () => {
  const lire = (...bouts: string[]): string =>
    readFileSync(join(__dirname, '..', '..', ...bouts), 'utf8');

  /**
   * LE DÉFAUT EXACT, FIGÉ ICI. Ces deux appels passaient `[]`. Un test
   * unitaire de `resoudreMarqueur` ne pouvait pas le voir : la fonction était
   * correcte, c'est ce qu'on lui donnait qui ne l'était pas.
   */
  it('le fil de séance passe de vraies cordes à resoudreMarqueur', () => {
    const src = lire('features', 'coach', 'filSeanceService.ts');
    expect(src).toContain('cordesForCircuit');
    expect(src).not.toMatch(/resoudreMarqueur\([^)]*,\s*\[\]\s*\)/);
  });

  it('la composition de carte aussi', () => {
    const src = lire('features', 'coach', 'marqueursSeanceService.ts');
    expect(src).toContain('cordesForCircuit');
    expect(src).not.toMatch(/resoudreMarqueur\([^)]*,\s*\[\]\s*\)/);
  });
});
