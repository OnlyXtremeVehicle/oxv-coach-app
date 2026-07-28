/**
 * Les libellés de permission doivent décrire ce que l'application FAIT — ni
 * plus, ni moins. Jalon 3, préalable à la revue App Store.
 *
 * ---
 *
 * POURQUOI CE TEST EXISTE
 *
 * `app.json` déclarait la localisation ainsi :
 *
 *     « iOS requiert l'accès à la localisation pour scanner les appareils
 *       Bluetooth. »
 *
 * C'était vrai, et incomplet. L'application SURVEILLE la position pour détecter
 * l'arrivée au circuit (`src/lib/geolocation.ts`, monté depuis
 * `app/_layout.tsx`), et deux écrans lisent la position courante pour enregistrer
 * un tracé ou un lieu. Un libellé qui sous-déclare est un motif de rejet en
 * revue — et, avant cela, une phrase qui trompe le pilote au moment précis où on
 * lui demande son accord.
 *
 * Même motif du côté Bluetooth : le libellé ne nommait que le RaceBox, alors que
 * `bluetoothService.ts` se connecte aussi aux ceintures cardiaques par le profil
 * standard 0x180D. Une donnée de santé, annoncée nulle part.
 *
 * ---
 *
 * ET LE CAS INVERSE, QUI EST PIRE POUR DE LA SANTÉ
 *
 * Le plugin `react-native-health` était enregistré SANS options : il injectait
 * donc ses libellés par défaut, en anglais — les seuls de toute l'application —
 * dont « Allow OXV to update health info ». Or `healthKitService` demande
 * `write: []`. Annoncer une écriture qu'on ne fait pas est du même ordre que
 * taire une lecture qu'on fait.
 *
 * ---
 *
 * CE QUE CE TEST VÉRIFIE VRAIMENT
 *
 * Il relie la DÉCLARATION au CODE. Tant que le code fait ces choses, le libellé
 * doit les dire. Si un jour la surveillance de position disparaît, le test
 * échouera — et c'est voulu : la déclaration devra alors être resserrée.
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
    plugins: (string | [string, unknown])[];
  };
};

const PLIST = APP.expo.ios.infoPlist;
const GEO = lire('src', 'lib', 'geolocation.ts');
const BLE = lire('src', 'ble', 'bluetoothService.ts');
const SANTE = lire('src', 'services', 'v2', 'healthKitService.ts');

describe('localisation', () => {
  // La surveillance de position est le fait qui commande le libellé.
  it('le code surveille bien la position', () => {
    expect(GEO).toContain('watchPositionAsync');
  });

  it('le libellé annonce la détection d’arrivée, pas seulement le Bluetooth', () => {
    const s = String(PLIST.NSLocationWhenInUseUsageDescription ?? '');
    expect(s).toMatch(/arriv/i);
    expect(s.length).toBeGreaterThan(60);
  });

  // Le dossier l'exige, et `app.json` doit continuer de le tenir : aucune
  // détection en arrière-plan, donc aucun mode de fond déclaré.
  it('aucun suivi en arrière-plan n’est déclaré', () => {
    expect(PLIST.UIBackgroundModes).toBeUndefined();
    expect(PLIST.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
  });

  it('le libellé le dit au pilote', () => {
    expect(String(PLIST.NSLocationWhenInUseUsageDescription)).toMatch(/arrière-plan/i);
  });
});

describe('Bluetooth', () => {
  it('le code se connecte bien à une ceinture cardiaque', () => {
    expect(BLE).toContain('0000180d');
  });

  it('les deux libellés Bluetooth la nomment', () => {
    for (const cle of [
      'NSBluetoothAlwaysUsageDescription',
      'NSBluetoothPeripheralUsageDescription',
    ]) {
      expect(String(PLIST[cle] ?? '')).toMatch(/cardiaque/i);
    }
  });
});

describe('santé', () => {
  it('le service demande la lecture SEULE', () => {
    expect(SANTE).toMatch(/write:\s*\[\]/);
  });

  /**
   * Le plugin n'écrase pas une valeur déjà présente (`||`). Poser les deux clés
   * dans `app.json` est donc le seul moyen d'imposer nos formulations — et
   * d'éviter que le prompt le plus sensible de l'application soit le seul en
   * anglais.
   */
  it('les deux libellés santé sont posés en français', () => {
    for (const cle of ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription']) {
      const s = String(PLIST[cle] ?? '');
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(/^Allow /);
    }
  });

  it('le libellé d’écriture ne promet aucune écriture', () => {
    expect(String(PLIST.NSHealthUpdateUsageDescription)).toMatch(/n’écrit rien|n'écrit rien/);
  });

  it('le plugin santé reste enregistré — sans lui, ni entitlement ni clés', () => {
    const noms = APP.expo.plugins.map((p) => (typeof p === 'string' ? p : p[0]));
    expect(noms).toContain('react-native-health');
  });
});

describe('ton OXV sur tous les libellés', () => {
  const libelles = Object.entries(PLIST)
    .filter(([k]) => /UsageDescription$/.test(k))
    .map(([, v]) => String(v));

  it('il y en a bien plusieurs', () => {
    expect(libelles.length).toBeGreaterThanOrEqual(7);
  });

  it('aucun emoji, aucun tutoiement, aucune promesse creuse', () => {
    for (const s of libelles) {
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
      expect(s).not.toMatch(/révolution|incroyable|magique|meilleur/i);
    }
  });
});
