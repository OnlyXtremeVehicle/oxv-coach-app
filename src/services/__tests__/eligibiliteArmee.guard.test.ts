/**
 * GARDE — le pilote peut déclarer ses pièces, et il ne peut pas les valider.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ LE 14/08/2026
 * ===========================================================================
 *
 * `eligibility_items` est en production depuis le 03/07, `declare_eligibility_item`
 * depuis le 11/08. **La seule occurrence de la RPC dans tout le dépôt était le
 * fichier de types généré.** Zéro appelant : aucun pilote ne pouvait rien
 * déclarer, nulle part.
 *
 * La ligne du plan promet *« trois écrans, une seule donnée »*. Il y en avait
 * un, côté admin, et il ne touchait qu'une des neuf clés : le briefing.
 *
 * ===========================================================================
 * L'INVARIANT QUI COMPTE
 * ===========================================================================
 *
 * **Déclarer n'est pas valider.** Le pilote dit « je l'ai » ; l'administrateur
 * seul met « ok » ou « refusé ». Si le code applicatif se mettait à écrire
 * `status`, la checklist d'accès à la piste deviendrait une formalité que le
 * pilote remplit lui-même — et la RLS le refuserait, ce qui est pire : un
 * bouton qui échoue en silence.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

import { CLES_DECLARABLES, CLES_ELIGIBILITE } from '../eligibilityLogic';

const RACINE = process.cwd();

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

const SERVICE = codeSansCommentaires(
  readFileSync(join(RACINE, 'src', 'services', 'eligibilityService.ts'), 'utf8')
);
const ECRAN = codeSansCommentaires(
  readFileSync(join(RACINE, 'app', '(app2)', 'vous', 'pieces.tsx'), 'utf8')
);

describe('la chaîne des pièces est armée', () => {
  /** LE CŒUR. Cette assertion aurait échoué du 11/08 au 14/08. */
  it('la RPC a un appelant de production', () => {
    const appelants: string[] = [];
    for (const racine of ['app', 'src']) {
      for (const f of fichiers(join(RACINE, racine))) {
        if (f.endsWith('database.types.ts')) continue;
        if (/declare_eligibility_item/.test(codeSansCommentaires(readFileSync(f, 'utf8')))) {
          appelants.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
        }
      }
    }
    expect(appelants).not.toEqual([]);
  });

  it('et un écran pilote la déclenche réellement', () => {
    expect(ECRAN).toContain('declarePiece(');
    expect(ECRAN).toContain('listPiecesForRegistration(');
  });

  it('l’écran est atteignable depuis le Pass', () => {
    const pass = codeSansCommentaires(
      readFileSync(join(RACINE, 'app', '(app2)', 'club', 'pass.tsx'), 'utf8')
    );
    expect(pass).toContain('/(app2)/vous/pieces');
  });

  /**
   * DÉCLARER N'EST PAS VALIDER. Le service ne doit jamais écrire `status` :
   * la RLS le refuserait, et un bouton qui échoue en silence est pire qu'un
   * bouton absent.
   */
  it('le service n’écrit jamais le statut', () => {
    expect(SERVICE).not.toMatch(/\.update\(/);
    expect(SERVICE).not.toMatch(/status:\s*'(ok|refused)'/);
  });

  it('les neuf clés du CHECK sont couvertes, et le briefing n’est pas déclarable', () => {
    expect(CLES_ELIGIBILITE).toHaveLength(9);
    expect(CLES_ELIGIBILITE).toContain('briefing');
    // Le briefing est le seul geste COLLECTIF des neuf : il est tenu par
    // l'équipe sur place, pas apporté par le pilote.
    expect(CLES_DECLARABLES).not.toContain('briefing');
    expect(CLES_DECLARABLES).toHaveLength(8);
  });
});
