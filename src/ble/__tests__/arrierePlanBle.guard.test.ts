/**
 * GARDE — l'arrière-plan BLE est déclaré EN ENTIER, ou il ne sert à rien.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE
 * ===========================================================================
 *
 * Capturer écran verrouillé demande TROIS choses, et il faut les trois :
 *
 *   1. l'option `modes: ['central']` du greffon `react-native-ble-plx`, qui est
 *      ce qui ÉCRIT `UIBackgroundModes` sur iOS (et non le manifeste) ;
 *   2. le même greffon en `isBackgroundEnabled: true`, pour Android ;
 *   3. un `restoreStateIdentifier` sur le gestionnaire central.
 *
 * Les deux premières sont visibles, se relisent, et donnent l'impression que
 * l'affaire est réglée. **La troisième est celle qui fait fonctionner le
 * mécanisme** : iOS ne réveille l'application pour un évènement Bluetooth que
 * s'il peut retrouver la session par cet identifiant.
 *
 * Sans elle, le manifeste est accepté, la revue App Store passe, et rien ne se
 * produit — l'application est suspendue à l'extinction de l'écran exactement
 * comme avant. Le mode existerait sur le papier et ne protégerait rien : la
 * forme même du défaut que ce dépôt combat, et qui a déjà coûté une séance.
 *
 * ===========================================================================
 * CE QUE CE TEST NE PROUVE PAS
 * ===========================================================================
 *
 * Il lit une déclaration ; il ne réveille aucun téléphone. La seule
 * vérification qui compte est au circuit : verrouiller l'écran en pleine
 * séance, rouler dix minutes, et constater que les trames sont là. Elle est
 * inscrite au dossier d'acceptation terrain.
 *
 * On vérifie ici ce qui EST vérifiable sans appareil : que les trois morceaux
 * sont présents ENSEMBLE. Deux sur trois est le pire des états — celui qui
 * rassure sans rien tenir.
 */

import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..', '..', '..');

const APP_JSON = JSON.parse(fs.readFileSync(path.join(RACINE, 'app.json'), 'utf8')) as {
  expo: {
    ios?: { infoPlist?: Record<string, unknown> };
    plugins?: (string | [string, Record<string, unknown>])[];
  };
};

const SERVICE = fs.readFileSync(path.join(RACINE, 'src', 'ble', 'bluetoothService.ts'), 'utf8');

describe('les trois morceaux de l’arrière-plan BLE', () => {
  /**
   * C'EST LE GREFFON QUI ÉCRIT `UIBackgroundModes`, PAS LE MANIFESTE.
   *
   * Première écriture de cette garde : lire `ios.infoPlist.UIBackgroundModes`.
   * `declarationsPermissions.test.ts` — plus ancien et mieux renseigné — l'a
   * arrêtée net : `plugin/build/withBLE.js:22` passe `_props.modes` à
   * `withBLEBackgroundModes`, qui pousse la clé lui-même. La recopier à la main
   * crée deux sources pour une valeur, et c'est celle du greffon qui gagne.
   *
   * On vérifie donc la source qui décide, et l'ABSENCE de la copie manuelle.
   */
  it('1. le greffon réclame le mode central, et la clé n’est pas recopiée', () => {
    const plugin = (APP_JSON.expo.plugins ?? []).find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === 'react-native-ble-plx'
    );
    expect(plugin?.[1].modes as string[]).toContain('central');
    expect(APP_JSON.expo.ios?.infoPlist?.UIBackgroundModes).toBeUndefined();
  });

  it('2. le plugin ble-plx a l’arrière-plan actif', () => {
    const plugin = (APP_JSON.expo.plugins ?? []).find(
      (p): p is [string, Record<string, unknown>] =>
        Array.isArray(p) && p[0] === 'react-native-ble-plx'
    );
    expect(plugin).toBeDefined();
    expect(plugin?.[1].isBackgroundEnabled).toBe(true);
  });

  /**
   * LE MORCEAU QUI FAIT RÉELLEMENT FONCTIONNER LE MÉCANISME. Les deux
   * précédents sans celui-ci donnent un mode déclaré et inerte.
   */
  it('3. le gestionnaire central porte un identifiant de restauration', () => {
    expect(SERVICE).toMatch(/restoreStateIdentifier/);
    // Il doit être passé AU CONSTRUCTEUR, pas seulement défini quelque part.
    expect(SERVICE).toMatch(/new Ctor\(\{[\s\S]{0,400}restoreStateIdentifier/);
  });

  /**
   * L'identifiant doit être STABLE d'un lancement à l'autre : le changer revient
   * à abandonner la session que le système gardait. Une constante nommée le
   * garantit mieux qu'une chaîne posée en ligne.
   */
  it('l’identifiant de restauration est une constante, pas une chaîne fabriquée', () => {
    expect(SERVICE).toMatch(/const BLE_RESTORE_ID = '[^'$]+';/);
    // Ni horodatage, ni aléa, ni identifiant d'appareil.
    expect(SERVICE).not.toMatch(/BLE_RESTORE_ID = [^;]*(Date\.now|Math\.random|uuid)/);
  });

  /**
   * ET LE COMMENTAIRE QUI DISAIT LE CONTRAIRE A ÉTÉ RETIRÉ.
   *
   * `captureSessionService` affirmait « pas de mode arrière-plan BLE revendiqué
   * (entitlements à venir) ». Le laisser après l'avoir activé serait pire que
   * de ne rien écrire : un lecteur s'y fierait pour conclure que l'écran
   * verrouillé coupe la capture.
   */
  it('aucune documentation ne prétend encore que l’arrière-plan est absent', () => {
    const capture = fs.readFileSync(
      path.join(RACINE, 'src', 'services', 'captureSessionService.ts'),
      'utf8'
    );
    expect(capture).not.toMatch(/entitlements à venir/);
    expect(capture).not.toMatch(/pas de mode arrière-plan BLE revendiqué/);
  });
});
