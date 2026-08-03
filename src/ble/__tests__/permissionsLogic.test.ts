/**
 * Le cas qui compte est `unavailable` : c'est lui qui a rendu l'appairage
 * RaceBox impossible sur iOS pendant toute la vie du projet. Voir l'en-tête de
 * `src/ble/permissionsLogic.ts` et `docs/DETTE.md` D-36.
 */

import { verdictAndroid, verdictBluetoothIos } from '../permissionsLogic';

describe('verdictBluetoothIos', () => {
  it('accorde sur granted et limited', () => {
    expect(verdictBluetoothIos('granted')).toEqual({
      granted: true,
      missing: [],
      indetermine: false,
    });
    expect(verdictBluetoothIos('limited')).toEqual({
      granted: true,
      missing: [],
      indetermine: false,
    });
  });

  it('refuse sur denied et blocked — ce sont de vraies réponses', () => {
    for (const issue of ['denied', 'blocked']) {
      const v = verdictBluetoothIos(issue);
      expect(v.granted).toBe(false);
      expect(v.missing).toEqual(['Bluetooth']);
      expect(v.indetermine).toBe(false);
    }
  });

  it('LAISSE PASSER sur unavailable, en le disant indéterminé', () => {
    // Le défaut d'origine : `unavailable` était traduit en refus, et les trois
    // écrans d'appairage n'appelaient jamais startScan(). iOS est le seul vrai
    // gardien — on le laisse trancher.
    const v = verdictBluetoothIos('unavailable');
    expect(v.granted).toBe(true);
    expect(v.missing).toEqual([]);
    expect(v.indetermine).toBe(true);
  });

  it('laisse passer une issue inconnue plutôt que de tuer l’appairage', () => {
    // Une version future de la bibliothèque ne doit pas rendre le produit
    // inerte parce qu'elle a ajouté un mot au vocabulaire.
    const v = verdictBluetoothIos('quelque-chose-de-neuf');
    expect(v.granted).toBe(true);
    expect(v.indetermine).toBe(true);
  });
});

describe('verdictAndroid', () => {
  it('accorde quand tout est accordé', () => {
    expect(verdictAndroid({ SCAN: 'granted', CONNECT: 'granted' })).toEqual({
      granted: true,
      missing: [],
      indetermine: false,
    });
  });

  it('nomme précisément ce qui manque', () => {
    const v = verdictAndroid({ SCAN: 'granted', CONNECT: 'denied' });
    expect(v.granted).toBe(false);
    expect(v.missing).toEqual(['CONNECT']);
  });

  it('reste strict sur unavailable — Android n’a pas le défaut d’iOS', () => {
    // Aucune poignée à compiler séparément côté Android : `unavailable` y
    // signifie vraiment « pas disponible », et non « je ne sais pas ».
    const v = verdictAndroid({ SCAN: 'unavailable' });
    expect(v.granted).toBe(false);
    expect(v.missing).toEqual(['SCAN']);
  });

  it('accorde sur un jeu vide, sans inventer de manque', () => {
    expect(verdictAndroid({}).granted).toBe(true);
  });
});
