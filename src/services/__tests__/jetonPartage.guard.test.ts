/**
 * UN SECRET NE SE FABRIQUE PAS SUR L'APPAREIL DE CELUI QU'IL PROTÈGE.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `generateShareToken()` vivait dans `sharesService.ts`, commentée « génère un
 * token cryptographiquement sûr », et s'appuyait sur `crypto.getRandomValues`,
 * réputé « présent sur RN via react-native-url-polyfill ».
 *
 * VÉRIFIÉ le 02/08/2026 en lisant le paquet installé : il n'expose que `URL` et
 * `URLSearchParams`. Aucun paquet du projet ne fournit `getRandomValues`, et le
 * runtime « winter » d'Expo 55 ne pose pas de `crypto` global. Sur appareil, la
 * branche de repli `Math.random` était donc la SEULE empruntée.
 *
 * Le jeton est le SEUL secret qui protège un lien de partage : qui le devine
 * voit la progression d'un pilote.
 *
 * Personne ne pouvait le voir en relisant — le code avait l'air correct, et le
 * commentaire affirmait la garantie. C'est le motif du dépôt : la garde posée,
 * non armée, doublée d'un texte qui affirme qu'elle l'est.
 *
 * ---
 *
 * CE QUE CETTE GARDE VÉRIFIE
 *
 * Que le client ne fabrique plus le jeton et ne l'envoie plus. La base le
 * produit (`gen_random_bytes`, migration L31 du 02/08/2026) et le client le
 * REÇOIT.
 *
 * Elle est lexicale, et ne lit que le CODE — les commentaires ci-dessus citent
 * `Math.random` pour garder la mémoire du défaut, et les effacer pour satisfaire
 * un test reviendrait à effacer la raison de la correction.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SERVICE = join(__dirname, '..', 'sharesService.ts');

/** Le code seul, commentaires retirés. */
function codeSeul(chemin: string): string {
  const sansBlocs = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  return sansBlocs
    .split('\n')
    .map((ligne) => {
      const i = ligne.indexOf('//');
      if (i < 0) return ligne;
      if (i > 0 && ligne[i - 1] === ':') return ligne;
      return ligne.slice(0, i);
    })
    .join('\n');
}

describe('le jeton de partage vient de la base', () => {
  const code = codeSeul(SERVICE);

  it('le client ne fabrique aucun jeton', () => {
    expect(code).not.toContain('generateShareToken');
    expect(code).not.toContain('Math.random');
  });

  it('le client ne PRÉTEND plus s’appuyer sur une entropie qu’il n’a pas', () => {
    // `crypto.getRandomValues` n'existe pas sur cet appareil. Le réintroduire
    // sans le paquet qui le fournit ramènerait le repli silencieux.
    expect(code).not.toContain('getRandomValues');
  });

  it('l’insertion n’envoie pas de jeton — la base le fournit', () => {
    // Envoyer une valeur empêcherait la valeur PAR DÉFAUT de s'appliquer : le
    // correctif serait annulé sans qu'aucune erreur ne se produise.
    //
    // ON VISE L'OBJET INSÉRÉ, pas le fichier entier. Une première version
    // cherchait `share_token:` partout et mordait sur la DÉCLARATION DE TYPE de
    // la ligne lue (`share_token: string;`) — qui n'est pas une écriture. Une
    // garde qui accuse le mauvais endroit se fait désarmer par exaspération.
    const debut = code.indexOf('.insert({');
    expect(debut).toBeGreaterThan(-1);
    const objetInsere = code.slice(debut, code.indexOf('})', debut));
    expect(objetInsere).not.toContain('share_token');
  });

  it('le jeton est bien relu après insertion', () => {
    // Sans lui dans le `select`, `shareUrlFor` recevrait `undefined` et
    // produirait une URL sans secret.
    expect(code).toContain('share_token');
  });

  it('aucun paquet du projet ne fournit getRandomValues — la raison du choix', () => {
    // Si l'un d'eux était ajouté un jour, cette assertion tomberait et il
    // faudrait rouvrir la décision en connaissance de cause, plutôt que de
    // remettre une fabrication cliente par habitude.
    const pkg = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    for (const fournisseur of [
      'react-native-get-random-values',
      'expo-crypto',
      'expo-standard-web-crypto',
      'react-native-quick-crypto',
    ]) {
      expect(deps).not.toContain(fournisseur);
    }
  });
});
