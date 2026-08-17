/**
 * La sortie d'écurie : qui peut organiser, qui reste à convier, qui doit
 * répondre — et le fait qu'aucun chiffre de performance n'entre ici.
 */

import type { Convoy } from '@/services/v2/convoysService';
import {
  aConvier,
  comptePresents,
  doitRepondre,
  membresAvecStatut,
  monStatut,
  peutOrganiser,
  resumeSortie,
} from '../sortieLogic';

const MEMBRES = [
  { userId: 'cap', nom: 'Gabin' },
  { userId: 'a', nom: 'Alix' },
  { userId: 'b', nom: 'Bruno' },
];

function convoi(parts: { userId: string; statut: 'invite' | 'present' | 'decline' }[]): Convoy {
  return {
    id: 'c1',
    sessionId: 's1',
    routeId: null,
    crewId: 'e1',
    restaurantId: null,
    createdBy: 'cap',
    meetingPoint: null,
    rdvAt: null,
    createdAt: '2026-08-17T10:00:00Z',
    participants: parts.map((p) => ({ ...p, joinedAt: '2026-08-17T10:00:00Z' })),
  };
}

describe('membresAvecStatut', () => {
  it('sans sortie, personne n’a de statut', () => {
    expect(membresAvecStatut(MEMBRES, null).map((m) => m.statut)).toEqual([null, null, null]);
  });

  it('reporte le statut de chacun', () => {
    const m = membresAvecStatut(
      MEMBRES,
      convoi([
        { userId: 'a', statut: 'present' },
        { userId: 'b', statut: 'decline' },
      ])
    );
    expect(m.map((x) => x.statut)).toEqual([null, 'present', 'decline']);
  });

  /** Regrouper les « décliné » en bas dresserait une liste de mauvais élèves. */
  it('conserve l’ordre reçu — jamais un tri par statut', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'a', statut: 'decline' }]));
    expect(m.map((x) => x.userId)).toEqual(['cap', 'a', 'b']);
  });

  it('inclut le capitaine — il sort avec son écurie', () => {
    expect(membresAvecStatut(MEMBRES, null).some((m) => m.userId === 'cap')).toBe(true);
  });
});

describe('aConvier', () => {
  it('propose ceux qui n’ont jamais été conviés', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'a', statut: 'present' }]));
    expect(aConvier(m).map((x) => x.userId)).toEqual(['cap', 'b']);
  });

  /** Le réinviter n'ajouterait rien et ferait croire que le geste n'a pas pris. */
  it('ne repropose pas un pilote déjà convié sans réponse', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'a', statut: 'invite' }]));
    expect(aConvier(m).map((x) => x.userId)).not.toContain('a');
  });

  /** Un refus sur une sortie n'est pas un refus pour toujours. */
  it('repropose un pilote qui a décliné', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'b', statut: 'decline' }]));
    expect(aConvier(m).map((x) => x.userId)).toContain('b');
  });
});

describe('peutOrganiser — reproduit la politique RESTRICTIVE du serveur', () => {
  const roles = [
    { userId: 'cap', role: 'captain' },
    { userId: 'a', role: 'member' },
  ];

  it('le capitaine, oui', () => {
    expect(peutOrganiser(roles, 'cap')).toBe(true);
  });

  it('un membre ordinaire, non', () => {
    expect(peutOrganiser(roles, 'a')).toBe(false);
  });

  /** Dans le doute, on n'affiche pas le geste. */
  it('sans lecteur identifié, non', () => {
    expect(peutOrganiser(roles, null)).toBe(false);
    expect(peutOrganiser([], 'cap')).toBe(false);
  });
});

describe('monStatut / doitRepondre', () => {
  it('rend le statut du lecteur, ou null', () => {
    const c = convoi([{ userId: 'a', statut: 'invite' }]);
    expect(monStatut(c, 'a')).toBe('invite');
    expect(monStatut(c, 'b')).toBeNull();
    expect(monStatut(null, 'a')).toBeNull();
    expect(monStatut(c, null)).toBeNull();
  });

  it('on répond quand on est convié sans avoir tranché', () => {
    expect(doitRepondre(convoi([{ userId: 'a', statut: 'invite' }]), 'a')).toBe(true);
  });

  /** Lui remontrer deux boutons lui ferait croire que sa réponse s'est perdue. */
  it('on ne redemande pas à qui a déjà répondu', () => {
    expect(doitRepondre(convoi([{ userId: 'a', statut: 'present' }]), 'a')).toBe(false);
    expect(doitRepondre(convoi([{ userId: 'a', statut: 'decline' }]), 'a')).toBe(false);
  });

  it('on ne demande rien à qui n’est pas convié', () => {
    expect(doitRepondre(convoi([]), 'a')).toBe(false);
  });
});

describe('resumeSortie — des faits, aucun chrono', () => {
  it('compte les présents, et eux seuls', () => {
    const m = membresAvecStatut(
      MEMBRES,
      convoi([
        { userId: 'a', statut: 'present' },
        { userId: 'b', statut: 'invite' },
      ])
    );
    expect(comptePresents(m)).toBe(1);
    expect(resumeSortie(m, false)).toBe('1 pilote');
  });

  it('dit l’absence de réponse plutôt qu’un zéro', () => {
    expect(resumeSortie(membresAvecStatut(MEMBRES, null), false)).toBe(
      'Personne n’a encore répondu'
    );
  });

  it('signale l’étape sans la chiffrer', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'a', statut: 'present' }]));
    expect(resumeSortie(m, true)).toContain('une étape en route');
  });

  /** La garde du domaine : aucun chiffre de performance ne sort d'ici. */
  it('ne produit ni durée, ni distance, ni vitesse', () => {
    const m = membresAvecStatut(MEMBRES, convoi([{ userId: 'a', statut: 'present' }]));
    for (const avec of [true, false]) {
      expect(resumeSortie(m, avec)).not.toMatch(/km|min|h\b|km\/h/i);
    }
  });
});
