/**
 * DESTINATAIRES DE LA BIOMÉTRIE — un canal par coach (jalon 6, lot 27a-bis).
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * Celui du confrère. Avant ce lot, la biométrie voyageait sur le canal de
 * séance, partagé : on ne pouvait pas la réserver à certains coachs, et la seule
 * position tenable était de n'émettre que si TOUS étaient au niveau détaillé.
 *
 * Conséquence : un coach au niveau détaillé perdait le cardio de son pilote
 * parce qu'un confrère en lecture simple s'était connecté. La donnée la plus
 * sensible du produit était la seule à dépendre de qui d'autre regardait.
 *
 * `mélange` ci-dessous échouerait sur l'ancien code : il rendait une liste vide.
 *
 * ---
 *
 * CE QUE CES TESTS NE PROUVENT PAS
 *
 * Qu'un coach non retenu ne peut pas lire le canal d'un autre. Cette fonction
 * décide à qui l'on ENVOIE ; ce qui empêche de LIRE est la RLS
 * `realtime.messages` — appliquée en production le 01/08/2026, migration
 * `20260801140838_l27_bio_par_coach_realtime_policies`. Un test unitaire ne peut
 * rien en dire : il ne joint aucun canal.
 */

import { destinatairesBiometrie } from '@/services/v2/liveHealthGate';

const simple = { coachId: 'c-simple', detailed: false };
const detaille = { coachId: 'c-detaille', detailed: true };

describe('destinatairesBiometrie', () => {
  it('mélange — le coach détaillé reçoit MALGRÉ la présence d’un confrère en lecture simple', () => {
    const recus = destinatairesBiometrie([simple, detaille], true, true);

    // Le cœur du lot : l'un n'annule plus l'autre.
    expect(recus.map((c) => c.coachId)).toEqual(['c-detaille']);
  });

  it('ne retient jamais un coach en lecture simple', () => {
    expect(destinatairesBiometrie([simple], true, true)).toEqual([]);
  });

  it('retient tous les coachs détaillés, et eux seuls', () => {
    const autre = { coachId: 'c-2', detailed: true };
    const recus = destinatairesBiometrie([simple, detaille, autre], true, true);
    expect(recus.map((c) => c.coachId).sort()).toEqual(['c-2', 'c-detaille']);
  });

  describe('les deux verrous du pilote valent pour tout le monde', () => {
    it('sans consentement, personne — même un coach détaillé', () => {
      expect(destinatairesBiometrie([detaille], false, true)).toEqual([]);
    });

    it('flag serveur retiré, personne', () => {
      expect(destinatairesBiometrie([detaille], true, false)).toEqual([]);
    });
  });

  describe('fail-closed sur les entrées douteuses', () => {
    it('liste vide → personne', () => {
      expect(destinatairesBiometrie([], true, true)).toEqual([]);
    });

    it('un coach sans identifiant n’est pas un destinataire', () => {
      // Sans identifiant, il n'y a pas de topic où envoyer : le retenir
      // reviendrait à diffuser sur un canal indéterminé.
      const sansId = { coachId: '', detailed: true };
      expect(destinatairesBiometrie([sansId], true, true)).toEqual([]);
    });

    it('un `detailed` non booléen ne vaut pas accord', () => {
      // Frontière non typée : la ligne vient de la base, `level` peut être nul
      // ou inconnu. Seul un `true` STRICT ouvre.
      const flou = { coachId: 'c-flou', detailed: 'oui' } as unknown as {
        coachId: string;
        detailed: boolean;
      };
      expect(destinatairesBiometrie([flou], true, true)).toEqual([]);
    });

    it('des entrées nulles dans la liste ne font pas tomber la sélection', () => {
      const avecTrou = [null, detaille] as unknown as { coachId: string; detailed: boolean }[];
      expect(destinatairesBiometrie(avecTrou, true, true).map((c) => c.coachId)).toEqual([
        'c-detaille',
      ]);
    });
  });
});
