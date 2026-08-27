/**
 * GARDE — la voie de recours est ouverte de bout en bout.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ LE 27/08/2026
 * ===========================================================================
 *
 * `demandes_examen_vehicule` est en production depuis le lot 11. Le site y
 * dépose les demandes. **Aucun fichier de l'app ne mentionnait la table.**
 * Zéro lecteur : les demandes s'accumulaient sans surface pour les instruire,
 * pendant que la CGV (art. 5.3) promet une réponse sous soixante-douze heures
 * ouvrées.
 *
 * Une promesse contractuelle sans écran qui la porte est une promesse qu'on
 * découvre rompue par une réclamation. C'est exactement le motif de la garde
 * `eligibiliteArmee` : une RPC en production dont le seul appelant était le
 * fichier de types généré.
 *
 * ===========================================================================
 * LES DEUX INVARIANTS
 * ===========================================================================
 *
 * 1. La chaîne est ARMÉE : service appelé par un écran, écran atteignable
 *    depuis le hub, alerte serveur qui connaît la nature « vehicule ».
 * 2. Le vocabulaire est VERROUILLÉ : ni refus, ni rejet, ni inéligibilité.
 *    L'article L121-11 interdit de refuser une prestation à un consommateur
 *    sans motif légitime ; un périmètre publié et appliqué uniformément n'est
 *    pas un refus, et toute la validité du dispositif se perd à la première
 *    chaîne de caractères qui dit le contraire.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { codeSansCommentaires } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

function lire(...segments: string[]): string {
  return codeSansCommentaires(readFileSync(join(RACINE, ...segments), 'utf8'));
}

const SERVICE = lire('src', 'services', 'examenVehiculeService.ts');
const LOGIQUE = lire('src', 'features', 'vehicules', 'examenSuiviLogic.ts');
const ECRAN = lire('app', '(admin)', 'examens-vehicule.tsx');
const HUB = lire('app', '(admin)', 'index.tsx');
const ALERTE = lire('supabase', 'functions', 'notify-admin-lead', 'index.ts');

describe('la voie de recours véhicule est armée', () => {
  /** LE CŒUR. Cette assertion aurait échoué du lot 11 au 27/08/2026. */
  it('le service a un appelant de production', () => {
    expect(ECRAN).toContain('listerDemandesExamen(');
    expect(ECRAN).toContain('instruireDemande(');
  });

  it('l’écran est atteignable depuis le hub admin', () => {
    expect(HUB).toContain('/(admin)/examens-vehicule');
  });

  /**
   * La plaque n'a d'intérêt que si elle RELIE. Figée sur l'inscription, elle
   * garde la trace du véhicule tel qu'il s'est présenté ce jour-là ; l'écran
   * doit s'en servir, sinon la colonne n'est qu'un champ de plus.
   */
  it('la plaque relie la demande aux inscriptions déjà posées', () => {
    expect(SERVICE).toContain('compterInscriptionsParPlaque');
    expect(ECRAN).toContain('compterInscriptionsParPlaque(');
  });

  /**
   * `en_examen` a été ajoutée à `registration_status_enum` le 27/08/2026. Une
   * valeur d'énumération que rien ne lit ni n'écrit est pire qu'absente : elle
   * suggère un dispositif qui n'existe pas. Elle doit avoir sa surface.
   */
  it('le statut « en_examen » a un lecteur et un écrivain', () => {
    expect(SERVICE).toContain("'en_examen'");
    expect(ECRAN).toContain('listerInscriptionsAExaminer(');
    expect(ECRAN).toContain('poserStatutInscription(');
  });

  /**
   * Cette surface dit « je regarde » ou « j'ai fini de regarder ». Confirmer
   * depuis ici court-circuiterait le paiement ; annuler prendrait une décision
   * qui appartient au membre.
   */
  it('la surface ne confirme ni n’annule une inscription', () => {
    const misesAJour = SERVICE.match(/\.update\([\s\S]*?\)/g) ?? [];
    for (const charge of misesAJour) {
      expect(charge).not.toContain("'confirmed'");
      expect(charge).not.toContain("'cancelled'");
    }
  });

  it('l’alerte serveur connaît la nature « vehicule » et accuse réception', () => {
    expect(ALERTE).toContain("'vehicule'");
    expect(ALERTE).toContain('demandes_examen_vehicule');
    expect(ALERTE).toContain('vehicule_ack');
  });
});

describe('les horodatages ne se fabriquent pas côté client', () => {
  /**
   * `instruite_le` est posée par un déclencheur en base. Un horodatage que le
   * client écrit est un horodatage qu'un client peut mentir — et c'est la
   * seule preuve que l'engagement des 72 h a été tenu.
   */
  it('le service n’écrit jamais la date d’instruction', () => {
    // LIRE `instruite_le` est légitime — l'écran affiche « Instruite le … ».
    // Ce qui est interdit, c'est de l'ÉCRIRE : la garde vise donc les charges
    // utiles de mise à jour, pas les mentions de la colonne. Une assertion sur
    // le fichier entier échouerait sur la simple déclaration de type, et une
    // garde qui crie sur du code correct finit par être désarmée.
    const misesAJour = SERVICE.match(/\.update\([\s\S]*?\)/g) ?? [];
    expect(misesAJour.length).toBeGreaterThan(0);
    for (const charge of misesAJour) {
      expect(charge).not.toContain('instruite_le');
    }
  });
});

describe('le vocabulaire est verrouillé (art. L121-11)', () => {
  const INTERDITS = /refus|rejet|rejeté|interdit|non autoris|inéligible|non éligible/i;

  it.each([
    ['le service', () => SERVICE],
    ['la logique de suivi', () => LOGIQUE],
    ['l’écran d’instruction', () => ECRAN],
  ])('%s n’emploie aucun mot de refus', (_nom, source) => {
    expect(source()).not.toMatch(INTERDITS);
  });

  /**
   * L'écran voisin de certification des belles routes dit « Rejeter », et il a
   * raison : une route n'est pas un consommateur. Le verbe ne se recopie pas
   * ici, et cette assertion existe pour que la tentation reste visible.
   */
  it('les trois issues nomment le périmètre, jamais une décision sur la personne', () => {
    expect(SERVICE).toContain('Hors du périmètre');
    expect(SERVICE).toContain('Référencée');
    expect(ECRAN).not.toContain('Rejeter');
  });
});
