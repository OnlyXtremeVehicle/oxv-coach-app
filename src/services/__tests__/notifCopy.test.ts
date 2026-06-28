/**
 * Verrou doctrinal de la copie des notifications (PR-43).
 *
 * Les notifications sont l'une des rares prises de parole de l'app hors écran :
 * elles doivent rester FACTUELLES, jamais prescriptives. Ce test bloque toute
 * dérive future (verbe de pilotage, jugement, tutoiement, emoji).
 */

import { isDoctrineSafe } from '../aiSafetyFilter';
import { NOTIF_COPY } from '../notifCopy';

// Plages emoji courantes (pictogrammes, symboles divers, dingbats, gear, étincelle).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2699}\u{2728}\u{2B50}]/u;

describe('notifCopy — copie de notification factuelle (PR-43)', () => {
  for (const [key, c] of Object.entries(NOTIF_COPY)) {
    it(`${key} : titre et corps sans tournure prescriptive`, () => {
      expect(isDoctrineSafe(c.title)).toBe(true);
      expect(isDoctrineSafe(c.body)).toBe(true);
    });

    it(`${key} : aucun emoji`, () => {
      expect(EMOJI.test(c.title)).toBe(false);
      expect(EMOJI.test(c.body)).toBe(false);
    });

    it(`${key} : vouvoiement (pas de tutoiement)`, () => {
      const text = `${c.title} ${c.body}`.toLowerCase();
      expect(/\btu\b|\bton\b|\btes\b|\btoi\b/.test(text)).toBe(false);
    });
  }
});
