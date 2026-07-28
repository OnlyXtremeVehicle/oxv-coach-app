/**
 * Le pilote ne lit jamais une chaîne anglaise — jalon 3, lot 21c.
 *
 * ---
 *
 * CE QUE CES TESTS EMPÊCHENT
 *
 * `bluetoothService` émet `Connexion échouée : ${message}` où `message` vient
 * de `react-native-ble-plx`, en anglais. `equipement.tsx` la posait telle quelle
 * dans `StateView`.
 *
 * Un pilote au paddock, casque à la main, lisait « Device 8A3F-... connection
 * failed » sur le seul écran qui décide si sa journée sera mesurée.
 */

import { diagnostiquer, texteDiagnostic } from '../diagnosticBle';

/** Messages réels de react-native-ble-plx, tels que le service les enveloppe. */
const REELS = {
  localisation: 'Connexion échouée : Device is not authorized to use BluetoothLE',
  eteint: 'Connexion échouée : BluetoothLE is powered off',
  timeout: 'Connexion échouée : Operation timed out',
  deconnecte: 'Connexion échouée : Device 8A3F-11EE was disconnected',
  echec: 'Connexion échouée : Device 8A3F-11EE connection failed',
  annule: 'Connexion échouée : Operation was cancelled',
  inconnu: 'Connexion échouée : Some brand new failure mode',
};

describe('chaque cause a son libellé', () => {
  /**
   * LA CAUSE QUE LE DOSSIER SIGNALE COMME « la plus fréquente et la moins
   * comprise ». iOS exige la localisation pour scanner en Bluetooth, ce qui
   * n'a aucun sens du point de vue du pilote : il cherche son boîtier, pas sa
   * position. Un message générique le ferait chercher du mauvais côté.
   */
  it('la localisation refusée est nommée, et expliquée', () => {
    const d = diagnostiquer(REELS.localisation);
    expect(d.cause).toContain('localisation');
    expect(d.geste).toContain('iOS');
  });

  it('le Bluetooth éteint est distingué du boîtier absent', () => {
    expect(diagnostiquer(REELS.eteint).cause).toContain('Bluetooth est éteint');
    expect(diagnostiquer(REELS.timeout).cause).toContain('n’a pas répondu');
  });

  it.each(Object.values(REELS))('« %s » ne laisse passer aucun anglais', (msg) => {
    const t = texteDiagnostic(diagnostiquer(msg));
    expect(t).not.toMatch(/device|failed|timed out|powered|cancelled|disconnected/i);
  });

  // Les identifiants techniques n'ont rien à faire devant un pilote.
  it('aucun identifiant d’appareil n’est affiché', () => {
    expect(texteDiagnostic(diagnostiquer(REELS.echec))).not.toContain('8A3F');
  });
});

describe('l’inconnu est dit honnêtement', () => {
  it('un message non reconnu donne une cause générique, pas la chaîne brute', () => {
    const d = diagnostiquer(REELS.inconnu);
    expect(d.cause).toBe('La liaison avec le boîtier n’a pas pu s’établir.');
    expect(texteDiagnostic(d)).not.toContain('brand new');
  });

  it('le message brut reste disponible pour le journal', () => {
    expect(diagnostiquer(REELS.inconnu).brut).toBe(REELS.inconnu);
  });

  it.each([null, undefined, '', '   '])('« %s » ne casse rien', (msg) => {
    expect(diagnostiquer(msg).cause.length).toBeGreaterThan(0);
  });
});

describe('l’ordre des motifs', () => {
  /**
   * « powered off » contient aussi « off » et pourrait tomber dans un motif
   * plus large. Le spécifique doit gagner, sinon le pilote cherche un boîtier
   * alors que c'est son téléphone qui a le Bluetooth coupé.
   */
  it('le spécifique passe avant le générique', () => {
    expect(diagnostiquer('BluetoothLE is powered off, connection failed').cause).toContain(
      'Bluetooth est éteint'
    );
  });
});

describe('ton OXV', () => {
  const tous = Object.values(REELS).map((m) => texteDiagnostic(diagnostiquer(m)));

  it('aucun emoji, aucun tutoiement', () => {
    for (const t of tous) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });

  /**
   * Doctrine : on décrit, on ne dirige pas. Un diagnostic technique peut dire
   * ce qui se passe et où chercher — il ne donne pas d'ordre au pilote.
   */
  it('aucun impératif adressé au pilote', () => {
    for (const t of tous) {
      expect(t).not.toMatch(/rallumez|vérifiez|activez|redémarrez|allez dans/i);
    }
  });

  it('aucun mot proscrit', () => {
    for (const t of tous) {
      expect(t).not.toMatch(/\blimite\b/i);
    }
  });
});
