/**
 * Tests du catalogue d'événements produit (KPI §27).
 * Vérifie les noms d'événements + l'absence de PII dans les propriétés.
 */

import { OxvEvent } from '../analyticsEvents';
import { trackEvent } from '../analyticsService';

jest.mock('../analyticsService', () => ({ trackEvent: jest.fn() }));
const mockTrack = trackEvent as jest.MockedFunction<typeof trackEvent>;

describe('analyticsEvents — catalogue KPI §27', () => {
  beforeEach(() => mockTrack.mockClear());

  it('onboardingTermine', () => {
    OxvEvent.onboardingTermine();
    expect(mockTrack).toHaveBeenCalledWith('onboarding_termine');
  });

  it('captureReussie porte source + segments (catégoriels)', () => {
    OxvEvent.captureReussie({ source: 'ubx_local', segments: 7 });
    expect(mockTrack).toHaveBeenCalledWith('capture_reussie', { source: 'ubx_local', segments: 7 });
  });

  it('captureEchouee', () => {
    OxvEvent.captureEchouee('none');
    expect(mockTrack).toHaveBeenCalledWith('capture_echouee', { source: 'none' });
  });

  it('bilanOuvert', () => {
    OxvEvent.bilanOuvert();
    expect(mockTrack).toHaveBeenCalledWith('bilan_ouvert');
  });

  it('datalabCoucheOuverte porte la couche', () => {
    OxvEvent.datalabCoucheOuverte('virage');
    expect(mockTrack).toHaveBeenCalledWith('datalab_couche_ouverte', { couche: 'virage' });
  });

  it('coachConsentementDonne porte le niveau', () => {
    OxvEvent.coachConsentementDonne('lecture_simple');
    expect(mockTrack).toHaveBeenCalledWith('coach_consentement_donne', {
      niveau: 'lecture_simple',
    });
  });

  it('coachNoteEnvoyee', () => {
    OxvEvent.coachNoteEnvoyee();
    expect(mockTrack).toHaveBeenCalledWith('coach_note_envoyee');
  });

  it('ne transmet jamais de PII dans les propriétés', () => {
    OxvEvent.captureReussie({ source: 'telemetry_frames', segments: 3 });
    OxvEvent.coachConsentementDonne('programme');
    OxvEvent.datalabCoucheOuverte('tours');
    const allProps = mockTrack.mock.calls
      .map((c) => JSON.stringify(c[1] ?? {}))
      .join(' ')
      .toLowerCase();
    for (const pii of ['email', 'user_id', 'first_name', 'lat', 'lon', 'token']) {
      expect(allProps).not.toContain(pii);
    }
  });
});
