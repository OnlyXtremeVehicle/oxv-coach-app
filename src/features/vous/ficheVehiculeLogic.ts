/**
 * ficheVehiculeLogic — CE QUE LA FICHE VÉHICULE AFFICHE, ET COMMENT ELLE
 * L'ÉCRIT.
 *
 * Lots 1 et 2 de `docs/produit/claude_OXV_Prompt_App_Garage_2026-08-26.md`,
 * doctrine dans `docs/produit/claude_OXV_Eligibilite_Vehicules_2026-08-26.md`.
 *
 * Aucun import natif : ts-jest node (le type `Vehicle` est importé en
 * `import type`, effacé à la compilation).
 *
 * ===========================================================================
 * CE MODULE NE CALCULE NI LE RAPPORT, NI LA CLASSE, NI L'OUVERTURE DES OFFRES
 * ===========================================================================
 *
 * Il les DEMANDE à `src/features/vehicules/eligibiliteLogic.ts`, module
 * canonique du périmètre de service — conditions C1 à C5, seuils de classe,
 * convention de bornes tranchée, arithmétique entière.
 *
 * La première écriture de ce fichier les recalculait, et elle est tombée seule
 * sur l'embûche : `Math.round(x * 100) / 100` publiait 3,93 là où le
 * référentiel publie 3,92 (Audi RS3 8Y) et 3,63 là où il publie 3,62 (Audi
 * TT RS 8S) — parce que Python arrondit AU PAIR, et parce que la
 * multiplication par cent fabrique une hausse qui n'existe pas dans le double
 * d'origine.
 *
 * Deux modules, deux arrondis, deux classes possibles pour un véhicule posé sur
 * un seuil : c'est-à-dire deux référentiels. Celui-ci ne garde donc que ce qui
 * lui revient — LA MISE EN FORME. Les seuils, les bornes et l'ouverture des
 * offres se lisent à un seul endroit.
 *
 * ===========================================================================
 * CE QUE LA BASE PORTE AUJOURD'HUI, ET CE QU'ELLE NE PORTE PAS
 * ===========================================================================
 *
 * Mesuré le 26/08/2026 sur `public.vehicles` (projet `fouvuqkdxarjpjbqnsjq`),
 * dix-sept colonnes :
 *
 *   id, user_id, created_at, updated_at, brand, model, year, license_plate,
 *   color, declared_value, photo_*_url ×4, notes, is_primary, mass_kg
 *
 * La fiche demande huit valeurs. **Trois existent, cinq n'existent pas.**
 *
 *   Marque                    `brand`      — texte libre, saisi par le pilote
 *   Modèle                    `model`      — texte libre, saisi par le pilote
 *   Masse                     `mass_kg`    — EXISTE (numeric(6,1), posée le
 *                                            29/07 par `20260729034110`), zéro
 *                                            ligne renseignée sur six, aucun
 *                                            formulaire ne l'écrit
 *   Génération                             — ABSENTE
 *   Années de la génération                — ABSENTES
 *   Puissance                              — ABSENTE
 *   Rapport masse / puissance              — ABSENT (dérivé des deux ci-dessus)
 *   Classe de roulage                      — ABSENTE (dérivée du rapport)
 *   Concordance HistoVec + horodatage      — ABSENTS
 *
 * `declared_value` N'EST PAS une masse ni une puissance : c'est la valeur
 * assurantielle déclarée, en CENTIMES, saisie côté site. Elle ne sert pas ici.
 *
 * La migration proposée est écrite, NON APPLIQUÉE :
 * `supabase/migrations/PROPOSITION_lot11b_referentiel_vehicules_et_histovec.sql`.
 * Elle pose `vehicles.generation` — la clé qui manque pour rapprocher un
 * véhicule du référentiel — et les trois colonnes HistoVec.
 *
 * ===========================================================================
 * POURQUOI AUCUN RAPPROCHEMENT AUTOMATIQUE
 * ===========================================================================
 *
 * `chercheAuReferentiel` exige un triplet marque / modèle / génération. La
 * génération n'existe pas en base. On pourrait la deviner — retenir la seule
 * génération d'un modèle qui couvre le millésime du véhicule — et cela
 * marcherait souvent.
 *
 * On ne le fait pas. « Souvent » n'est pas une règle, et le prix de l'erreur
 * n'est pas symétrique : un rapprochement fautif affiche une classe fausse,
 * donc un accès faux, sur une donnée que le pilote lira comme un fait. Un
 * « — » n'affiche rien de faux. La fiche attend donc la colonne, et le
 * rattachement explicite qui va avec.
 *
 * ===========================================================================
 * LA CLASSE EST UN FAIT D'ORGANISATION, JAMAIS UN RANG
 * ===========================================================================
 *
 * Le libellé rendu est neutre — « Classe II — GT ». Aucun qualificatif, aucune
 * position relative, aucun effectif par classe : ce module n'expose NI
 * comparateur, NI ordre entre classes.
 *
 * Le bloc « Accès » énonce ce qui est ouvert. Il n'énonce jamais ce qui est
 * fermé, et n'invite jamais à changer de véhicule.
 */

import {
  LIBELLE_OFFRE,
  type ClasseRoulage,
  classeDepuisRatio,
  libelleClasse,
  offresOuvertes,
  ratioKgCh,
} from '@/features/vehicules/eligibiliteLogic';
import {
  chercheAuReferentiel,
  type EntreeReferentiel,
} from '@/features/vehicules/referentielVehicules';
import type { Vehicle } from '@/services/garageService';

/** Absence. Jamais zéro, jamais une valeur inventée. */
export const TIRET = '—';

/**
 * U+202F, espace fine insécable — séparateur de milliers du français, exigé
 * par la micro-typographie du prompt. Elle ne se coupe pas en fin de ligne et
 * ne s'élargit pas à la justification, contrairement à l'espace ordinaire.
 */
const ESPACE_FINE = '\u202F';

/**
 * U+00A0, espace insécable ordinaire — elle sépare le nombre de son UNITÉ.
 * L'espace fine est le séparateur de milliers ; elle serait trop serrée entre
 * « 1 035 » et « kg », où la typographie française demande une insécable pleine.
 */
const ESPACE_INSECABLE = '\u00A0';

export type StatutConcordance = 'verifiee' | 'non_etablie' | 'non_verifie';

/**
 * Ce dont la fiche dispose pour un véhicule du garage.
 *
 * Deux sources, et elles ne disent pas la même chose :
 *
 *   • `entree` — l'entrée du référentiel publié. Elle porte la génération, les
 *     années, la puissance et la masse DE LA GÉNÉRATION. C'est la source
 *     canonique : quand elle existe, elle prime.
 *   • `masseDeclareeKg` — `vehicles.mass_kg`, la masse déclarée sur CE
 *     véhicule. Elle sert quand le référentiel ne dit rien, et c'est la seule
 *     des cinq valeurs techniques qui existe en base aujourd'hui.
 */
export interface SourceFiche {
  entree: EntreeReferentiel | null;
  masseDeclareeKg: number | null;
}

/**
 * Concordance HistoVec. `verifieLe` est un horodatage ISO complet en base ;
 * il est restitué au JOUR — la concordance est un fait du jour, et afficher
 * une minute suggérerait une précision que la réponse HistoVec ne porte pas.
 */
export interface ConcordanceHistovec {
  statut: StatutConcordance;
  verifieLe: string | null;
  /** Motif factuel de la non-concordance. Jamais une qualification de faute. */
  motif: string | null;
}

export interface LigneFiche {
  key: string;
  label: string;
  value: string;
}

/** Fiche vide — l'état de tout véhicule non rattaché au référentiel. */
export const SOURCE_FICHE_ABSENTE: SourceFiche = {
  entree: null,
  masseDeclareeKg: null,
};

/** Concordance non demandée : « — », et aucune alerte. */
export const CONCORDANCE_ABSENTE: ConcordanceHistovec = {
  statut: 'non_verifie',
  verifieLe: null,
  motif: null,
};

/**
 * Mention affichée sous une concordance non établie. Fait d'organisation, sans
 * impératif : le contrôle réel a lieu au paddock, l'application ne bloque rien.
 */
export const MENTION_ADMINISTRATION = 'L’administration OXV traite les écarts de concordance.';

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

function estFini(n: number | null): n is number {
  return n !== null && Number.isFinite(n);
}

/** « 1 035 », espace fine insécable tous les trois chiffres. */
function groupeMilliers(entier: string): string {
  const signe = entier.startsWith('-') ? '-' : '';
  const chiffres = signe ? entier.slice(1) : entier;
  return signe + chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE);
}

/** « 180 ch », « — » si absente. */
export function fmtPuissance(ch: number | null): string {
  if (!estFini(ch)) return TIRET;
  return `${groupeMilliers(String(Math.round(ch)))}${ESPACE_INSECABLE}ch`;
}

/**
 * « 1 035 kg », « 1 082,5 kg » quand la décimale existe, « — » si absente.
 *
 * La colonne est `numeric(6,1)` : la décimale est significative quand elle est
 * renseignée, et parasite quand elle vaut zéro.
 */
export function fmtMasse(kg: number | null): string {
  if (!estFini(kg)) return TIRET;
  const arrondi = Math.round(kg * 10) / 10;
  const entier = Math.trunc(arrondi);
  const decimale = Math.round(Math.abs(arrondi - entier) * 10);
  const corps =
    decimale === 0
      ? groupeMilliers(String(entier))
      : `${groupeMilliers(String(entier))},${decimale}`;
  return `${corps}${ESPACE_INSECABLE}kg`;
}

/** « 5,75 kg/ch », « — » si le rapport n'est pas calculable. */
export function fmtRatio(ratio: number | null): string {
  if (!estFini(ratio)) return TIRET;
  return `${ratio.toFixed(2).replace('.', ',')}${ESPACE_INSECABLE}kg/ch`;
}

/**
 * Années de la génération : « 2012 – 2023 », « depuis 2022 » quand la
 * production court toujours, « — » si rien n'est connu.
 */
export function libelleAnnees(debut: number | null, fin: number | null): string {
  const d = estFini(debut) ? String(Math.round(debut)) : null;
  const f = estFini(fin) ? String(Math.round(fin)) : null;
  if (d !== null && f !== null) return `${d} – ${f}`;
  if (d !== null) return `depuis ${d}`;
  if (f !== null) return `jusqu’en ${f}`;
  return TIRET;
}

/** « 26 août 2026 » depuis un ISO, « — » si illisible ou absent. */
export function formatJour(iso: string | null): string {
  if (iso === null || iso.length === 0) return TIRET;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return TIRET;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Classe et accès — la décision vient d'ailleurs, seul l'affichage est ici
// ---------------------------------------------------------------------------

/** La masse retenue pour la fiche : celle du référentiel, la déclarée à défaut. */
function masseRetenue(source: SourceFiche): number | null {
  return source.entree?.masseKg ?? source.masseDeclareeKg;
}

/**
 * La classe de roulage du véhicule, ou `null` — jamais une classe par défaut.
 *
 * `classeDepuisRatio` ne connaît PAS le plafond de masse (C4), délibérément :
 * le périmètre complet, conditions C1 à C5, est le travail
 * d'`evalueEligibilite`, et il appartient au tunnel de réservation, pas à une
 * fiche de consultation. Aucune des 93 entrées publiées n'est concernée.
 */
export function classeDeLaFiche(source: SourceFiche): ClasseRoulage | null {
  return classeDepuisRatio(masseRetenue(source), source.entree?.puissanceCh ?? null);
}

/** « Classe II — GT », ou « — » si la classe n'est pas établie. */
export function libelleClasseOuTiret(classe: ClasseRoulage | null): string {
  return classe === null ? TIRET : libelleClasse(classe);
}

/**
 * « Access, Signature, Heritage » ou « Access ». « — » si la classe n'est pas
 * établie.
 *
 * Énonce l'ouvert, jamais le fermé. Aucun verbe de restriction, aucune
 * incitation à changer de véhicule.
 */
export function libelleAcces(classe: ClasseRoulage | null): string {
  const offres = offresOuvertes(classe);
  if (offres.length === 0) return TIRET;
  return offres.map((o) => LIBELLE_OFFRE[o]).join(', ');
}

// ---------------------------------------------------------------------------
// Lignes de la fiche
// ---------------------------------------------------------------------------

/**
 * Les six lignes techniques, dans l'ordre du prompt. Marque et modèle vivent
 * au bloc « Spécifications » juste au-dessus : les répéter ici ferait deux
 * fois la même information à deux centimètres d'intervalle.
 */
export function lignesFicheTechnique(source: SourceFiche): LigneFiche[] {
  const entree = source.entree;
  const masse = masseRetenue(source);
  const puissance = entree?.puissanceCh ?? null;
  const generation =
    entree !== null && entree.generation.trim().length > 0 ? entree.generation.trim() : TIRET;

  return [
    { key: 'generation', label: 'Génération', value: generation },
    {
      key: 'annees',
      label: 'Années',
      value: libelleAnnees(entree?.anneeDebut ?? null, entree?.anneeFin ?? null),
    },
    { key: 'puissance', label: 'Puissance', value: fmtPuissance(puissance) },
    { key: 'masse', label: 'Masse', value: fmtMasse(masse) },
    {
      key: 'ratio',
      label: 'Rapport masse / puissance',
      value: fmtRatio(ratioKgCh(masse, puissance)),
    },
    { key: 'classe', label: 'Classe', value: libelleClasseOuTiret(classeDeLaFiche(source)) },
  ];
}

/**
 * Ce dont la fiche dispose pour un véhicule du garage.
 *
 * LA COUTURE, désormais cousue. Elle a été écrite en attente de
 * `vehicles.generation` ; la colonne existe en production depuis le lot 11, avec
 * `puissance_ch`, `referentiel_id` et `mass_kg`. Le motif du `null` en dur —
 * « public.vehicles ne porte pas la génération » — était périmé.
 *
 * LE RAPPROCHEMENT EST EXACT OU IL N'EST PAS. `chercheAuReferentiel` compare
 * marque, modèle ET génération, normalisés. Marque et modèle seuls ne désignent
 * pas une puissance : une 911 « Carrera » couvre trois cents chevaux d'écart
 * selon la génération. Un rapprochement approximatif produirait une classe
 * fausse, donc des formules ouvertes à tort — et la classe est le pivot du
 * périmètre de service. On ne devine pas.
 *
 * TANT QUE LA DONNÉE MANQUE, LA FICHE DIT « NON ÉTABLI », ET C'EST JUSTE.
 * Les six véhicules du parc ont ces colonnes vides au 27/08/2026 : le site les
 * écrit à la confirmation d'une réservation, et ce code n'est pas encore en
 * production. La fiche affichera donc les mêmes tirets qu'avant — mais mesurés
 * sur la donnée au lieu d'être posés par une constante. L'un se résorbe seul à
 * la première réservation ; l'autre serait resté là indéfiniment.
 */
export function ficheDepuisVehicule(v: Vehicle): SourceFiche {
  const { brand, model, generation } = v;
  const entree =
    brand && model && generation ? chercheAuReferentiel(brand, model, generation) : null;
  return { entree, masseDeclareeKg: v.massKg };
}

// ---------------------------------------------------------------------------
// Concordance HistoVec — restituée, jamais bloquante
// ---------------------------------------------------------------------------

export interface RenduConcordance {
  /** Valeur de droite : « Vérifiée », « Non établie », ou « — ». */
  valeur: string;
  /** Ligne factuelle sous la valeur, `null` quand il n'y a rien à dire. */
  detail: string | null;
  /** Vrai pour le seul état où la mention administrative s'affiche. */
  mentionAdministration: boolean;
}

/**
 * Rend les trois états, sans jugement de valeur.
 *
 *   vérifiée      → « Vérifiée », plus le jour de la vérification
 *   non établie   → « Non établie », plus le motif factuel s'il est consigné
 *   non vérifié   → « — », et RIEN d'autre : aucune alerte, aucune couleur,
 *                   aucun appel à l'action
 *
 * Aucun de ces états ne restreint quoi que ce soit dans l'application. Le
 * contrôle a lieu au paddock ; ceci en est la restitution.
 */
export function rendreConcordance(c: ConcordanceHistovec): RenduConcordance {
  if (c.statut === 'verifiee') {
    const jour = formatJour(c.verifieLe);
    return {
      valeur: 'Vérifiée',
      detail: jour === TIRET ? null : `Vérification du ${jour}`,
      mentionAdministration: false,
    };
  }
  if (c.statut === 'non_etablie') {
    const motif = c.motif !== null && c.motif.trim().length > 0 ? c.motif.trim() : null;
    return { valeur: 'Non établie', detail: motif, mentionAdministration: true };
  }
  return { valeur: TIRET, detail: null, mentionAdministration: false };
}
