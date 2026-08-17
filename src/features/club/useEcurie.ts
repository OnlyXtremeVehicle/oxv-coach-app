/**
 * Hook de l'écran d'écurie — trois sources, chacune tombant seule.
 *
 * ===========================================================================
 * CE QU'IL ASSEMBLE
 * ===========================================================================
 *
 *   • `getMyCrew()`         — l'écurie du lecteur, ses membres et leurs rôles ;
 *   • `resolveCrewProfiles` — leurs prénoms, best-effort, borné par la RLS ;
 *   • `listPublicCrews()`   — l'annuaire, agrégats seuls.
 *
 * Aucune table n'est créée, aucune colonne ajoutée : tout existe en production
 * depuis le 04/07. Ce qui manquait, c'était l'appelant.
 *
 * ===========================================================================
 * TROIS ÉCHECS INDÉPENDANTS
 * ===========================================================================
 *
 * Un annuaire indisponible n'efface pas l'écurie du lecteur, et inversement.
 * `Promise.allSettled` plutôt que `all` : sur cet écran, une source en panne
 * doit masquer SON bloc, pas la page.
 *
 * ===========================================================================
 * CE QU'IL NE FAIT PAS, ET POURQUOI
 * ===========================================================================
 *
 * Ni exclusion, ni invitation, ni téléversement de logo. Le plan les prévoit,
 * mais les fonctions serveur correspondantes N'EXISTENT PAS — `crews` n'expose
 * que quatre RPC plus l'annuaire, et aucun bucket de logo n'est déclaré.
 * Écrire ces gestes côté application supposerait d'écrire dans `crew_members`
 * en direct, ce que la RLS refuse à juste titre : c'est au serveur d'arbitrer
 * qui peut exclure qui.
 *
 * Poser des boutons qui échoueraient serait exactement le défaut que ce lot
 * corrige ailleurs. Ils sont donc absents, et le point est consigné.
 */

import { useCallback, useEffect, useState } from 'react';

import { crewCardTitle, crewOwnerName, type CrewMemberProfile } from './clubHubLogic';
import { resolveCrewProfiles } from './crewProfilesService';
import { trierAnnuaire, type LigneAnnuaire } from './ecurieLogic';
import {
  getMyCrew,
  listPublicCrews,
  nameMyCrew,
  setCrewInsigne,
} from '@/services/v2/referralService';
import { insigneAffichable, type InsigneAffichable } from '@/features/club/insigneLogic';
import { useAuthStore } from '@/store/useAuthStore';

export interface EcurieData {
  crewId: string;
  /** Le nom donné, ou `null` si l'écurie n'a jamais été baptisée. */
  nom: string | null;
  /** Titre affichable (nom, sinon « Le groupe de X », sinon « Votre écurie »). */
  titre: string;
  membres: CrewMemberProfile[];
  /**
   * Ce qu'il y a à peindre à la place de l'insigne — déjà résolu par
   * `insigneAffichable`, donc déjà fail-closed. L'écran n'a aucune règle de
   * visibilité à réappliquer, et ne peut pas se tromper en l'oubliant.
   */
  insigne: InsigneAffichable;
}

export interface UseEcurieResult {
  loading: boolean;
  /** `null` = le lecteur n'appartient à aucune écurie (état normal, pas une panne). */
  ecurie: EcurieData | null;
  /** Vrai si la lecture de l'écurie a échoué (distinct de « pas d'écurie »). */
  erreur: boolean;
  annuaire: LigneAnnuaire[];
  /** L'annuaire n'a pas pu être lu — distinct d'un annuaire vide. */
  annuaireErreur: boolean;
  userId: string | null;
  /** Baptise l'écurie et recharge. Refus serveur remonté tel quel. */
  baptiser: (nom: string) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Pose un insigne du catalogue, ou le retire (`null`), puis recharge.
   * Le téléversement d'image passera par le même service mais demande d'abord
   * l'envoi du fichier dans le bucket : il n'est pas encore câblé ici.
   */
  definirInsigne: (
    catalogueKey: string | null
  ) => Promise<{ ok: boolean; error?: string; moderationRequise?: boolean }>;
  recharger: () => void;
}

export function useEcurie(): UseEcurieResult {
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [ecurie, setEcurie] = useState<EcurieData | null>(null);
  const [erreur, setErreur] = useState(false);
  const [annuaire, setAnnuaire] = useState<LigneAnnuaire[]>([]);
  const [annuaireErreur, setAnnuaireErreur] = useState(false);
  const [cle, setCle] = useState(0);

  const recharger = useCallback(() => setCle((k) => k + 1), []);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(false);
    setAnnuaireErreur(false);

    (async () => {
      const [mienne, publique] = await Promise.allSettled([getMyCrew(), listPublicCrews()]);

      if (publique.status === 'fulfilled') {
        if (!annule) setAnnuaire(trierAnnuaire(publique.value));
      } else if (!annule) {
        setAnnuaireErreur(true);
        setAnnuaire([]);
      }

      if (mienne.status === 'rejected') {
        if (!annule) {
          setErreur(true);
          setEcurie(null);
          setLoading(false);
        }
        return;
      }

      const crew = mienne.value;
      if (crew === null) {
        if (!annule) {
          setEcurie(null);
          setLoading(false);
        }
        return;
      }

      // Les profils ne peuvent pas faire échouer l'écran : sans prénom, les
      // membres s'affichent par handle, et sans handle « Un pilote ».
      const membres = await resolveCrewProfiles(crew.members).catch(() =>
        crew.members.map((m) => ({
          userId: m.userId,
          firstName: null,
          handle: null,
          avatarUrl: null,
          role: m.role,
        }))
      );

      if (annule) return;
      setEcurie({
        crewId: crew.crewId,
        nom: crew.name,
        titre: crewCardTitle(crew.name, crewOwnerName(membres)),
        membres,
        // `getMyCrew` ne rend QUE l'écurie du lecteur : `estMien` vaut donc
        // toujours vrai ici, et le capitaine voit son image même en attente.
        // L'annuaire, lui, ne porte aucun identifiant d'écurie — la question ne
        // s'y pose pas.
        insigne: insigneAffichable(
          {
            insigneCatalogueKey: crew.insigneCatalogueKey,
            insigneImagePath: crew.insigneImagePath,
            insigneStatus: crew.insigneStatus,
          },
          true
        ),
      });
      setLoading(false);
    })();

    return () => {
      annule = true;
    };
  }, [cle]);

  const baptiser = useCallback(async (nom: string) => {
    const res = await nameMyCrew(nom);
    // Recharger même en cas de succès seul : le titre affiché vient du nom
    // relu, jamais de la valeur saisie — si le serveur a normalisé, on montre
    // ce qu'il a retenu.
    if (res.ok) setCle((k) => k + 1);
    return res;
  }, []);

  const definirInsigne = useCallback(async (catalogueKey: string | null) => {
    const res = await setCrewInsigne(catalogueKey, null);
    // Même motif que le baptême : on relit plutôt que de croire la valeur
    // envoyée. Le serveur seul sait s'il a ouvert une modération.
    if (res.ok) setCle((k) => k + 1);
    return res;
  }, []);

  return {
    loading,
    ecurie,
    erreur,
    annuaire,
    annuaireErreur,
    userId,
    baptiser,
    definirInsigne,
    recharger,
  };
}
