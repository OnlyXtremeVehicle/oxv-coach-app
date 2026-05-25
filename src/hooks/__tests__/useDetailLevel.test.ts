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

  it('admin → detailed', () => {
    expect(defaultLevelForRole('admin')).toBe('detailed');
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

  it('admin ne peut pas toggler', () => {
    expect(canToggleForRole('admin')).toBe(false);
  });

  it('null / undefined peut toggler (fallback pilote)', () => {
    expect(canToggleForRole(null)).toBe(true);
    expect(canToggleForRole(undefined)).toBe(true);
  });
});
