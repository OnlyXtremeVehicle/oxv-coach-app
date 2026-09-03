// @ts-nocheck — Deno runtime, pas Node
// Edge Function : cron-analyze-pending-sessions
//
// Balaye les telemetry_sessions completed sans analyse persistée et
// déclenche le calcul côté serveur (marge globale + zone). Rattrape
// les cas où l'app pilote a été tuée avant que analyzeAndPersistSession
// n'ait fini (Q37 sem 13).
//
// Important : NE PAS faire l'analyse trackviz par segment ici (parser
// UBX serait lourd à porter Deno). On fait juste la marge globale
// minimale via les laps. L'analyse complète se fera à la prochaine
// ouverture de l'app par le pilote.
//
// Schédulage : appelé par pg_cron toutes les heures (à configurer
// manuellement côté Supabase Dashboard → Database → Cron Jobs).
// SELECT cron.schedule('analyze-pending', '0 * * * *',
//   $$ SELECT net.http_post(
//     url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/cron-analyze-pending-sessions',
//     headers := jsonb_build_object('Content-Type', 'application/json')
//   ); $$);
//
// verify_jwt = false : appelable sans auth (cron + admin manuel).
// Mais on vérifie un secret header X-Cron-Token pour bloquer le public.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';

// `consistency` s'appelait `regularity` jusqu'au 13/08/2026.
//
// `app_session_analyses` porte deux colonnes voisines, `qdi` et
// `margin_breakdown` : sur la même ligne, `qdi.regularite` valait 34 et
// `margin_breakdown.regularity` valait 0.
//
// CORRIGÉ LE 14/08 : ce ne sont pas deux mesures. Les deux partent des MÊMES
// temps au tour — le QDI en coefficient de variation, la marge en écart-type
// absolu. Une grandeur, deux formules qui ne s'accordent pas, deux noms qui ne
// le disaient pas.
//
// CETTE FONCTION EST L'UN DES DEUX ÉCRIVAINS, et elle tourne : pg_cron job 4,
// « analyze-pending-sessions », actif, toutes les heures.
//
// Précision utile, parce qu'elle change la gravité : le balayage ne prend que
// les séances dépourvues d'analyse. Tant qu'elle n'est pas redéployée, elle ne
// réécrit donc PAS les lignes existantes — mais chaque séance neuve repart avec
// l'ancienne clé, et la colonne se met à porter deux formes.
//
// Le CRITÈRE de ce balayage a lui-même changé le 14/08 : il portait sur
// `margin_global IS NOT NULL`, et c'était une boucle en attente. Voir la
// requête, plus bas.
/**
 * LA VERSION DU MOTEUR DE CALCUL — à incrémenter à CHAQUE changement de calcul.
 *
 * Elle valait `'cron-v1.0'` dans la v18 comme dans la v20, après trois
 * fabrications retirées (`pilotMargin = 100` par défaut, `max_g_lateral ?? 0`,
 * la clé `regularity`) et une formule de constance changée de nature —
 * d'un seuil en secondes vers un coefficient de variation.
 *
 * Elle ne versionnait rien : onze lignes de production portaient la même
 * étiquette pour deux calculs différents.
 *
 * Elle commande désormais l'éligibilité au balayage. Une ligne calculée par un
 * moteur périmé redevient éligible, une fois. **C'est la seule discipline que
 * ce mécanisme demande, et il ne vaut que par elle.**
 *
 * `v2.0` : le calcul de constance a changé de NATURE, pas de réglage.
 * `v3.0`, le même jour : la marge véhicule reposait sur une constante inventée
 * de 1,0 g — retirée. La marge globale se replie sur la marge pilote, et TOUT
 * l'historique doit être repris.
 */
const ALGO_VERSION = 'cron-v3.0';

// LA VERSION QUE L'APPLICATION APPOSE, ET QUE CE CRON NE DOIT PAS REPRENDRE.
//
// `upsertAnalysis` (src/services/analysesService.ts) ecrit `app-v1.0` sur les
// seances qu'elle analyse. Son calcul est PLUS RICHE que celui d'ici : elle
// dispose des segments trackviz, que cette fonction refuse de calculer — voir
// l'en-tete, « parser UBX serait lourd a porter Deno ».
//
// Sans cette exclusion, mesure du 03/09/2026 : une seance analysee par
// l'application redevenait eligible dans l'heure, et ce cron reecrivait
// `margin_global` avec son propre calcul, puis re-tamponnait `cron-v3.0`. La
// marge faisait l'aller-retour a chaque ouverture de bilan.
//
// CONSEQUENCE ASSUMEE : une seance analysee par l'application ne sera plus
// jamais reprise ici, meme quand ALGO_VERSION sera incremente. C'est voulu —
// on ne rattrape pas un calcul complet par un calcul degrade. Son rattrapage a
// elle est la reouverture du bilan.
const APP_ALGO_VERSION = 'app-v1.0';

const MAX_SESSIONS_PER_RUN = 50;
const CONSISTENCY_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;
const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;
/**
 * ===========================================================================
 * IL N'Y A PLUS DE VÉHICULE PAR DÉFAUT — RETIRÉ LE 14/08/2026
 * ===========================================================================
 *
 * Cette constante valait 1,0 g et servait de dénominateur à la marge véhicule
 * pour 100 % des séances : la table `vehicles` ne porte AUCUNE grandeur
 * d'adhérence, et l'application ne passait donc jamais de véhicule.
 *
 * `VEHICLE_WEIGHT = 0.4` : sur Bouteville, elle décalait la marge globale de
 * 7,7 points. La fabrication corrigée le matin même en valait 12,2.
 *
 * Elle a survécu à trois passes de mesure parce qu'elle n'avait pas la forme
 * des autres : pas un `?? 0`, mais une constante nommée et documentée. Elle ne
 * ressemblait pas à une fabrication, elle ressemblait à un paramètre.
 *
 * La marge véhicule vaut désormais `null`, et la marge globale se replie sur
 * la marge PILOTE — même règle que `marginCalculator.computeMargin` côté
 * application. Les deux doivent rester d'accord : c'est cette divergence-là
 * qui a produit deux formules de constance.
 */

function clampMargin(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// COPIE DÉLIBÉRÉE de `computeRegularite` (src/services/qdiLogic.ts).
//
// Cette fonction tourne dans Deno et ne peut rien importer de `src/`. La copie
// est donc structurelle, pas un oubli — et c'est exactement ainsi que deux
// formules d'une même grandeur finissent par diverger. Un test compare les DEUX
// implémentations sur une batterie d'entrées : il extrait celle-ci du fichier et
// l'exécute contre celle de l'application (`cronMemeFormule.guard.test.ts`).
//
// Ce qu'elle a remplacé : `100 - max(0, σ - 1 s) * 25`, un seuil ABSOLU en
// secondes. Il notait zéro une dispersion de 1,5 % sur des tours longs. La
// jumelle `computeSmoothness`, elle, applique le même patron à des g — une
// grandeur déjà sans dimension — et fonctionne. Le coefficient de variation
// rend la durée sans dimension avant de la comparer.
//
// `null` sous trois tours : deux tours ne donnent qu'un écart, et un écart n'est
// pas une dispersion.
function computeConsistency(lapSeconds: number[]): number | null {
  const laps = lapSeconds.filter((v) => Number.isFinite(v) && v > 0);
  if (laps.length < 3) return null;
  const mean = laps.reduce((a, b) => a + b, 0) / laps.length;
  const variance = laps.reduce((a, b) => a + (b - mean) ** 2, 0) / laps.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.round(100 * (1 - Math.max(0, Math.min(1, cv / 0.06))));
}

// Le seuil est ici appliqué à des g — sans dimension. Cette formule-là est
// juste, et elle est conservée telle quelle.
//
// Ce qui NE l'était pas : l'appelant passait `Number(l.max_g_lateral ?? 0)`, et
// fabriquait donc un « 0 g » pour chaque tour non mesuré. Une dispersion de
// zéros identiques vaut zéro, la fluidité sortait à 100, et environ 24 % de la
// marge globale reposait sur rien. L'application avait corrigé ce défaut ; la
// fonction serveur le portait encore. Les tours sans mesure sont désormais
// ÉCARTÉS, et sous deux tours mesurés la fluidité vaut `null`.
function computeSmoothness(gLats: (number | null)[]): number | null {
  const mesures = gLats.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (mesures.length < 2) return null;
  return clampMargin(100 - Math.max(0, stddev(mesures) - 0.05) * 200);
}

function marginZoneOf(p: number): 'green' | 'yellow' | 'red' {
  if (p >= 30) return 'green';
  if (p >= 15) return 'yellow';
  return 'red';
}

Deno.serve(async (req: Request) => {
  try {
    // Optional security : check X-Cron-Token if present
    const expectedToken = Deno.env.get('CRON_TOKEN');
    if (expectedToken) {
      const got = req.headers.get('X-Cron-Token');
      if (got !== expectedToken) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Séances closes SANS LIGNE D'ANALYSE.
    //
    // L'EXCLUSION PORTAIT SUR `margin_global IS NOT NULL` JUSQU'AU 14/08/2026,
    // ET C'ÉTAIT UNE BOUCLE EN ATTENTE.
    //
    // Dix des onze séances closes n'ont AUCUN tour : quelle que soit la qualité
    // du calcul, il ne pourra jamais rien en conclure. Tant que le critère est
    // « marge nulle », ces séances restent éligibles pour toujours — reprises à
    // chaque heure, examinées, abandonnées, reprises.
    //
    // Aujourd'hui la file est vide parce qu'aucune ligne ne porte de marge
    // nulle. Le jour où l'on vide les marges fabriquées, elle en compterait dix,
    // définitivement.
    //
    // Le critère juste est l'EXISTENCE de la ligne : « cette séance a-t-elle été
    // examinée ? », et non « en a-t-on tiré un chiffre ? ». Une séance sans
    // matière est examinée une fois, et c'est tout.
    //
    // ─────────────────────────────────────────────────────────────────────
    // 14/08, SECONDE CORRECTION : LE CRITÈRE PORTE SUR LA VERSION DU MOTEUR
    // ─────────────────────────────────────────────────────────────────────
    //
    // Le critère « la séance a-t-elle une ligne ? » ferme la boucle, mais il
    // ferme AUSSI le rattrapage. Constaté le jour même en production :
    //
    //   Bouteville, la SEULE séance de la base qui porte une vraie mesure,
    //   garde `margin_global = 39.20` et `breakdown.regularity = 0` —
    //   l'ancienne clé et l'ancienne formule — alors que le calcul livré
    //   quelques heures plus tôt donne 51,44. La fonction tournait toutes les
    //   heures, rendait 200, et traitait zéro séance. Correctement.
    //
    // Et rien d'autre ne pouvait la rattraper : `analyzeAndPersistSession`
    // n'est appelée QUE par `rec/fin`, à la clôture. Rouvrir une séance ne
    // recalcule pas.
    //
    // Le critère juste est donc : « cette séance a-t-elle été examinée PAR LE
    // MOTEUR COURANT ? » Une ligne calculée par un moteur périmé redevient
    // éligible, une fois, jusqu'à ce qu'elle porte la version du jour.
    //
    // Trois propriétés à la fois :
    //   • la boucle reste FERMÉE — après recalcul la ligne porte la version
    //     courante et ressort de la file, qu'elle contienne un chiffre ou un
    //     « rien à mesurer » ;
    //   • le rattrapage devient AUTOMATIQUE — incrémenter la constante suffit
    //     à faire repasser tout l'historique, une fois ;
    //   • et `algo_version` recommence à dire quelque chose. Elle valait
    //     'cron-v1.0' dans la v18 comme dans la v20, après trois fabrications
    //     retirées, une formule changée de nature et une clé renommée. Elle ne
    //     versionnait rien.
    //
    // À INCRÉMENTER À CHAQUE CHANGEMENT DE CALCUL. C'est la seule discipline
    // que ce mécanisme demande, et il ne vaut que par elle.
    const { data: pending, error } = await supabase
      .from('telemetry_sessions')
      .select('id, user_id, max_g_lateral')
      .eq('status', 'completed')
      .not(
        'id',
        'in',
        `(SELECT telemetry_session_id FROM app_session_analyses WHERE algo_version IN ('${ALGO_VERSION}', '${APP_ALGO_VERSION}'))`
      )
      .limit(MAX_SESSIONS_PER_RUN);

    if (error) {
      // Fallback : si la sous-requête ne marche pas (RLS limit ou autre),
      // on fait 2 requêtes séparées
      const { data: allCompleted } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, max_g_lateral')
        .eq('status', 'completed')
        .limit(MAX_SESSIONS_PER_RUN * 4);
      // Même critère que la requête principale : l'existence de la ligne. Un
      // repli qui filtrerait autrement rouvrirait la boucle par la porte de
      // derrière, et seulement quand la sous-requête échoue — donc rarement,
      // donc invisiblement.
      const { data: existingAnalyses } = await supabase
        .from('app_session_analyses')
        .select('telemetry_session_id')
        // MÊME critère que la requête principale, version comprise. Un repli
        // qui ignorerait `algo_version` refermerait le rattrapage par la porte
        // de derrière — et seulement quand la sous-requête échoue, donc
        // rarement, donc invisiblement.
        .in('algo_version', [ALGO_VERSION, APP_ALGO_VERSION]);
      const analyzedIds = new Set(
        (existingAnalyses ?? []).map((r: { telemetry_session_id: string }) => r.telemetry_session_id)
      );
      const filtered = (allCompleted ?? []).filter((s: { id: string }) => !analyzedIds.has(s.id));
      return processSessions(supabase, filtered.slice(0, MAX_SESSIONS_PER_RUN));
    }

    return processSessions(supabase, pending ?? []);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

// deno-lint-ignore no-explicit-any
async function processSessions(supabase: any, sessions: any[]) {
  const results: {
    sessionId: string;
    ok: boolean;
    marginGlobal?: number;
    skipped?: string;
    error?: string;
  }[] = [];

  for (const session of sessions) {
    try {
      // MARGE VÉHICULE — `NULL` veut dire « pas encore mesuré », pas « 0 g ».
      //
      // Cette fonction lisait `Number(session.max_g_lateral ?? 0)`, puis rendait
      // 100 quand le résultat valait zéro. Une séance dont la colonne est nulle
      // — parce qu'elle n'est écrite qu'à la CLÔTURE — recevait donc « 100 % de
      // marge véhicule », c'est-à-dire le chiffre roi du bilan, faux et persisté
      // à vie. L'application avait corrigé ce défaut ; le serveur le portait
      // encore, et il a écrit cinq lignes à `margin_global = 100`.
      //
      // Absence → on n'écrit rien du tout.
      // Le véhicule n'est caractérisé nulle part : la marge véhicule est
      // toujours `null` aujourd'hui. `observedG` reste lu — il redeviendra
      // utile le jour où une adhérence mesurée existera — mais il ne sert plus
      // de numérateur à un dénominateur inventé.
      const vehicleMargin: number | null = null;

      // Récupérer les laps valides (hors outlap/inlap)
      const { data: laps } = await supabase
        .from('laps')
        .select('duration_seconds, max_g_lateral, is_outlap, is_inlap')
        .eq('session_id', session.id);
      const validLaps = ((laps ?? []) as Array<{
        duration_seconds: number;
        max_g_lateral: number | null;
        is_outlap: boolean;
        is_inlap: boolean;
      }>).filter(
        (l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0
      );

      // Plus de valeur par défaut à 100 : une séance sans tours n'est pas un
      // pilotage parfait, c'est une séance sans tours. `null` remonte jusqu'à la
      // marge globale, qui n'est alors pas écrite.
      let consistency: number | null = null;
      let smoothness: number | null = null;
      let pilotMargin: number | null = null;
      if (validLaps.length >= 2) {
        consistency = computeConsistency(validLaps.map((l) => l.duration_seconds));
        smoothness = computeSmoothness(
          validLaps.map((l) => (l.max_g_lateral === null ? null : Number(l.max_g_lateral)))
        );
        pilotMargin =
          consistency !== null && smoothness !== null
            ? clampMargin(CONSISTENCY_WEIGHT * consistency + SMOOTHNESS_WEIGHT * smoothness)
            : null;
      }

      // RIEN À MESURER : ON ÉCRIT QUAND MÊME LA LIGNE, SANS AUCUNE MARGE.
      //
      // Une composante absente ne se pondère pas — sans l'une des deux, il n'y a
      // pas de marge globale, et surtout pas « une marge de 100 % ».
      //
      // Mais ne rien écrire du tout laisserait la séance éligible à jamais : le
      // balayage prend celles qui n'ont pas de ligne. La ligne est donc posée
      // avec ses marges nulles, `computed_at` et `algo_version` renseignés.
      //
      // Elle dit exactement ce qui s'est passé : EXAMINÉE, RIEN À MESURER. C'est
      // vrai, c'est utile, et c'est ce que le principe de non-fabrication
      // demande — l'absence est une information, pas un trou à combler.
      // LE REPLI, IDENTIQUE À L'APPLICATION : sans marge pilote il n'y a rien ;
      // sans marge véhicule la globale EST la marge pilote.
      if (pilotMargin === null) {
        const { error: videErr } = await supabase.from('app_session_analyses').upsert(
          {
            telemetry_session_id: session.id,
            user_id: session.user_id,
            margin_global: null,
            margin_zone: null,
            margin_vehicle: vehicleMargin,
            margin_pilot: pilotMargin,
            margin_breakdown: null,
            algo_version: ALGO_VERSION,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'telemetry_session_id' }
        );
        results.push({
          sessionId: session.id,
          ok: videErr === null,
          skipped: 'examinée, rien à mesurer',
          error: videErr?.message,
        });
        continue;
      }

      const marginGlobal =
        vehicleMargin !== null
          ? clampMargin(VEHICLE_WEIGHT * vehicleMargin + PILOT_WEIGHT * pilotMargin)
          : pilotMargin;
      const zone = marginZoneOf(marginGlobal);

      // Upsert
      const { error: upsertErr } = await supabase.from('app_session_analyses').upsert(
        {
          telemetry_session_id: session.id,
          user_id: session.user_id,
          margin_global: marginGlobal,
          margin_zone: zone,
          margin_vehicle: vehicleMargin,
          margin_pilot: pilotMargin,
          margin_breakdown: {
            vehicle: vehicleMargin,
            pilot: pilotMargin,
            consistency,
            smoothness,
            // Sur quoi le chiffre repose. Même vocabulaire que `MarginBase`
            // côté application — l'écran doit pouvoir le dire au pilote.
            base: vehicleMargin !== null ? 'complete' : 'pilote-seul',
          },
          algo_version: ALGO_VERSION,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'telemetry_session_id' }
      );

      if (upsertErr) {
        results.push({ sessionId: session.id, ok: false, error: upsertErr.message });
      } else {
        results.push({ sessionId: session.id, ok: true, marginGlobal });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ sessionId: session.id, ok: false, error: msg });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({
      ok: true,
      processed: results.length,
      successful: okCount,
      failed: results.length - okCount,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
