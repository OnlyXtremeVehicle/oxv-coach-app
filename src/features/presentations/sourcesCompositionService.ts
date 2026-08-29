/**
 * LES PIÈCES DU MOTEUR DE COMPOSITION QUE LA BASE PORTAIT DÉJÀ — lot 10c.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE
 * ===========================================================================
 *
 * Le lot 9a a livré `compositionLogic` avec six entrées nommées sans source :
 * `experience.presentationsVues`, `travailActif`, `faits.acquis`,
 * `faits.reperePiste`, et deux « à confirmer » — `faits.voixCoach` et
 * `faits.referencePartagee`.
 *
 * La vérification contre `database.types.ts` ET contre la base de production
 * (26/08/2026) a tranché. DEUX de ces six existaient déjà, et personne ne les
 * lisait :
 *
 *   `acquis`     → `cycle_steps.status = 'atteint'`. Le commentaire de la table
 *                  en production le dit mot pour mot : « Axes qualitatifs d un
 *                  programme coach. Focus descriptif, statut en_cours/atteint
 *                  observe par le coach, aucun score chiffre. » C'est
 *                  exactement l'acquis du §05.E — « Un acquis existe lorsqu'il
 *                  est prouvé, répété puis conservé », « Le coach valide
 *                  acquisition puis maîtrise » (P46).
 *
 *   `voixCoach`  → `coach_annotations.audio_url`. La colonne existe depuis
 *                  PR-59, `coachAudioService` écrit dedans, et rien ne la
 *                  relisait pour dire « il y a une voix sur cette séance ».
 *
 * Les quatre autres manquent réellement. Elles ne sont PAS repliées ici sur un
 * voisin qui leur ressemble : une source approximative se lit comme une
 * source, et le moteur ouvrirait une fiche sur du vide. Voir l'en-tête de la
 * migration `20260826140000_lot10c_…` pour ce qui les remplacerait.
 *
 * ===========================================================================
 * TROIS VOISINS ÉCARTÉS, ET LA RAISON DE CHACUN
 * ===========================================================================
 *
 *   `coach_objectives.status = 'achieved'` — un OBJECTIF atteint, avec sa cible
 *   chiffrée (`target_value`). P46 parle de COMPÉTENCES (« Qu'est-ce que je
 *   sais mieux faire ? »), et M26 interdit « un score global présenté comme
 *   vérité ». Un objectif chiffré atteint n'est pas une compétence acquise ;
 *   les confondre ferait entrer un chiffre là où le cahier n'en veut pas.
 *
 *   `pilot_goals.status = 'achieved'` — le but que le pilote se fixe à
 *   lui-même, dans un espace que le commentaire de la table décrit comme
 *   « jamais visible des coachs ni admins ». L'acquis de P46/P47 est VALIDÉ par
 *   le coach. Un but auto-déclaré atteint ne l'est pas.
 *
 *   `coach_corner_reference` — « Repères de référence du coach par virage » :
 *   point de freinage en mètres, vitesse cible, note de trajectoire. Le mot
 *   « repère » y est, la chose non : P38 demande « Photo, panneau, vibreur ou
 *   objet réel associé », un ancrage MÉMOIRE au volant. Servir `reperePiste`
 *   depuis cette table ouvrirait P38 sur des mètres et des km/h.
 *
 * ===========================================================================
 * LA RLS EST LA RÈGLE — ON NE LA REJOUE PAS EN TYPESCRIPT
 * ===========================================================================
 *
 * `cycle_steps` n'est lisible par le pilote que si le programme est partagé
 * (`dev_cycles_pilot_select` : `pilot_id = auth.uid() AND is_shared = true`),
 * et par le coach que s'il l'a authoré au niveau « programme ». Rien de tout
 * cela n'est réécrit ici : la requête demande, la base filtre. Deux copies de
 * la même règle finiraient par diverger, et c'est celle du TypeScript qui
 * mentirait — elle n'est opposable à personne.
 *
 * UNE SEULE EXCEPTION, ASSUMÉE : `visibility = 'shared'` sur les annotations.
 * `marqueursSeanceService` a déjà payé ce défaut le 02/08/2026 — une première
 * version lisait `body` sans regarder `visibility` et publiait au pilote un mot
 * que le coach s'était écrit à lui-même. Une voix privée n'ouvre donc pas P36.
 */

import type { FaitsSeance, TravailActif } from '@/features/presentations/compositionLogic';
import { supabase } from '@/lib/supabase';
import { listMyCycles } from '@/services/developmentCycleService';

/**
 * Les deux faits de `FaitsSeance` que ce module sait établir.
 *
 * Le `Pick` n'est pas décoratif : si `compositionLogic` renomme l'un des deux
 * champs, ce fichier cesse de compiler. Une copie des noms l'aurait laissé
 * compiler en alimentant un champ qui n'existe plus.
 */
export type FaitsHumainsSeance = Pick<FaitsSeance, 'acquis' | 'voixCoach'>;

/**
 * Au moins un acquis a-t-il été observé comme atteint par le coach ?
 *
 * Un BOOLÉEN, pas un compte. « Vous avez sept acquis » serait un score déguisé,
 * et M26 l'écarte explicitement. Le moteur n'a besoin que de savoir si la
 * porte de P46–P51 peut s'ouvrir.
 *
 * Ne rejette jamais : une lecture impossible rend `false`. Un débrief ne doit
 * pas tomber parce que la table des programmes n'a pas répondu — il composera
 * une carte de moins, et `ecartees` dira laquelle.
 */
export async function lireAcquisValide(piloteId: string): Promise<boolean> {
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;

  // `listMyCycles` existe déjà et porte la bonne requête. La réécrire ici
  // dupliquerait la sélection de colonnes ET la gestion d'erreur.
  const cycles = await listMyCycles(piloteId).catch(() => []);
  if (cycles.length === 0) return false;

  // Les axes de TOUS les programmes du pilote, clos compris : un acquis prouvé
  // dans un programme terminé reste un acquis. Une requête `in`, pas un appel
  // par programme — `listSteps` est fait pour afficher un programme, pas pour
  // répondre à une question par oui ou par non sur quinze.
  const { data, error } = await supabase
    .from('cycle_steps')
    .select('id')
    .in(
      'cycle_id',
      cycles.map((c) => c.id)
    )
    .eq('status', 'atteint')
    .limit(1);

  if (error) {
    console.warn('[OXV][composition] lireAcquisValide :', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Une voix du coach est-elle rattachée à cette capture, et audible par elle ?
 *
 * Trois filtres, chacun pour une raison :
 *
 *   `visibility = 'shared'`  — une note privée est un mot que le coach s'est
 *                              écrit ; P36 propose de RÉÉCOUTER, et on
 *                              n'ouvre pas une fiche sur un fichier fermé.
 *   `deleted_at is null`     — la table est en suppression douce.
 *   `audio_url is not null`  — la voix, pas le texte.
 *
 * Le fait n'exige PAS que l'annotation porte un marqueur : `donneesRequises` de
 * P36 demande `trace-position` à côté, et c'est là que la position se vérifie.
 * Doubler la condition ici fermerait la fiche sur des séances qui la méritent.
 */
export async function lireVoixCoach(entree: {
  piloteId: string;
  captureId: string;
}): Promise<boolean> {
  const { piloteId, captureId } = entree;
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;
  if (typeof captureId !== 'string' || captureId.length === 0) return false;

  const { data, error } = await supabase
    .from('coach_annotations')
    .select('id')
    .eq('pilot_id', piloteId)
    .eq('telemetry_session_id', captureId)
    .eq('visibility', 'shared')
    .is('deleted_at', null)
    .not('audio_url', 'is', null)
    .limit(1);

  if (error) {
    console.warn('[OXV][composition] lireVoixCoach :', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Les deux faits d'un coup, en parallèle.
 *
 * L'appelant reste libre de les demander séparément : le débrief les veut
 * ensemble, la fiche compétences n'a besoin que du premier.
 */
export async function lireFaitsHumains(entree: {
  piloteId: string;
  captureId: string;
}): Promise<FaitsHumainsSeance> {
  const [acquis, voixCoach] = await Promise.all([
    lireAcquisValide(entree.piloteId),
    lireVoixCoach(entree),
  ]);
  return { acquis, voixCoach };
}

// ===========================================================================
// LES TROIS PIÈCES QUI MANQUAIENT — migration 20260829000000, appliquée le
// 29/08/2026.
// ===========================================================================
//
// L'en-tête de ce fichier disait, au 26/08 : « Les quatre autres manquent
// réellement. » Trois d'entre elles existent désormais en base, et sont lues
// ici. La quatrième — `referencePartagee` (P59) — n'a toujours pas de source :
// elle exige un modèle de CONSENTEMENT inter-pilotes, qui est une décision du
// fondateur et non de la plomberie de lot. Elle reste nommée, pas inventée.
//
// `as never` sur `.from()` : ces tables ne sont pas encore dans
// `database.types.ts`. C'est le motif maison — la requête est correcte, le
// typage du client ne les connaît pas encore.

/** Une ligne de `pilot_presentation_work`, réduite à ce que le moteur lit. */
interface LigneTravail {
  id: string;
  presentation_id: string;
  closed_at: string | null;
}

/**
 * Les présentations que ce pilote a déjà ouvertes.
 *
 * Rend des IDENTIFIANTS, jamais un compte : `plafondNiveau` demande « en a-t-il
 * déjà ouvert une de niveau preuve ? », pas « combien ». La table ne porte
 * d'ailleurs aucun compteur d'ouvertures — compter les regards fabriquerait un
 * chiffre que quelqu'un finirait par afficher.
 *
 * Une lecture impossible rend une liste vide : le pilote retombe au flash,
 * qui est le repli sûr. Jamais une exception — un débrief ne tombe pas parce
 * qu'une table n'a pas répondu.
 */
export async function lirePresentationsVues(piloteId: string): Promise<string[]> {
  if (typeof piloteId !== 'string' || piloteId.length === 0) return [];

  const { data, error } = await supabase
    .from('pilot_presentation_views' as never)
    .select('presentation_id')
    .eq('user_id', piloteId);

  if (error) {
    console.warn('[OXV][composition] lirePresentationsVues :', error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return (data as unknown as { presentation_id: string }[]).map((l) => l.presentation_id);
}

/**
 * Marquer une présentation comme ouverte.
 *
 * `upsert` sur la clé (pilote, présentation) : la première ouverture pose la
 * ligne, les suivantes ne font qu'avancer `last_opened_at`. `first_opened_at`
 * n'est jamais réécrit — c'est la date contre laquelle P48 lit « au prochain
 * événement », et l'écraser effacerait la seule chose que la table sait dire du
 * temps.
 *
 * Ne rejette pas : rater l'enregistrement d'une lecture ne doit pas empêcher
 * cette lecture.
 */
export async function marquerPresentationVue(
  piloteId: string,
  presentationId: string
): Promise<void> {
  if (typeof piloteId !== 'string' || piloteId.length === 0) return;
  if (typeof presentationId !== 'string' || presentationId.length === 0) return;

  const { error } = await supabase.from('pilot_presentation_views' as never).upsert(
    {
      user_id: piloteId,
      presentation_id: presentationId,
      last_opened_at: new Date().toISOString(),
    } as never,
    { onConflict: 'user_id,presentation_id' }
  );

  if (error) console.warn('[OXV][composition] marquerPresentationVue :', error.message);
}

/**
 * Le chantier ouvert, s'il y en a un.
 *
 * Rend `null` quand rien n'est ouvert — et c'est exactement équivalent, pour
 * `choisirOpportunite`, à rendre un travail terminé : les deux le laissent
 * choisir une nouvelle opportunité. On rend donc la forme la plus simple qui
 * dise la vérité.
 *
 * La base garantit qu'il n'y en a qu'un : un index unique partiel sur
 * `(user_id) where closed_at is null`. La règle du §00 est tenue par une
 * contrainte, pas par ce code — une garde applicative se contourne.
 */
export async function lireTravailActif(piloteId: string): Promise<TravailActif | null> {
  if (typeof piloteId !== 'string' || piloteId.length === 0) return null;

  const { data, error } = await supabase
    .from('pilot_presentation_work' as never)
    .select('id, presentation_id, closed_at')
    .eq('user_id', piloteId)
    .is('closed_at', null)
    .limit(1);

  if (error) {
    console.warn('[OXV][composition] lireTravailActif :', error.message);
    return null;
  }
  const lignes = data as unknown as LigneTravail[] | null;
  if (!Array.isArray(lignes) || lignes.length === 0) return null;
  return { id: lignes[0].presentation_id, termine: false };
}

/**
 * Ouvrir un chantier sur une opportunité.
 *
 * Rend `true` si le chantier est ouvert, `false` sinon — et le `false` le plus
 * fréquent n'est pas une panne : c'est l'index unique qui refuse un SECOND
 * chantier. Le §00 vit là, et l'appelant n'a pas à le redemander avant
 * d'écrire.
 */
export async function ouvrirTravail(entree: {
  piloteId: string;
  presentationId: string;
  captureId?: string | null;
}): Promise<boolean> {
  const { piloteId, presentationId } = entree;
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;
  if (typeof presentationId !== 'string' || presentationId.length === 0) return false;

  const { error } = await supabase.from('pilot_presentation_work' as never).insert({
    user_id: piloteId,
    presentation_id: presentationId,
    session_id: entree.captureId ?? null,
  } as never);

  if (error) {
    console.warn('[OXV][composition] ouvrirTravail :', error.message);
    return false;
  }
  return true;
}

/**
 * Conclure le chantier ouvert.
 *
 * `motif` est LIBRE et FACULTATIF, et descriptif : ce qui a été observé, jamais
 * une consigne. `closed_by` porte celui qui conclut ; la RLS refuse de signer
 * au nom d'un autre. Laisser `signataire` vide est un cas normal — le §00
 * admet qu'un travail se conclue par le résultat observé, sans que personne
 * n'ait tranché.
 */
export async function cloturerTravail(entree: {
  piloteId: string;
  motif?: string | null;
  signataire?: string | null;
}): Promise<boolean> {
  const { piloteId } = entree;
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;

  const motif = typeof entree.motif === 'string' ? entree.motif.trim() : '';

  const { error } = await supabase
    .from('pilot_presentation_work' as never)
    .update({
      closed_at: new Date().toISOString(),
      closed_by: entree.signataire ?? null,
      // La base refuse un motif vide : on écrit `null` plutôt qu'une chaîne
      // blanche, qui se lirait comme « quelqu'un a écrit quelque chose ».
      motif_cloture: motif.length > 0 ? motif : null,
    } as never)
    .eq('user_id', piloteId)
    .is('closed_at', null);

  if (error) {
    console.warn('[OXV][composition] cloturerTravail :', error.message);
    return false;
  }
  return true;
}

/**
 * Ce pilote a-t-il posé un repère mémoire sur ce circuit ?
 *
 * Un BOOLÉEN : `faits.reperePiste` demande si P38 peut s'ouvrir, pas combien de
 * repères existent. Le repère lui-même se lit ailleurs, quand la fiche s'ouvre.
 *
 * La validation du coach n'est PAS exigée. `validated_by` à `null` veut dire
 * « pas encore regardé », jamais « refusé » — fermer P38 dessus punirait le
 * pilote de la disponibilité de son coach.
 */
export async function lireReperePiste(entree: {
  piloteId: string;
  circuitId: string;
}): Promise<boolean> {
  const { piloteId, circuitId } = entree;
  if (typeof piloteId !== 'string' || piloteId.length === 0) return false;
  if (typeof circuitId !== 'string' || circuitId.length === 0) return false;

  const { data, error } = await supabase
    .from('pilot_corner_landmarks' as never)
    .select('id')
    .eq('user_id', piloteId)
    .eq('circuit_id', circuitId)
    .limit(1);

  if (error) {
    console.warn('[OXV][composition] lireReperePiste :', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}
