/**
 * GARDE — la méthode publiée dit TOUTE la banque, et une inférence nomme
 * toujours son hypothèse.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ
 * ===========================================================================
 *
 * Quatre briques de transparence pointaient vers un écran qui n'existait pas :
 *
 *   • `provenance.ts` — 27 grandeurs, chacune avec sa source et sa convention,
 *     verrouillées par test, et rendues à l'écran en UN seul point ;
 *   • `ProvenanceTag` porte une prop `toujours`, commentée « utile dans un
 *     écran de méthode », jamais passée par personne ;
 *   • `catalogue.ts` donne aux six lectures un champ `source` documenté
 *     « MÉTHODE », que la feuille n'affiche jamais ;
 *   • l'en-tête de `qdiLogic.ts` réclame un « bloc méthode obligatoire à
 *     l'affichage ».
 *
 * ===========================================================================
 * CE QUE CETTE GARDE EXIGE
 * ===========================================================================
 *
 * Que l'écran rende la banque ENTIÈRE, sans liste écrite à la main qui
 * divergerait — c'est pourquoi il itère sur `BANQUE` et non sur une copie.
 *
 * Et l'invariant de fond : **une grandeur inférée nomme son hypothèse.** Un
 * [I] sans phrase serait le pire des cas — un chiffre présenté comme un fait
 * alors qu'il repose sur une supposition tue.
 */

import { readFileSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

import { BANQUE, peutEtreChiffreRoi } from '../provenance';

const RACINE = process.cwd();

const ECRAN = codeSansCommentaires(
  readFileSync(join(RACINE, 'app', '(app2)', 'methode.tsx'), 'utf8')
);

describe('la méthode publiée', () => {
  it('l’écran itère la BANQUE entière, sans liste recopiée', () => {
    expect(ECRAN).toContain("from '@/telemetry/provenance'");
    expect(ECRAN).toMatch(/for \(const g of BANQUE\)/);
  });

  it('il rend la source ET la convention de chaque grandeur', () => {
    expect(ECRAN).toContain('{g.source}');
    expect(ECRAN).toContain('{g.convention}');
  });

  /**
   * LE CŒUR DOCTRINAL. Un [I] est un chiffre qui repose sur une hypothèse ;
   * ne pas la nommer reviendrait à présenter une supposition comme un fait.
   */
  it('chaque grandeur inférée nomme son hypothèse', () => {
    const muettes = BANQUE.filter((g) => g.prov === 'I').filter((g) => g.source.trim().length < 20);
    expect(muettes.map((g) => g.cle)).toEqual([]);
  });

  it('et il y a bien des inférences — sinon la garde ne prouve rien', () => {
    expect(BANQUE.filter((g) => g.prov === 'I').length).toBeGreaterThan(0);
  });

  /**
   * La règle que l'écran énonce doit être celle que le code applique : une
   * grandeur inférée ne peut pas porter le chiffre roi.
   */
  it('aucune grandeur inférée ne peut régner', () => {
    for (const g of BANQUE) {
      if (g.prov === 'I') expect(peutEtreChiffreRoi(g.cle)).toBe(false);
    }
  });

  it('l’écran est atteignable depuis la Signature', () => {
    const signature = codeSansCommentaires(
      readFileSync(join(RACINE, 'app', '(app2)', 'signature.tsx'), 'utf8')
    );
    expect(signature).toContain('/(app2)/methode');
  });

  /**
   * Et il ne coache pas. Une méthode qui glisserait vers le conseil
   * cesserait d'être une méthode.
   */
  it('l’écran ne prescrit rien', () => {
    expect(ECRAN).not.toMatch(/vous devriez|il faut que|essayez de|améliorez/i);
  });
});
