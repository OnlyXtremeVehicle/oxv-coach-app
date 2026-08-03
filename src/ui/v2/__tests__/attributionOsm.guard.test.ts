/**
 * GARDE — le tracé d'un circuit ne s'affiche jamais sans son attribution.
 *
 * ===========================================================================
 * CE QUI EST EN JEU, ET CE N'EST PAS UN DÉTAIL DE STYLE
 * ===========================================================================
 *
 * `circuits.centerline_latlon` porte, pour les trois circuits de production,
 * des relevés dérivés d'OpenStreetMap :
 *
 *   Haute Saintonge — way/54412766, 72 points, posés le 03/08/2026
 *   Circuit Ricardo Tormo — 135 points
 *   Charente — 26 points
 *
 * OpenStreetMap est sous **ODbL**. La licence impose l'attribution partout où
 * la donnée est montrée. Le plan de montage V3 le rappelle explicitement :
 * « les 73 points de hauteSaintonge.ts sont sous ODbL. Toute remontée en base
 * transporte l'obligation d'attribution à OpenStreetMap. »
 *
 * ===========================================================================
 * CE QUI ÉTAIT EN PLACE
 * ===========================================================================
 *
 * Relevé le 03/08/2026 : **cinq écrans affichaient ce tracé sans attribution.**
 * Seul `club/importer-trace.tsx` la portait, parce que son sujet est justement
 * l'import depuis OpenStreetMap — donc l'endroit où l'on y pense.
 *
 * C'est le mode de défaillance ordinaire d'une obligation confiée aux écrans :
 * elle est tenue là où le sujet la rappelle, et oubliée partout ailleurs. Le
 * sixième écran l'aurait oubliée aussi.
 *
 * ===========================================================================
 * LE REMÈDE : L'OBLIGATION SUIT LA DONNÉE
 * ===========================================================================
 *
 * L'attribution est rendue par `TraceCircuit` lui-même, le composant qui
 * dessine la donnée. Un écran ne peut plus l'oublier : il faudrait la masquer
 * DÉLIBÉRÉMENT, par `attributionMasquee`, et ce mot se voit en revue.
 *
 * Elle n'apparaît que lorsqu'un tracé est effectivement dessiné. Rien
 * d'affiché, rien à attribuer.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE NE PROUVE PAS
 * ===========================================================================
 *
 * Elle est LEXICALE. Elle ne monte aucun composant : elle vérifie que le texte
 * est écrit dans le composant, sous une condition de rendu, et que le
 * masquage reste explicite. Elle ne dit pas que la mention est LISIBLE à
 * l'écran — cela demande un appareil, et personne n'a encore regardé.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..', '..', '..');
const TRACE = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'TraceCircuit.tsx'), 'utf8');

describe('attribution OpenStreetMap', () => {
  it('TraceCircuit porte la mention', () => {
    expect(TRACE).toContain('© contributeurs OpenStreetMap');
  });

  it('elle est conditionnée au rendu effectif d’un tracé', () => {
    // Attribuer une absence n'aurait pas de sens, et poserait une mention
    // orpheline sur un écran vide.
    const i = TRACE.indexOf('© contributeurs OpenStreetMap');
    const avant = TRACE.slice(Math.max(0, i - 400), i);
    expect(avant).toMatch(/width > 0 && trace\.path !== ''/);
  });

  it('le masquage existe, mais il faut le demander', () => {
    // Le défaut DOIT être « attribuer ». Un défaut inverse ramènerait le
    // problème d'origine, en plus discret.
    expect(TRACE).toMatch(/attributionMasquee = false/);
    expect(TRACE).toMatch(/!attributionMasquee/);
  });

  it('aucun écran ne masque l’attribution sans raison écrite', () => {
    // Si un jour un écran la masque, ce test le nomme. Il n'interdit pas —
    // `importer-trace.tsx` porterait légitimement la sienne — il oblige à ce
    // que ce soit visible ici.
    const ecrans: string[] = [];
    const parcourir = (d: string): void => {
      for (const e of readdirSync(d)) {
        if (e === 'node_modules' || e === '__tests__') continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (e.endsWith('.tsx')) ecrans.push(p);
      }
    };
    parcourir(join(RACINE, 'app'));

    const masquants = ecrans
      .filter((f) => /attributionMasquee/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(RACINE, '').replace(/\\/g, '/'));

    expect(masquants).toEqual([]);
  });
});
