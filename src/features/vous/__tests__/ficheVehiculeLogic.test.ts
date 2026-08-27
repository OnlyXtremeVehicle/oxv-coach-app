/**
 * ficheVehiculeLogic — la mise en forme de la fiche véhicule, et rien d'autre.
 *
 * CE QUE CETTE SUITE NE TESTE PAS, ET POURQUOI.
 *
 * Ni le rapport masse / puissance, ni les seuils de classe, ni l'ouverture des
 * offres : ils appartiennent à `src/features/vehicules/eligibiliteLogic.ts` et
 * y sont déjà couverts, référentiel publié à l'appui. Les rejouer ici
 * installerait une seconde vérité, exactement ce que le module refuse.
 *
 * Ce qui est vérifié ici : que la fiche DÉLÈGUE (une entrée réelle du
 * référentiel produit bien sa classe), que les valeurs sont écrites en
 * typographie française, que l'absence s'écrit « — » et jamais zéro, et que
 * rien de ce qui s'affiche ne porte de qualificatif, de rang ou de verbe de
 * restriction.
 */

import { chercheAuReferentiel } from '@/features/vehicules/referentielVehicules';
import type { ClasseRoulage } from '@/features/vehicules/eligibiliteLogic';
import type { Vehicle } from '@/services/garageService';

import {
  CONCORDANCE_ABSENTE,
  MENTION_ADMINISTRATION,
  SOURCE_FICHE_ABSENTE,
  TIRET,
  classeDeLaFiche,
  ficheDepuisVehicule,
  fmtMasse,
  fmtPuissance,
  fmtRatio,
  formatJour,
  libelleAcces,
  libelleAnnees,
  libelleClasseOuTiret,
  lignesFicheTechnique,
  rendreConcordance,
  type SourceFiche,
} from '../ficheVehiculeLogic';

const FINE = '\u202F';
const NBSP = '\u00A0';

/** L'entrée réelle du référentiel publié — pas une fabrication de test. */
const A110R = chercheAuReferentiel('Alpine', 'A110', 'R');
const GT3 = chercheAuReferentiel('Porsche', '911', '992 GT3');
const ABARTH = chercheAuReferentiel('Abarth', '595', 'Competizione');

const vehicule = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  brand: 'Alpine',
  model: 'A110',
  generation: null,
  year: 2022,
  color: 'Bleu',
  notes: null,
  isPrimary: false,
  massKg: null,
  ...over,
});

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

describe('formats', () => {
  it('sépare les milliers par une espace fine insécable', () => {
    expect(fmtMasse(1035)).toBe(`1${FINE}035${NBSP}kg`);
    expect(fmtMasse(2347)).toBe(`2${FINE}347${NBSP}kg`);
    expect(fmtPuissance(1020)).toBe(`1${FINE}020${NBSP}ch`);
  });

  it('n’insère aucun séparateur sous mille', () => {
    expect(fmtMasse(860)).toBe(`860${NBSP}kg`);
    expect(fmtPuissance(180)).toBe(`180${NBSP}ch`);
  });

  it('rend la décimale de masse quand elle existe, la tait quand elle vaut zéro', () => {
    // `mass_kg` est un numeric(6,1) : la décimale est significative quand elle
    // est renseignée, parasite quand elle vaut zéro.
    expect(fmtMasse(1082.5)).toBe(`1${FINE}082,5${NBSP}kg`);
    expect(fmtMasse(1082.0)).toBe(`1${FINE}082${NBSP}kg`);
  });

  it('rend le rapport à deux décimales, virgule française', () => {
    expect(fmtRatio(5.75)).toBe(`5,75${NBSP}kg/ch`);
    expect(fmtRatio(3.6)).toBe(`3,60${NBSP}kg/ch`);
  });

  it('rend « — » sur toute valeur absente, jamais un zéro', () => {
    expect(fmtMasse(null)).toBe(TIRET);
    expect(fmtPuissance(null)).toBe(TIRET);
    expect(fmtRatio(null)).toBe(TIRET);
    expect(formatJour(null)).toBe(TIRET);
    expect(formatJour('pas une date')).toBe(TIRET);
  });
});

describe('libelleAnnees', () => {
  it('rend la plage close', () => {
    expect(libelleAnnees(2012, 2023)).toBe('2012 – 2023');
  });

  it('rend une production toujours ouverte sans inventer de fin', () => {
    expect(libelleAnnees(2022, null)).toBe('depuis 2022');
  });

  it('rend « — » quand rien n’est connu', () => {
    expect(libelleAnnees(null, null)).toBe(TIRET);
  });
});

// ---------------------------------------------------------------------------
// Classe et accès — la fiche délègue, elle ne recalcule pas
// ---------------------------------------------------------------------------

describe('classe affichée', () => {
  it('rend un fait d’organisation, pas un rang', () => {
    expect(libelleClasseOuTiret('I')).toBe('Classe I — Sport');
    expect(libelleClasseOuTiret('II')).toBe('Classe II — GT');
    expect(libelleClasseOuTiret('III')).toBe('Classe III — Supersport');
  });

  it('rend le tiret cadratin quand la classe n’est pas établie', () => {
    expect(libelleClasseOuTiret(null)).toBe(TIRET);
    expect(libelleClasseOuTiret(null)).not.toBe('0');
  });

  it('reprend la classe du module d’éligibilité sur des entrées réelles', () => {
    expect(classeDeLaFiche({ entree: ABARTH, masseDeclareeKg: null })).toBe('I');
    expect(classeDeLaFiche({ entree: A110R, masseDeclareeKg: null })).toBe('II');
    expect(classeDeLaFiche({ entree: GT3, masseDeclareeKg: null })).toBe('III');
  });

  it('n’établit aucune classe sans référentiel, même avec une masse déclarée', () => {
    // Le cas RÉEL du dépôt aujourd'hui : `mass_kg` peut exister, la puissance
    // n'existe nulle part. Une masse seule ne fait pas une classe.
    expect(classeDeLaFiche({ entree: null, masseDeclareeKg: 1420 })).toBeNull();
    expect(classeDeLaFiche(SOURCE_FICHE_ABSENTE)).toBeNull();
  });
});

describe('libelleAcces', () => {
  it('énonce l’ouvert, exactement dans la forme attendue', () => {
    expect(libelleAcces('I')).toBe('Access');
    expect(libelleAcces('II')).toBe('Access, Signature, Heritage');
    expect(libelleAcces('III')).toBe('Access, Signature, Heritage');
  });

  it('rend le tiret cadratin quand la classe n’est pas établie', () => {
    expect(libelleAcces(null)).toBe(TIRET);
  });
});

// ---------------------------------------------------------------------------
// Lignes de la fiche
// ---------------------------------------------------------------------------

describe('lignesFicheTechnique', () => {
  it('rend les six lignes du prompt, dans l’ordre', () => {
    expect(lignesFicheTechnique(SOURCE_FICHE_ABSENTE).map((l) => l.key)).toEqual([
      'generation',
      'annees',
      'puissance',
      'masse',
      'ratio',
      'classe',
    ]);
  });

  it('rend une fiche entièrement en tirets quand rien n’est connu', () => {
    const valeurs = lignesFicheTechnique(SOURCE_FICHE_ABSENTE).map((l) => l.value);
    expect(valeurs).toEqual([TIRET, TIRET, TIRET, TIRET, TIRET, TIRET]);
    expect(valeurs).not.toContain('0');
  });

  it('rend une fiche complète depuis une entrée réelle — Alpine A110 R', () => {
    const lignes = lignesFicheTechnique({ entree: A110R, masseDeclareeKg: null });
    expect(lignes.map((l) => l.value)).toEqual([
      'R',
      'depuis 2022',
      `300${NBSP}ch`,
      `1${FINE}082${NBSP}kg`,
      `3,61${NBSP}kg/ch`,
      'Classe II — GT',
    ]);
  });

  it('rend la plage close d’une génération arrêtée — Abarth 595 Competizione', () => {
    const lignes = lignesFicheTechnique({ entree: ABARTH, masseDeclareeKg: null });
    const par = (k: string): string => lignes.find((l) => l.key === k)?.value ?? '';
    expect(par('annees')).toBe('2012 – 2023');
    expect(par('ratio')).toBe(`5,75${NBSP}kg/ch`);
    expect(par('classe')).toBe('Classe I — Sport');
  });

  it('affiche la masse déclarée seule, sans en tirer ni rapport ni classe', () => {
    const lignes = lignesFicheTechnique({ entree: null, masseDeclareeKg: 1420 });
    const par = (k: string): string => lignes.find((l) => l.key === k)?.value ?? '';
    expect(par('masse')).toBe(`1${FINE}420${NBSP}kg`);
    expect(par('puissance')).toBe(TIRET);
    expect(par('ratio')).toBe(TIRET);
    expect(par('classe')).toBe(TIRET);
  });

  it('laisse la masse du référentiel primer sur la masse déclarée', () => {
    const lignes = lignesFicheTechnique({ entree: A110R, masseDeclareeKg: 1200 });
    expect(lignes.find((l) => l.key === 'masse')?.value).toBe(`1${FINE}082${NBSP}kg`);
  });
});

describe('ficheDepuisVehicule', () => {
  it('ne rapproche AUCUN véhicule du référentiel tant que la génération manque', () => {
    // `public.vehicles` ne porte pas la génération. Deviner marcherait souvent —
    // et « souvent » afficherait un jour une classe fausse, donc un accès faux.
    const source: SourceFiche = ficheDepuisVehicule(vehicule());
    expect(source.entree).toBeNull();
  });

  it('remonte la masse déclarée, seule des cinq valeurs techniques en base', () => {
    expect(ficheDepuisVehicule(vehicule({ massKg: 1082 })).masseDeclareeKg).toBe(1082);
    expect(ficheDepuisVehicule(vehicule({ massKg: null })).masseDeclareeKg).toBeNull();
  });

  it('rend une fiche de tirets pour un véhicule sans masse — l’état normal', () => {
    const valeurs = lignesFicheTechnique(ficheDepuisVehicule(vehicule())).map((l) => l.value);
    expect(valeurs).toEqual([TIRET, TIRET, TIRET, TIRET, TIRET, TIRET]);
  });
});

// ---------------------------------------------------------------------------
// Concordance HistoVec — trois états, aucun blocage
// ---------------------------------------------------------------------------

describe('rendreConcordance', () => {
  it('rend la concordance vérifiée avec son jour', () => {
    const r = rendreConcordance({
      statut: 'verifiee',
      verifieLe: '2026-08-26T09:14:00.000Z',
      motif: null,
    });
    expect(r.valeur).toBe('Vérifiée');
    expect(r.detail).toContain('2026');
    expect(r.detail).toContain('Vérification du');
    expect(r.mentionAdministration).toBe(false);
  });

  it('rend la concordance vérifiée sans horodatage lisible, sans inventer de date', () => {
    const r = rendreConcordance({ statut: 'verifiee', verifieLe: null, motif: null });
    expect(r.valeur).toBe('Vérifiée');
    expect(r.detail).toBeNull();
  });

  it('rend la non-concordance avec son motif factuel', () => {
    const r = rendreConcordance({
      statut: 'non_etablie',
      verifieLe: '2026-08-26T09:14:00.000Z',
      motif: 'Immatriculation inconnue du service.',
    });
    expect(r.valeur).toBe('Non établie');
    expect(r.detail).toBe('Immatriculation inconnue du service.');
    expect(r.mentionAdministration).toBe(true);
  });

  it('rend la non-concordance sans motif consigné sans en fabriquer un', () => {
    const r = rendreConcordance({ statut: 'non_etablie', verifieLe: null, motif: '  ' });
    expect(r.detail).toBeNull();
    expect(r.mentionAdministration).toBe(true);
  });

  it('rend le non-vérifié en tiret, sans une seule alerte', () => {
    const r = rendreConcordance(CONCORDANCE_ABSENTE);
    expect(r.valeur).toBe(TIRET);
    expect(r.detail).toBeNull();
    expect(r.mentionAdministration).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DOCTRINE — ce que la fiche ne dit jamais
// ---------------------------------------------------------------------------

describe('doctrine', () => {
  const classes: (ClasseRoulage | null)[] = ['I', 'II', 'III', null];

  const rendus: string[] = [
    ...classes.map(libelleClasseOuTiret),
    ...classes.map(libelleAcces),
    ...lignesFicheTechnique(SOURCE_FICHE_ABSENTE).flatMap((l) => [l.label, l.value]),
    ...lignesFicheTechnique({ entree: A110R, masseDeclareeKg: null }).flatMap((l) => [
      l.label,
      l.value,
    ]),
    MENTION_ADMINISTRATION,
    rendreConcordance({ statut: 'verifiee', verifieLe: '2026-08-26T09:14:00Z', motif: null })
      .valeur,
    rendreConcordance({ statut: 'non_etablie', verifieLe: null, motif: null }).valeur,
    rendreConcordance(CONCORDANCE_ABSENTE).valeur,
  ];

  it('n’emploie jamais le mot « limite »', () => {
    for (const t of rendus) expect(t.toLowerCase()).not.toContain('limit');
  });

  it('n’emploie aucun verbe de restriction ni d’incitation au changement', () => {
    const proscrits = [
      'interdit',
      'refus',
      'non autorisé',
      'non éligible',
      'inéligible',
      'restrein',
      'fermé',
      'exclu',
      'changez',
      'vous devez',
      'il faut',
    ];
    for (const t of rendus) {
      for (const p of proscrits) expect(t.toLowerCase()).not.toContain(p);
    }
  });

  it('n’emploie aucun qualificatif ni aucune position relative de classe', () => {
    const proscrits = [
      'supérieur',
      'inférieur',
      'meilleur',
      'plus rapide',
      'niveau',
      'rang',
      'classement',
      'débutant',
      'expert',
      'pilotes',
    ];
    for (const t of rendus) {
      for (const p of proscrits) expect(t.toLowerCase()).not.toContain(p);
    }
  });

  it('n’expose aucun effectif — les libellés ne portent aucun nombre de pilotes', () => {
    for (const t of [...classes.map(libelleClasseOuTiret), ...classes.map(libelleAcces)]) {
      expect(t).not.toMatch(/\d+\s*(pilote|place|inscrit)/i);
    }
  });
});
