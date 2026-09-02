-- BOUTEVILLE — les virages recalcules sur le trace referme et recale.
--
-- Suite immediate de 20260902120000. Cette migration-la avait remis `corners`
-- a NULL, et disait pourquoi : `apex_s_norm` est NORMALISE, et le trace a
-- change de longueur (5 820,8 -> 5 906,1 m) ET d origine (deplacee de 1 735 m,
-- pour demarrer a la ligne). Les douze cordes ecrites le 30/08 designaient
-- donc des endroits qui n existent plus.
--
-- ===========================================================================
-- LE MEME MOTEUR, PAS UNE COPIE
-- ===========================================================================
--
-- La fonction edge `detect-circuit-corners` porte `verify_jwt = true` : elle
-- se declenche depuis la console admin, avec un jeton d utilisateur. Le calcul
-- a donc ete fait ici par le module que cette fonction IMPORTE —
-- `src/circuit/circuitGenerator.ts`, `generateCircuit(ligne,
-- PARAMS_CENTERLINE)` — et non par une reimplementation. C est le choix
-- qu affirme l en-tete de la fonction : « LE MEME MOTEUR QUE L APPLICATION,
-- PAS UNE COPIE ». Le payload ci-dessous a exactement la forme qu elle ecrit :
-- meme engine_version, memes params, meme calibration.
--
-- ===========================================================================
-- TREIZE, ET NON PLUS DOUZE
-- ===========================================================================
--
-- Le trace ouvert en rendait douze, le trace referme en rend treize. Ce n est
-- pas une derive de reglage — les parametres sont identiques (smoothWin 0,
-- resampleStep 10, cornerRadius 100) : c est la couture de 85 m qui coupait
-- une courbe en deux morceaux dont aucun ne franchissait le seuil de rayon.
-- Refermer l anneau la rend entiere.
--
-- Rappel de ce qui ne se decide pas ici : `name` reste NULL sur les treize.
-- Nommer un virage est un acte editorial, jamais un calcul.

update public.circuits
set corners = '{"engine_version":"corners-v1","params":{"smoothWin":0,"resampleStep":10,"cornerRadius":100},"calibration":"centerline_latlon","n_corners":13,"corners":[{"corner_index":1,"direction":"right","apex_s_norm":0.0308,"r_m":12,"name":null,"calibration":"centerline_latlon"},{"corner_index":2,"direction":"left","apex_s_norm":0.0769,"r_m":79,"name":null,"calibration":"centerline_latlon"},{"corner_index":3,"direction":"right","apex_s_norm":0.1692,"r_m":33,"name":null,"calibration":"centerline_latlon"},{"corner_index":4,"direction":"left","apex_s_norm":0.2231,"r_m":40,"name":null,"calibration":"centerline_latlon"},{"corner_index":5,"direction":"right","apex_s_norm":0.3769,"r_m":33,"name":null,"calibration":"centerline_latlon"},{"corner_index":6,"direction":"left","apex_s_norm":0.4615,"r_m":26,"name":null,"calibration":"centerline_latlon"},{"corner_index":7,"direction":"right","apex_s_norm":0.5077,"r_m":14,"name":null,"calibration":"centerline_latlon"},{"corner_index":8,"direction":"left","apex_s_norm":0.5692,"r_m":46,"name":null,"calibration":"centerline_latlon"},{"corner_index":9,"direction":"left","apex_s_norm":0.6385,"r_m":95,"name":null,"calibration":"centerline_latlon"},{"corner_index":10,"direction":"right","apex_s_norm":0.6615,"r_m":22,"name":null,"calibration":"centerline_latlon"},{"corner_index":11,"direction":"left","apex_s_norm":0.7077,"r_m":36,"name":null,"calibration":"centerline_latlon"},{"corner_index":12,"direction":"left","apex_s_norm":0.8,"r_m":48,"name":null,"calibration":"centerline_latlon"},{"corner_index":13,"direction":"right","apex_s_norm":0.9154,"r_m":84,"name":null,"calibration":"centerline_latlon"}]}'::jsonb,
    corners_engine_version = 'corners-v1',
    corners_computed_at = now(),
    updated_at = now()
where id = '723c9dfc-d0d3-428c-a0d7-f04178e9cd7e';
