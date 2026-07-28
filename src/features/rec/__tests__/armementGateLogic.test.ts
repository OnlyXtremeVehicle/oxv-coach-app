/**
 * On n'arme pas une capture sans boîtier — jalon 3, phase 4bis.
 *
 * ---
 *
 * CE QUE CES TESTS EMPÊCHENT DE REVENIR
 *
 * `placement.tsx` passait `disabled={starting}` — un garde de ré-entrance, rien
 * de plus. L'état de la liaison Bluetooth n'était consulté nulle part.
 *
 * Boîtier éteint, hors de portée, ou Bluetooth coupé : le pilote maintenait six
 * cents millisecondes, sentait l'haptique, voyait la jauge se remplir, arrivait
 * sur `roulage`, et roulait sa séance entière sans rien enregistrer.
 *
 * Aucune erreur n'aurait été levée. Un flux BLE qui ne vient jamais n'est pas
 * une panne, c'est un silence — et la séance vide se serait découverte au bilan,
 * c'est-à-dire trop tard.
 */

import { libelleAction, verdictArmement } from '../armementGateLogic';
import type { BleStatus } from '@/types/telemetry';

/** Toutes les valeurs du type, pour qu'aucune n'échappe au banc. */
const TOUS: BleStatus[] = ['idle', 'scanning', 'connecting', 'connected', 'disconnected', 'error'];

describe('la voie normale', () => {
  it('un boîtier connecté ouvre l’armement', () => {
    expect(verdictArmement('connected', false)).toEqual({ peutArmer: true, action: 'armer' });
  });
});

describe('le défaut d’origine, statut par statut', () => {
  it.each(TOUS.filter((s) => s !== 'connected'))('« %s » refuse l’armement', (statut) => {
    expect(verdictArmement(statut, false).peutArmer).toBe(false);
  });

  it('chaque refus dit pourquoi', () => {
    for (const s of TOUS.filter((x) => x !== 'connected')) {
      const v = verdictArmement(s, false);
      expect(typeof v.raison).toBe('string');
      expect(v.raison!.length).toBeGreaterThan(0);
    }
  });
});

describe('refuser n’est pas bloquer la journée', () => {
  // Une panne route vers le diagnostic, où la sortie existe.
  it.each(['disconnected', 'error', 'idle'] as const)('« %s » envoie au diagnostic', (statut) => {
    const v = verdictArmement(statut, false);
    expect(v.action).toBe('diagnostic');
    expect(libelleAction(v.action)).toBe('Régler l’appairage');
  });

  /**
   * Une connexion en cours n'est PAS une panne. Proposer une action pendant
   * qu'elle s'établit inviterait à l'interrompre — et l'interrompre au paddock,
   * c'est repartir pour un cycle de recherche.
   */
  it.each(['connecting', 'scanning'] as const)('« %s » demande seulement d’attendre', (statut) => {
    const v = verdictArmement(statut, false);
    expect(v.action).toBe('patienter');
    expect(libelleAction(v.action)).toBeNull();
  });
});

describe('rouler sans mesure — un choix, jamais une déduction', () => {
  it('passe outre le statut quand le pilote l’a décidé', () => {
    for (const s of TOUS) {
      expect(verdictArmement(s, false, true).peutArmer).toBe(true);
    }
  });

  /**
   * LE TEST QUI DÉFEND LA RÈGLE.
   *
   * Sans le drapeau explicite, aucun statut d'échec ne doit ouvrir l'armement.
   * Déduire « il veut rouler sans mesure » d'une panne transformerait un
   * incident matériel en décision du pilote, ce qu'il n'est pas.
   */
  it('ne se déduit JAMAIS d’un échec', () => {
    for (const s of TOUS.filter((x) => x !== 'connected')) {
      expect(verdictArmement(s, false).peutArmer).toBe(false);
    }
  });
});

describe('la ré-entrance prime sur tout', () => {
  // Y compris sur un boîtier connecté : un second appui ne doit pas lancer une
  // seconde session.
  it.each(TOUS)('« %s » avec un démarrage en cours refuse', (statut) => {
    const v = verdictArmement(statut, true);
    expect(v.peutArmer).toBe(false);
    expect(v.action).toBe('patienter');
  });

  it('même le choix « sans mesure » ne passe pas outre', () => {
    expect(verdictArmement('connected', true, true).peutArmer).toBe(false);
  });
});

describe('ton OXV', () => {
  const raisons = TOUS.map((s) => verdictArmement(s, false).raison).filter(
    (r): r is string => typeof r === 'string'
  );

  it('aucune prescription, aucun emoji, aucun tutoiement', () => {
    for (const r of raisons) {
      expect(r).not.toMatch(/vous devez|il faut|veuillez|rallumez|vérifiez/i);
      expect(r).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(r).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });

  it('aucun mot proscrit', () => {
    for (const r of raisons) {
      expect(r).not.toMatch(/\blimite\b/i);
    }
  });
});
