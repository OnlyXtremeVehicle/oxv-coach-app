-- =============================================================================
-- JALON 0 — LE TRACÉ DE HAUTE SAINTONGE VIENT DÉSORMAIS DU RELEVÉ OSM
--
-- Appliquée le 03/08/2026.
-- =============================================================================
--
-- CE QUI CHANGE
--
-- Ancien : 65 points, provenance non tracée.
-- Nouveau : 72 points — `way/54412766`, `highway=raceway`, « Piste vitesse »,
-- source cadastre DGI. Longueur mesurée 2,207 km ; la base portait 2,21 km.
--
-- LE FICHIER DENSIFIÉ À 1 MÈTRE A ÉTÉ ÉCARTÉ, ET C'EST IMPORTANT
--
-- Le fondateur a fourni deux versions du même relevé : la source OSM (72
-- points, 30,7 m d'espacement) et une densification à 1 m (2243 points). La
-- seconde paraît meilleure. Elle ne l'est pas : la densification INTERPOLE,
-- elle n'ajoute aucune mesure — et elle déstabilise la détection de virages.
--
-- Mesuré sur le même tracé, en ne changeant que la densité :
--
--     1 m -> 12 virages     3 m -> 16     8 m ->  8     20 m ->  8
--     2 m -> 14 virages     5 m -> 14    12 m -> 12
--
-- Sept réponses pour un seul circuit. La cause est `PARAMS_CENTERLINE.smoothWin
-- = 0` : aucun lissage. Le réglage avait été validé sur le tracé de Valence,
-- espacé de 30 m, où il n'y a rien à lisser. Sur un tracé dense, la moindre
-- irrégularité du relevé devient une courbure, et un virage.
--
-- 30,7 m est donc le régime pour lequel le moteur a été réglé, et le seul où
-- son résultat soit défendable aujourd'hui. Voir docs/DETTE.md D-38 : ce défaut
-- attend le jour où l'on calera le tracé sur la télémétrie, qui produit des
-- points tous les 1,7 m.
-- =============================================================================

update public.circuits
   set centerline_latlon = '[{"lat":45.242873,"lon":-0.095874},{"lat":45.242844,"lon":-0.095563},{"lat":45.242652,"lon":-0.094129},{"lat":45.242074,"lon":-0.08956},{"lat":45.241955,"lon":-0.088694},{"lat":45.241898,"lon":-0.088268},{"lat":45.241869,"lon":-0.088195},{"lat":45.241831,"lon":-0.088142},{"lat":45.241775,"lon":-0.088112},{"lat":45.241702,"lon":-0.088108},{"lat":45.241631,"lon":-0.088148},{"lat":45.24158,"lon":-0.088233},{"lat":45.241554,"lon":-0.088341},{"lat":45.241552,"lon":-0.088745},{"lat":45.241611,"lon":-0.090087},{"lat":45.241628,"lon":-0.090514},{"lat":45.241623,"lon":-0.090666},{"lat":45.241594,"lon":-0.09079},{"lat":45.241545,"lon":-0.090875},{"lat":45.241467,"lon":-0.090946},{"lat":45.24113,"lon":-0.091163},{"lat":45.240567,"lon":-0.09155},{"lat":45.240425,"lon":-0.091641},{"lat":45.240341,"lon":-0.091679},{"lat":45.240273,"lon":-0.091687},{"lat":45.24017,"lon":-0.091668},{"lat":45.240072,"lon":-0.0916},{"lat":45.239985,"lon":-0.091496},{"lat":45.239855,"lon":-0.091173},{"lat":45.239699,"lon":-0.090783},{"lat":45.239657,"lon":-0.090649},{"lat":45.239662,"lon":-0.090495},{"lat":45.239743,"lon":-0.090326},{"lat":45.239874,"lon":-0.08999},{"lat":45.239907,"lon":-0.089798},{"lat":45.239903,"lon":-0.089586},{"lat":45.239851,"lon":-0.089349},{"lat":45.239766,"lon":-0.089171},{"lat":45.239645,"lon":-0.089019},{"lat":45.23955,"lon":-0.088929},{"lat":45.239432,"lon":-0.088876},{"lat":45.239311,"lon":-0.088871},{"lat":45.239201,"lon":-0.088907},{"lat":45.239084,"lon":-0.088995},{"lat":45.238991,"lon":-0.089137},{"lat":45.23893,"lon":-0.089298},{"lat":45.238899,"lon":-0.0895},{"lat":45.238908,"lon":-0.089671},{"lat":45.238993,"lon":-0.090321},{"lat":45.239075,"lon":-0.090891},{"lat":45.239149,"lon":-0.09106},{"lat":45.239392,"lon":-0.091474},{"lat":45.239537,"lon":-0.091725},{"lat":45.239643,"lon":-0.092007},{"lat":45.239798,"lon":-0.092419},{"lat":45.240033,"lon":-0.093004},{"lat":45.240307,"lon":-0.093724},{"lat":45.240529,"lon":-0.094303},{"lat":45.240934,"lon":-0.09536},{"lat":45.241047,"lon":-0.095544},{"lat":45.241191,"lon":-0.09567},{"lat":45.241302,"lon":-0.095791},{"lat":45.241384,"lon":-0.095934},{"lat":45.241513,"lon":-0.09621},{"lat":45.241629,"lon":-0.096417},{"lat":45.241844,"lon":-0.096663},{"lat":45.242001,"lon":-0.096756},{"lat":45.242192,"lon":-0.0968},{"lat":45.242476,"lon":-0.096739},{"lat":45.242687,"lon":-0.096548},{"lat":45.242809,"lon":-0.096311},{"lat":45.242865,"lon":-0.096092}]'::jsonb
 where name = 'Haute Saintonge';

-- =============================================================================
-- APRÈS APPLICATION
--
--   select jsonb_array_length(centerline_latlon) from public.circuits
--    where name = 'Haute Saintonge';   -- attendu : 72
--
-- Puis relancer `detect-circuit-corners` sur ce circuit : 8 virages,
-- calibration `centerline_latlon`. Ils remplacent les 7 issus du schéma SVG.
-- =============================================================================
