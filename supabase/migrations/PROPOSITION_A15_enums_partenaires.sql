-- =============================================================================
-- PROPOSITION — les trois énumérations partenaires
-- =============================================================================
--
-- NON APPLIQUÉE. Elle fige un vocabulaire de marque, ce qui vous revient — et
-- l'équipe du site attend des valeurs, pas un avis.
--
-- Valeurs reprises de l'arbitrage du 13/08, §2.5, qui les propose en invitant à
-- les corriger plutôt qu'à repartir de zéro. Le registre disait « je n'ai pas
-- d'avis » ; une énumération sans valeurs bloque une équipe entière.
--
-- -----------------------------------------------------------------------------
-- LES TROIS RÈGLES COMPTENT PLUS QUE LES VALEURS
-- -----------------------------------------------------------------------------
--
--   1. minuscules sans accent — un enum qui porte des accents finit par porter
--      deux orthographes de la même valeur ;
--   2. jamais de `null` — une énumération sans valeur par défaut produit des
--      lignes muettes, et une ligne muette se lit comme une donnée absente
--      alors qu'elle est seulement non renseignée ;
--   3. `autre` sur la PREMIÈRE seulement. Les deux suivantes doivent être
--      exhaustives, ou elles ne servent à rien : une valeur `autre` sur un
--      statut de relation ou un niveau d'engagement vide la colonne de son sens.
--
-- =============================================================================

begin;

/*
 * NATURE — ce que le partenaire EST. Ouverte : le monde de l'automobile en
 * invente régulièrement, et `autre` évite d'avoir à migrer l'enum à chaque
 * rencontre.
 */
create type public.partenaire_nature_enum as enum (
  'concessionnaire',
  'preparateur',
  'assureur',
  'hotellerie',
  'media',
  'equipementier',
  'autre'
);

/*
 * STATUT — où en est la RELATION. Exhaustive par construction : une relation
 * est forcément dans l'un de ces cinq états, et `clos` absorbe les fins, quelle
 * qu'en soit la raison.
 */
create type public.partenaire_statut_enum as enum (
  'pressenti',
  'en_discussion',
  'actif',
  'suspendu',
  'clos'
);

/*
 * ENGAGEMENT — le NIVEAU. Trois paliers, et pas quatre : au-delà, la
 * distinction cesse d'être lisible de l'extérieur, et c'est le regard du membre
 * qui compte.
 *
 * `referent` est le palier d'entrée — un partenaire que l'on cite ; `partenaire`
 * l'engagement ordinaire ; `partenaire_principal` est SINGULIER par intention.
 * Si vous en voulez plusieurs, dites-le : c'est une décision, pas un détail
 * d'implémentation.
 */
create type public.partenaire_engagement_enum as enum (
  'referent',
  'partenaire',
  'partenaire_principal'
);

commit;

-- =============================================================================
-- RACCORDEMENT — dans un second temps, une fois le vocabulaire validé
-- =============================================================================
--
-- Les colonnes ne sont PAS ajoutées ici : l'arbitrage porte sur le vocabulaire,
-- et poser des colonnes sur une table dont le site est propriétaire mérite un
-- accord des deux côtés. Quand ce sera le cas :
--
--   alter table public.partners
--     add column nature      public.partenaire_nature_enum     not null default 'autre',
--     add column statut      public.partenaire_statut_enum     not null default 'pressenti',
--     add column engagement  public.partenaire_engagement_enum not null default 'referent';
--
-- `not null default` sur les trois : c'est la règle 2, et elle ne se tient qu'à
-- l'écriture de la colonne. Ajoutée nullable « pour ne pas casser », elle ne le
-- redeviendra jamais.
--
-- =============================================================================
-- ANNULATION
-- =============================================================================
-- drop type if exists public.partenaire_engagement_enum;
-- drop type if exists public.partenaire_statut_enum;
-- drop type if exists public.partenaire_nature_enum;
