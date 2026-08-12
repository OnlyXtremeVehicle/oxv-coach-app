/**
 * Tests centralButtonLogic — décision pure du bouton central (Livrable 8) :
 * les 3 modes (rec / countdown / reserve) + frontières de dates, et le
 * masquage V2 de la TabBar sous /rec/<segment> (mécanisme du lot L2).
 * .ts pur, aucun rendu de composant.
 */

import {
  V2_HIDDEN_SEGMENTS,
  centralButtonRoute,
  countdownLabel,
  daysUntilTrackDay,
  decideCentralButton,
  isV2CaptureFlowPath,
} from '../centralButtonLogic';

/** Date ISO locale 'YYYY-MM-DD' d'un décalage en jours par rapport à `now`. */
function isoDayOffset(now: Date, offsetDays: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const NOW = new Date(2026, 6, 18, 14, 30); // 18 juillet 2026, 14 h 30 locale

describe('daysUntilTrackDay — jours locaux entiers', () => {
  it("aujourd'hui → 0, demain → 1, hier → -1", () => {
    expect(daysUntilTrackDay(isoDayOffset(NOW, 0), NOW)).toBe(0);
    expect(daysUntilTrackDay(isoDayOffset(NOW, 1), NOW)).toBe(1);
    expect(daysUntilTrackDay(isoDayOffset(NOW, -1), NOW)).toBe(-1);
  });

  it('frontière du soir : à 23 h 59, demain reste J-1 (minuit à minuit local)', () => {
    const lateEvening = new Date(2026, 6, 18, 23, 59);
    expect(daysUntilTrackDay('2026-07-19', lateEvening)).toBe(1);
    expect(daysUntilTrackDay('2026-07-18', lateEvening)).toBe(0);
  });

  it('frontière du matin : à 0 h 01, le jour même est J-0', () => {
    const earlyMorning = new Date(2026, 6, 18, 0, 1);
    expect(daysUntilTrackDay('2026-07-18', earlyMorning)).toBe(0);
  });

  it('horizon long : 14 jours comptés exactement', () => {
    expect(daysUntilTrackDay(isoDayOffset(NOW, 14), NOW)).toBe(14);
  });

  it('date illisible ou débordante → null (jamais un faux countdown)', () => {
    expect(daysUntilTrackDay('pas-une-date', NOW)).toBeNull();
    expect(daysUntilTrackDay('', NOW)).toBeNull();
    expect(daysUntilTrackDay('2026-02-31', NOW)).toBeNull(); // déborde en mars
    expect(daysUntilTrackDay('2026-13-01', NOW)).toBeNull();
  });

  it('tolère un timestamp complet (seule la date compte, prefix ISO)', () => {
    expect(daysUntilTrackDay('2026-07-19T08:00:00Z'.slice(0, 10), NOW)).toBe(1);
    expect(daysUntilTrackDay('2026-07-19T08:00:00+02:00', NOW)).toBe(1);
  });
});

describe('countdownLabel', () => {
  it("format mono 'J-x', plancher à J-0", () => {
    expect(countdownLabel(3)).toBe('J-3');
    expect(countdownLabel(0)).toBe('J-0');
    expect(countdownLabel(-2)).toBe('J-0');
    expect(countdownLabel(120)).toBe('J-120');
  });
});

describe('decideCentralButton — les 3 modes', () => {
  it('rec : capture en cours, prime sur tout le reste', () => {
    expect(
      decideCentralButton({
        recordingActive: true,
        nextDayDate: isoDayOffset(NOW, 3),
        now: NOW,
      })
    ).toEqual({ mode: 'rec' });
  });

  it('countdown : journée à venir → J-x', () => {
    expect(
      decideCentralButton({ recordingActive: false, nextDayDate: isoDayOffset(NOW, 3), now: NOW })
    ).toEqual({ mode: 'countdown', label: 'J-3' });
  });

  it('countdown frontière : jour J → J-0', () => {
    expect(
      decideCentralButton({ recordingActive: false, nextDayDate: isoDayOffset(NOW, 0), now: NOW })
    ).toEqual({ mode: 'countdown', label: 'J-0' });
  });

  it('reserve : aucune journée', () => {
    expect(decideCentralButton({ recordingActive: false, nextDayDate: null, now: NOW })).toEqual({
      mode: 'reserve',
    });
  });

  it('reserve : journée passée (jamais un countdown négatif)', () => {
    expect(
      decideCentralButton({ recordingActive: false, nextDayDate: isoDayOffset(NOW, -1), now: NOW })
    ).toEqual({ mode: 'reserve' });
  });

  it('reserve : date illisible (donnée douteuse = pas de countdown inventé)', () => {
    expect(
      decideCentralButton({ recordingActive: false, nextDayDate: 'invalide', now: NOW })
    ).toEqual({ mode: 'reserve' });
  });
});

describe('isV2CaptureFlowPath — masquage de la TabBar sous /rec/<segment>', () => {
  it('chaque segment listé masque la barre', () => {
    for (const segment of V2_HIDDEN_SEGMENTS) {
      expect(isV2CaptureFlowPath(`/rec/${segment}`)).toBe(true);
    }
  });

  it('les sous-chemins d’un segment masqué masquent aussi', () => {
    expect(isV2CaptureFlowPath('/rec/roulage/detail')).toBe(true);
  });

  it("'/rec' seul reste visible (amorce, pas le flux immersif)", () => {
    expect(isV2CaptureFlowPath('/rec')).toBe(false);
    expect(isV2CaptureFlowPath('/rec/')).toBe(false);
  });

  it('les portes et les segments inconnus restent visibles', () => {
    expect(isV2CaptureFlowPath('/')).toBe(false);
    expect(isV2CaptureFlowPath('/data')).toBe(false);
    expect(isV2CaptureFlowPath('/rec/inconnu')).toBe(false);
    // Segment v1 hors /rec : couvert par shouldShowTabBar (appMap), pas ici.
    expect(isV2CaptureFlowPath('/roulage')).toBe(false);
  });
});

describe('la destination — le bouton central ouvre le Pass', () => {
  /**
   * Il menait à la porte Club en mode « réserver » : un hub de sept enfants,
   * où le pilote devait trouver lui-même celui qu'il cherchait. Le Pass répond
   * aux deux questions — ce qu'il possède, et le chemin quand il n'a rien.
   */
  it('réserver et compte à rebours mènent au Pass', () => {
    expect(centralButtonRoute('reserve')).toBe('/(app2)/club/pass');
    expect(centralButtonRoute('countdown')).toBe('/(app2)/club/pass');
  });

  it('une capture en cours ramène à la capture, jamais à un document', () => {
    expect(centralButtonRoute('rec')).toBe('/(app2)/rec');
  });
});
