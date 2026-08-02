-- =============================================================================
-- L30 — UN MARQUEUR N'A NI TEXTE NI VIRAGE
--
--   *** APPLIQUÉE EN PRODUCTION LE 02/08/2026 (version 20260802065500). ***
--
-- Décision fondateur : appliquer les deux volets.
--
-- Ce fichier contient EXACTEMENT le SQL qui a tourné, sans un caractère de
-- plus. La migration L29 avait dérivé de ce qu'elle décrivait — quiconque
-- reconstruisait le schéma depuis les fichiers obtenait autre chose que la
-- production. On ne recommence pas.
-- =============================================================================
--
-- LE DÉFAUT — CELUI QUE J'AI INTRODUIT
--
-- Le geste « Marquer cet instant », livré le 02/08, ne pouvait RIEN écrire. Pour
-- DEUX raisons indépendantes : corriger l'une seule n'aurait rien débloqué.
--
--   1. `body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000)`
--      `poserMarqueur()` insère `body: ''` — longueur zéro, refus systématique.
--
--   2. `corner_index INTEGER NOT NULL CHECK (corner_index BETWEEN 1 AND 7)`
--      `poserMarqueur()` écrit `null` — violation 23502.
--
-- Le typage, le lint et les tests passaient tous : ils portent sur la DÉCISION
-- (`decideMarqueur`), jamais sur l'écriture. Et l'objet inséré est casté
-- `as never` — un contournement repris du code voisin, qui éteint exactement la
-- vérification qui aurait servi ici.
--
-- Le second blocage a été trouvé par la revue adversariale, APRÈS que j'aie cru
-- avoir identifié le seul défaut. D'où la règle D-28 : avant de livrer un
-- chemin d'écriture, lire les contraintes de la table cible.
--
-- ---------------------------------------------------------------------------
-- POURQUOI RELÂCHER PLUTÔT QUE REMPLIR
--
-- On pourrait écrire n'importe quoi dans `body` — « Marqueur », un point, un
-- espace — et « 1 » dans `corner_index`. Ce serait une NOTE FABRIQUÉE et un
-- VIRAGE QUE PERSONNE N'A MESURÉ, tous deux ressortant dans le fil comme si le
-- coach les avait posés. La doctrine interdit exactement cela.
--
-- Un marqueur n'a ni texte ni virage, et c'est sa NATURE : le coach marque en
-- regardant la piste. Le sens vient plus tard, à la relecture ; le virage se
-- résout contre les cordes de référence, qui n'existent pas encore. Le schéma
-- doit dire cette vérité, pas la contourner.
--
-- ---------------------------------------------------------------------------
-- CE QUI A ÉTÉ VÉRIFIÉ AVANT (règles D-24 et D-28)
--
-- Quatre fonctions lisent `coach_annotations`. Les deux qui pouvaient souffrir
-- d'un `corner_index` nul ont été relues :
--
--   • `my_session_annotations` — écrit DÉJÀ `order by a.corner_index nulls
--     last` : elle anticipait des nuls. Elle filtre aussi
--     `length(btrim(a.body)) > 0`, donc un marqueur seul n'entre JAMAIS dans la
--     liste d'annotations du pilote. Il ne l'atteint que par le rapport que le
--     coach compose.
--   • `pilot_sessions_for_coach` — ne fait que compter des lignes. Sauve.
--
-- Le trigger de notification (`0021`) sort immédiatement si
-- `visibility != 'shared'`, et un marqueur naît `private` : aucun pilote n'est
-- notifié d'un repère que le coach s'est posé à lui-même.
--
-- ---------------------------------------------------------------------------
-- ÉPREUVE APRÈS APPLICATION
--
-- L'insertion exacte de `poserMarqueur()` a été jouée dans une transaction
-- ANNULÉE : marqueur ACCEPTÉ, ligne ne portant rien du tout REFUSÉE, table
-- revenue à 0 ligne. La définition d'une contrainte ne prouve pas qu'un
-- `insert` passe — les clés étrangères, les NOT NULL et les triggers comptent
-- aussi.
--
-- DÉGÂT RÉEL AVANT APPLICATION : NUL. 0 annotation en production, 0 compte
-- coach. Le bouton n'a jamais pu être pressé par personne.
-- =============================================================================

-- VOLET 1 — le texte -----------------------------------------------------

alter table public.coach_annotations
  drop constraint if exists coach_annotations_body_check;

alter table public.coach_annotations
  add constraint coach_annotations_texte_ou_marqueur
  check (
    (length(body) between 1 and 1000)
    or (body = '' and marker_elapsed_ms is not null)
  );

comment on constraint coach_annotations_texte_ou_marqueur on public.coach_annotations is
  'Une ligne porte SOIT un texte (1 à 1000 caractères), SOIT un marqueur sans '
  'texte, soit les deux. Jamais rien. Un marqueur n''a pas de texte par nature : '
  'le coach marque en regardant la piste, il n''écrit pas.';

-- VOLET 2 — le virage ----------------------------------------------------

alter table public.coach_annotations
  alter column corner_index drop not null;

alter table public.coach_annotations
  drop constraint if exists coach_annotations_corner_index_check;

alter table public.coach_annotations
  add constraint coach_annotations_virage_note_ou_marqueur
  check (
    (corner_index is null and marker_elapsed_ms is not null)
    or (corner_index between 1 and 7)
  );

comment on constraint coach_annotations_virage_note_ou_marqueur on public.coach_annotations is
  'Une NOTE vise toujours un virage (1 à 7). Un MARQUEUR en est dispensé : son '
  'virage se résout à la lecture, pas au moment du geste.';
