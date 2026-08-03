/**
 * GARDE DE SOURCE — un seul réglage de virages, pour deux appelants.
 *
 * ===========================================================================
 * CE QUI ÉTAIT EN PLACE
 * ===========================================================================
 *
 * La fonction serveur `detect-circuit-corners` ne lisait que `track_svg_path`.
 * Sur Valence et Charente, cette colonne est NULL — les deux circuits portent
 * une `centerline_latlon` (135 et 26 points), qu'elle ignorait. Elle répondait
 * alors `{ ok: false, reason: 'no_geometry' }` en **HTTP 200**, sans erreur :
 * rien ne signalait que le moteur n'avait rien fait.
 *
 * Résultat : `circuits.corners` vide sur les deux circuits, et le plan V3 en
 * concluait une dépendance terrain (« attendre une séance à Valence »). C'en
 * était une pour les NOMS de virages, jamais pour leur détection : la
 * géométrie était là depuis le début.
 *
 * ===========================================================================
 * POURQUOI UN SEUL RÉGLAGE
 * ===========================================================================
 *
 * Deux appelants dérivent les virages d'un même circuit :
 *
 *   - `src/circuit/circuitCorners.ts` — les repères affichés au coach ;
 *   - `supabase/functions/detect-circuit-corners` — ce qui est ÉCRIT en base.
 *
 * S'ils divergeaient d'un seul paramètre, le même circuit porterait deux
 * vérités. Un coach annotant « le virage 9 » désignerait un endroit à l'écran
 * et un autre en base, et personne ne verrait l'écart : les deux nombres sont
 * plausibles isolément. C'est la faute la plus coûteuse de cette famille, car
 * elle ne produit aucune erreur — seulement un désaccord silencieux.
 *
 * `PARAMS_CENTERLINE` vit donc dans `circuitGenerator.ts`, qui n'importe rien
 * et se lit aussi bien sous Deno que sous Metro.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE NE PROUVE PAS
 * ===========================================================================
 *
 * Elle est LEXICALE. Elle ne déploie rien et n'appelle pas la base : elle
 * garantit que les deux chemins partent du même réglage, pas que la fonction
 * serveur a été redéployée. Tant qu'elle ne l'est pas, la version en
 * production reste celle qui ignore la centerline.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { deriveCornersFromCenterline } from '../circuitCorners';
import { PARAMS_CENTERLINE, generateCircuit } from '../circuitGenerator';

const RACINE = join(__dirname, '..', '..', '..');

function source(...chemin: string[]): string {
  return readFileSync(join(RACINE, ...chemin), 'utf8');
}

const FONCTION = source('supabase', 'functions', 'detect-circuit-corners', 'index.ts');
const CLIENT = source('src', 'circuit', 'circuitCorners.ts');
const GENERATEUR = source('src', 'circuit', 'circuitGenerator.ts');

describe('le réglage des virages est partagé', () => {
  it('le générateur l’expose, et lui seul', () => {
    expect(GENERATEUR).toMatch(/export const PARAMS_CENTERLINE/);
    expect(PARAMS_CENTERLINE).toEqual({ smoothWin: 0, resampleStep: 10, cornerRadius: 100 });
  });

  it('le générateur n’importe rien — sinon Deno ne peut pas le lire', () => {
    // C'est la condition qui rend le partage possible. Un seul import, même
    // typé, casserait la résolution côté fonction serveur.
    expect(GENERATEUR).not.toMatch(/^\s*import\s/m);
  });

  it('la fonction serveur importe le réglage au lieu de le recopier', () => {
    expect(FONCTION).toMatch(
      /import \{[^}]*PARAMS_CENTERLINE[^}]*\} from '\.\.\/\.\.\/\.\.\/src\/circuit\/circuitGenerator\.ts'/
    );
    expect(FONCTION).toMatch(/generateCircuit\(ligne, PARAMS_CENTERLINE\)/);
  });

  it('le client importe le même, au lieu d’en définir un local', () => {
    expect(CLIENT).toMatch(/PARAMS_CENTERLINE/);
    expect(CLIENT).not.toMatch(/const DERIVE_PARAMS/);
  });

  it('aucun des deux ne redéfinit les valeurs à la main', () => {
    // Un littéral `smoothWin: 0` réapparu ailleurs serait le début de la
    // divergence — plausible, silencieux, et invisible en revue.
    for (const [nom, s] of [
      ['fonction serveur', FONCTION],
      ['client', CLIENT],
    ] as const) {
      expect([nom, /smoothWin\s*:/.test(s)]).toEqual([nom, false]);
      expect([nom, /cornerRadius\s*:/.test(s)]).toEqual([nom, false]);
    }
  });
});

describe('la fonction serveur lit bien la centerline', () => {
  it('elle sélectionne la colonne', () => {
    expect(FONCTION).toMatch(/select\('id, name, track_svg_path, centerline_latlon, length_km'\)/);
  });

  it('elle marque la provenance du calcul', () => {
    // Un virage dérivé d'une géométrie réelle et un virage dérivé d'un dessin
    // ne valent pas la même chose : la base doit dire lequel elle porte.
    expect(FONCTION).toMatch(/calibration: 'centerline_latlon'/);
    expect(FONCTION).toMatch(/calibration: 'schematic_svg'/);
  });

  it('elle ne répond plus « pas de géométrie » quand une centerline existe', () => {
    const iCenterline = FONCTION.indexOf('ligne.length >= 4');
    const iNoGeometry = FONCTION.indexOf("reason: 'no_geometry'");
    expect(iCenterline).toBeGreaterThan(-1);
    expect(iNoGeometry).toBeGreaterThan(iCenterline);
  });
});

describe('les deux chemins comptent la même chose', () => {
  it('un tracé donné rend le même nombre de virages des deux côtés', () => {
    // Le client passe par `deriveCornersFromCenterline`, la fonction serveur
    // appelle `generateCircuit` directement. Ce test vérifie que le pivot
    // commun — le générateur, avec le réglage partagé — est bien ce qui
    // décide, et non un traitement propre à l'un des deux.
    const carre: { lat: number; lon: number }[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      carre.push({ lat: 45 + 0.004 * Math.cos(a), lon: -0.14 + 0.006 * Math.sin(a) });
    }
    const parLeGenerateur = generateCircuit(carre, PARAMS_CENTERLINE).corners.length;
    expect(deriveCornersFromCenterline(carre)).toHaveLength(parLeGenerateur);
  });
});
