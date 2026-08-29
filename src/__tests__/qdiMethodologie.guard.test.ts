/**
 * GARDE — la méthodologie publiée dit ce que le code calcule.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE
 * ===========================================================================
 *
 * La méthodologie du QDI a vécu dix-huit mois dans l'AUTRE dépôt
 * (`docs/site/QDI_METHODOLOGIE.md`), loin des formules. Elle a dérivé sans que
 * rien ne l'arrête : elle annonçait une Fluidité mesurée sur les « entrées
 * volant et pédales » et un Freinage lu sur la « montée en pression », alors
 * que le boîtier n'a ni capteur de volant, ni capteur de pédales. Ce texte
 * était publié sur oxvehicle.fr.
 *
 * Le document vit désormais à côté du code. Cette garde tient les deux points
 * qui, s'ils se défont, refont exactement la même dérive.
 *
 * ===========================================================================
 * CE QU'ELLE NE GARDE PAS
 * ===========================================================================
 *
 * Elle ne cherche AUCUN mot interdit. Le document parle nécessairement de
 * volant et de pédales — pour dire qu'ils ne sont pas mesurés. Une garde
 * lexicale accuserait la phrase d'honnêteté elle-même : le piège classique de
 * ce dépôt. Elle vérifie donc des faits vérifiables, pas du vocabulaire.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { QDI_ALGO_VERSION, computeQdi } from '@/services/qdiLogic';

// Le document est taillé à 80 colonnes : une phrase y traverse les lignes. On
// compare donc un texte aux espaces normalisés — sinon la garde tomberait au
// premier reformatage, et une garde qui crie pour un retour à la ligne finit par
// être désactivée.
const DOC = readFileSync(
  join(process.cwd(), 'docs/architecture/21_QDI_METHODOLOGIE.md'),
  'utf8',
).replace(/\s+/g, ' ');

describe('la méthodologie QDI reste alignée sur le calcul', () => {
  /**
   * Le document PUBLIE une version. Si le code en change et que le document
   * garde l'ancienne, il décrit des formules qui ne tournent plus — et il le
   * fait avec l'autorité d'un document de référence.
   */
  it('le document nomme la version d’algorithme en vigueur', () => {
    expect(DOC).toContain(QDI_ALGO_VERSION);
  });

  /** Les cinq branches du code sont les cinq branches du document. */
  it('les cinq branches sont décrites, et aucune autre', () => {
    const branches = Object.keys(computeQdi([], [])).filter(
      (k) => !['algoVersion', 'lapCount', 'frameCount'].includes(k),
    );
    expect(branches).toHaveLength(5);

    const libelles: Record<string, string> = {
      trajectoire: 'Trajectoire',
      fluidite: 'Fluidité',
      freinage: 'Freinage',
      acceleration: 'Accélération',
      regularite: 'Régularité',
    };
    for (const b of branches) {
      expect(libelles[b]).toBeDefined();
      expect(DOC).toContain('**' + libelles[b] + '**');
    }
  });

  /**
   * L'HONNÊTETÉ CAPTEURS NE SE SUPPRIME PAS. C'est la phrase dont l'absence a
   * produit un texte public faux : sans elle, un lecteur suppose que « Freinage »
   * se lit sur la pédale.
   */
  it('le document dit ce que le boîtier ne mesure pas', () => {
    expect(DOC).toMatch(/ni capteur de volant/i);
    expect(DOC).toMatch(/ni capteur de p[ée]dales/i);
  });

  /**
   * Le code ne compose AUCUN score global. Tant que c'est vrai, le document
   * doit le dire — une pondération publiée sans calcul derrière est ce que la
   * page Progression du site affiche encore.
   */
  it('aucun score global n’est calculé, et le document l’annonce', () => {
    const resultat = computeQdi([], []);
    expect(resultat).not.toHaveProperty('score');
    expect(resultat).not.toHaveProperty('global');
    expect(DOC).toMatch(/aucun score global/i);
  });
});
