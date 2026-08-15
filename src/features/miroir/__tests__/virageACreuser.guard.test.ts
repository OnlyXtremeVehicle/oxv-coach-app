/**
 * GARDE — le virage à creuser est CHOISI, ÉCRIT, relu et rendu.
 *
 * ===========================================================================
 * UNE COLONNE VIDE DEPUIS LE 24 MAI
 * ===========================================================================
 *
 * `app_session_analyses.next_focus_corner_index` existe depuis la migration
 * `0009` (24/05/2026). Mesuré en production le 15/08 :
 *
 *     14 lignes · 0 avec next_focus_corner_index · 0 avec next_focus_phrase
 *
 * Elle était pourtant relue par TROIS requêtes de `analysesService`, typée
 * côté application, et lue par `DebriefMirror` — un composant monté nulle
 * part. Personne ne l'écrivait.
 *
 * Le 15/08 au soir, le lot A3 a posé un marqueur de trace qui la consomme. Il
 * aurait été inerte : la sélection existait (dans `focusCorner.ts`, orphelin),
 * la lecture existait, l'affichage venait d'arriver — et il manquait
 * l'écriture, au milieu. C'est la forme la plus coûteuse du motif de ce dépôt :
 * une chaîne complète à un maillon près, où chaque maillon prouve l'intention
 * et aucun ne prouve le fonctionnement.
 *
 * ===========================================================================
 * CE QUE LA GARDE TIENT — LES QUATRE MAILLONS
 * ===========================================================================
 *
 * Choisir · écrire · relire · rendre. Vérifier un seul des quatre laisserait
 * exactement le défaut qu'on vient de corriger.
 */

import { readFileSync } from 'fs';

import { codeExecutable } from '@/test-utils/codeSeul';
import { join } from 'path';

import { virageACreuser, type SegmentMargeLite } from '../margeLogic';

const RACINE = process.cwd();

const seg = (
  segmentIndex: number,
  marginPercent: number | null,
  marginZone: SegmentMargeLite['marginZone']
): SegmentMargeLite => ({ segmentIndex, marginPercent, marginZone });

describe('le virage à creuser — la chaîne entière', () => {
  describe('1 · le choix', () => {
    it('le rouge de plus faible marge l’emporte sur tous les jaunes', () => {
      expect(virageACreuser([seg(0, 8, 'yellow'), seg(1, 12, 'red'), seg(2, 40, 'green')])).toBe(1);
    });

    it('entre deux rouges, le plus serré', () => {
      expect(virageACreuser([seg(3, 14, 'red'), seg(7, 9, 'red')])).toBe(7);
    });

    it('sans rouge, le jaune le plus faible', () => {
      expect(virageACreuser([seg(2, 25, 'yellow'), seg(5, 18, 'yellow')])).toBe(5);
    });

    /**
     * LE SILENCE EST UNE RÉPONSE. Tout est confortable : désigner quand même
     * un virage fabriquerait un souci pour remplir un emplacement d'écran.
     */
    it('tout en vert : rien à désigner', () => {
      expect(virageACreuser([seg(0, 55, 'green'), seg(1, 62, 'green')])).toBeNull();
    });

    it('une zone rouge sans marge mesurée ne peut pas être classée', () => {
      expect(virageACreuser([seg(0, null, 'red'), seg(1, 30, 'yellow')])).toBe(1);
    });

    it('aucun segment : rien', () => {
      expect(virageACreuser([])).toBeNull();
    });
  });

  describe('2 · l’écriture — le maillon qui manquait', () => {
    it('`upsertAnalysis` écrit la colonne', () => {
      const service = codeExecutable(
        readFileSync(join(RACINE, 'src', 'services', 'analysesService.ts'), 'utf8')
      );
      expect(service).toMatch(/next_focus_corner_index:\s*input\.nextFocusCornerIndex/);
    });

    it('et l’analyse la calcule sur les segments réels, puis la passe', () => {
      const analyse = codeExecutable(
        readFileSync(join(RACINE, 'src', 'services', 'analyzeSessionService.ts'), 'utf8')
      );
      expect(analyse).toMatch(/virageACreuser\(analysis\.segments\)/);
      expect(analyse).toMatch(/nextFocusCornerIndex,/);
    });

    /**
     * Et PAS depuis `focusCorner.ts`, qui choisit parmi `BELTOISE_CORNERS` —
     * une topologie codée en dur que la politique multi-circuit a retirée
     * partout ailleurs. Un orphelin ne se branche pas parce qu'il est
     * orphelin : il se branche s'il dit vrai.
     */
    it('la sélection ne passe pas par la topologie Beltoise', () => {
      const analyse = codeExecutable(
        readFileSync(join(RACINE, 'src', 'services', 'analyzeSessionService.ts'), 'utf8')
      );
      expect(analyse).not.toMatch(/selectFocusCorner|BELTOISE_CORNERS/);
    });
  });

  describe('3 · la relecture et 4 · le rendu', () => {
    it('le service relit la colonne et la nomme', () => {
      const service = codeExecutable(
        readFileSync(join(RACINE, 'src', 'services', 'analysesService.ts'), 'utf8')
      );
      expect(service).toMatch(/nextFocusCornerIndex:\s*row\.next_focus_corner_index/);
    });

    it('le bilan en fait un marqueur de trace', () => {
      const bilan = codeExecutable(
        readFileSync(join(RACINE, 'src', 'features', 'miroir', 'useBilan.ts'), 'utf8')
      );
      expect(bilan).toMatch(/focusVirage\(analysis\?\.nextFocusCornerIndex/);
      expect(bilan).toMatch(/traceMarkers\.push/);
    });
  });
});
