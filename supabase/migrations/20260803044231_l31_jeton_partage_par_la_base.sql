-- =============================================================================
-- LE JETON DE PARTAGE EST FABRIQUÉ PAR LA BASE
--
--   *** APPLIQUÉE EN PRODUCTION LE 03/08/2026. ***
--
-- Décision fondateur.
--
-- ÉPROUVÉE APRÈS APPLICATION, dans une transaction ANNULÉE : deux insertions
-- SANS jeton ont reçu deux jetons DISTINCTS de 32 caractères, alphabet
-- base64url — le format exact de celui déjà en production. Les URL émises
-- restent valides.
--
-- Le code client a été retiré dans le même lot, dans l'ordre prescrit :
-- migration d'abord, retrait ensuite.
--
-- Rédigé le 02/08/2026. Décision fondateur du même jour : « faire fabriquer le
-- jeton par la base ».
-- =============================================================================
--
-- LE DÉFAUT
--
-- `generateShareToken()` (src/services/sharesService.ts) est commenté « Génère un
-- token cryptographiquement sûr » et s'appuie sur ceci :
--
--     if (typeof crypto !== 'undefined' && crypto.getRandomValues) { … }
--     else { bytes[i] = Math.floor(Math.random() * 256); }
--
-- Le commentaire affirme que `crypto.getRandomValues` est « présent sur RN via
-- react-native-url-polyfill ». **C'est faux.** Vérifié le 02/08/2026 en lisant
-- le paquet installé : `react-native-url-polyfill` n'expose que `URL` et
-- `URLSearchParams` — aucune occurrence de `getRandomValues`. Aucun autre paquet
-- du projet n'en fournit : ni `react-native-get-random-values`, ni
-- `expo-crypto`, ni `expo-standard-web-crypto` ne sont installés, et le runtime
-- « winter » d'Expo 55 ne pose pas de `crypto` global.
--
-- Sur appareil, **la branche `Math.random` est donc la seule empruntée**. C'est
-- exactement le motif récurrent du dépôt : la garde est écrite, elle n'est pas
-- armée, et un commentaire affirme qu'elle l'est. Personne ne pouvait le voir en
-- relisant — le code a l'air correct.
--
-- ---------------------------------------------------------------------------
-- POURQUOI C'EST GRAVE, ET DANS QUELLE MESURE ÇA NE L'EST PAS ENCORE
--
-- Le jeton est le SEUL secret qui protège un lien de partage : qui le devine
-- voit la progression d'un pilote. `Math.random` est un générateur de commodité,
-- pas de sécurité — son état interne est petit et se reconstruit à partir de
-- quelques sorties observées du même processus.
--
-- Exposition réelle AUJOURD'HUI : nulle. Un seul lien existe en production, déjà
-- expiré, et la page qui le lit n'est pas déployée. Rien n'a fuité. C'est le
-- moment de corriger, précisément parce qu'il n'y a rien à réparer.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LA BASE, ET PAS UN PAQUET DE PLUS
--
-- Un secret ne se fabrique pas sur l'appareil de celui qu'il protège. La base le
-- produit avec `gen_random_bytes` (pgcrypto, déjà installé dans le schéma
-- `extensions` — vérifié), le client ne l'invente plus : il le reçoit.
--
-- Aucune dépendance ajoutée, donc aucun build natif à refaire.
--
-- LE FORMAT NE CHANGE PAS. Mesuré côté base :
--     translate(encode(gen_random_bytes(24),'base64'), '+/', '-_')
--     → « EMlr6qrGRc3pPjvF2N113XECqo5F9I9P »   (32 caractères, base64url)
-- Le jeton présent en production fait exactement 32 caractères de même alphabet.
-- Les URL déjà émises restent valides, la colonne garde son type et son UNIQUE.
--
-- 24 octets = 192 bits. Aucun remplissage `=` à retirer : 24 est multiple de 3.
--
-- ---------------------------------------------------------------------------
-- ORDRE D'APPLICATION — IMPORTANT
--
-- 1. Cette migration D'ABORD. Elle ne casse rien : le client continue d'envoyer
--    son jeton, la valeur par défaut ne s'applique simplement pas.
-- 2. Le retrait de `generateShareToken()` côté application ENSUITE.
--
-- L'inverse casserait la création de liens : sans valeur par défaut et sans
-- jeton envoyé, l'insertion violerait le NOT NULL posé ci-dessous.
--
-- Le code applicatif n'est donc PAS modifié dans le même lot que ce fichier. Il
-- attend que la migration soit appliquée.
-- =============================================================================

-- La colonne existe déjà (UNIQUE, indexée). On lui donne de quoi se remplir
-- seule, avec de l'entropie réelle.
alter table public.app_progression_shares
  alter column share_token set default translate(
    encode(extensions.gen_random_bytes(24), 'base64'),
    '+/',
    '-_'
  );

-- Un partage sans jeton n'est pas un partage : il serait introuvable, et la
-- contrainte UNIQUE tolère plusieurs NULL — donc plusieurs lignes muettes.
alter table public.app_progression_shares
  alter column share_token set not null;

comment on column public.app_progression_shares.share_token is
  'Secret qui protège le lien de partage. Fabriqué PAR LA BASE '
  '(gen_random_bytes, 192 bits, base64url). Le client ne doit plus l''inventer : '
  'jusqu''au 02/08/2026 il le tirait de Math.random — un générateur de '
  'commodité, pas de sécurité — parce qu''un commentaire affirmait à tort que '
  'crypto.getRandomValues était disponible sur l''appareil.';

-- =============================================================================
-- APRÈS APPLICATION — CE QU'IL FAUDRA VÉRIFIER
--
--   insert into public.app_progression_shares (user_id, share_scope)
--   values ('<un uuid réel>', 'progression_only')
--   returning share_token, length(share_token);
--
-- Attendu : 32 caractères, alphabet base64url, différent à chaque appel. À jouer
-- dans une transaction ANNULÉE — une définition de contrainte ne prouve pas
-- qu'une insertion passe.
-- =============================================================================
