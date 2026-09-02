/**
 * GARDE — le tracé d'un circuit ne s'affiche jamais sans son attribution.
 *
 * ===========================================================================
 * CE QUI EST EN JEU, ET CE N'EST PAS UN DÉTAIL DE STYLE
 * ===========================================================================
 *
 * `circuits.centerline_latlon` porte des relevés dérivés d'OpenStreetMap. Ils
 * étaient trois quand cette garde a été écrite ; ils sont SIX, remesurés le
 * 02/09/2026, et les six sont OSM :
 *
 *   Haute Saintonge — way/54412766, 72 points, posés le 03/08/2026
 *   Albi — way/95802415, 138 points
 *   Bugatti — relation/2725877, 589 points
 *   Circuit Ricardo Tormo — 135 points
 *   Charente — 26 points
 *   Bouteville — 139 points
 *
 * LES DEUX DERNIERS NE SE DÉCLARAIENT PAS OSM, ET ILS LE SONT. La migration
 * `20260812190000_circuit_bouteville.sql:6` écrit « Source : relevé fondateur »,
 * et `circuits.description` en production dit « relevée par le fondateur ». Les
 * deux se trompent. Mesuré le 02/09/2026, sommet par sommet :
 *
 *   sommets 0–12    = les 13 premiers nœuds du way 675583973 (`ref=D 152`)
 *   sommet 45       = nœud 1615886624, way 806776936 (« Rue du Prévôt »)
 *   sommets 110,130 = nœuds 6326714723 et 6326720302, way 80842946 (`ref=D 699`)
 *   Charente sommet 0 = nœud 640171667, sommet 5 = nœud 643857017
 *
 * L'objection sérieuse était qu'un relevé fondateur ait pu être VERSÉ dans OSM.
 * Elle se ferme par l'historique des nœuds, lu à l'API :
 *
 *   nœud 1615886624 — version 1, 2012-02-02, jamais rééditée
 *   nœud 6326714723 — version 1, 2019-03-09, jamais rééditée
 *   nœud 640171667  — version 2, 2019-03-17
 *
 * Quatorze ans, sept ans, sept ans avant le prétendu relevé. Et le circuit a
 * été créé en base 3 h 26 AVANT la première trame de la séance du 12/08 : il ne
 * peut pas être le relevé de ce roulage.
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

/**
 * LE SECOND CHEMIN DE RENDU, ajouté le 02/09/2026.
 *
 * Cette garde n'a surveillé qu'un composant sur deux pendant un mois.
 * `CircuitMap` dessine `HAUTE_SAINTONGE_TRACK` — le way 54412766, déclaré comme
 * tel dans `src/trackviz/hauteSaintonge.ts:2` — et ne portait AUCUNE mention.
 * Il sert trois écrans, dont deux côté coach.
 *
 * Une garde qui protège la moitié des surfaces qui montrent la donnée qu'elle
 * protège est une garde qui rassure à tort.
 */
const CARTE = readFileSync(
  join(RACINE, 'src', 'components', 'CircuitMap', 'CircuitMap.tsx'),
  'utf8'
);

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

  it('CircuitMap la porte aussi — c’est le second chemin de rendu', () => {
    expect(CARTE).toContain('© contributeurs OpenStreetMap');
  });

  /**
   * Ici la condition n'est pas « un tracé est dessiné » mais « c'est bien LE
   * circuit dont on a la géométrie » : `estHauteSaintonge` renvoie tôt sur un
   * état vide, et tout ce qui est dessiné après vient d'OSM. L'attribution doit
   * donc se trouver APRÈS ce retour anticipé, jamais avant.
   */
  it('et elle est posée après la garde de circuit, pas sur l’état vide', () => {
    const garde = CARTE.indexOf('if (!estHauteSaintonge(circuitName))');
    const mention = CARTE.indexOf('© contributeurs OpenStreetMap');
    expect(garde).toBeGreaterThan(-1);
    expect(mention).toBeGreaterThan(garde);
  });

  /**
   * R3 — les deux univers visuels ne se mélangent pas. `CircuitMap` est de
   * l'univers coach : ses jetons viennent de `@/theme/v2`, jamais de
   * `src/ui/v2`. Une mention copiée depuis `TraceCircuit` amènerait les
   * mauvais jetons avec elle.
   */
  it('CircuitMap tient la mention avec les jetons de son univers', () => {
    expect(CARTE).toMatch(/theme\.fonts\.mono/);
    expect(CARTE).toMatch(/theme\.fontSize\.micro/);
    expect(CARTE).not.toMatch(/from '@\/ui\/v2/);
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
