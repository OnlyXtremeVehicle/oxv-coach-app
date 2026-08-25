/**
 * GARDE — LE VOISINAGE DES COULEURS SÉMANTIQUES, MESURÉ.
 *
 * ===========================================================================
 * POURQUOI ELLE EXISTE
 * ===========================================================================
 *
 * Le dépôt tient plusieurs familles de couleurs qui veulent dire des choses
 * différentes : les cinq branches QDI, les deux ors, le rouge de marque, les
 * couleurs de rôle, la palette de carte. Chacune a été choisie dans son coin.
 *
 * Personne ne les avait jamais mesurées ENSEMBLE. L'audit du 17/08/2026 l'a fait
 * et a trouvé onze paires sous ΔE 25 — dont une créée le jour même : la
 * Régularité venait de passer au cyan, et l'optimiseur qui l'avait choisie
 * mesurait contre huit couleurs réservées **sans connaître les couleurs de
 * rôle**. La méthode était incomplète, et rien ne l'aurait dit.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT, ET CE QU'ELLE NE FAIT PAS
 * ===========================================================================
 *
 * Elle ne demande PAS que toutes les paires soient éloignées : deux couleurs
 * proches qui ne se croisent jamais ne gênent personne, et `role.coach` EST le
 * rouge de marque, délibérément.
 *
 * Elle épingle la liste connue, avec sa raison, et **échoue sur la douzième**.
 * Une nouvelle proximité devient alors une décision consciente : soit on écarte
 * la teinte, soit on l'ajoute ici en écrivant pourquoi elle est tolérable.
 *
 * Zéro dépendance React Native : mesure pure, testée en node.
 */

import { dataColors, palette, roleColors } from '../v2';
import { CARTE } from '@/features/carte/paletteCarte';

// ---------------------------------------------------------------------------
// Mesure — ΔE CIE76 en L*a*b*
// ---------------------------------------------------------------------------

function versLineaire(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => versLineaire(parseInt(hex.slice(i, i + 2), 16) / 255));
  let X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [X, Y, Z] = [f(X), f(Y), f(Z)];
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

export function ecartPercu(a: string, b: string): number {
  const A = lab(a);
  const B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * Le seuil. Sous 25, deux teintes catégorielles se confondent à l'usage sur un
 * écran sombre — c'est la valeur employée pour construire la palette de carte,
 * reprise ici pour que le dépôt n'ait pas deux exigences selon qui mesure.
 */
const SEUIL = 25;

// ---------------------------------------------------------------------------
// Toutes les couleurs qui PORTENT UN SENS. Les gris de chrome n'y sont pas :
// ils ne se distinguent pas les uns des autres, ils s'échelonnent.
// ---------------------------------------------------------------------------

const SEMANTIQUES: Record<string, string> = {
  'qdi.trajectoire': dataColors.trajectory,
  'qdi.freinage': dataColors.brake,
  'qdi.acceleration': dataColors.accel,
  'qdi.fluidite': dataColors.flow,
  'qdi.regularite': dataColors.regularity,
  'or.chrono': palette.gold,
  'or.heritage': palette.heritageGold,
  'marque.rouge': palette.red,
  'role.pilot': roleColors.pilot,
  'role.coach': roleColors.coach,
  'role.partner': roleColors.partner,
  'role.admin': roleColors.admin,
  'carte.pointDeVue': CARTE.pointDeVue,
  'carte.eau': CARTE.eau,
  'carte.col': CARTE.col,
  'carte.sommet': CARTE.sommet,
  'carte.etape': CARTE.etape,
};

/**
 * Les proximités CONNUES, chacune avec sa raison. Mesurées le 17/08/2026.
 *
 * Trois d'entre elles méritent d'être regardées un jour — elles portent des
 * distinctions que le dépôt affirme ailleurs :
 *
 *   `qdi.freinage / marque.rouge` (18,8) — le dépôt répète « rouge de DONNÉE,
 *   distinct du rouge de MARQUE ». La distinction est plus faible que le seuil
 *   qu'on s'impose sur la carte.
 *
 *   `qdi.fluidite / or.chrono` (19,0) — même chose : l'or est réservé au chrono
 *   et la Fluidité est jaune, à dix-neuf points l'une de l'autre.
 *
 *   `qdi.trajectoire / role.partner` (10,0) — deux bleus. Ils ne se croisent pas
 *   aujourd'hui, l'espace partenaire ne portant pas de donnée QDI.
 */
const CONNUES: { paire: [string, string]; raison: string }[] = [
  {
    paire: ['marque.rouge', 'role.coach'],
    raison: 'identiques par décision — le rôle coach EST le rouge de marque',
  },
  { paire: ['role.pilot', 'carte.etape'], raison: 'deux blancs, jamais sur le même écran' },
  { paire: ['role.pilot', 'carte.pointDeVue'], raison: 'deux crèmes, jamais sur le même écran' },
  {
    paire: ['carte.pointDeVue', 'carte.etape'],
    raison: 'second canal de lecture : l’étape porte une pastille plus grande',
  },
  {
    paire: ['qdi.regularite', 'role.admin'],
    raison: 'espaces disjoints — le cyan admin ne sort pas de app/(admin), qui ne porte aucun QDI',
  },
  {
    paire: ['qdi.trajectoire', 'role.partner'],
    raison: 'espaces disjoints — l’espace partenaire ne porte aucune donnée QDI',
  },
  {
    paire: ['qdi.freinage', 'marque.rouge'],
    raison: 'À REGARDER — distinction affirmée par le dépôt, mesurée à 18,8',
  },
  {
    paire: ['qdi.freinage', 'role.coach'],
    raison: 'conséquence de la précédente, role.coach étant le rouge de marque',
  },
  {
    paire: ['qdi.fluidite', 'or.chrono'],
    raison: 'À REGARDER — l’or est réservé au chrono, et la Fluidité est à 19,0',
  },
  { paire: ['role.partner', 'carte.col'], raison: 'marginal (24,4), espaces disjoints' },
];

function cle(a: string, b: string): string {
  return [a, b].sort().join(' / ');
}

describe('voisinage des couleurs sémantiques', () => {
  const proches: string[] = [];
  const noms = Object.keys(SEMANTIQUES);
  for (let i = 0; i < noms.length; i++) {
    for (let j = i + 1; j < noms.length; j++) {
      if (ecartPercu(SEMANTIQUES[noms[i]], SEMANTIQUES[noms[j]]) < SEUIL) {
        proches.push(cle(noms[i], noms[j]));
      }
    }
  }
  const connues = CONNUES.map(({ paire }) => cle(paire[0], paire[1]));

  /**
   * LE TEST QUI COMPTE. Une teinte ajoutée ou déplacée sans mesure fait
   * apparaître une paire ici, et la garde la nomme.
   */
  it('aucune proximité NOUVELLE', () => {
    expect(proches.filter((p) => !connues.includes(p))).toEqual([]);
  });

  /**
   * Et l'inverse : une paire qui s'est éloignée doit sortir de la liste, sinon
   * elle finirait par justifier une proximité qui n'existe plus.
   */
  it('aucune entrée périmée dans la liste connue', () => {
    expect(connues.filter((c) => !proches.includes(c))).toEqual([]);
  });

  it('chaque proximité connue porte une raison', () => {
    for (const { raison } of CONNUES) {
      expect(raison.trim().length).toBeGreaterThan(10);
    }
  });

  /** La mesure elle-même, vérifiée sur des bornes connues. */
  it('l’écart perçu mesure ce qu’il prétend', () => {
    expect(ecartPercu('#FFFFFF', '#FFFFFF')).toBeCloseTo(0, 6);
    expect(ecartPercu('#000000', '#FFFFFF')).toBeCloseTo(100, 0);
  });
});
