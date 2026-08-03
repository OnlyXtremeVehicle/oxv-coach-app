/**
 * GARDE DE SOURCE — aucun espace ne devient un écran noir après déconnexion.
 *
 * ===========================================================================
 * CE QUI ÉTAIT EN PLACE
 * ===========================================================================
 *
 * Quatre groupes de routes sur huit lisaient `profile` et rendaient `null`
 * quand il était absent :
 *
 *     app/(coach)/_layout.tsx
 *     app/(coach-onboarding)/_layout.tsx
 *     app/(partner)/_layout.tsx
 *     app/(pro)/_layout.tsx
 *
 * Or `signOut()` remet l'état à `initialState`, donc `profile` à `null`. Le
 * layout se re-rendait, tombait sur `if (!profile) return null;` et n'émettait
 * plus aucun `Stack` : le sous-arbre disparaissait.
 *
 * Et rien ne renavigue. `app/index.tsx` n'est pas monté quand la route courante
 * est /(partner) — il n'y a donc personne pour renvoyer vers le login. L'écran
 * restait noir jusqu'à ce que l'application soit tuée.
 *
 * Le motif correct existait deux fichiers plus loin, dans `app/(app2)/_layout.tsx` :
 * une redirection déclenchée par `status === 'unauthenticated'`. `status` est la
 * seule source qui distingue « déconnecté » de « profil pas encore lu » —
 * distinction que ce dépôt a déjà payée une fois (voir `profilIndisponible`).
 *
 * `app/(admin)/_layout.tsx` s'en sortait par un rebond : il redirige vers
 * /(app2) quand le profil n'est pas admin, et (app2) renvoie au login. Un cran
 * de plus, mais jamais d'écran noir.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE VÉRIFIE
 * ===========================================================================
 *
 * Que tout layout de groupe de routes lisant `profile` sait aussi quoi faire
 * de `status === 'unauthenticated'` — soit en redirigeant lui-même, soit en
 * déléguant explicitement à un layout qui le fait.
 *
 * Elle est LEXICALE. Elle ne monte aucun composant et ne prouve pas que la
 * redirection aboutit : elle garantit que la question est posée dans chaque
 * espace. Un futur groupe de routes copié sur un voisin fautif tombera ici.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');
const DOSSIER_APP = join(RACINE, 'app');

/** Les layouts de groupe : `app/(quelque-chose)/_layout.tsx`. */
function layoutsDeGroupe(): string[] {
  return readdirSync(DOSSIER_APP, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('('))
    .map((e) => join(DOSSIER_APP, e.name, '_layout.tsx'))
    .filter((p) => {
      try {
        readFileSync(p, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
}

/**
 * Espaces qui délèguent volontairement leur sortie à un autre layout, avec la
 * raison. Toute entrée ici est une décision, pas un oubli — et elle doit rester
 * vraie : le test vérifie que la délégation existe réellement dans le code.
 */
const DELEGUENT: Record<string, { vers: string; motif: string }> = {
  '(admin)': {
    vers: '/(app2)',
    motif:
      "redirige vers l'espace pilote dès que le profil n'est pas admin ; " +
      '(app2) renvoie ensuite au login.',
  },
};

describe('sortie après déconnexion', () => {
  const layouts = layoutsDeGroupe();

  it('des layouts de groupe sont bien inspectés', () => {
    // Un filtre cassé rendrait cette suite verte sans rien regarder.
    expect(layouts.length).toBeGreaterThanOrEqual(6);
  });

  it.each(layouts.map((p) => [p.split(/[\\/]/).slice(-2, -1)[0], p]))(
    '%s ne peut pas rester sur un écran noir',
    (groupe, chemin) => {
      const source = readFileSync(chemin as string, 'utf8');

      // Un layout qui ne lit jamais le profil ne peut pas produire ce défaut.
      if (!/useAuthStore\(\(s\) => s\.profile\)/.test(source)) return;

      const delegue = DELEGUENT[groupe as string];
      if (delegue) {
        expect(source).toContain(delegue.vers);
        return;
      }

      expect(source).toMatch(/status === 'unauthenticated'/);
      expect(source).toMatch(/\/\(auth\)\/login/);
    }
  );

  it('la référence — (app2) porte bien le motif que les autres copient', () => {
    // Si celui-ci change de forme, la garde ci-dessus deviendrait fausse en
    // silence : elle chercherait un motif qui n'est plus la convention.
    const app2 = readFileSync(join(DOSSIER_APP, '(app2)', '_layout.tsx'), 'utf8');
    expect(app2).toMatch(/status === 'unauthenticated'/);
    expect(app2).toMatch(/\/\(auth\)\/login/);
  });
});
