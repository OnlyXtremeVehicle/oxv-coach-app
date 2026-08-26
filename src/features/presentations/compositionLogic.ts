/**
 * LE MOTEUR DE COMPOSITION — quelles présentations ce run permet d'ouvrir. PUR.
 *
 * Sans React, sans react-native, sans Supabase. Mêmes entrées, même sortie.
 *
 * ===========================================================================
 * LA DEMANDE, ET CE QU'ELLE VEUT DIRE MÉCANIQUEMENT
 * ===========================================================================
 *
 * *« Créer de nouvelles présentations en fonction du souhait du pilote et de
 * son expérience avec OXV, automatiquement. »*
 *
 * « Créer » ne veut pas dire inventer une vue : les soixante-cinq existent, et
 * `registrePresentations` les porte. Cela veut dire COMPOSER — choisir, dans
 * ce catalogue, celles qui ont un sens ce soir-là, pour ce pilote-là, avec ce
 * que la séance a réellement mesuré, et les ordonner.
 *
 * Le moteur ne fabrique donc rien. Il refuse beaucoup, et il dit pourquoi :
 * `ecartees` porte, pour chaque fiche laissée de côté, le fait qui l'écarte.
 * Une composition sans son revers serait un choix opaque, et un choix opaque
 * est un score déguisé.
 *
 * ===========================================================================
 * LES QUATRE RÈGLES DU §00, ET OÙ ELLES SONT TENUES
 * ===========================================================================
 *
 *   1. « Force d'abord » — les fiches de rôle `reussite` passent devant celles
 *      de rôle `opportunite`. Tenu par `RANG_ROLE`, vérifié par le test
 *      « la réussite passe devant l'opportunité ».
 *
 *   2. « Une seule opportunité : les autres restent cachées jusqu'à ce que le
 *      travail actif soit terminé » — `choisirOpportunite`. Une seule sort, et
 *      tant qu'un `travailActif` n'est pas `termine`, c'est LUI, sans qu'aucune
 *      autre ne puisse prendre sa place.
 *
 *   3. « Aucune présentation dont la donnée requise est absente ou en confiance
 *      faible » — `donneesDisponibles`, qui retire les grandeurs MESURÉES de
 *      l'ensemble disponible quand la confiance du tour est faible.
 *
 *   4. « Jamais P55–P65 au pilote » (§06) — deux verrous : la surface de la
 *      fiche, et `estMoteurDePreuve` sur l'intervalle. Une surface mal recopiée
 *      ne suffirait pas à ouvrir la porte.
 *
 * Et la cinquième, qui n'est pas dans le §00 mais dans la doctrine du dépôt :
 * **jamais de score global.** La composition ne rend aucun agrégat, aucun rang,
 * aucun pourcentage. Un test parcourt la sortie et le vérifie.
 *
 * ===========================================================================
 * L'EXPÉRIENCE CHANGE LA PROFONDEUR, JAMAIS L'ACCÈS
 * ===========================================================================
 *
 * LA RÈGLE RETENUE, ÉCRITE EN CLAIR :
 *
 *   Un pilote qui débute et un pilote de vingt séances reçoivent le même
 *   CATALOGUE. Ce qui diffère est ce qui S'OUVRE TOUT SEUL — le niveau de
 *   lecture par défaut, et le nombre de cartes du débrief. Rien n'est retiré :
 *   une fiche au-dessus du plafond sort avec `parDefaut: false` et le motif qui
 *   le dit ; elle reste dans la liste, ouvrable d'un geste.
 *
 * C'est la mécanique du §00 — *« Preuve progressive : un toucher ouvre
 * l'animation ; un second ouvre les traces et la méthode »* — et non un tri
 * entre ce qu'un pilote « peut » voir et ce qu'il ne pourrait pas. La doctrine
 * OXV interdit le paternalisme autant que la surcharge : on ne cache pas une
 * mesure à quelqu'un parce qu'on le juge trop neuf pour elle. On ne la lui
 * jette pas non plus au visage le premier soir.
 *
 * Le plafond monte aussi par l'USAGE, pas seulement par le compteur de
 * séances : un pilote qui a déjà ouvert une lecture de niveau preuve a montré
 * qu'il la voulait. Le compteur n'a plus rien à dire après ça.
 *
 * ===========================================================================
 * CE QUE LE SOUHAIT FAIT, ET CE QU'IL NE FAIT PAS
 * ===========================================================================
 *
 * Le souhait — l'intention posée avant de rouler (`planDeRunLogic`) et le
 * thème nommé après le run (`qcmLogic`) — ne FILTRE rien. Il départage.
 *
 * Un pilote qui a nommé « le freinage » voit remonter les fiches qui éclairent
 * le freinage, et c'est parmi elles que l'opportunité active est choisie si
 * elle s'y trouve. Aucune fiche n'est écartée pour ne pas correspondre : ce
 * serait décider à sa place que le reste ne l'intéresse pas.
 *
 * `ressentiSaisonLogic` le formule pour la saison, et c'est vrai ici aussi :
 * *on compte, on n'interprète pas.* Le moteur ne conclut pas qu'un thème nommé
 * est une faiblesse. Il constate qu'il occupe le pilote, et met devant.
 */

import type { NiveauConfiance } from '@/features/data/confianceLogic';
import { THEMES_LIBELLES } from '@/features/data/saison/ressentiSaisonLogic';
import type { PlanDeRun } from '@/features/rec/planDeRunLogic';
import type { RessentiQcm, ThemeQcm } from '@/features/rec/qcmLogic';
import { etatNiveau, type EtatSeance } from '@/telemetry/niveaux';

import {
  DONNEES_MESUREES,
  FICHES,
  LIBELLES_DONNEES,
  LIBELLES_NIVEAUX,
  estMoteurDePreuve,
  type CleDonnee,
  type FichePresentation,
  type IdPresentation,
  type MomentPresentation,
  type NiveauLecture,
  type RolePresentation,
} from './registrePresentations';

/** Version du moteur — à incrémenter dès qu'une règle de composition change. */
export const VERSION_COMPOSITION = 'composition-presentations-1.0.0';

// ===========================================================================
// Seuils — conventions nommées, À VALIDER SUR PISTE.
// Aucun n'est une mesure : ce sont des choix de lecture, remplaçables dès
// qu'une campagne sur circuit dira mieux.
// ===========================================================================

/**
 * En deçà de ce nombre de séances, la lecture qui s'ouvre d'elle-même reste le
 * flash. Trois séances, c'est-à-dire à peu près une journée de piste : de quoi
 * avoir vu un débrief, l'avoir relu, et être revenu. À valider sur piste.
 */
export const SEANCES_POUR_PREUVE = 3;

/**
 * Au-delà, le débrief s'autorise plus de cartes. Douze séances, soit trois ou
 * quatre journées : le pilote sait où il regarde. À valider sur piste.
 */
export const SEANCES_POUR_LECTURE_LARGE = 12;

/**
 * Le budget de cartes du débrief pilote, par palier d'expérience.
 *
 * Le premier chiffre n'est pas choisi ici : le §02 du cahier écrit « Écran
 * pilote · 3 cartes », et le §00 les nomme — réussite, opportunité, suite. Les
 * deux autres sont des conventions. À valider sur piste.
 */
export const CARTES_PREMIERES_SEANCES = 3;
export const CARTES_SEANCES_ETABLIES = 5;
export const CARTES_LECTURE_LARGE = 8;

/**
 * Le budget du plan de travail coach.
 *
 * Celui-là non plus n'est pas inventé : la fiche P34 « Pile de preuves coach »
 * porte TEXTE « 5 dossiers max ».
 */
export const DOSSIERS_COACH = 5;

// ===========================================================================
// Entrées
// ===========================================================================

/** Qui lit. Le Lab et le coach ne sont pas des pilotes plus avancés. */
export type SurfaceLecteur = 'pilote' | 'coach' | 'lab';

/**
 * Ce que le pilote a déjà vécu avec OXV.
 *
 * `journees` compte les JOURNÉES DE PISTE, pas les séances : la fiche P48
 * demande « Ai-je conservé ce que j'avais appris ? » au *prochain événement*,
 * et deux runs du même après-midi ne sont pas deux événements.
 */
export interface ExperiencePilote {
  /** Séances déjà roulées, toutes journées confondues. */
  seances: number;
  /** Journées de piste distinctes. */
  journees: number;
  /** Circuits roulés — identifiants, dédoublonnés ici. */
  circuits: readonly string[];
  /** Présentations déjà ouvertes, par identifiant. */
  presentationsVues: readonly string[];
}

/**
 * Ce que le pilote a dit vouloir.
 *
 * Deux sources, toutes deux déjà dans le dépôt : la carte du run
 * (`composerPlanDeRun`, lot 7a) pour ce qu'il avait posé AVANT, et le QCM
 * d'entre-runs (`qcmLogic`) pour ce qu'il a nommé APRÈS.
 */
export interface SouhaitPilote {
  /** La carte composée avant de rouler. `null` = aucune. */
  plan: PlanDeRun | null;
  /** Le thème nommé après le run. `null` = question passée, ou pas posée. */
  theme: ThemeQcm | null;
  /** Le ressenti associé. `null` = idem. */
  ressenti: RessentiQcm | null;
}

/**
 * Les faits de contexte de la séance — tout ce qui ne se déduit pas des trames.
 *
 * Tous les champs sont REQUIS. L'appelant dit explicitement ce qu'il n'a pas ;
 * il ne l'omet pas. C'est la leçon de `entreesOptionnelles` : une entrée
 * optionnelle que personne ne renseigne devient un repli invisible.
 */
export interface FaitsSeance {
  /** Le passage est situé sur le tracé (projection curviligne exploitable). */
  tracePosition: boolean;
  /** L'état de la chaîne de mesure a été relevé (boîtier, liaison, réseau). */
  santeChaine: boolean;
  /** L'avancement du traitement de ce run est connu. */
  etatTraitement: boolean;
  /** Une vidéo du run est rattachée et alignée. */
  video: boolean;
  /** Un coach est rattaché au compte du pilote. */
  coachLie: boolean;
  /** Une consigne du coach porte sur cette séance. */
  consigneCoach: boolean;
  /** Un message vocal du coach est rattaché à une preuve. */
  voixCoach: boolean;
  /** Un repère réel de piste est associé (photo, panneau, vibreur). */
  reperePiste: boolean;
  /** Au moins un acquis a été validé. */
  acquis: boolean;
  /** Une référence publiée et consentie est disponible. */
  referencePartagee: boolean;
  /** Le direct du run est disponible. */
  live: boolean;
  /** Le direct de plusieurs pilotes est disponible. */
  flotteLive: boolean;
  /** Des canaux véhicule (CAN/OBD) sont branchés. */
  canauxVehicule: boolean;
  /** Runs de la journée en cours, celui-ci compris. */
  runsDeLaJournee: number;
}

/**
 * Ce que la séance permet de lire.
 *
 * `etat` est l'objet de `src/telemetry/niveaux.ts`, sans copie : c'est déjà lui
 * qui sait qu'un delta demande deux tours de longueur voisine, et que le
 * freinage se lit sans gyroscope. Le redire ici en ferait deux vérités.
 */
export interface DisponibiliteSeance {
  etat: EtatSeance;
  /** La note de `confianceLogic` sur le tour lu. `null` = non évaluée. */
  confiance: NiveauConfiance | null;
  faits: FaitsSeance;
}

/**
 * L'opportunité en cours de travail.
 *
 * §00 : *« les autres restent cachées jusqu'à ce que le travail actif soit
 * terminé »*. Sans cette entrée, le moteur rouvrirait un chantier différent à
 * chaque run, et le pilote n'en finirait aucun.
 */
export interface TravailActif {
  /** L'identifiant de la présentation d'opportunité en cours. */
  id: string;
  /** Le travail est-il conclu (résultat observé, ou coach ayant tranché) ? */
  termine: boolean;
}

export interface EntreeComposition {
  surface: SurfaceLecteur;
  experience: ExperiencePilote;
  souhait: SouhaitPilote;
  disponibilite: DisponibiliteSeance;
  /** `null` = aucun travail ouvert. */
  travailActif: TravailActif | null;
}

// ===========================================================================
// Sorties
// ===========================================================================

export interface PresentationComposee {
  id: IdPresentation;
  nom: string;
  niveau: NiveauLecture;
  role: RolePresentation;
  moment: MomentPresentation;
  /**
   * Vraie quand la présentation s'ouvre d'elle-même. Fausse ne veut PAS dire
   * fermée : elle est dans la liste, et le motif dit ce qui la met en second
   * rang — un niveau de lecture au-dessus du plafond, ou un budget de cartes
   * atteint.
   */
  parDefaut: boolean;
  /** Pourquoi elle est là, et à ce rang. Factuel, jamais un jugement. */
  motifs: readonly string[];
}

export interface PresentationEcartee {
  id: IdPresentation;
  /** Le fait qui l'écarte. Une seule cause, la première rencontrée. */
  motif: string;
}

export interface Composition {
  version: string;
  /** Le niveau de lecture qui s'ouvre de lui-même. Au-delà : sur demande. */
  plafondNiveau: NiveauLecture;
  /** Budget de cartes du débrief. `null` = aucun budget (densité autorisée). */
  cartesParDefaut: number | null;
  /** La liste ORDONNÉE. */
  presentations: readonly PresentationComposee[];
  /** Ce qui n'a pas pu être composé, et pourquoi. */
  ecartees: readonly PresentationEcartee[];
}

// ===========================================================================
// Ce que la séance rend disponible
// ===========================================================================

/** Ce que le moteur a pu réunir, et ce que la confiance basse lui a repris. */
export interface DonneesSeance {
  /** Les données réellement présentées comme exploitables. */
  disponibles: ReadonlySet<CleDonnee>;
  /**
   * Les données PRÉSENTES mais retenues faute de confiance de mesure.
   * Elles existent : c'est la lecture qu'on refuse, pas la donnée qu'on nie.
   */
  retenuesParConfiance: ReadonlySet<CleDonnee>;
}

function circuitsDistincts(circuits: readonly string[]): number {
  const vus = new Set<string>();
  for (const c of circuits) {
    const t = c.trim();
    if (t.length > 0) vus.add(t);
  }
  return vus.size;
}

/**
 * Ce que la séance et le contexte rendent lisible.
 *
 * Les grandeurs mesurées viennent de `niveaux.ts` — jamais d'un second calcul
 * posé ici. Le freinage est tiré du niveau `delta` et non de `phases`, parce
 * que c'est là qu'il est : `detectBrakingZones` ne consomme que l'accélération
 * longitudinale, dérivée de la seule vitesse. Le ranger derrière le gyroscope
 * cacherait une lecture disponible sur toute séance, et `niveaux.ts` le dit.
 */
export function donneesDisponibles(entree: EntreeComposition): DonneesSeance {
  const { disponibilite, souhait, experience } = entree;
  const presentes = new Set<CleDonnee>();

  // ---- Les grandeurs mesurées, par les niveaux de restitution -------------
  const ouvert = (cle: Parameters<typeof etatNiveau>[0]): boolean =>
    etatNiveau(cle, disponibilite.etat).ouvert;

  if (ouvert('chrono')) presentes.add('tour-chronometre');
  if (ouvert('regularite')) presentes.add('repetition');
  if (ouvert('delta')) {
    presentes.add('tours-comparables');
    presentes.add('delta');
    presentes.add('freinage');
  }
  if (ouvert('phases')) {
    presentes.add('gyroscope');
    presentes.add('segmentation-virages');
  }
  if (ouvert('enveloppe')) presentes.add('accelerations');

  // ---- Les faits de contexte ---------------------------------------------
  const f = disponibilite.faits;
  if (f.tracePosition) presentes.add('trace-position');
  if (f.santeChaine) presentes.add('sante-chaine');
  if (f.etatTraitement) presentes.add('etat-traitement');
  if (f.video) presentes.add('video');
  if (f.coachLie) presentes.add('coach-lie');
  if (f.consigneCoach) presentes.add('consigne-coach');
  if (f.voixCoach) presentes.add('voix-coach');
  if (f.reperePiste) presentes.add('repere-piste');
  if (f.acquis) presentes.add('acquis');
  if (f.referencePartagee) presentes.add('reference-partagee');
  if (f.live) presentes.add('live');
  if (f.flotteLive) presentes.add('flotte-live');
  if (f.canauxVehicule) presentes.add('canaux-vehicule');
  if (f.runsDeLaJournee >= 2) presentes.add('plusieurs-runs');

  // ---- Ce que le pilote a posé lui-même ----------------------------------
  if (souhait.plan !== null && souhait.plan.intention !== null) presentes.add('intention');
  if (souhait.theme !== null && souhait.ressenti !== null) presentes.add('ressenti');

  // ---- Ce que son histoire apporte ----------------------------------------
  if (experience.journees >= 2) presentes.add('plusieurs-evenements');
  if (circuitsDistincts(experience.circuits) >= 2) presentes.add('plusieurs-circuits');

  // ---- La note de mesure --------------------------------------------------
  // Sa PRÉSENCE suffit : P17 et P64 existent pour dire qu'elle est basse.
  if (disponibilite.confiance !== null) presentes.add('confiance-mesure');

  // ---- Confiance faible : les grandeurs mesurées ne se présentent pas -----
  const retenues = new Set<CleDonnee>();
  if (disponibilite.confiance === 'faible') {
    for (const cle of presentes) {
      if (DONNEES_MESUREES.has(cle)) retenues.add(cle);
    }
    for (const cle of retenues) presentes.delete(cle);
  }

  return { disponibles: presentes, retenuesParConfiance: retenues };
}

// ===========================================================================
// Profondeur : plafond de niveau et budget de cartes
// ===========================================================================

/**
 * Le niveau de lecture qui s'ouvre de lui-même.
 *
 * Jamais 3 pour un pilote : le §06 réserve le niveau Lab au coach et à
 * l'analyste, et la surface le tient déjà. Le redire ici est le second verrou.
 */
export function plafondNiveau(entree: EntreeComposition): NiveauLecture {
  if (entree.surface !== 'pilote') return 3;

  if (entree.experience.seances >= SEANCES_POUR_PREUVE) return 2;

  // L'usage vaut le compteur : une preuve déjà ouverte a répondu à la question.
  const dejaOuvertUnePreuve = entree.experience.presentationsVues.some((id) => {
    const fiche = FICHES.find((p) => p.id === id);
    return fiche !== undefined && fiche.niveau >= 2;
  });
  return dejaOuvertUnePreuve ? 2 : 1;
}

/** Le budget de cartes du débrief. `null` = aucun (densité autorisée, §01). */
export function cartesParDefaut(entree: EntreeComposition): number | null {
  if (entree.surface === 'lab') return null;
  if (entree.surface === 'coach') return DOSSIERS_COACH;
  if (entree.experience.seances >= SEANCES_POUR_LECTURE_LARGE) return CARTES_LECTURE_LARGE;
  if (entree.experience.seances >= SEANCES_POUR_PREUVE) return CARTES_SEANCES_ETABLIES;
  return CARTES_PREMIERES_SEANCES;
}

// ===========================================================================
// Composition
// ===========================================================================

const RANG_MOMENT: Readonly<Record<MomentPresentation, number>> = { avant: 0, apres: 1 };

/**
 * L'ordre du §00 : *« une réussite, une opportunité, une preuve, une phrase
 * humaine et un prochain test »*. La réussite ouvre, l'opportunité suit, le
 * reste vient après.
 */
const RANG_ROLE: Readonly<Record<RolePresentation, number>> = {
  reussite: 0,
  opportunite: 1,
  autre: 2,
};

function surfaceAccepte(fiche: FichePresentation, surface: SurfaceLecteur): boolean {
  if (surface === 'pilote') {
    // Deux verrous pour une règle du §06.
    return fiche.surfaces.includes('pilote') && !estMoteurDePreuve(fiche.id);
  }
  return fiche.surfaces.includes(surface);
}

/** Le libellé du thème, tel que le carnet de saison l'écrit déjà. */
function libelleTheme(theme: ThemeQcm): string {
  return THEMES_LIBELLES[theme] ?? theme;
}

interface Candidate {
  fiche: FichePresentation;
  index: number;
  surLeTheme: boolean;
  dejaVue: boolean;
  motifs: string[];
}

/**
 * L'opportunité active, et une seule.
 *
 * Tant qu'un travail est ouvert et non terminé, c'est lui — et si sa donnée a
 * disparu (une séance sans tour comparable, par exemple), AUCUNE autre ne prend
 * sa place : le chantier reste ouvert, il n'est pas remplacé en douce.
 */
function choisirOpportunite(
  candidates: readonly Candidate[],
  travailActif: TravailActif | null
): { active: Candidate | null; travailEnCours: boolean } {
  const opportunites = candidates.filter((c) => c.fiche.role === 'opportunite');
  if (opportunites.length === 0) return { active: null, travailEnCours: false };

  if (travailActif !== null && !travailActif.termine) {
    const active = opportunites.find((c) => c.fiche.id === travailActif.id) ?? null;
    return { active, travailEnCours: true };
  }

  // Le thème nommé départage ; à défaut, l'ordre du catalogue.
  const surLeTheme = opportunites.find((c) => c.surLeTheme);
  return { active: surLeTheme ?? opportunites[0], travailEnCours: false };
}

/**
 * Compose la liste ordonnée des présentations que ce run permet d'ouvrir.
 *
 * Pure : aucun accès réseau, aucune horloge, aucun aléa.
 */
export function composerPresentations(entree: EntreeComposition): Composition {
  const { disponibles, retenuesParConfiance } = donneesDisponibles(entree);
  const plafond = plafondNiveau(entree);
  const budget = cartesParDefaut(entree);

  const theme = entree.souhait.theme;
  const vues = new Set(entree.experience.presentationsVues);

  const ecartees: PresentationEcartee[] = [];
  const candidates: Candidate[] = [];

  FICHES.forEach((fiche, index) => {
    // ---- Surface ---------------------------------------------------------
    if (!surfaceAccepte(fiche, entree.surface)) {
      ecartees.push({
        id: fiche.id,
        motif: estMoteurDePreuve(fiche.id)
          ? 'moteur de preuve du coach et du Lab'
          : 'lecture d’une autre surface que la vôtre',
      });
      return;
    }

    // ---- Données requises -------------------------------------------------
    const manquante = fiche.donneesRequises.find((cle) => !disponibles.has(cle));
    if (manquante !== undefined) {
      ecartees.push({
        id: fiche.id,
        motif: retenuesParConfiance.has(manquante)
          ? `confiance de mesure faible sur ce tour : ${LIBELLES_DONNEES[manquante]}`
          : `donnée absente : ${LIBELLES_DONNEES[manquante]}`,
      });
      return;
    }

    const surLeTheme = theme !== null && fiche.themes.includes(theme);
    const motifs: string[] = ['la séance porte ce que cette lecture demande'];
    if (surLeTheme && theme !== null) {
      motifs.push(`vous avez nommé ${libelleTheme(theme)} après ce run`);
    }

    candidates.push({ fiche, index, surLeTheme, dejaVue: vues.has(fiche.id), motifs });
  });

  // ---- Une seule opportunité ---------------------------------------------
  const { active, travailEnCours } = choisirOpportunite(candidates, entree.travailActif);
  const retenues: Candidate[] = [];
  for (const c of candidates) {
    if (c.fiche.role !== 'opportunite') {
      retenues.push(c);
      continue;
    }
    if (active !== null && c.fiche.id === active.fiche.id) {
      c.motifs.push(
        travailEnCours ? 'le travail ouvert sur cette zone' : 'seule zone à explorer pour l’instant'
      );
      retenues.push(c);
      continue;
    }
    ecartees.push({
      id: c.fiche.id,
      motif: travailEnCours
        ? 'un travail est en cours ; les autres zones restent fermées'
        : 'une seule zone à explorer à la fois',
    });
  }

  // ---- Ordre --------------------------------------------------------------
  retenues.sort((a, b) => {
    const m = RANG_MOMENT[a.fiche.moment] - RANG_MOMENT[b.fiche.moment];
    if (m !== 0) return m;
    const r = RANG_ROLE[a.fiche.role] - RANG_ROLE[b.fiche.role];
    if (r !== 0) return r;
    const t = Number(b.surLeTheme) - Number(a.surLeTheme);
    if (t !== 0) return t;
    const v = Number(a.dejaVue) - Number(b.dejaVue);
    if (v !== 0) return v;
    return a.index - b.index;
  });

  // ---- Ce qui s'ouvre de soi-même ----------------------------------------
  let cartesUtilisees = 0;
  const presentations: PresentationComposee[] = retenues.map((c) => {
    const motifs = [...c.motifs];
    if (c.dejaVue) motifs.push('déjà ouverte lors d’une séance précédente');

    let parDefaut: boolean;
    if (c.fiche.niveau > plafond) {
      parDefaut = false;
      motifs.push(`lecture ${LIBELLES_NIVEAUX[c.fiche.niveau]} — elle s’ouvre d’un geste`);
    } else if (c.fiche.moment === 'avant') {
      // Le cadrage d'avant-run n'est pas une carte du débrief : il a son écran.
      parDefaut = true;
    } else if (budget === null || cartesUtilisees < budget) {
      parDefaut = true;
      cartesUtilisees++;
    } else {
      parDefaut = false;
      motifs.push('au-delà des cartes du débrief — elle s’ouvre d’un geste');
    }

    return {
      id: c.fiche.id,
      nom: c.fiche.nom,
      niveau: c.fiche.niveau,
      role: c.fiche.role,
      moment: c.fiche.moment,
      parDefaut,
      motifs,
    };
  });

  return {
    version: VERSION_COMPOSITION,
    plafondNiveau: plafond,
    cartesParDefaut: budget,
    presentations,
    ecartees,
  };
}
