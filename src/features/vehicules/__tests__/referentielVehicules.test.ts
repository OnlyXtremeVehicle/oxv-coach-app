/**
 * Tests du référentiel véhicules 2026 (LOT 11a) — ts-jest node, zéro rendu.
 *
 * ===========================================================================
 * CE TEST RELIT LE CSV SUR LE DISQUE, ET C'EST TOUT SON INTÉRÊT
 * ===========================================================================
 *
 * `referentielVehicules.ts` ne porte NI classe NI ratio : il porte masse et
 * puissance, et recalcule le reste. Une transcription qui recopierait aussi la
 * classe se vérifierait toute seule et ne prouverait rien.
 *
 * La vérification exigée par le document — « aucune valeur de classe n'est
 * saisie en dur », et la classe recalculée doit être celle du référentiel
 * publié — n'a donc de sens qu'en confrontant le module à la pièce
 * contractuelle elle-même. Ce fichier lit
 * `docs/produit/OXV_Referentiel_Vehicules_2026.csv` et compare les 93 lignes,
 * colonne par colonne.
 *
 * S'il échoue un jour, ce sera l'une de deux choses, et il faudra les
 * distinguer avant de toucher quoi que ce soit :
 *   • le CSV a été révisé et le module ne l'a pas suivi — régénérer le module ;
 *   • le module a été édité à la main — le fait divergent est dans le code.
 * Dans aucun des deux cas on ne corrige la classe : on corrige la donnée qui la
 * produit.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { classeDepuisRatio, ratioKgCh } from '../eligibiliteLogic';
import type { ClasseRoulage } from '../eligibiliteLogic';
import {
  NOMBRE_ENTREES,
  REFERENTIEL_VEHICULES,
  REVISION_REFERENTIEL,
  chercheAuReferentiel,
  classeReferentiel,
  libelleEntree,
  marquesDuReferentiel,
  millesimeCouvert,
  modelesDeLaMarque,
  ratioReferentiel,
} from '../referentielVehicules';

// ===========================================================================
// La pièce contractuelle, lue sur le disque
// ===========================================================================

const CHEMIN_CSV = join(process.cwd(), 'docs', 'produit', 'OXV_Referentiel_Vehicules_2026.csv');

interface LigneCsv {
  readonly marque: string;
  readonly modele: string;
  readonly generation: string;
  readonly anneeDebut: string;
  readonly anneeFin: string;
  readonly puissanceCh: string;
  readonly masseKg: string;
  readonly ratioKgCh: string;
  readonly classe: string;
  readonly carrosserie: string;
  readonly motorisation: string;
  readonly statut: string;
  readonly motifExclusion: string;
  readonly revision: string;
}

/** Lecture du CSV publié : BOM UTF-8, séparateur « ; », décimale « , ». */
function lisCsv(): readonly LigneCsv[] {
  const brut = readFileSync(CHEMIN_CSV, 'utf8').replace(/^﻿/, '');
  const lignes = brut.split(/\r?\n/).filter((l) => l.trim() !== '');
  return lignes.slice(1).map((l) => {
    const c = l.split(';');
    return {
      marque: c[0],
      modele: c[1],
      generation: c[2],
      anneeDebut: c[3],
      anneeFin: c[4],
      puissanceCh: c[5],
      masseKg: c[6],
      ratioKgCh: c[7],
      classe: c[8],
      carrosserie: c[9],
      motorisation: c[10],
      statut: c[11],
      motifExclusion: c[12],
      revision: c[13],
    };
  });
}

const CSV = lisCsv();

/** « 5,75 » → 5.75. Le CSV porte la décimale française. */
const nombreFr = (v: string): number => Number(v.replace(',', '.'));

// ===========================================================================
// La transcription
// ===========================================================================

describe('transcription du CSV', () => {
  it('le CSV publié tient 93 lignes, et le module autant', () => {
    expect(CSV).toHaveLength(93);
    expect(NOMBRE_ENTREES).toBe(93);
    expect(REFERENTIEL_VEHICULES).toHaveLength(93);
  });

  it('le millésime déclaré est celui de toutes les lignes du CSV', () => {
    expect(REVISION_REFERENTIEL).toBe('2026');
    for (const l of CSV) expect(l.revision).toBe(REVISION_REFERENTIEL);
  });

  it('les 93 triplets marque / modèle / génération se retrouvent un à un', () => {
    const manquants = CSV.filter(
      (l) => chercheAuReferentiel(l.marque, l.modele, l.generation) === null
    ).map((l) => `${l.marque} ${l.modele} ${l.generation}`);
    expect(manquants).toEqual([]);
  });

  it('aucun triplet en double — la recherche serait ambiguë', () => {
    const cles = REFERENTIEL_VEHICULES.map(libelleEntree);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('masse, puissance, années, carrosserie et motorisation sont fidèles au CSV', () => {
    const ecarts: string[] = [];
    for (const l of CSV) {
      const e = chercheAuReferentiel(l.marque, l.modele, l.generation);
      if (e === null) continue;
      const attendu = {
        puissanceCh: Number(l.puissanceCh),
        masseKg: Number(l.masseKg),
        anneeDebut: Number(l.anneeDebut),
        anneeFin: l.anneeFin === '' ? null : Number(l.anneeFin),
        carrosserie: l.carrosserie,
        motorisation: l.motorisation,
      };
      const obtenu = {
        puissanceCh: e.puissanceCh,
        masseKg: e.masseKg,
        anneeDebut: e.anneeDebut,
        anneeFin: e.anneeFin,
        carrosserie: e.carrosserie,
        motorisation: e.motorisation,
      };
      if (JSON.stringify(attendu) !== JSON.stringify(obtenu)) {
        ecarts.push(`${libelleEntree(e)} : ${JSON.stringify(obtenu)} ≠ ${JSON.stringify(attendu)}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});

// ===========================================================================
// LA VÉRIFICATION EXIGÉE — la classe recalculée contre la classe publiée
// ===========================================================================

describe('aucune valeur de classe saisie en dur', () => {
  it('le module ne porte littéralement aucune classe — la table n’a que des faits', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'features', 'vehicules', 'referentielVehicules.ts'),
      'utf8'
    );
    const table = source.slice(
      source.indexOf('const TABLE'),
      source.indexOf('];\n\n/** Le référentiel')
    );
    expect(table).not.toMatch(/'(I|II|III)'/);
  });

  it('les 93 classes du CSV sont celles que `classeDepuisRatio` recalcule', () => {
    const divergences: string[] = [];
    for (const l of CSV) {
      const recalculee = classeDepuisRatio(Number(l.masseKg), Number(l.puissanceCh));
      if (recalculee !== (l.classe as ClasseRoulage)) {
        divergences.push(
          `${l.marque} ${l.modele} ${l.generation} — ${l.masseKg} kg / ${l.puissanceCh} ch : ` +
            `CSV « ${l.classe} », recalculée « ${recalculee ?? '—'} »`
        );
      }
    }
    expect(divergences).toEqual([]);
  });

  it('les 93 ratios du CSV sont ceux que `ratioKgCh` recalcule', () => {
    const divergences: string[] = [];
    for (const l of CSV) {
      const recalcule = ratioKgCh(Number(l.masseKg), Number(l.puissanceCh));
      if (recalcule !== nombreFr(l.ratioKgCh)) {
        divergences.push(
          `${l.marque} ${l.modele} ${l.generation} : CSV « ${l.ratioKgCh} », recalculé « ${recalcule ?? '—'} »`
        );
      }
    }
    expect(divergences).toEqual([]);
  });

  it('les accesseurs du module rendent la même chose que le CSV', () => {
    for (const l of CSV) {
      const e = chercheAuReferentiel(l.marque, l.modele, l.generation);
      expect(e).not.toBeNull();
      expect(classeReferentiel(e as NonNullable<typeof e>)).toBe(l.classe);
      expect(ratioReferentiel(e as NonNullable<typeof e>)).toBe(nombreFr(l.ratioKgCh));
    }
  });

  it('la répartition publiée est retrouvée — 16 en I, 48 en II, 29 en III', () => {
    const comptes = { I: 0, II: 0, III: 0 };
    for (const e of REFERENTIEL_VEHICULES) {
      const c = classeReferentiel(e);
      expect(c).not.toBeNull();
      comptes[c as ClasseRoulage] += 1;
    }
    expect(comptes).toEqual({ I: 16, II: 48, III: 29 });
  });
});

// ===========================================================================
// Le référentiel est dans le périmètre, par construction
// ===========================================================================

describe('toutes les entrées tiennent dans C3 et C4', () => {
  it('aucune masse au-delà de 2 400 kg', () => {
    const hors = REFERENTIEL_VEHICULES.filter((e) => e.masseKg > 2400).map(libelleEntree);
    expect(hors).toEqual([]);
  });

  it('aucun ratio au-delà de 6,0 kg/ch, donc aucune entrée sans classe', () => {
    const sansClasse = REFERENTIEL_VEHICULES.filter((e) => classeReferentiel(e) === null).map(
      libelleEntree
    );
    expect(sansClasse).toEqual([]);
  });

  it('le CSV publié ne porte que des lignes actives, sans motif d’exclusion', () => {
    for (const l of CSV) {
      expect(l.statut).toBe('actif');
      expect(l.motifExclusion).toBe('');
    }
  });
});

// ===========================================================================
// La recherche
// ===========================================================================

describe('recherche au référentiel', () => {
  it('retrouve une entrée exacte', () => {
    const e = chercheAuReferentiel('Porsche', 'Cayman', '718 GT4');
    expect(e).not.toBeNull();
    expect(e?.masseKg).toBe(1420);
    expect(classeReferentiel(e as NonNullable<typeof e>)).toBe('III');
  });

  it('tolère casse, accents et ponctuation — un accent ne crée pas un examen pour rien', () => {
    expect(chercheAuReferentiel('MERCEDES-AMG', 'a45 s', 'w177')).not.toBeNull();
    expect(chercheAuReferentiel('  alfa   romeo ', 'Giulia', 'Quadrifóglio')).not.toBeNull();
  });

  it('un véhicule absent rend null — hors référentiel, pas hors périmètre', () => {
    expect(chercheAuReferentiel('Bugatti', 'Chiron', 'Pur Sport')).toBeNull();
  });

  it('deux générations d’un même modèle restent distinctes', () => {
    const base = chercheAuReferentiel('Alpine', 'A110', 'Base');
    const r = chercheAuReferentiel('Alpine', 'A110', 'R');
    expect(base?.masseKg).toBe(1110);
    expect(r?.masseKg).toBe(1082);
    expect(classeReferentiel(base as NonNullable<typeof base>)).toBe('II');
    expect(classeReferentiel(r as NonNullable<typeof r>)).toBe('II');
  });

  it('les marques sont dédoublonnées et triées', () => {
    const marques = marquesDuReferentiel();
    expect(new Set(marques).size).toBe(marques.length);
    expect([...marques].sort()).toEqual([...marques]);
    expect(marques).toContain('Porsche');
  });

  it('la cascade par marque rend les entrées de cette marque, et rien d’autre', () => {
    const porsche = modelesDeLaMarque('porsche');
    expect(porsche.length).toBeGreaterThan(10);
    for (const e of porsche) expect(e.marque).toBe('Porsche');
    expect(modelesDeLaMarque('Bugatti')).toEqual([]);
  });
});

describe('couverture du millésime', () => {
  const abarth = chercheAuReferentiel('Abarth', '595', 'Competizione') as NonNullable<
    ReturnType<typeof chercheAuReferentiel>
  >;
  const a110r = chercheAuReferentiel('Alpine', 'A110', 'R') as NonNullable<
    ReturnType<typeof chercheAuReferentiel>
  >;

  it('les deux bornes sont incluses sur une génération close', () => {
    expect(millesimeCouvert(abarth, 2012)).toBe(true);
    expect(millesimeCouvert(abarth, 2023)).toBe(true);
    expect(millesimeCouvert(abarth, 2011)).toBe(false);
    expect(millesimeCouvert(abarth, 2024)).toBe(false);
  });

  it('une génération toujours commercialisée n’a pas de borne haute', () => {
    expect(a110r.anneeFin).toBeNull();
    expect(millesimeCouvert(a110r, 2022)).toBe(true);
    expect(millesimeCouvert(a110r, 2030)).toBe(true);
    expect(millesimeCouvert(a110r, 2021)).toBe(false);
  });

  it('une année non finie n’est jamais couverte', () => {
    expect(millesimeCouvert(abarth, Number.NaN)).toBe(false);
  });
});
