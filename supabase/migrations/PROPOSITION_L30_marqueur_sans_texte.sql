-- =============================================================================
-- PROPOSITION — UN MARQUEUR N'A PAS DE TEXTE
--
--   *** NON APPLIQUÉE. NE PAS EXÉCUTER SANS DÉCISION FONDATEUR. ***
--
-- Fichier volontairement NON horodaté : `supabase db push` l'ignore.
--
-- Rédigé le 02/08/2026, après avoir constaté que le geste livré une heure plus
-- tôt ne peut pas s'exécuter.
-- =============================================================================
--
-- LE DÉFAUT — CELUI QUE J'AI INTRODUIT
--
-- `coach_annotations.body` porte, depuis la migration 0020 :
--
--     body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000)
--
-- `poserMarqueur()` insère `body: ''`. **Longueur zéro : la contrainte refuse la
-- ligne, à tous les coups.** Le bouton « Marquer cet instant » est donc inerte —
-- il montre une erreur et n'écrit rien.
--
-- Je ne l'ai pas vu en écrivant : le typage passe, le lint passe, les tests
-- passent — ils portent sur la DÉCISION (`decideMarqueur`), pas sur l'écriture.
-- Aucune garde du dépôt ne compare un `insert` aux contraintes de sa table.
--
-- ---------------------------------------------------------------------------
-- POURQUOI RELÂCHER PLUTÔT QUE REMPLIR
--
-- On pourrait écrire n'importe quoi dans `body` — « Marqueur », un point, un
-- espace. Ce serait une NOTE FABRIQUÉE, et elle ressortirait dans le fil à côté
-- des faits mesurés, comme si le coach l'avait écrite. La doctrine interdit
-- exactement cela.
--
-- **Un marqueur n'a pas de texte, et c'est sa nature** : le coach marque en
-- regardant la piste, il n'écrit pas. Le sens vient plus tard, quand il relit.
-- Le schéma doit dire cette vérité, pas la contourner.
--
-- ---------------------------------------------------------------------------
-- CE QUE LA NOUVELLE RÈGLE DIT
--
-- Une ligne de `coach_annotations` porte SOIT un texte, SOIT un marqueur, soit
-- les deux. Jamais rien.
--
-- La borne haute de 1000 caractères est conservée telle quelle.
--
-- ---------------------------------------------------------------------------
-- CE QUI NE CHANGE PAS, ET QU'IL FAUT SAVOIR
--
-- Le trigger de notification (`0021`) est SAUF : il sort immédiatement si
-- `visibility != 'shared'`, et un marqueur naît `private`. Aucun pilote n'est
-- notifié d'un repère que le coach s'est posé à lui-même. Vérifié.
--
-- Le garde-fou doctrinal `isDoctrineSafe` n'est pas concerné : il ne s'applique
-- qu'aux notes PARTAGÉES, et `poserMarqueur` ne passe pas par ce chemin.
--
-- ---------------------------------------------------------------------------
-- DÉGÂT RÉEL : NUL. 0 annotation en production, 0 compte coach. Le bouton n'a
-- jamais pu être pressé par personne.
-- =============================================================================

alter table public.coach_annotations
  drop constraint if exists coach_annotations_body_check;

alter table public.coach_annotations
  add constraint coach_annotations_texte_ou_marqueur
  check (
    -- Un texte, dans les bornes d'origine…
    (length(body) between 1 and 1000)
    -- …ou un marqueur, qui n'en porte pas.
    or (body = '' and marker_elapsed_ms is not null)
  );

comment on constraint coach_annotations_texte_ou_marqueur on public.coach_annotations is
  'Une ligne porte SOIT un texte (1 à 1000 caractères), SOIT un marqueur sans '
  'texte, soit les deux. Jamais rien. Un marqueur n''a pas de texte par nature : '
  'le coach marque en regardant la piste, il n''écrit pas. Remplir body d''un '
  'mot quelconque produirait une note fabriquée qui ressortirait dans le fil '
  'comme si le coach l''avait écrite.';

-- =============================================================================
-- SECOND BLOCAGE — `corner_index` EST NOT NULL
--
-- Trouvé par la revue adversariale du 02/08/2026, APRÈS que j'aie cru avoir
-- identifié le seul défaut. Il y en avait deux.
--
--     corner_index INTEGER NOT NULL CHECK (corner_index BETWEEN 1 AND 7)
--
-- `poserMarqueur()` écrit `corner_index: null` : violation 23502. L'insertion
-- échoue donc pour DEUX raisons indépendantes, et corriger `body` seul n'aurait
-- rien débloqué.
--
-- Le typage ne pouvait pas le voir : l'objet inséré est casté `as never` — un
-- contournement que j'avais repris du code voisin sans mesurer qu'il éteint
-- exactement la vérification qui aurait servi ici.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LE VIRAGE DOIT DEVENIR NULLABLE
--
-- Un marqueur ne connaît PAS son virage au moment du geste. Le coach appuie en
-- regardant la piste ; le virage se résout à la lecture, contre les cordes de
-- référence — qui n'existent pas encore.
--
-- Aucune valeur ne conviendrait : la contrainte impose 1 à 7, et écrire « 1 »
-- par défaut désignerait un virage précis que personne n'a mesuré. Ce serait la
-- valeur fabriquée que la doctrine interdit.
--
-- La colonne reste NOT NULL pour une NOTE — une annotation écrite vise toujours
-- un virage, c'est ainsi qu'elle est classée. Seul un marqueur en est dispensé.
-- =============================================================================

alter table public.coach_annotations
  alter column corner_index drop not null;

-- On maintient la borne 1..7 pour les valeurs présentes, et on exige un virage
-- dès qu'il ne s'agit PAS d'un marqueur : une note sans virage n'aurait nulle
-- part où se classer.
alter table public.coach_annotations
  drop constraint if exists coach_annotations_corner_index_check;

alter table public.coach_annotations
  add constraint coach_annotations_virage_note_ou_marqueur
  check (
    (corner_index is null and marker_elapsed_ms is not null)
    or (corner_index between 1 and 7)
  );

comment on constraint coach_annotations_virage_note_ou_marqueur on public.coach_annotations is
  'Une NOTE vise toujours un virage (1 à 7) — c''est ainsi qu''elle se classe. '
  'Un MARQUEUR en est dispensé : il ne connaît pas son virage au moment du '
  'geste, celui-ci se résout à la lecture contre les cordes de référence. '
  'Écrire une valeur par défaut désignerait un virage que personne n''a mesuré.';
