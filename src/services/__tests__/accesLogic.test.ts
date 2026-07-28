/**
 * L'application doit répondre comme la base — jalon 2, phase 2, lot 9.
 *
 * ---
 *
 * LE DÉFAUT QUE CES TESTS FIGENT
 *
 * `public.is_admin()` — la fonction qu'appellent 167 policies sur 93 tables —
 * dit `role = 'admin' OR is_admin = true`. Deux endroits de l'application
 * lisaient **la colonne seule** : le sélecteur d'espace et le garde du layout
 * admin.
 *
 * Constaté en production le 28/07/2026 : `julie.huet.perso@gmail.com` et
 * `bitaube.p@gmail.com` portent `role = 'admin'` avec `is_admin = false`. La
 * base leur accorde tout, l'application ne leur montrait pas la porte et les
 * refoulait si elles l'atteignaient autrement.
 *
 * Rien ne levait d'erreur : l'application était simplement **plus restrictive
 * que la base**. Un excès de sévérité ne casse rien de visible. C'est pour cela
 * qu'il a duré.
 *
 * Le cas inverse est tout aussi réel — `administration@oxvehicle.fr` porte
 * `role = 'pilot'` avec `is_admin = true`, et administre par cette seule
 * colonne. Les deux branches du `OR` servent, chacune à un compte vivant.
 */

import { estAdmin, estCoach, peutChangerEspace } from '../accesLogic';
import type { ProfilAcces } from '../accesLogic';

/** Les trois formes réellement présentes en base le 28/07/2026. */
const ADMIN_PAR_ROLE: ProfilAcces = { role: 'admin', is_admin: false };
const ADMIN_PAR_COLONNE: ProfilAcces = { role: 'pilot', is_admin: true };
const PILOTE: ProfilAcces = { role: 'pilot', is_admin: false };
const PARTENAIRE: ProfilAcces = { role: 'partner', is_admin: false };
const COACH: ProfilAcces = { role: 'coach', is_admin: false };

describe('estAdmin — miroir exact de public.is_admin()', () => {
  // La branche qui manquait. Deux comptes de production en dépendent.
  it('admet un compte dont le RÔLE est admin, colonne à false', () => {
    expect(estAdmin(ADMIN_PAR_ROLE)).toBe(true);
  });

  // La branche historique. `administration@oxvehicle.fr` en dépend, et un
  // miroir role→is_admin la lui retirerait — voir la proposition du lot 8.
  it('admet un compte dont la COLONNE est vraie, rôle pilote', () => {
    expect(estAdmin(ADMIN_PAR_COLONNE)).toBe(true);
  });

  it('refuse un pilote ordinaire', () => {
    expect(estAdmin(PILOTE)).toBe(false);
  });

  it('refuse un partenaire et un coach', () => {
    expect(estAdmin(PARTENAIRE)).toBe(false);
    expect(estAdmin(COACH)).toBe(false);
  });

  // Un profil absent n'est pas un profil permissif. Le chargement du profil est
  // asynchrone : pendant ce temps la réponse doit être « non ».
  it('refuse en l’absence de profil', () => {
    expect(estAdmin(null)).toBe(false);
    expect(estAdmin(undefined)).toBe(false);
  });

  /**
   * LE TEST QUI DÉFEND LA RÈGLE, PAS LE CODE.
   *
   * Un `AND` passerait tous les cas ci-dessus sauf ceux-ci. C'est exactement
   * l'erreur d'origine, sous une autre forme : une condition plus sévère que
   * celle de la base.
   */
  it('c’est un OU, jamais un ET', () => {
    expect(estAdmin({ role: 'admin', is_admin: false })).toBe(true);
    expect(estAdmin({ role: 'pilot', is_admin: true })).toBe(true);
  });
});

describe('estCoach — miroir de public.is_coach()', () => {
  it('n’admet que le rôle coach, sans repli sur is_admin', () => {
    expect(estCoach(COACH)).toBe(true);
    expect(estCoach(ADMIN_PAR_COLONNE)).toBe(false);
    expect(estCoach(ADMIN_PAR_ROLE)).toBe(false);
    expect(estCoach(null)).toBe(false);
  });
});

describe('peutChangerEspace — le sélecteur d’espace', () => {
  it('suit exactement estAdmin', () => {
    for (const p of [ADMIN_PAR_ROLE, ADMIN_PAR_COLONNE, PILOTE, PARTENAIRE, COACH, null]) {
      expect(peutChangerEspace(p)).toBe(estAdmin(p));
    }
  });
});
