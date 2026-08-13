/**
 * L'état de la file de capture, rendu LISIBLE — lecture Supabase-free.
 *
 * Pendant « accès au disque » de `features/rec/syncEnAttenteLogic`, qui porte
 * tout le discernement et reste testable sans banc de fichiers.
 *
 * ===========================================================================
 * CE SERVICE N'EXISTAIT PAS, ET C'EST TOUT LE PROBLÈME
 * ===========================================================================
 *
 * `hasPending`, `pendingSessionIds` et le dossier de quarantaine n'avaient
 * AUCUN appelant hors des tests. Une séance entière pouvait dormir sur le
 * téléphone sans le moindre signe — pas de bandeau, pas de compteur, pas
 * d'écran de diagnostic. Le seul symptôme externe était une ligne figée en
 * `recording`, découverte en interrogeant la base à la main.
 *
 * Il ne LÈVE jamais : un état de synchronisation illisible ne doit pas empêcher
 * un écran de fin de séance de s'afficher.
 */

import {
  pendingCount,
  pendingSessionIds,
  processQueue,
  quarantineCount,
} from '@/services/captureSyncQueue';

import type { EtatSynchro } from '@/features/rec/syncEnAttenteLogic';

/** L'état courant de la file. Jamais d'exception — au pire, tout à zéro. */
export async function lireEtatSynchro(): Promise<EtatSynchro> {
  try {
    const [enAttente, enQuarantaine, seances] = await Promise.all([
      pendingCount(),
      quarantineCount(),
      pendingSessionIds().catch(() => [] as string[]),
    ]);
    return { enAttente, enQuarantaine, seances };
  } catch {
    return { enAttente: 0, enQuarantaine: 0, seances: [] };
  }
}

/**
 * Rejeu MANUEL de la file, puis relecture de l'état.
 *
 * Le rejeu automatique existe (retour réseau, relance périodique). Celui-ci est
 * le geste du pilote qui a du réseau, veut partir, et préfère s'en assurer
 * plutôt que de faire confiance. Ce n'est pas une redondance : c'est la
 * différence entre un mécanisme et une garantie qu'on peut vérifier.
 */
export async function rejouerMaintenant(): Promise<EtatSynchro> {
  try {
    await processQueue();
  } catch {
    /* l'état relu ci-dessous dira ce qu'il en reste */
  }
  return lireEtatSynchro();
}
