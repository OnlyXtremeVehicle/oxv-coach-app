-- =============================================================================
-- Renseigne `laps.distance_meters` sur les tours qui n'en portent pas,
-- à partir des trames réelles de la séance.
-- =============================================================================
--
-- POURQUOI CE SCRIPT EXISTE
--
-- `distance_meters` n'a jamais été écrite par l'application — documenté le
-- 26/07/2026, corrigé le 13/08/2026 seulement. Toutes les séances antérieures
-- portent donc des tours sans longueur, et `compteToursComparables` n'accepte
-- que des longueurs strictement positives : le niveau « Le delta et la trace »
-- restait fermé sur ces séances, avec un message affirmant qu'aucun tour n'était
-- comparable — y compris pour trois tours à quatre mètres d'écart.
--
-- CE QUE CE SCRIPT MESURE, ET CE QU'IL N'INVENTE PAS
--
-- Exactement le calcul que fait désormais l'odomètre embarqué : intégration de
-- la vitesse Doppler du boîtier, pas des positions GPS. La dérive d'un véhicule
-- à l'arrêt est elle-même une distance — vingt kilomètres en cinq minutes
-- d'immobilité — et cumuler les positions produirait un nombre absurde.
--
--   - bande morte à 3 km/h : sous ce seuil, la vitesse est du bruit ;
--   - pas de temps plafonné à 2 000 ms : au-delà, c'est un trou de données et
--     non un déplacement mesuré.
--
-- Les tours dont l'intégrale est nulle sont LAISSÉS À `null`. Un odomètre muet
-- ne mesure pas zéro mètre : il ne mesure rien, et écrire 0 le ferait passer
-- pour une mesure.
--
-- VÉRIFICATION CROISÉE, sur la séance du 13/08/2026 : cette intégrale et le
-- produit `avg_speed_kmh × duration_seconds` — deux chemins indépendants —
-- concordent à 1,4 m près sur 5 875 m.
--
-- IDEMPOTENT : ne touche que les lignes à `distance_meters IS NULL`.
-- RÉVERSIBLE : voir la requête d'annulation en fin de fichier.
-- =============================================================================

begin;

with trame as (
  select tf.session_id,
         tf.elapsed_ms,
         tf.speed_kmh,
         tf.elapsed_ms - lag(tf.elapsed_ms) over (
           partition by tf.session_id order by tf.elapsed_ms
         ) as dt_ms
  from public.telemetry_frames tf
  where tf.session_id in (
    select distinct lp.session_id from public.laps lp where lp.distance_meters is null
  )
),
borne as (
  -- Les tours se repèrent dans les trames par leur décalage depuis le début de
  -- la séance : `telemetry_frames` ne porte pas de numéro de tour.
  select lp.id,
         lp.session_id,
         (extract(epoch from (lp.started_at - ts.started_at)) * 1000)::numeric as debut_ms,
         (extract(epoch from (lp.ended_at   - ts.started_at)) * 1000)::numeric as fin_ms
  from public.laps lp
  join public.telemetry_sessions ts on ts.id = lp.session_id
  where lp.distance_meters is null
    and lp.started_at is not null
    and lp.ended_at is not null
    and ts.started_at is not null
),
odometre as (
  select b.id,
         sum(
           case
             when t.dt_ms > 0 and t.dt_ms <= 2000 and t.speed_kmh >= 3
             then (t.speed_kmh / 3.6) * (t.dt_ms / 1000.0)
             else 0
           end
         ) as metres
  from borne b
  join trame t
    on t.session_id = b.session_id
   and t.elapsed_ms >= b.debut_ms
   and t.elapsed_ms <  b.fin_ms
  group by b.id
)
update public.laps lp
set distance_meters = round(odometre.metres, 2)
from odometre
where lp.id = odometre.id
  and odometre.metres > 0;   -- zéro reste null : l'absence, pas une mesure

-- Contrôle avant de valider : les longueurs doivent se ressembler entre elles
-- sur une même séance, et coller au produit vitesse moyenne × durée.
select session_id,
       lap_number,
       distance_meters,
       round((avg_speed_kmh / 3.6) * duration_seconds, 1) as controle_vmoy_x_duree
from public.laps
where distance_meters is not null
order by session_id, lap_number;

commit;

-- =============================================================================
-- ANNULATION — remet les longueurs à l'état d'avant.
-- =============================================================================
-- update public.laps set distance_meters = null
-- where session_id = '<uuid de la séance>';
