/**
 * Tests equipementLogic (V2-L4, porte VOUS, écran Équipement) — logique pure, node.
 *
 * Couvre : lecture batterie depuis l'état textuel (numérique, « % », mots,
 * bornage, absence), pastille d'état (bon/à vérifier/inconnu), garde Apple
 * Watch fail-closed (consentement + drapeau + iOS, entrées douteuses), visibilité
 * de la carte (iOS only), libellés de statut HealthKit.
 */

import {
  canRequestHealthAuth,
  deviceHealthLabel,
  devicePastille,
  parseBatteryPercent,
  watchCardVisible,
  watchShowAuthorizeButton,
  watchStatusLabel,
} from '../equipementLogic';

// ---------------------------------------------------------------------------
// Batterie
// ---------------------------------------------------------------------------

describe('parseBatteryPercent', () => {
  it('valeurs chiffrées, avec ou sans unité', () => {
    expect(parseBatteryPercent('85')).toBe(85);
    expect(parseBatteryPercent('85%')).toBe(85);
    expect(parseBatteryPercent('battery 42 %')).toBe(42);
    expect(parseBatteryPercent('7.8')).toBe(8); // arrondi via clampBatteryLevel
  });

  it('borne dans [0, 100]', () => {
    expect(parseBatteryPercent('-5')).toBe(0);
    expect(parseBatteryPercent('140')).toBe(100);
  });

  it('mots non chiffrés ou absence → null (cadran « — », jamais 0 fabriqué)', () => {
    expect(parseBatteryPercent('low')).toBeNull();
    expect(parseBatteryPercent('ok')).toBeNull();
    expect(parseBatteryPercent('')).toBeNull();
    expect(parseBatteryPercent(null)).toBeNull();
    expect(parseBatteryPercent(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pastille d'état
// ---------------------------------------------------------------------------

describe('devicePastille / deviceHealthLabel', () => {
  it('mots « bon état » → ok', () => {
    expect(devicePastille('ok')).toBe('ok');
    expect(devicePastille('Good')).toBe('ok');
    expect(devicePastille('connected')).toBe('ok');
    expect(deviceHealthLabel('ok')).toBe('Bon état');
  });

  it('mots d’alerte → attention', () => {
    expect(devicePastille('low')).toBe('attention');
    expect(devicePastille('DEGRADED')).toBe('attention');
    expect(devicePastille('error')).toBe('attention');
    expect(deviceHealthLabel('low')).toBe('À vérifier');
  });

  it('absent / vide / inconnu → unknown (jamais un « bon » affirmé sans donnée)', () => {
    expect(devicePastille(null)).toBe('unknown');
    expect(devicePastille(undefined)).toBe('unknown');
    expect(devicePastille('')).toBe('unknown');
    expect(devicePastille('zorglub')).toBe('unknown');
    expect(deviceHealthLabel(null)).toBe('État inconnu');
  });
});

// ---------------------------------------------------------------------------
// Garde Apple Watch — consent + flag + iOS (fail-closed)
// ---------------------------------------------------------------------------

describe('canRequestHealthAuth (fail-closed, 3 conditions)', () => {
  const OPEN = { isIOS: true, biometryFlagOn: true, captureConsent: true };

  it('ouvre uniquement quand les 3 conditions sont réunies', () => {
    expect(canRequestHealthAuth(OPEN)).toBe(true);
  });

  it('non-iOS → fermé', () => {
    expect(canRequestHealthAuth({ ...OPEN, isIOS: false })).toBe(false);
  });

  it('drapeau biométrie OFF → fermé', () => {
    expect(canRequestHealthAuth({ ...OPEN, biometryFlagOn: false })).toBe(false);
  });

  it('consentement de capture absent → fermé', () => {
    expect(canRequestHealthAuth({ ...OPEN, captureConsent: false })).toBe(false);
  });

  it('entrées douteuses (undefined) → fermé, jamais ouvert par accident', () => {
    expect(
      canRequestHealthAuth({
        isIOS: true,
        biometryFlagOn: undefined as unknown as boolean,
        captureConsent: true,
      })
    ).toBe(false);
    expect(
      canRequestHealthAuth({
        isIOS: undefined as unknown as boolean,
        biometryFlagOn: true,
        captureConsent: true,
      })
    ).toBe(false);
  });
});

describe('watchCardVisible', () => {
  it('carte présente sur iOS uniquement (Android : absente)', () => {
    expect(watchCardVisible(true)).toBe(true);
    expect(watchCardVisible(false)).toBe(false);
  });
});

describe('watchStatusLabel / watchShowAuthorizeButton', () => {
  it('libellés des 4 statuts', () => {
    expect(watchStatusLabel('granted')).toBe('Autorisée');
    expect(watchStatusLabel('denied')).toBe('Refusée');
    expect(watchStatusLabel('unavailable')).toBe('Indisponible sur cet appareil');
    expect(watchStatusLabel('idle')).toBe('Non demandée');
  });

  it('bouton « Autoriser » masqué si déjà accordée ou indisponible', () => {
    expect(watchShowAuthorizeButton('idle')).toBe(true);
    expect(watchShowAuthorizeButton('denied')).toBe(true);
    expect(watchShowAuthorizeButton('granted')).toBe(false);
    expect(watchShowAuthorizeButton('unavailable')).toBe(false);
  });
});
