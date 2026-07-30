/**
 * GARDE DE SOURCE — tout lien de partage doit expirer.
 *
 * ---
 *
 * POURQUOI UNE GARDE SUR LE CODE SOURCE, ET PAS UN TEST DE COMPORTEMENT
 *
 * `sharesService.createShare` ne pose `expires_at` que si `expiresInDays` lui
 * est fourni (`sharesService.ts` : `const expiresAt = opts.expiresInDays ? … :
 * null`). L'oubli ne casse rien, ne lève rien, ne se voit pas : il produit un
 * lien public **qui n'expire jamais**.
 *
 * C'est exactement arrivé deux fois. `app/(app2)/club/galerie.tsx` appelait
 * `createShare({ scope })` et `app/(pro)/partage.tsx` appelait
 * `createShare({ scope, includedMetrics })` — les deux sans durée. Aucun test
 * de comportement n'aurait pu le voir : le service fait ce qu'on lui demande.
 *
 * Une garde lexicale a d'abord été posée : lire les appels réels et exiger que
 * chacun NOMME une durée. Elle était insuffisante, et la revue adversariale du
 * 29/07 l'a montré — `expiresInDays: duree ?? undefined` la franchit tout en
 * produisant le lien éternel qu'elle prétend interdire.
 *
 * La vraie garde est donc le TYPE : `createShare` exige désormais
 * `expiresInDays: number` dans sa signature, et refuse à l'exécution toute
 * valeur nulle ou négative. Ce fichier ne fait plus que veiller sur la forme
 * des appels — un filet, pas la barrière.
 *
 * ---
 *
 * CE QU'ELLE NE PROUVE PAS
 *
 * Qu'aucun lien sans expiration n'existe en base. La garde est lexicale : elle
 * empêche d'en créer de nouveaux, elle ne répare pas les anciens.
 *
 * État relevé en production le 29/07/2026 : **un seul lien existe, et il porte
 * une expiration** (`expires_at` non nul, `included_metrics` non vide). Les deux
 * appels fautifs vivaient dans le code sans avoir jamais produit de ligne
 * ouverte — le défaut était réel, son dégât nul. Rien à réparer.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..', '..');

function fichiersSources(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree === '__tests__') continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      fichiersSources(chemin, acc);
    } else if (/\.tsx?$/.test(entree)) {
      acc.push(chemin);
    }
  }
  return acc;
}

/**
 * Retire commentaires de bloc et de ligne.
 *
 * Sans cela, la garde se déclenche sur sa propre documentation : le commentaire
 * de `galerie.tsx` qui EXPLIQUE l'ancien appel fautif contient littéralement
 * `createShare({ scope })`. Une garde qui accuse la prose décrivant le défaut
 * est une garde qu'on finit par désarmer.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Appels à `createShare(` hors du service lui-même, avec leur argument objet.
 * On lit jusqu'à l'accolade fermante en comptant la profondeur — un
 * `.slice(0, 200)` couperait un appel formaté sur plusieurs lignes.
 */
function appelsCreateShare(source: string): string[] {
  const appels: string[] = [];
  const motif = /createShare\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(source)) !== null) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    while (i < source.length && profondeur > 0) {
      if (source[i] === '{') profondeur++;
      else if (source[i] === '}') profondeur--;
      i++;
    }
    appels.push(source.slice(m.index, i));
  }
  return appels;
}

describe('garde — aucun lien de partage sans expiration', () => {
  const fichiers = [
    ...fichiersSources(join(RACINE, 'app')),
    ...fichiersSources(join(RACINE, 'src')),
  ].filter((f) => !f.endsWith(join('services', 'sharesService.ts')));

  it('chaque appel à createShare nomme expiresInDays', () => {
    const fautifs: string[] = [];

    for (const fichier of fichiers) {
      const source = sansCommentaires(readFileSync(fichier, 'utf8'));
      if (!source.includes('createShare')) continue;
      for (const appel of appelsCreateShare(source)) {
        if (!appel.includes('expiresInDays')) {
          fautifs.push(`${fichier.slice(RACINE.length + 1)} — ${appel.replace(/\s+/g, ' ')}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('la garde sait détecter un appel fautif', () => {
    // Sans ce contrôle, une expression régulière cassée rendrait le test
    // ci-dessus vert sur un dépôt entièrement fautif.
    const faux = "createShare({ scope, includedMetrics: ['best_lap'] })";
    const appels = appelsCreateShare(faux);
    expect(appels).toHaveLength(1);
    expect(appels[0].includes('expiresInDays')).toBe(false);
  });

  it('la garde ignore un appel cité dans un commentaire', () => {
    // Cas réel : le commentaire de `galerie.tsx` cite l'ancien appel fautif
    // pour expliquer ce qui a été corrigé. L'accuser désarmerait la garde.
    const avecCommentaire = [
      '/**',
      ' * Avant ce portage, la galerie appelait createShare({ scope }) sans durée.',
      ' */',
      'createShare({ scope, expiresInDays: 7, includedMetrics: m })',
    ].join('\n');
    const appels = appelsCreateShare(sansCommentaires(avecCommentaire));
    expect(appels).toHaveLength(1);
    expect(appels[0].includes('expiresInDays')).toBe(true);
  });

  it('aucun appel ne contourne la durée par un repli sur undefined', () => {
    // C'est le cas qui a franchi la première version de cette garde :
    // `expiresInDays: duration ?? undefined` NOMME bien la clé, et produit
    // pourtant `expires_at = null`. Le type l'interdit maintenant ; ce contrôle
    // le rappelle à qui lirait ce fichier plutôt que la signature.
    const contournements: string[] = [];
    for (const fichier of fichiers) {
      const source = sansCommentaires(readFileSync(fichier, 'utf8'));
      if (!source.includes('createShare')) continue;
      for (const appel of appelsCreateShare(source)) {
        if (/expiresInDays\s*:\s*[^,}]*\?\?\s*undefined/.test(appel)) {
          contournements.push(fichier.slice(RACINE.length + 1));
        }
      }
    }
    expect(contournements).toEqual([]);
  });

  it('la garde lit un appel étalé sur plusieurs lignes', () => {
    const vrai = [
      'createShare({',
      '  scope: shareScope,',
      '  expiresInDays: shareDays,',
      '  includedMetrics: sanitizeIncludedMetrics(shareMetrics),',
      '})',
    ].join('\n');
    const appels = appelsCreateShare(vrai);
    expect(appels).toHaveLength(1);
    expect(appels[0].includes('expiresInDays')).toBe(true);
  });
});
