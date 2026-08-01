-- =============================================================================
-- PROPOSITION — un coach ne se consent pas lui-même une affiliation
--
-- NON APPLIQUÉE. Fichier NON horodaté : `supabase db push` l'ignore. Il attend
-- l'accord du fondateur.
--
-- Rédigé le 01/08/2026, à la suite d'une revue adversariale du lot 27a-bis.
-- =============================================================================
--
-- LE DÉFAUT, VÉRIFIÉ EN PRODUCTION LE 01/08/2026
--
-- La policy d'insertion `coach_pilots_insert_by_coach` n'impose que trois
-- choses :
--
--     coach_id = auth.uid() AND is_coach() AND initiated_by = 'coach'
--
-- **Aucune restriction de colonne.** Un compte portant `role = 'coach'` peut
-- donc insérer, pour un pilote qu'il n'a jamais rencontré, une ligne où il pose
-- lui-même `pilot_consent_at`, `live_sharing_at`, `active = true`,
-- `status = 'active'` et `level = 'lecture_detaillee'`.
--
-- Le garde-fou SEC-3 (`guard_coach_pilots_colonnes`), qui interdit précisément à
-- un coach d'écrire ces colonnes, est un trigger **`BEFORE UPDATE` seulement**.
-- Il ne voit jamais une insertion. La garde existe, elle ne se déclenche pas.
--
-- `UNIQUE (coach_id, pilot_id)` ne protège pas : il n'empêche que la SECONDE
-- ligne. L'attaque vise justement un pilote avec qui aucune ligne n'existe.
--
-- ---------------------------------------------------------------------------
-- CE QUE CELA OUVRE
--
-- Toutes les lectures qui dérivent de `coach_pilots`, pas seulement la
-- biométrie : `is_coach_of` et `is_detailed_coach_of` commandent l'accès aux
-- séances, aux trames de télémétrie, aux analyses de segments, au carnet. Le
-- canal biométrie n'est que l'endroit où la revue l'a trouvé.
--
-- Deux verrous restent hors de portée : les consentements biométrie du pilote et
-- le drapeau serveur `biometry`. Ils limitent le dégât sur la santé ; ils ne
-- couvrent rien d'autre.
--
-- ---------------------------------------------------------------------------
-- MODÈLE D'ATTAQUANT, ET DÉGÂT RÉEL
--
-- Il faut porter `role = 'coach'`, attribué par un administrateur — c'est le
-- même modèle d'attaquant que celui pour lequel SEC-3 a été écrite. **La
-- production compte 0 compte coach au 01/08/2026 : le dégât actuel est nul.**
-- Rien à rattraper, tout à fermer avant le premier coach.
--
-- ---------------------------------------------------------------------------
-- LE CORRECTIF
--
-- Une affiliation demandée par un coach naît **en attente**, et c'est le pilote
-- qui l'accepte — ce que fait déjà `coach_pilots_update_own_pilot_consent`. On
-- écrit donc dans la policy ce que le produit fait déjà : à l'insertion par un
-- coach, les colonnes de consentement sont NULLES et le statut est `pending`.
--
-- Le second bras rend le trigger SEC-3 symétrique, pour que la règle tienne même
-- si une policy future était rédigée sans y penser. Une garde à deux endroits
-- vaut mieux qu'une garde documentée à un seul.
-- =============================================================================

-- --- 1. La policy d'insertion : naître en attente, jamais consenti ----------

drop policy if exists coach_pilots_insert_by_coach on public.coach_pilots;

create policy coach_pilots_insert_by_coach
  on public.coach_pilots
  for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())
    and public.is_coach()
    and initiated_by = 'coach'
    -- Le consentement du pilote ne s'auto-attribue pas.
    and pilot_consent_at is null
    and live_sharing_at is null
    -- Une demande est une demande : elle attend une réponse.
    and status = 'pending'
    and active = false
  );

-- --- 2. Le garde-fou SEC-3, rendu symétrique --------------------------------
--
-- REMARQUE POUR LA RELECTURE : le corps de `guard_coach_pilots_colonnes` compare
-- `old` et `new`. Sur un INSERT, `old` est NULL — le corps existant lèverait donc
-- une erreur au lieu de refuser proprement. Le bras d'insertion doit être écrit
-- à part, et il ne peut pas l'être ici sans relire la fonction telle qu'elle est
-- réellement en production.
--
-- **Volontairement laissé en attente.** Poser un trigger à moitié juste sur une
-- table d'affiliation serait pire que la policy ci-dessus, qui suffit à fermer
-- le chemin d'attaque connu. À reprendre avec la fonction sous les yeux.
