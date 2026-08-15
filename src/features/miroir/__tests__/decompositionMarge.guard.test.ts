/**
 * GARDE — le chiffre roi dit sur quoi il repose, quelle que soit l'origine du
 * texte qui l'accompagne.
 *
 * ===========================================================================
 * POURQUOI
 * ===========================================================================
 *
 * La marge globale pesait 40 % véhicule / 60 % pilote. Jusqu'au 14/08/2026, la
 * part véhicule ne venait d'aucune mesure : `input.vehicle` n'était jamais
 * renseigné, et le calcul retombait sur `DEFAULT_VEHICLE = { maxGLateral: 1.0 }`
 * — une constante. Sur Bouteville, 7,7 points de marge sortaient de là.
 *
 * La constante est retirée. Quand le véhicule n'est pas caractérisé — c'est le
 * cas de TOUTES les séances aujourd'hui —, la marge porte sur le pilote seul.
 *
 * Ce n'est pas un changement de chiffre, c'est un changement de NATURE. Le
 * taire reviendrait à remplacer une fabrication par un silence.
 *
 * ===========================================================================
 * CE QUE LA GARDE TIENT
 * ===========================================================================
 *
 * Le chiffre et sa base vivent au MÊME endroit : la section MARGE de l'écran
 * de bilan, qui porte le nombre, sa décomposition pondérée, et la ligne
 * « Véhicule non caractérisé — exclu du calcul ».
 *
 * Une note équivalente a vécu sous le débrief du 14 au 15/08. Elle est
 * retirée : deux fois la même précaution, à deux blocs de distance sur le même
 * écran, ne rassure pas davantage — elle dilue, et elle se désynchronise. La
 * garde vérifie donc aussi son ABSENCE là-bas.
 *
 * Côté coach, la même base commande le libellé d'un ÉCART, qui affirme plus
 * fort qu'un chiffre : il pose que les deux valeurs sont commensurables.
 */

import { readFileSync } from 'fs';

import { codeExecutable, codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

import { libelleLigneMarge } from '@/services/marginCalculator';

const RACINE = process.cwd();

describe('la décomposition de la marge', () => {
  /**
   * LA SECTION MARGE PORTE LE CHIFFRE ET SA BASE — lot A3 du 15/08.
   *
   * Une note sous le débrief disait la même chose du 14 au 15/08. Deux
   * précautions identiques à deux blocs de distance ne rassurent pas
   * davantage : elles diluent. La section a gagné, parce qu'elle est CONTRE le
   * nombre et qu'elle porte aussi sa décomposition.
   */
  it('l’écran rend la marge, sa décomposition, et l’exclusion du véhicule', () => {
    const source = readFileSync(join(RACINE, 'app', '(app2)', 'bilan', '[sessionId].tsx'), 'utf8');

    // STRUCTURE : lue sans les littéraux, pour qu'un commentaire ou un libellé
    // ne puisse pas faire passer la garde au vert.
    const structure = codeExecutable(source);
    // Sans le littéral `'absente'` : `codeExecutable` l'efface aussi, et une
    // garde qui cherche une chaîne dans un texte dont on a retiré les chaînes
    // échoue toujours. Ici on veut l'ACCÈS au champ, pas sa comparaison.
    expect(structure).toMatch(/data\.marge\.kind !==/);
    expect(structure).toMatch(/data\.marge\.composantes\.map/);

    // TEXTE : lu avec les littéraux — ces deux phrases SONT le contenu, et le
    // texte JSX est précisément ce que `codeExecutable` efface. Employer le
    // mauvais des deux lecteurs rend une garde qui ne voit pas ce qu'elle
    // prétend vérifier ; c'est arrivé en écrivant celle-ci.
    const texte = codeSansCommentaires(source);
    expect(texte).toMatch(/data\.marge\.kind !== 'absente'/);
    expect(texte).toContain('MARGE PILOTE');
    expect(texte).toContain('Véhicule non caractérisé — exclu du calcul.');
    // La décomposition nomme ses poids : un chiffre roi qui agrège deux
    // grandeurs sans les montrer serait indéfendable.
    expect(texte).toMatch(/poids \$\{c\.poids === 0\.6/);
  });

  /** Et la phrase ne subsiste PAS ailleurs sur le même écran. */
  it('elle ne se répète pas sous le débrief', () => {
    const ecran = codeExecutable(
      readFileSync(join(RACINE, 'app', '(app2)', 'bilan', '[sessionId].tsx'), 'utf8')
    );
    expect(ecran).not.toMatch(/baseNote/);
  });

  /**
   * CÔTÉ COACH, un ÉCART affirme plus fort qu'un chiffre : il pose que les
   * deux valeurs sont commensurables. Le libellé doit donc suivre la base.
   */
  describe('deux marges côte à côte', () => {
    it('toutes pilote-seul : la ligne le dit', () => {
      const l = libelleLigneMarge(['pilote-seul', 'pilote-seul']);
      expect(l.label).toBe('marge pilote');
      expect(l.note).toMatch(/pilotage/);
    });

    it('toutes complètes : rien à préciser', () => {
      const l = libelleLigneMarge(['complete', 'complete']);
      expect(l.label).toBe('marge globale');
      expect(l.note).toBeNull();
    });

    /** LE CAS QUI COMPTE : deux bases différentes, un écart qui ne veut rien dire. */
    it('bases différentes : la comparaison est signalée', () => {
      const l = libelleLigneMarge(['complete', 'pilote-seul']);
      expect(l.note).toMatch(/pas sur la même base/);
    });

    it('une base inconnue : on ne devine pas, on garde le libellé d’origine', () => {
      expect(libelleLigneMarge(['pilote-seul', null])).toEqual({
        label: 'marge globale',
        note: null,
      });
      expect(libelleLigneMarge([])).toEqual({ label: 'marge globale', note: null });
    });

    it('les deux écrans de comparaison emploient le libellé, pas une chaîne en dur', () => {
      for (const ecran of ['comparer.tsx', 'comparer-pilotes.tsx']) {
        const code = codeExecutable(readFileSync(join(RACINE, 'app', '(coach)', ecran), 'utf8'));
        expect({ ecran, code: /libelleLigneMarge\(/.test(code) }).toEqual({ ecran, code: true });
        expect({ ecran, code: /ligneMarge\.note/.test(code) }).toEqual({ ecran, code: true });
      }
    });

    it('et le cliché de séance porte la base — sinon le libellé n’aurait rien à lire', () => {
      const service = codeExecutable(
        readFileSync(join(RACINE, 'src', 'services', 'coachService.ts'), 'utf8')
      );
      expect(service).toMatch(/marginBase:\s*baseDepuisBreakdown/);
      expect(service).toMatch(/margin_breakdown/);
    });
  });

  /**
   * ET LA BASE VIENT DE LA BASE DE DONNÉES, pas d'une supposition de l'écran :
   * le calcul l'inscrit dans `margin_breakdown`, le service la relit.
   */
  it('la base est persistée par le calcul et relue par le service', () => {
    const calcul = codeExecutable(
      readFileSync(join(RACINE, 'src', 'services', 'marginCalculator.ts'), 'utf8')
    );
    expect(calcul).toMatch(/base:\s*MarginBase|base,/);

    // Et `margeLogic` décide de la publication sur la MESURE (`marginVehicle`),
    // pas sur un drapeau : la globale revient d'elle-même le jour où le
    // véhicule sera caractérisé.
    const marge = codeExecutable(
      readFileSync(join(RACINE, 'src', 'features', 'miroir', 'margeLogic.ts'), 'utf8')
    );
    expect(marge).toMatch(/marginVehicle !== null/);

    const service = codeExecutable(
      readFileSync(join(RACINE, 'src', 'services', 'analysesService.ts'), 'utf8')
    );
    expect(service).toMatch(/marginBase:\s*baseDepuisBreakdown/);

    // Le jumeau serveur écrit la même clé : sans cela, toute séance analysée
    // par le cron arriverait sans base et la note disparaîtrait en silence.
    const cron = codeExecutable(
      readFileSync(
        join(RACINE, 'supabase', 'functions', 'cron-analyze-pending-sessions', 'index.ts'),
        'utf8'
      )
    );
    expect(cron).toMatch(/base:/);
  });
});
