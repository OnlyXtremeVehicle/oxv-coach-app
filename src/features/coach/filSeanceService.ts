/**
 * FIL DE SÉANCE — le chargement (jalon 6, phase 5).
 *
 * Rassemble, pour UNE capture, ce que les trois registres ont à en dire, et rend
 * un fil assemblé par `filSeanceLogic`. Aucune décision d'affichage ici : ce
 * module lit la base et traduit des lignes en événements.
 *
 * ---
 *
 * CINQ SOURCES, ET UNE SIXIÈME ÉCARTÉE
 *
 *   `app_session_analyses`  machine · la lecture globale de la séance
 *   `app_segment_analyses`  machine · la marge virage par virage
 *   `laps`                  machine · les tours bouclés — les SEULS vrais événements datés
 *   `coach_annotations`     coach   · ce qu'un humain a écrit
 *   `session_intentions`    pilote  · ce qu'il avait posé avant de rouler
 *
 * **`session_feedback` est volontairement absente.** Sa colonne `session_id`
 * pointe vers `sessions` — la JOURNÉE au calendrier — et non vers
 * `telemetry_sessions`, la capture. Vérifié sur les clés étrangères le
 * 01/08/2026. La joindre sur l'identifiant de capture aurait rapproché deux
 * grains différents et affiché l'avis d'une journée entière comme s'il portait
 * sur un run. Un fil doit dire d'où vient chaque ligne, ou se taire.
 *
 * `coach_pilot_highlight` est écartée pour la même raison de grain : elle vit
 * par BINÔME, sans lien de séance. Ce qu'un coach met en avant pour un pilote
 * n'appartient pas au fil d'une capture particulière.
 *
 * ---
 *
 * CE QUI EST DATÉ, ET CE QUI NE L'EST PAS
 *
 * Seuls les tours portent un instant DANS la séance (`laps.ended_at`). Les
 * analyses portent un `computed_at`, mais c'est l'heure du CALCUL, postérieure
 * au roulage : la placer dans le fil situerait « la lecture OXV » après le
 * dernier tour, ce qui est vrai du calcul et faux de la séance. Elles remontent
 * donc en entête, avec leur ancrage de virage quand elles en ont un.
 *
 * Les annotations du coach, elles, sont datées de leur écriture — un vrai
 * moment, même s'il tombe après le roulage. Elles descendent dans le fil.
 *
 * ---
 *
 * TOUT ÉCHEC EST SILENCIEUX ET PARTIEL
 *
 * Une source qui ne répond pas retire ses lignes du fil, elle ne le fait pas
 * échouer. Le coach voit alors moins de choses — jamais une erreur à la place de
 * sa séance, jamais une valeur inventée pour combler.
 */

import { type EvenementFil, type FilSeance, assembleFil } from '@/features/coach/filSeanceLogic';
import { supabase } from '@/lib/supabase';

/** Convertit un horodatage ISO en ms, ou null s'il est absent ou illisible. */
function instant(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Chrono en secondes → « 1:23.4 ». Rend null si la mesure n'existe pas. */
function chrono(secondes: number | null | undefined): string | null {
  if (typeof secondes !== 'number' || !Number.isFinite(secondes) || secondes <= 0) return null;
  const m = Math.floor(secondes / 60);
  const s = secondes - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

async function lectureGlobale(captureId: string): Promise<EvenementFil[]> {
  const { data } = await supabase
    .from('app_session_analyses')
    .select('id, margin_global, margin_zone, next_focus_phrase, debrief_text')
    .eq('telemetry_session_id', captureId)
    .maybeSingle();
  if (!data) return [];

  const r = data as {
    id: string;
    margin_global: number | null;
    margin_zone: string | null;
    next_focus_phrase: string | null;
    debrief_text: string | null;
  };

  const out: EvenementFil[] = [];

  // La marge globale ne s'affiche QUE si elle est mesurée. Un « 0 % » fabriqué
  // se lirait comme une mesure catastrophique.
  if (typeof r.margin_global === 'number' && Number.isFinite(r.margin_global)) {
    out.push({
      id: `analyse-marge-${r.id}`,
      registre: 'machine',
      instantMs: null,
      tour: null,
      virage: null,
      titre: `Marge globale ${Math.round(r.margin_global)} %`,
      corps: r.margin_zone ?? null,
    });
  }

  if (typeof r.debrief_text === 'string' && r.debrief_text.trim().length > 0) {
    out.push({
      id: `analyse-debrief-${r.id}`,
      registre: 'machine',
      instantMs: null,
      tour: null,
      virage: null,
      titre: 'Lecture de la séance',
      corps: r.debrief_text,
    });
  }

  if (typeof r.next_focus_phrase === 'string' && r.next_focus_phrase.trim().length > 0) {
    out.push({
      id: `analyse-focus-${r.id}`,
      registre: 'machine',
      instantMs: null,
      tour: null,
      virage: null,
      titre: 'À observer la prochaine fois',
      corps: r.next_focus_phrase,
    });
  }

  return out;
}

async function margesParVirage(captureId: string): Promise<EvenementFil[]> {
  const { data } = await supabase
    .from('app_segment_analyses')
    .select('id, segment_index, segment_name, margin_percent, margin_zone')
    .eq('telemetry_session_id', captureId)
    .order('segment_index', { ascending: true });
  if (!Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .map((row): EvenementFil | null => {
      const marge = row.margin_percent;
      if (typeof marge !== 'number' || !Number.isFinite(marge)) return null;
      const index = row.segment_index;
      return {
        id: `segment-${String(row.id)}`,
        registre: 'machine',
        instantMs: null,
        tour: null,
        // `segment_index` est DÉJÀ en base 1 (CHECK SQL >= 1) : on le rend tel
        // quel. L'incrémenter désignerait le virage suivant (D-21).
        virage: typeof index === 'number' && Number.isFinite(index) ? index : null,
        titre:
          typeof row.segment_name === 'string' && row.segment_name.length > 0
            ? row.segment_name
            : 'Virage',
        corps: `Marge ${Math.round(marge)} %${row.margin_zone ? ` · ${String(row.margin_zone)}` : ''}`,
      };
    })
    .filter((e): e is EvenementFil => e !== null);
}

async function toursBoucles(captureId: string): Promise<EvenementFil[]> {
  const { data } = await supabase
    .from('laps')
    .select('id, lap_number, ended_at, duration_seconds, is_best_lap, is_outlap, is_inlap')
    .eq('session_id', captureId)
    .order('lap_number', { ascending: true });
  if (!Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .map((row): EvenementFil | null => {
      const fin = instant(row.ended_at as string | null);
      if (fin === null) return null; // sans fin de tour, pas d'événement daté
      const duree = chrono(row.duration_seconds as number | null);
      const numero = row.lap_number;
      // Un tour d'entrée ou de sortie n'est pas un tour de référence : on le dit
      // plutôt que de le présenter comme un chrono comparable.
      const nature = row.is_outlap === true ? 'Sortie' : row.is_inlap === true ? 'Rentrée' : null;
      return {
        id: `tour-${String(row.id)}`,
        registre: 'machine',
        instantMs: fin,
        tour: typeof numero === 'number' && Number.isFinite(numero) ? numero : null,
        virage: null,
        titre: duree === null ? 'Tour bouclé' : `Tour en ${duree}`,
        corps: nature ?? (row.is_best_lap === true ? 'Meilleur tour de la séance' : null),
      };
    })
    .filter((e): e is EvenementFil => e !== null);
}

async function annotationsCoach(captureId: string): Promise<EvenementFil[]> {
  const { data } = await supabase
    .from('coach_annotations')
    .select('id, body, corner_index, lap_index, created_at, audio_url')
    .eq('telemetry_session_id', captureId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (!Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .map((row): EvenementFil | null => {
      const corps = row.body;
      const aAudio = typeof row.audio_url === 'string' && row.audio_url.length > 0;
      // Une annotation sans texte NI audio ne porte rien : on ne l'affiche pas.
      if ((typeof corps !== 'string' || corps.trim().length === 0) && !aAudio) return null;
      const virage = row.corner_index;
      const tour = row.lap_index;
      return {
        id: `annotation-${String(row.id)}`,
        registre: 'coach',
        instantMs: instant(row.created_at as string | null),
        tour: typeof tour === 'number' && Number.isFinite(tour) ? tour : null,
        virage: typeof virage === 'number' && Number.isFinite(virage) ? virage : null,
        titre: aAudio ? 'Note vocale de votre coach' : 'Note de votre coach',
        corps: typeof corps === 'string' && corps.trim().length > 0 ? corps : null,
      };
    })
    .filter((e): e is EvenementFil => e !== null);
}

async function intentionPilote(captureId: string): Promise<EvenementFil[]> {
  const { data } = await supabase
    .from('session_intentions')
    .select('id, body, created_at')
    .eq('session_id', captureId)
    .maybeSingle();
  if (!data) return [];

  const r = data as { id: string; body: string | null };
  if (typeof r.body !== 'string' || r.body.trim().length === 0) return [];

  return [
    {
      id: `intention-${r.id}`,
      registre: 'pilote',
      // Posée AVANT le roulage : la dater dans le fil la placerait au mauvais
      // endroit. Elle encadre la séance, elle n'en est pas un moment.
      instantMs: null,
      tour: null,
      virage: null,
      titre: 'Ce que vous vouliez garder en tête',
      corps: r.body,
    },
  ];
}

/**
 * Charge le fil d'une capture. Ne rejette jamais : une source muette retire ses
 * lignes, elle ne fait pas tomber l'écran.
 */
export async function chargerFilSeance(captureId: string): Promise<FilSeance> {
  if (typeof captureId !== 'string' || captureId.length === 0) {
    return assembleFil([]);
  }

  const morceaux = await Promise.all([
    lectureGlobale(captureId).catch(() => []),
    margesParVirage(captureId).catch(() => []),
    toursBoucles(captureId).catch(() => []),
    annotationsCoach(captureId).catch(() => []),
    intentionPilote(captureId).catch(() => []),
  ]);

  return assembleFil(morceaux.flat());
}
