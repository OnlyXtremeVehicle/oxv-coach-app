-- =============================================================================
-- BOUTEVILLE — LE TRACÉ DU PREMIER ESSAI TERRAIN
-- =============================================================================
--
-- Appliquée en production le 12/08/2026, quelques heures avant le premier essai
-- réel de la chaîne de capture. Source : relevé fondateur
-- (`src/circuit/data/bouteville.geojson`), conservé au dépôt pour que la
-- géométrie soit vérifiable — les tests de détection de tours s'appuient dessus.
--
-- -----------------------------------------------------------------------------
-- CE QUI A ÉTÉ VÉRIFIÉ AVANT D'ÉCRIRE, ET COMMENT
-- -----------------------------------------------------------------------------
--
-- Un tracé se vérifie en le PARCOURANT, pas en le regardant. La polyligne a
-- donc été densifiée à un pas de 2 m — ce que rend un RaceBox à 25 Hz — et
-- passée dans l'algorithme réel de `utils/lapDetection`.
--
--   boucle fermée              premier sommet = dernier, écart 0,00 m
--   longueur                   5 913 m (139 sommets distincts)
--   auto-intersections         0
--   ligne d'arrivée / tracé    4,38 m — la porte est coupée, avec marge
--   cap au franchissement      336,6° sur le segment porteur
--                              (339,4° sur base large : la piste ne tourne pas là)
--   brin étranger le plus près 157,6 m — aucune demi-largeur réaliste ne peut
--                              attraper un autre morceau du circuit
--   séance de 33 min simulée   8 franchissements sur 8, à 0/1,5/3 m de bruit
--                              GPS et à 25/10/5 Hz
--
-- -----------------------------------------------------------------------------
-- LE SENS DE PARCOURS N'EST PAS UN DÉTAIL
-- -----------------------------------------------------------------------------
--
-- La porte a un SENS obligatoire (cf. `utils/lapDetection`). Parcourue à
-- l'envers, cette boucle rend **zéro tour** — vérifié, pas supposé. Le sens est
-- celui du GeoJSON : depuis la ligne, la piste part au nord-nord-ouest vers la
-- pointe nord, et revient par l'est.
--
-- C'est le seul point de ce dossier qui ne se rattrape pas après coup : une
-- journée roulée dans l'autre sens ne produit aucun chronométrage.
--
-- -----------------------------------------------------------------------------
-- LA LIGNE D'ARRIVÉE N'A PAS ÉTÉ DÉPLACÉE
-- -----------------------------------------------------------------------------
--
-- Le point déclaré est à 4,38 m du tracé. Sa projection exacte sur la piste
-- (45,5971374 / -0,1334345) donnerait 0 m, et elle a été essayée : les deux
-- comptent 3 tours sur 3, à toutes les demi-largeurs de 15 à 40 m.
--
-- On garde donc le point du fondateur. Déplacer en silence un repère relevé sur
-- le terrain pour gagner quatre mètres qui ne changent rien serait exactement le
-- genre de correction discrète que ce dépôt s'interdit.
--
-- `finish_line_radius_m` vaut 25 : c'est la DEMI-LARGEUR de la porte, très
-- au-dessus des 4,38 m de décalage et très en dessous des 157 m qui feraient
-- courir un risque de confusion avec un autre brin.
--
-- -----------------------------------------------------------------------------
-- CE QUE `length_km` DÉCLENCHE, ET QU'IL FAUT SAVOIR
-- -----------------------------------------------------------------------------
--
-- Cette colonne n'est plus décorative : `captureFinishLineFor` en dérive la
-- distance minimale entre deux tours comptés (la moitié), qui écarte les tours
-- fabriqués par un véhicule arrêté sur la ligne. Sans elle, la garde ne
-- s'arme pas — c'est le comportement historique, et il est silencieux.
--
-- Tout circuit ajouté sans longueur roule donc sans cette protection.
--
-- -----------------------------------------------------------------------------
-- CE QUE CE TRACÉ EST
-- -----------------------------------------------------------------------------
--
-- Une boucle de routes ouvertes — le relevé le dit lui-même : D152, Rue du
-- Prévôt, Echauguette, Châteauneuf, D699. Ce n'est pas un circuit fermé, et
-- l'application ne fait ici qu'enregistrer ce qui se passe. La doctrine du
-- silence en piste s'applique inchangée : aucun écran, aucun son, aucun HUD
-- pendant que le véhicule roule.
--
-- =============================================================================

-- Le tableau `centerline_latlon` (139 points) est trop volumineux pour être
-- relu ici : il est reconstruit à l'identique depuis le GeoJSON du dépôt.
-- Cette migration DOCUMENTE l'insertion appliquée ; elle ne la rejoue pas —
-- la ligne existe en production depuis le 12/08/2026
-- (id 723c9dfc-d0d3-428c-a0d7-f04178e9cd7e).

update public.circuits
   set finish_line_radius_m = 25,
       finish_line_heading  = 336.6,
       length_km            = 5.913,
       is_official          = true,
       review_status        = 'approved'
 where name = 'Bouteville';

comment on column public.circuits.finish_line_heading is
  'Cap de la piste au franchissement (degrés, 0 = nord). Renseigné → détection par PORTE, avec SENS OBLIGATOIRE : un circuit parcouru à l''envers ne compte aucun tour. NULL → repli mode rayon, sans filtre de direction.';

comment on column public.circuits.length_km is
  'Longueur du tracé (km). Sert à l''affichage ET à la garde de distance minimale entre deux tours (moitié de cette valeur) : un circuit sans longueur roule sans cette protection, et un véhicule arrêté sur la ligne y compte des tours fantômes.';
