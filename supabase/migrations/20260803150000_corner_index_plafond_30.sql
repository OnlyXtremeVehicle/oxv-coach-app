-- =============================================================================
-- LA CONTRAINTE DE VIRAGE PLAFONNAIT À 7, VALENCE EN A 14
--
-- APPLIQUÉE le 03/08/2026, sur autorisation explicite du fondateur.
-- `coach_annotations` était vide : aucune ligne à migrer.
-- =============================================================================
--
-- CE QUI BLOQUE
--
-- `coach_annotations` porte :
--
--   CHECK ( (corner_index IS NULL AND marker_elapsed_ms IS NOT NULL)
--        OR (corner_index >= 1 AND corner_index <= 7) )
--
-- Le plafond de 7 n'est pas une règle de sécurité : c'est le nombre de virages
-- de Haute Saintonge, gravé dans le schéma le jour où c'était le seul circuit.
--
-- Depuis le 03/08/2026, la production en compte trois, et leurs virages sont
-- calculés :
--
--   Haute Saintonge        7   (schéma SVG, 15/06/2026)
--   Circuit Ricardo Tormo 14   (centerline réelle, 03/08/2026)
--   Charente               3   (centerline réelle, 03/08/2026)
--
-- Conséquence CONCRÈTE : à Valence, un coach ne peut annoter que les sept
-- premiers virages. Du huitième au quatorzième, l'écriture est rejetée par la
-- base. Le pilote ne saura jamais que la moitié du circuit était muette.
--
-- Aucune ligne n'est encore concernée — `coach_annotations` est vide — donc
-- rien à migrer. Le coût est nul aujourd'hui et maximal le jour de Valence.
--
-- ---------------------------------------------------------------------------
-- TROIS SORTIES, ET CE QU'ELLES COÛTENT
--
-- A — PLAFOND GÉNÉREUX (proposée ci-dessous)
--     `corner_index between 1 and 30`. La contrainte redevient ce qu'elle
--     devait être : un refus du non-sens (zéro, négatif, 5000), pas la
--     géométrie d'un circuit. Trente couvre largement tout circuit routier ;
--     le Nürburgring Nordschleife en compte 73, mais ce n'est pas notre
--     terrain — et le jour où ce le serait, le plafond se relève d'une ligne.
--     Simple, immédiat, sans couplage.
--
-- B — AUCUN PLAFOND, `corner_index >= 1`
--     Rien à maintenir. Mais une faute de frappe côté client — un index calculé
--     sur le mauvais tableau — passerait sans rien dire, et une annotation
--     pointerait un virage qui n'existe pas. Ce dépôt préfère qu'une écriture
--     absurde tombe.
--
-- C — VALIDATION CONTRE LE CIRCUIT RÉEL, PAR DÉCLENCHEUR
--     Le plus juste : refuser un index supérieur au nombre de virages du
--     circuit de la séance. Mais cela lie l'écriture d'une annotation au
--     recalcul des virages : recalculer un circuit avec MOINS de virages
--     invaliderait rétroactivement des annotations existantes, et la base
--     n'aurait plus aucun moyen de dire lesquelles. À rouvrir le jour où les
--     virages seront figés par la télémétrie — pas avant.
--
-- RETENU : A. C'est le seul des trois qui ne crée pas de dette neuve.
-- =============================================================================

alter table public.coach_annotations
  drop constraint if exists coach_annotations_virage_note_ou_marqueur;

alter table public.coach_annotations
  add constraint coach_annotations_virage_note_ou_marqueur
  check (
    (corner_index is null and marker_elapsed_ms is not null)
    or (corner_index >= 1 and corner_index <= 30)
  );

-- =============================================================================
-- APRÈS APPLICATION — CE QU'IL FAUT VÉRIFIER
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'coach_annotations_virage_note_ou_marqueur';
--   -- attendu : … corner_index >= 1 AND corner_index <= 30 …
--
-- Puis la preuve qui compte, et elle n'est pas en SQL : ouvrir une séance de
-- Valence côté coach et annoter le virage 12. Une contrainte élargie ne prouve
-- pas que l'écran propose les quatorze virages — c'est une autre question, et
-- elle se pose côté application.
-- =============================================================================
