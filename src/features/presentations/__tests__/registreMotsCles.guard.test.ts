/**
 * GARDE — toute fiche porte un libellé COURT, et ce libellé est un mot-clé.
 *
 * ===========================================================================
 * CE QU'ELLE ATTRAPE
 * ===========================================================================
 *
 * Les soixante-cinq `nom` du catalogue sont des noms de CATALOGUE : « Ce que je
 * retiens », « Effet jusqu'à la zone suivante », « Repère de décélération
 * observée ». Ils se lisent bien dans un index. Sur une feuille de données, la
 * règle des mots-clés les refuse tous les soixante-cinq — mesuré le 01/09/2026,
 * et le compte est exact : zéro passait.
 *
 * La décision du fondateur du 30/08 tranche : « Champ `court` obligatoire ; la
 * phrase reste au second geste. » Cette garde est ce qui rend la décision
 * opposable. Une fiche ajoutée demain sans `court`, ou avec un `court` qui
 * porte un mot outil, échoue ici.
 *
 * ===========================================================================
 * POURQUOI ELLE VIT DANS LE REGISTRE, ET PAS DANS `check-doctrine`
 * ===========================================================================
 *
 * Le scanner doctrinal lit les fichiers `.tsx` — les écrans. Ces libellés
 * vivent dans un `.ts`, et voyagent jusqu'à l'écran par le moteur de
 * composition. Le scanner ne les voit donc pas, et ne peut pas les voir sans
 * suivre les valeurs à travers deux modules.
 *
 * C'est une limite CONNUE du scanner, et cette garde est la réponse : la règle
 * s'applique à la SOURCE de la chaîne, là où la chaîne est écrite.
 */

import { REGISTRE_PRESENTATIONS } from '../registrePresentations';
import { estPhrase, motifRefusMotCle } from '@/lib/regleMotsCles';

describe('les libellés courts du registre', () => {
  it('les soixante-cinq fiches en portent un', () => {
    const sans = REGISTRE_PRESENTATIONS.filter(
      (p) => typeof p.court !== 'string' || p.court.trim().length === 0
    ).map((p) => p.id);
    expect(sans).toEqual([]);
  });

  it('chacun est un mot-clé valide, sans exception', () => {
    const refuses = REGISTRE_PRESENTATIONS.map((p) => ({
      id: p.id,
      court: p.court,
      motif: motifRefusMotCle(p.court),
    })).filter((r) => r.motif !== null);
    expect(refuses).toEqual([]);
  });

  it('aucun n’est une phrase, par la définition du brief', () => {
    const phrases = REGISTRE_PRESENTATIONS.filter((p) => estPhrase(p.court)).map((p) => p.id);
    expect(phrases).toEqual([]);
  });

  /**
   * Deux fiches qui montreraient le même libellé seraient indistinguables dans
   * une liste — et la liste des lectures en montre plusieurs à la fois.
   */
  it('ils sont tous distincts', () => {
    const vus = new Map<string, string>();
    const collisions: string[] = [];
    for (const p of REGISTRE_PRESENTATIONS) {
      const deja = vus.get(p.court);
      if (deja !== undefined) collisions.push(`${deja} et ${p.id} : « ${p.court} »`);
      else vus.set(p.court, p.id);
    }
    expect(collisions).toEqual([]);
  });

  /**
   * LE COURT NE REMPLACE PAS LE NOM, IL LE DOUBLE.
   *
   * Si les deux devenaient identiques, c'est que le nom du catalogue aurait été
   * réécrit en mot-clé — et l'index du §04 ne s'y retrouverait plus. Les deux
   * champs ont deux usages ; les confondre en perdrait un.
   */
  it('le nom du catalogue est conservé, et reste distinct du libellé', () => {
    // `as string` : le registre est `as const`, et TypeScript sait déjà que les
    // deux ensembles de littéraux ne se recoupent pas — il refuse la
    // comparaison. La garde reste utile à l'exécution, le jour où le registre
    // cesserait d'être figé.
    const confondus = REGISTRE_PRESENTATIONS.filter(
      (p) => (p.nom as string) === (p.court as string)
    ).map((p) => p.id);
    expect(confondus).toEqual([]);
    for (const p of REGISTRE_PRESENTATIONS) {
      expect(p.nom.trim().length).toBeGreaterThan(0);
    }
  });
});
