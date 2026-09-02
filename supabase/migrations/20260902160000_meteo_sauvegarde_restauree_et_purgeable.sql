-- LA METEO DU 19/07 : rendue aux seances, et rendue effacable.
--
-- DECISION DU FONDATEUR, 02/09/2026, sur deux points distincts.
--
-- ============================================================================
-- 1. POURQUOI LA TABLE AVAIT ETE VIDEE — la reponse etait deja ecrite
-- ============================================================================
--
-- docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md, point 3 : les cinq tables
-- `_backup_*_20260719` « datent des travaux de securite du 19 juillet et
-- portent sur des tables qui semblent relever du site ». Le document pose la
-- question a l equipe site en toutes lettres — « A vous de dire » — et elle n a
-- jamais repondu.
--
-- Le vidage n est donc PAS un jugement sur la qualite de ces releves : c est un
-- lot de securite cote site, et les mesures elles-memes n ont jamais ete mises
-- en cause. Le fondateur tranche : on les restaure.
--
-- CE QUI A ETE MESURE AVANT D ECRIRE :
--   14 lignes, schema IDENTIQUE a weather_snapshots (20 colonnes, une a une)
--   7 seances distinctes, toutes VIVANTES dans telemetry_sessions
--   0 ligne orpheline, 0 collision avec le contenu actuel (la cible etait vide)
--   2 moments par seance — 'before' ET 'after'
--   temperatures 13,8 a 15,8 C, pression 1015-1016 hPa, humidite 58 a 79 %
--   une latitude/longitude DIFFERENTE a chaque ligne : la position reelle de
--   l appareil, et non la ligne d arrivee du circuit
--
-- ============================================================================
-- 2. LA CONTRADICTION DU DEPOT SUR LA DONNEE PERSONNELLE
-- ============================================================================
--
-- La migration 20260801150110 classe `_backup_weather` parmi les sauvegardes
-- qui « n en portent pas [de donnees personnelles] et restent hors purge ».
--
-- docs/architecture/14_PURGE_MATRIX.md dit l inverse des cinq copies : « C est
-- un defaut d EFFACEMENT : un compte purge survit dans ces copies. »
--
-- La mesure tranche pour la seconde : chaque ligne porte une POSITION
-- GEOGRAPHIQUE distincte, et un `session_id` qui remonte a un utilisateur par
-- telemetry_sessions.user_id. Une position rattachable a une personne est une
-- donnee personnelle ; la classer autrement etait un pari.
--
-- LE GESTE CHOISI N EST PAS CELUI QU ON ATTENDAIT. Ajouter un `delete` dans
-- `purge_user_data` aurait impose de REECRIRE une fonction SECURITY DEFINER de
-- 11 735 caracteres, critique pour le RGPD, pour y inserer cinq lignes — et
-- de les placer AVANT `delete from telemetry_sessions`, qui est la toute
-- premiere instruction, sans quoi la sous-requete ne trouverait plus rien.
-- Une transcription pour cinq lignes, sur cette fonction-la, est un risque
-- disproportionne.
--
-- La sauvegarde n a AUCUNE contrainte — ni cle primaire, ni cle etrangere,
-- verifie — et aucune ligne orpheline. On lui donne donc la meme cle etrangere
-- que la table qu elle copie : la copie herite du comportement d effacement de
-- l original. Plus de question d ordre dans la purge, plus de fonction a
-- reecrire, et le jour ou `purge_user_data` sera reordonnee, cela tiendra
-- toujours.

-- ── 2a. La copie s efface avec la seance, comme l original ──────────────────

alter table public._backup_weather_20260719
  add constraint backup_weather_20260719_session_id_fkey
  foreign key (session_id) references public.telemetry_sessions (id)
  on delete cascade;

comment on constraint backup_weather_20260719_session_id_fkey
  on public._backup_weather_20260719 is
  'Ajoutee le 02/09/2026. Cette copie porte une position geographique par ligne '
  'et un session_id rattachable a un utilisateur : c est une donnee personnelle, '
  'contrairement a ce qu affirmait la migration du 01/08. La cascade la fait '
  'entrer dans la purge RGPD sans reecrire purge_user_data, dont le delete sur '
  'telemetry_sessions est la premiere instruction.';

-- ── 2b. Les quatorze releves reviennent aux sept seances ────────────────────

insert into public.weather_snapshots (
  id, session_id, captured_at, moment, latitude, longitude, temperature_c,
  feels_like_c, humidity_pct, pressure_hpa, visibility_km, wind_speed_kmh,
  wind_direction_deg, wind_gust_kmh, precipitation_mm,
  precipitation_probability_pct, weather_code, weather_label, raw_data, created_at
)
select
  id, session_id, captured_at, moment, latitude, longitude, temperature_c,
  feels_like_c, humidity_pct, pressure_hpa, visibility_km, wind_speed_kmh,
  wind_direction_deg, wind_gust_kmh, precipitation_mm,
  precipitation_probability_pct, weather_code, weather_label, raw_data, created_at
from public._backup_weather_20260719
on conflict (id) do nothing;

-- VERIFIE APRES APPLICATION, le 02/09/2026 :
--   weather_snapshots : 14 lignes, 7 seances, moments 'before' ET 'after',
--   14 positions distinctes, temperatures 13,8 a 15,8 C
--   contrainte de cascade posee (confdeltype = 'c')
