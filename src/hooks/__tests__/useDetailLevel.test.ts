/**
 * Tests des helpers purs du hook useDetailLevel.
 *
 * On teste les fonctions pures exportées (sans monter de composant)
 * pour vérifier la logique simple/détaillé selon le rôle.
 */

import { canToggleForRole, defaultLevelForRole } from '@/hooks/detailLevelLogic';

describe('defaultLevelForRole', () => {
  it('pilote → simple', () => {
    expect(defaultLevelForRole('pilot')).toBe('simple');
  });

  it('coach → detailed', () => {
    expect(defaultLevelForRole('coach')).toBe('detailed');
  });

  /**
   * L'ADMINISTRATEUR EST UN PILOTE SUR LES ÉCRANS PILOTE.
   *
   * Ce test attendait `detailed`. Il figeait un défaut : sur `settings`,
   * `stats`, `tours` et `replay`, un compte administrateur recevait les chiffres
   * bruts ET perdait le commutateur — donc aucun retour vers la lecture simple,
   * c'est-à-dire vers le principe 5.
   *
   * Le besoin professionnel des chiffres exacts est celui du coach qui lit la
   * séance d'un autre. Pas celui de l'administrateur qui lit la sienne.
   */
  it('admin → simple, comme un pilote', () => {
    expect(defaultLevelForRole('admin')).toBe('simple');
  });

  it('partenaire et pilote pro → simple', () => {
    expect(defaultLevelForRole('partner')).toBe('simple');
    expect(defaultLevelForRole('pro_pilot')).toBe('simple');
  });

  it('null / undefined → simple (fallback pilote)', () => {
    expect(defaultLevelForRole(null)).toBe('simple');
    expect(defaultLevelForRole(undefined)).toBe('simple');
  });
});

describe('canToggleForRole', () => {
  it('pilote peut toggler', () => {
    expect(canToggleForRole('pilot')).toBe(true);
  });

  it('coach ne peut pas toggler', () => {
    expect(canToggleForRole('coach')).toBe(false);
  });

  // Le commutateur n'est pas grisé quand il est refusé : il n'est plus dessiné.
  // Le retirer à l'administrateur revenait à lui interdire la lecture simple.
  it('admin peut toggler', () => {
    expect(canToggleForRole('admin')).toBe(true);
  });

  it('seul le coach en est privé', () => {
    for (const r of ['pilot', 'admin', 'partner', 'pro_pilot'] as const) {
      expect(canToggleForRole(r)).toBe(true);
    }
    expect(canToggleForRole('coach')).toBe(false);
  });

  it('null / undefined peut toggler (fallback pilote)', () => {
    expect(canToggleForRole(null)).toBe(true);
    expect(canToggleForRole(undefined)).toBe(true);
  });
});
