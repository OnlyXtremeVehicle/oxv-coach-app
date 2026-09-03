import { readFileSync } from 'fs';
import { join } from 'path';

import { SHAREABLE_METRICS, sanitizeIncludedMetrics, shareUrlFor } from '../sharesService';

// Le service importe le client Supabase (throw sans env) ; on le mocke.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('sanitizeIncludedMetrics (liste blanche RGPD)', () => {
  it('ne garde que des clés connues, sans doublon', () => {
    expect(sanitizeIncludedMetrics(['best_lap', 'inconnu', 'regularity', 'best_lap'])).toEqual([
      'best_lap',
      'regularity',
    ]);
  });

  it('liste vide → vide (défaut = rien de partagé)', () => {
    expect(sanitizeIncludedMetrics([])).toEqual([]);
  });

  it('rejette toute clé inconnue (jamais plus que la liste blanche)', () => {
    expect(sanitizeIncludedMetrics(['n_importe_quoi', 'service_role'])).toEqual([]);
  });
});

describe('SHAREABLE_METRICS', () => {
  it('clés uniques et non vides', () => {
    const keys = SHAREABLE_METRICS.map((m) => m.key);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/**
 * LE LIEN QUE LE PILOTE ENVOIE À QUELQU'UN D'AUTRE.
 *
 * Il n'avait AUCUN test. C'est pourtant la seule chose de ce service qui sort de
 * l'application et atterrit chez un tiers : si elle est fausse, personne dans le
 * dépôt ne s'en aperçoit — c'est le destinataire qui découvre une page vide.
 */
describe('shareUrlFor', () => {
  it('vise www, jamais l’apex', () => {
    // `oxvehicle.fr` répond 307 vers `www` (mesuré le 02/08/2026). Le lien part
    // dans une application tierce dont on ne maîtrise pas la politique de
    // redirection : on ne lui laisse pas ce choix.
    expect(shareUrlFor('abc123')).toBe('https://www.oxvehicle.fr/share/abc123');
  });

  it('encode le segment plutôt que de parier sur sa forme', () => {
    // Le jeton est produit en base64url et ne devrait rien contenir à échapper.
    // « Ne devrait pas » n'est pas une garantie : une URL se construit en
    // encodant ses segments.
    expect(shareUrlFor('a/b?c#d')).toBe('https://www.oxvehicle.fr/share/a%2Fb%3Fc%23d');
  });

  it('ne produit jamais de double slash', () => {
    const url = shareUrlFor('jeton');
    expect(url.slice('https://'.length)).not.toContain('//');
  });
});

/**
 * LA LISTE BLANCHE S'APPLIQUE À LA FRONTIÈRE, PAS CHEZ L'APPELANT.
 *
 * Mesuré le 03/09/2026, et c'est ce qui a motivé ce bloc : les deux écrans qui
 * créent un lien ne se comportent PAS pareil.
 *
 *   `app/(app2)/club/galerie.tsx:220`   passe `sanitizeIncludedMetrics(...)`
 *   `app/(pro)/partage.tsx:96`          passe `[...metrics]`, brut
 *
 * Le second n'expose rien aujourd'hui : ses cases à cocher itèrent
 * `SHAREABLE_METRICS`, donc son ensemble ne peut contenir que des clés valides,
 * et `createShare` filtre de toute façon. Deux couches, aucune faille.
 *
 * Mais les trois gardes de partage — liste blanche, provenance du jeton,
 * expiration — resteraient VERTES si `createShare` cessait de filtrer et se
 * mettait à faire confiance à `opts.includedMetrics`. Le filtre serait alors
 * porté par un seul appelant sur deux, et rien ne le dirait.
 *
 * Ce test-ci tient ce point précis, et lui seul.
 */
describe('createShare filtre lui-même, sans faire confiance à son appelant', () => {
  const SOURCE = readFileSync(join(__dirname, '..', 'sharesService.ts'), 'utf8');

  it('l’insertion passe par la liste blanche, jamais par la valeur reçue', () => {
    expect(SOURCE).toMatch(/included_metrics:\s*sanitizeIncludedMetrics\(/);
    // Et surtout : jamais la valeur brute de l'appelant.
    expect(SOURCE).not.toMatch(/included_metrics:\s*opts\.includedMetrics/);
  });

  /**
   * LE CONTRE-TEST. Sans lui, les deux assertions ci-dessus passeraient aussi
   * sur un fichier où la ligne aurait simplement disparu.
   */
  it('la garde sait reconnaître un contournement', () => {
    const fautif = `included_metrics: opts.includedMetrics ?? [],`;
    expect(/included_metrics:\s*sanitizeIncludedMetrics\(/.test(fautif)).toBe(false);
    expect(/included_metrics:\s*opts\.includedMetrics/.test(fautif)).toBe(true);
  });
});
