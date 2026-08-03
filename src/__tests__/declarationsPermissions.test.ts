/**
 * Les libellés de permission doivent décrire ce que l'application FAIT — ni
 * plus, ni moins. Et il faut les lire À LA SOURCE QUI GAGNE.
 *
 * ---
 *
 * LA VERSION PRÉCÉDENTE DE CE TEST ÉTAIT VERTE SUR DES VALEURS INERTES
 *
 * J'avais ajouté quatre clés à `ios.infoPlist` — deux Bluetooth, deux santé —
 * en écrivant que « le plugin n'écrase pas une valeur déjà présente ».
 * **C'est l'inverse.** Les deux plugins mettent leur option EN PREMIER dans le
 * `||` :
 *
 *   react-native-ble-plx/plugin/build/withBluetoothPermissions.js:9
 *     bluetoothAlwaysPermission || config.modResults.NS… || défaut
 *   react-native-health/app.plugin.js:13-21
 *     healthSharePermission || config.modResults.NS… || défaut
 *
 * L'option du plugin l'emporte donc toujours. Mes quatre clés n'atteignaient
 * jamais l'Info.plist construit, et ce test les affirmait conformes.
 *
 * Une assertion verte sur une valeur inerte est pire qu'une absence de test :
 * elle donne une confiance qui n'a rien derrière.
 *
 * ---
 *
 * ET J'AVAIS INVENTÉ LE DÉFAUT D'ORIGINE
 *
 * L'en-tête précédent affirmait que `react-native-health` était « enregistré
 * SANS options », donc en anglais. Faux : il porte ses deux libellés français
 * depuis son introduction. Ma vérification affichait le NOM des plugins et
 * jetait leurs options — j'ai conclu d'une sortie qui ne pouvait pas me le
 * montrer.
 *
 * ---
 *
 * CE QUI RESTAIT VRAI, ET QUI EST CORRIGÉ AILLEURS
 *
 * `NSBluetoothAlwaysUsageDescription` est le SEUL prompt Bluetooth qu'iOS 13+
 * affiche — `NSBluetoothPeripheralUsageDescription` est totalement déprécié, le
 * plugin lui-même le signale. Sa valeur effective venait de
 * `bluetoothAlwaysPermission`, qui ne nommait que le RaceBox alors que
 * `bluetoothService.ts` porte `0x180D` et scanne les ceintures cardiaques.
 *
 * C'est cette option — la source qui gagne — qui a été corrigée.
 *
 * ---
 *
 * CE QUE CE TEST VÉRIFIE MAINTENANT
 *
 * Pour chaque permission, il lit LA SOURCE EFFECTIVE : l'option du plugin quand
 * un plugin possède la clé, `ios.infoPlist` sinon. Et il relie cette source au
 * CODE : tant que le code fait la chose, le libellé doit la dire.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');

function lire(...p: string[]): string {
  return readFileSync(join(RACINE, ...p), 'utf8');
}

const APP = JSON.parse(lire('app.json')) as {
  expo: {
    ios: { infoPlist: Record<string, unknown> };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

const PLIST = APP.expo.ios.infoPlist;

/** Options d'un plugin, ou `null` s'il est enregistré nu. */
function optionsPlugin(nom: string): Record<string, unknown> | null {
  for (const p of APP.expo.plugins) {
    if (Array.isArray(p) && p[0] === nom) return p[1];
    if (p === nom) return null;
  }
  throw new Error(`plugin ${nom} absent de app.json`);
}

const BLE_PLX = optionsPlugin('react-native-ble-plx');
const SANTE_PLUGIN = optionsPlugin('react-native-health');
const LOCALISATION = optionsPlugin('expo-location');
const AUDIO = optionsPlugin('expo-audio');

const GEO = lire('src', 'lib', 'geolocation.ts');
const BLE = lire('src', 'ble', 'bluetoothService.ts');
const SANTE = lire('src', 'services', 'v2', 'healthKitService.ts');

describe('la source qui gagne', () => {
  /**
   * Le fondement de tout le reste. Si un jour un plugin cessait d'écraser, ces
   * assertions tomberaient et il faudrait relire le test avant les libellés.
   */
  it('les deux plugins mettent leur option AVANT la valeur du manifeste', () => {
    const ble = lire(
      'node_modules',
      'react-native-ble-plx',
      'plugin',
      'build',
      'withBluetoothPermissions.js'
    );
    const sante = lire('node_modules', 'react-native-health', 'app.plugin.js');
    expect(ble).toMatch(/bluetoothAlwaysPermission\s*\|\|/);
    expect(sante).toMatch(/healthSharePermission\s*\|\|/);
    expect(sante).toMatch(/healthUpdatePermission\s*\|\|/);
  });

  /**
   * Corollaire : aucune clé possédée par un plugin ne doit rester dans
   * `ios.infoPlist`. Elle y serait inerte, et une configuration inerte ment.
   */
  it('aucune clé possédée par un plugin ne traîne dans infoPlist', () => {
    for (const cle of [
      'NSBluetoothAlwaysUsageDescription',
      'NSBluetoothPeripheralUsageDescription',
      'NSHealthShareUsageDescription',
      'NSHealthUpdateUsageDescription',
      // Ajoutées le 03/08/2026 : `expo-location` et `expo-audio` possèdent ces
      // clés, les laisser au manifeste les rendrait inertes.
      'NSLocationWhenInUseUsageDescription',
      'NSLocationAlwaysUsageDescription',
      'NSMicrophoneUsageDescription',
    ]) {
      expect(PLIST[cle]).toBeUndefined();
    }
  });
});

describe('Bluetooth — l’option du plugin', () => {
  it('le code se connecte bien à une ceinture cardiaque', () => {
    expect(BLE).toContain('0000180d');
  });

  /**
   * `NSBluetoothAlwaysUsageDescription` est le seul prompt qu'iOS 13+ affiche.
   * Sa valeur vient de cette option — pas du manifeste.
   */
  it('le libellé effectif nomme la ceinture cardiaque', () => {
    const s = String(BLE_PLX?.bluetoothAlwaysPermission ?? '');
    expect(s).toMatch(/cardiaque/i);
    expect(s).toMatch(/RaceBox/);
  });

  // Le plugin AVERTIT si on la fournit : dépréciée depuis iOS 13.
  it('la clé « peripheral », dépréciée, n’est pas fournie au plugin', () => {
    expect(BLE_PLX?.bluetoothPeripheralPermission).toBeUndefined();
  });
});

/**
 * LOCALISATION — CE BLOC AFFIRMAIT LE CONTRAIRE, ET IL AVAIT TORT.
 *
 * Il s'intitulait « le manifeste, car aucun plugin ne la possède » et interdisait
 * de déclarer `expo-location`. La convention paraissait saine : le libellé
 * français vivait dans `ios.infoPlist`, et le test le lisait là.
 *
 * **`expo-location` possède bel et bien ces clés.** Son greffon est appliqué par
 * l'autolinking, qu'on le déclare ou non, et il écrit TROIS clés — dont deux que
 * personne n'avait demandées :
 *
 *     NSLocationAlwaysUsageDescription            = « Allow $(PRODUCT_NAME)… »
 *     NSLocationAlwaysAndWhenInUseUsageDescription = « Allow $(PRODUCT_NAME)… »
 *
 * En anglais, dans une application entièrement française, et réclamant un suivi
 * PERMANENT alors que le libellé voisin promet « aucun suivi en arrière-plan ».
 *
 * Le test ne le voyait pas : il vérifiait `app.json`, pas l'Info.plist construit.
 * Il assertait `NSLocationAlwaysAndWhenInUseUsageDescription` absente **du
 * manifeste** — ce qui était vrai, et sans rapport avec ce que l'appareil
 * recevait. Une garde verte sur la mauvaise surface, exactement ce que l'en-tête
 * de ce fichier dénonce pour les clés Bluetooth et santé.
 *
 * Constaté le 03/08/2026 par `expo config --type introspect --json`, en
 * préparant un build. La seule façon de RETIRER les deux clés est de déclarer le
 * greffon et de lui passer `false` — d'où le renversement de la règle ici.
 */
describe('localisation — les options du plugin, qui possède les clés', () => {
  it('le code surveille bien la position', () => {
    expect(GEO).toContain('watchPositionAsync');
  });

  it('le greffon est déclaré — c’est la seule façon de brider ce qu’il écrit', () => {
    expect(LOCALISATION).not.toBeNull();
  });

  it('le libellé effectif annonce la détection d’arrivée, pas seulement le Bluetooth', () => {
    const s = String(LOCALISATION?.locationWhenInUsePermission ?? '');
    expect(s).toMatch(/arriv/i);
    expect(s).toMatch(/arrière-plan/i);
    expect(s).not.toMatch(/^Allow /);
  });

  it('les deux clés « Always » sont EXPLICITEMENT refusées', () => {
    // `false` demande au greffon de SUPPRIMER la clé. L'omettre la laisserait
    // avec le texte anglais par défaut : ne rien dire, ici, c'est accepter.
    expect(LOCALISATION?.locationAlwaysPermission).toBe(false);
    expect(LOCALISATION?.locationAlwaysAndWhenInUsePermission).toBe(false);
  });

  it('aucun suivi en arrière-plan n’est déclaré au manifeste', () => {
    expect(PLIST.UIBackgroundModes).toBeUndefined();
    expect(PLIST.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
  });
});

/**
 * MICROPHONE — même histoire, même correction.
 *
 * `expo-audio` possède `NSMicrophoneUsageDescription` et l'écrivait en anglais
 * par défaut. Son greffon ajoute EN PLUS le mode d'arrière-plan `audio` dès que
 * `enableBackgroundPlayback` est vrai — ce qui est son défaut. Or rien dans le
 * code ne lit en arrière-plan : `playsInSilentMode` sert à jouer malgré le
 * silencieux, ce n'est pas la même chose.
 *
 * Un mode d'arrière-plan déclaré sans usage est une cause de refus classique à
 * la revue App Store, et une promesse faite à l'utilisateur qu'on ne tient pas.
 */
describe('microphone — les options du plugin audio', () => {
  it('le libellé effectif est en français et nomme l’usage', () => {
    const s = String(AUDIO?.microphonePermission ?? '');
    expect(s.length).toBeGreaterThan(0);
    expect(s).not.toMatch(/^Allow /);
    expect(s).toMatch(/vocale|voix|note/i);
  });

  it('ni lecture ni enregistrement en arrière-plan', () => {
    expect(AUDIO?.enableBackgroundPlayback).toBe(false);
    expect(AUDIO?.enableBackgroundRecording).toBe(false);
  });
});

describe('santé — les options du plugin', () => {
  it('le service demande la lecture SEULE', () => {
    expect(SANTE).toMatch(/write:\s*\[\]/);
  });

  it('les deux libellés effectifs sont en français', () => {
    for (const cle of ['healthSharePermission', 'healthUpdatePermission']) {
      const s = String(SANTE_PLUGIN?.[cle] ?? '');
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(/^Allow /);
    }
  });

  it('le libellé d’écriture ne promet aucune écriture', () => {
    expect(String(SANTE_PLUGIN?.healthUpdatePermission)).toMatch(/n’écrit rien|n'écrit rien/);
  });

  // Les données cliniques ne sont ni lues ni prévues : la clé restait sinon
  // injectée pour rien, et demanderait un accès qu'on n'exerce pas.
  it('les données cliniques restent coupées', () => {
    expect(SANTE_PLUGIN?.isClinicalDataEnabled).toBe(false);
  });
});

describe('ton OXV sur tous les libellés effectifs', () => {
  const libelles = [
    ...Object.entries(PLIST)
      .filter(([k]) => /UsageDescription$/.test(k))
      .map(([, v]) => String(v)),
    ...APP.expo.plugins
      .filter((p): p is [string, Record<string, unknown>] => Array.isArray(p))
      .flatMap(([, o]) =>
        Object.entries(o)
          .filter(([k]) => /Permission$/.test(k))
          .map(([, v]) => String(v))
      ),
  ];

  it('il y en a bien plusieurs', () => {
    expect(libelles.length).toBeGreaterThanOrEqual(8);
  });

  it('aucun emoji, aucun tutoiement, aucune promesse creuse', () => {
    for (const s of libelles) {
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
      expect(s).not.toMatch(/révolution|incroyable|magique|meilleur/i);
    }
  });

  it('aucun n’est resté en anglais', () => {
    for (const s of libelles) {
      expect(s).not.toMatch(/^Allow |health info|Allow \$\(PRODUCT_NAME\)/);
    }
  });
});
