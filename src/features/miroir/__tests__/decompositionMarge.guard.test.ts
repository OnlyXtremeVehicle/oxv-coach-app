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
 * La note vit HORS des actes du débrief, et elle est rendue dans les deux
 * branches. La fondre dans le récit aurait deux défauts : elle disparaîtrait
 * quand le débrief est généré (le texte vient alors d'ailleurs, et l'écran
 * l'étiquette comme tel), et elle mélangerait deux provenances sous une seule
 * étiquette — ce que la transparence IA interdit ici.
 */

import { readFileSync } from 'fs';

import { codeExecutable } from '@/test-utils/codeSeul';
import { join } from 'path';

import { debriefModel } from '../bilanLogic';
import { libelleBaseMarge, libelleLigneMarge } from '@/services/marginCalculator';

const RACINE = process.cwd();

describe('la décomposition de la marge', () => {
  it('« pilote seul » se dit, « complète » ne dit rien', () => {
    const dit = libelleBaseMarge('pilote-seul');
    expect(dit).not.toBeNull();
    expect(dit).toMatch(/pilotage seul/);
    // Rien à signaler quand la marge repose sur tout ce qu'elle devrait : une
    // note qui ne dit rien use la confiance qu'on aura besoin d'avoir ailleurs.
    expect(libelleBaseMarge('complete')).toBeNull();
  });

  it('elle ne prescrit rien et ne juge pas', () => {
    for (const base of ['complete', 'pilote-seul', 'aucune'] as const) {
      const t = libelleBaseMarge(base) ?? '';
      expect(t).not.toMatch(/vous devriez|il faut|évitez|améliorez|meilleur|mauvais/i);
    }
  });

  /**
   * LE CŒUR. Un récit GÉNÉRÉ ne doit pas faire disparaître la note : c'est
   * précisément la séance la mieux racontée qui mérite le plus qu'on dise sur
   * quoi son chiffre repose.
   */
  it('la note survit à un débrief généré', () => {
    const genere = debriefModel(
      {
        debriefText: 'Un récit.\n---\nUne méta.\n---\nUne préparation.',
        marginGlobal: 51,
        marginBase: 'pilote-seul',
      },
      'Gabin'
    );
    expect(genere.kind).toBe('generated');
    if (genere.kind === 'pending') throw new Error('inattendu');
    expect(genere.baseNote).toMatch(/pilotage seul/);
  });

  it('et elle est là aussi dans le repli', () => {
    const repli = debriefModel(
      { debriefText: null, marginGlobal: 51, marginBase: 'pilote-seul' },
      'Gabin'
    );
    expect(repli.kind).toBe('fallback');
    if (repli.kind === 'pending') throw new Error('inattendu');
    expect(repli.baseNote).toMatch(/pilotage seul/);
  });

  /**
   * Le contre-exemple, sans quoi la garde ne prouverait que « la note est
   * toujours là ». Une ligne antérieure au 14/08 ne porte pas de base : on
   * n'invente pas une phrase pour elle.
   */
  it('une ligne sans base ne se voit pas attribuer de note', () => {
    const ancien = debriefModel({ debriefText: null, marginGlobal: 39.2 }, 'Gabin');
    if (ancien.kind === 'pending') throw new Error('inattendu');
    expect(ancien.baseNote).toBeNull();
  });

  it('la note ne se glisse pas dans les actes — provenance pure', () => {
    const repli = debriefModel(
      { debriefText: null, marginGlobal: 51, marginBase: 'pilote-seul' },
      'Gabin'
    );
    if (repli.kind === 'pending') throw new Error('inattendu');
    for (const acte of repli.acts) expect(acte.body).not.toMatch(/pilotage seul/);
  });

  /**
   * ET L'ÉCRAN LA REND. Sans ce dernier maillon, tout ce qui précède serait
   * une garde posée sur du code que personne n'affiche — le motif que ce
   * dépôt a répété neuf fois.
   */
  it('l’écran de bilan affiche la note', () => {
    const ecran = codeExecutable(
      readFileSync(join(RACINE, 'app', '(app2)', 'bilan', '[sessionId].tsx'), 'utf8')
    );
    expect(ecran).toMatch(/debrief\.baseNote !== null/);
    expect(ecran).toMatch(/\{data\.debrief\.baseNote\}/);
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
