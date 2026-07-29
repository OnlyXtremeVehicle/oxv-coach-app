/**
 * Le registre de provenance doit être CONSOMMÉ, pas seulement écrit.
 * Jalon 4, phase 4sexies.
 *
 * ---
 *
 * POURQUOI CE TEST EXISTE
 *
 * Ce lot a commencé par constater que `kinematics.origines` était rempli et lu
 * nulle part. Écrire un registre plus complet sans le brancher aurait reproduit
 * exactement le défaut qu'il corrige — la huitième garde posée et jamais armée
 * de ce dépôt.
 *
 * Ce test vérifie donc l'ARMEMENT, pas la définition.
 *
 * ---
 *
 * LA RÈGLE : TOUTE INFÉRENCE AFFICHÉE S'ANNONCE
 *
 * Une mesure et une déduction n'ont pas à s'annoncer dans le fil de lecture —
 * étiqueter le normal use l'attention. Une INFÉRENCE, si : elle repose sur une
 * hypothèse qui peut être fausse, et le pilote a le droit de la connaître avant
 * d'en tirer une conclusion sur sa conduite.
 *
 * Le test cherche, pour chaque grandeur [I], les écrans qui l'affichent, et
 * exige qu'ils portent l'étiquette.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { BANQUE } from '../provenance';

const RACINE = join(__dirname, '..', '..', '..');

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|__tests__/.test(e.name) && !e.name.startsWith('.')) fichiers(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Retire les commentaires : un en-tête cite forcément ce qu'il explique. */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ECRANS = [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))].map((f) => ({
  chemin: f.replace(RACINE, '').replace(/\\/g, '/'),
  code: codeSeul(readFileSync(f, 'utf8')),
}));

describe('le registre a un consommateur', () => {
  it('ProvenanceTag existe et lit le registre', () => {
    const tag = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'ProvenanceTag.tsx'), 'utf8');
    expect(tag).toContain("from '@/telemetry/provenance'");
    expect(tag).toContain('grandeur(');
  });

  it('il est exporté par le kit', () => {
    const baril = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'index.ts'), 'utf8');
    expect(baril).toContain('ProvenanceTag');
  });

  /**
   * LE TEST DU LOT. Un composant sans appelant est un composant mort — et un
   * registre sans consommateur est un registre décoratif.
   */
  it('il est réellement monté quelque part', () => {
    const porteurs = ECRANS.filter(
      (e) => /<ProvenanceTag/.test(e.code) && !e.chemin.endsWith('ProvenanceTag.tsx')
    );
    expect(porteurs.map((p) => p.chemin)).not.toEqual([]);
  });
});

describe('toute inférence affichée s’annonce', () => {
  const INFEREES = BANQUE.filter((g) => g.prov === 'I');

  it('il y en a bien', () => {
    expect(INFEREES.length).toBeGreaterThan(0);
  });

  /**
   * Le tour idéal est le cas nommé par le dossier — « annoncé théorique ». Il
   * s'affichait en chiffre héros sans rien dire de sa nature : un temps que
   * personne n'a jamais réalisé, présenté comme la mesure de la séance.
   */
  it('le tour idéal porte son étiquette là où il s’affiche', () => {
    const viz = ECRANS.find((e) => e.chemin.endsWith('TourIdealViz.tsx'));
    expect(viz).toBeDefined();
    expect(viz!.code).toContain('delta.idealLapTime');
  });

  /**
   * Les deux autres inférences — taux d'exploitation, recouvrement
   * freinage-virage — ne sont affichées NULLE PART aujourd'hui. Ce test le
   * fige : le jour où l'une d'elles arrive à l'écran, il faudra la brancher au
   * registre, et l'échec de ce test le rappellera.
   */
  it.each(['gg.exploitationRate', 'gg.trailBrakingOverlap'])(
    '« %s » n’est pas encore affichée — à étiqueter le jour où elle le sera',
    (cle) => {
      const champ = cle.split('.')[1];
      const affichee = ECRANS.filter((e) => e.code.includes(champ));
      const etiquetee = ECRANS.filter((e) => e.code.includes(cle));
      // Soit elle n'est nulle part, soit elle est étiquetée. Jamais affichée nue.
      expect({ cle, nue: affichee.length > 0 && etiquetee.length === 0 }).toEqual({
        cle,
        nue: false,
      });
    }
  );
});

describe('ce que l’étiquette ne fait pas', () => {
  /**
   * Une mesure ne s'annonce pas par défaut. Si `[M]` apparaissait partout,
   * l'étiquette cesserait d'être un signal — et c'est l'inférence qu'on
   * cesserait de voir.
   */
  it('le composant tait le mesuré et le déduit par défaut', () => {
    const tag = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'ProvenanceTag.tsx'), 'utf8');
    expect(tag).toMatch(/toujours\s*=\s*false/);
    expect(tag).toMatch(/g\.prov\s*!==\s*'I'/);
  });

  // Fail-closed : une clé absente du registre n'affiche rien plutôt qu'un
  // badge vide qui laisserait croire à une provenance connue.
  it('une clé inconnue ne rend rien', () => {
    const tag = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'ProvenanceTag.tsx'), 'utf8');
    expect(tag).toMatch(/if\s*\(!g\)\s*return null/);
  });
});
