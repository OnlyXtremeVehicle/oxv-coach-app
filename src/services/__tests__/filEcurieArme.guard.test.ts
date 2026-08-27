/**
 * GARDE — le fil d'écurie est armé, et le dépôt ne se contourne pas.
 *
 * ===========================================================================
 * L'INVARIANT QUI A DÉJÀ ÉTÉ PERDU UNE FOIS
 * ===========================================================================
 *
 * `oxv_deposer_reservation_ecurie` porte les règles du dépôt : trois dates
 * distinctes et futures pour une privatisation, une seule demande ouverte par
 * écurie, la formule calculée depuis l'effectif.
 *
 * Le 27/08/2026, une politique d'insertion directe avait été posée EN PLUS de
 * cette fonction. Mesuré en transaction annulée : un capitaine écrivait une
 * privatisation à trente pilotes avec ZÉRO date. La base a été corrigée — plus
 * aucune politique d'écriture n'existe sur `reservations_ecurie`.
 *
 * Ce test garde le côté application : si un jour quelqu'un écrit un `insert`
 * direct dans le service, il échouera en production sur la RLS. Mieux vaut
 * qu'il échoue ici, avec l'explication.
 *
 * Une règle qui vit dans une fonction et une porte qui la contourne, ce n'est
 * pas une règle : c'est une suggestion.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { codeSansCommentaires } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

function lire(...segments: string[]): string {
  return codeSansCommentaires(readFileSync(join(RACINE, ...segments), 'utf8'));
}

const SERVICE = lire('src', 'services', 'ecurieFilService.ts');
const LOGIQUE = lire('src', 'features', 'club', 'filEcurieLogic.ts');
const ECRAN = lire('app', '(app2)', 'club', 'fil.tsx');
const ECURIE = lire('app', '(app2)', 'club', 'ecurie.tsx');

describe('le fil d’écurie est armé', () => {
  it('le service a un appelant de production', () => {
    expect(ECRAN).toContain('listerMessagesFil(');
    expect(ECRAN).toContain('envoyerMessage(');
    expect(ECRAN).toContain('deposerReservationEcurie(');
    expect(ECRAN).toContain('reservationEnCours(');
  });

  it('l’écran est atteignable depuis l’écurie', () => {
    expect(ECURIE).toContain('/(app2)/club/fil');
  });
});

describe('le dépôt passe par la fonction serveur, et par elle seule', () => {
  /** LE CŒUR. Cette assertion aurait échoué sur la première version de la base. */
  it('le service n’écrit jamais en direct dans reservations_ecurie', () => {
    const ecritures = SERVICE.match(/\.from\('reservations_ecurie[^']*'[\s\S]{0,400}?\)/g) ?? [];
    for (const bloc of ecritures) {
      expect(bloc).not.toContain('.insert(');
      expect(bloc).not.toContain('.update(');
      expect(bloc).not.toContain('.upsert(');
      expect(bloc).not.toContain('.delete(');
    }
  });

  it('le dépôt appelle bien la fonction', () => {
    expect(SERVICE).toContain('oxv_deposer_reservation_ecurie');
  });

  /**
   * Un membre ne peut pas écrire au nom d'OXV : la politique d'insertion
   * n'accepte que `'membre'`, et le service ne doit pas tenter autre chose —
   * un appel refusé est un bouton qui échoue en silence.
   */
  it('le service ne pose jamais un message système', () => {
    const insertions = SERVICE.match(/\.insert\([\s\S]*?\)/g) ?? [];
    for (const bloc of insertions) {
      expect(bloc).not.toContain('systeme');
      expect(bloc).not.toContain('nature');
    }
  });
});

describe('le seuil reste un reflet, jamais une décision', () => {
  /**
   * `reservations_ecurie.formule` est une colonne GÉNÉRÉE : la base décide.
   * Le module client ne fait qu'annoncer. S'il se mettait à écrire la formule,
   * une divergence produirait une inscription dont le prix et la journée ne
   * correspondraient pas à ce qui a été annoncé.
   */
  it('le client n’envoie jamais de formule', () => {
    // LIRE la formule est légitime — le bandeau l'affiche. C'est l'ÉCRIRE qui
    // ne l'est pas. La garde vise donc les charges utiles envoyées au serveur,
    // pas les mentions de la colonne : une assertion sur le fichier entier
    // échouerait sur le simple mappage de lecture, et une garde qui crie sur du
    // code correct finit par être désarmée.
    const charges = [
      ...(SERVICE.match(/\.insert\([\s\S]*?\)/g) ?? []),
      ...(SERVICE.match(/\.update\([\s\S]*?\)/g) ?? []),
      ...(SERVICE.match(/\.rpc\([\s\S]*?\}\s*as never\)/g) ?? []),
    ];
    expect(charges.length).toBeGreaterThan(0);
    for (const charge of charges) {
      expect(charge).not.toContain('formule');
    }
    expect(ECRAN).not.toMatch(/formule\s*:\s*'(insertion|privatisation)'/);
  });

  it('le seuil est nommé, jamais écrit en clair dans l’écran', () => {
    expect(LOGIQUE).toContain('SEUIL_PRIVATISATION = 17');
    // 17 ne doit pas se retrouver en dur dans la surface : le jour où le
    // fondateur le change, un seul endroit doit bouger.
    expect(ECRAN).toContain('SEUIL_PRIVATISATION');
  });
});

describe('le vocabulaire tient', () => {
  const INTERDITS = /refus|rejet|rejeté|interdit|inéligible/i;

  it.each([
    ['la logique', () => LOGIQUE],
    ['le service', () => SERVICE],
    ['l’écran', () => ECRAN],
  ])('%s n’emploie aucun mot de refus', (_nom, source) => {
    expect(source()).not.toMatch(INTERDITS);
  });
});
