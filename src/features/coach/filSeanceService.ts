/**
 * FIL DE SÉANCE — le chargement (jalon 6, phase 5).
 *
 * Rassemble, pour UNE capture, ce que les trois registres ont à en dire, et rend
 * un fil assemblé par `filSeanceLogic`. Aucune décision d'affichage ici : ce
 * module lit la base et traduit des lignes en événements.
 *
 * ---
 *
 * CINQ SOURCES, ET DEUX ÉCARTÉES
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
 * grains différents.
 *
 * `coach_pilot_highlight` l'est pour la même raison : elle vit par BINÔME, sans
 * lien de séance.
 *
 * ---
 *
 * CE QUI EST DATÉ, ET CE QUI NE L'EST PAS
 *
 * Seuls les tours portent un instant DANS la séance (`laps.ended_at`). Les
 * analyses portent un `computed_at`, mais c'est l'heure du CALCUL, postérieure
 * au roulage : elles remontent en entête, avec leur ancrage de virage.
 *
 * Les annotations du coach sont datées de leur ÉCRITURE — un vrai moment, mais
 * qui n'est pas un moment de la séance. Elles descendent dans le fil, et l'écran
 * affiche leur date complète pour que la différence saute aux yeux.
 *
 * ---
 *
 * L'ÉCHEC N'EST PAS LE VIDE
 *
 * Une source qui ne répond pas ne rend pas « rien » : elle rend un ÉCHEC, et le
 * fil le porte (`panne`). Une première version avalait toutes les erreurs
 * Supabase et affichait « Ce fil est vide » sur une panne totale de réseau —
 * l'état d'erreur de l'écran était injoignable. Relevé par la revue adversariale
 * du 01/08/2026.
 *
 * ---
 *
 * CET ÉCRAN EST LU PAR LE COACH
 *
 * Les libellés s'adressent à LUI, pas au pilote : « Votre note », pas « la note
 * de votre coach » ; « Ce que le pilote voulait garder en tête », pas « ce que
 * VOUS vouliez ». Une première version reprenait les formulations de l'espace
 * pilote et faisait dire au coach qu'il était son propre coach.
 */

import { type EvenementFil, type FilSeance, assembleFil } from '@/features/coach/filSeanceLogic';
import { supabase } from '@/lib/supabase';
import {
  type BorneTour,
  type TrameMarqueur,
  phraseMarqueur,
  resoudreMarqueur,
} from '@/telemetry/marqueur';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { formatChronoTenths } from '@/utils/format';

/** Résultat d'une source : ses événements, et si sa lecture a échoué. */
interface Morceau {
  evenements: EvenementFil[];
  panne: boolean;
}

const RIEN: Morceau = { evenements: [], panne: false };
const PANNE: Morceau = { evenements: [], panne: true };

/** Un nombre exploitable — les frontières non typées en rendent rarement. */
function nombreFini(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Convertit un horodatage ISO en ms, ou null s'il est absent ou illisible. */
function instant(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string' || iso.length === 0) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Étiquette humaine d'une zone de marge — « Confortable », « À explorer »,
 * « Terrain serré ».
 *
 * `margin_zone` est un CODE COULEUR interne (`green` · `yellow` · `red`,
 * contraint en base), pas une étiquette. Une première version le rendait tel
 * quel : le coach lisait « green » sous un chiffre roi, dans un écran vouvoyé —
 * et « red » lu seul à côté d'une marge se lit comme un verdict. La table de
 * correspondance existait déjà et était appliquée partout ailleurs.
 */
function libelleZone(zone: unknown): string | null {
  if (zone !== 'green' && zone !== 'yellow' && zone !== 'red') return null;
  return marginLabelOf(zone as MarginZone);
}

/**
 * Première phrase utile d'un texte long, séparateurs Markdown retirés.
 *
 * `debrief_text` est rédigé en Markdown : titres, listes, traits de séparation.
 * L'afficher brut faisait apparaître des « --- » et des « ## » dans le fil.
 */
function premierParagraphe(texte: string): string | null {
  const propre = texte
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-*_]{3,}$/.test(l))
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/^[-*]\s+/, '')
        .trim()
    )
    .filter((l) => l.length > 0);
  return propre.length > 0 ? propre.join(' ') : null;
}

async function lectureGlobale(captureId: string): Promise<Morceau> {
  const { data, error } = await supabase
    .from('app_session_analyses')
    .select('id, margin_global, margin_zone, next_focus_phrase, debrief_text')
    .eq('telemetry_session_id', captureId)
    .maybeSingle();

  if (error) return PANNE;
  if (!data) return RIEN;

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
      corps: libelleZone(r.margin_zone),
    });
  }

  if (typeof r.debrief_text === 'string' && r.debrief_text.trim().length > 0) {
    const corps = premierParagraphe(r.debrief_text);
    if (corps !== null) {
      out.push({
        id: `analyse-debrief-${r.id}`,
        registre: 'machine',
        instantMs: null,
        tour: null,
        virage: null,
        titre: 'Lecture de la séance',
        corps,
      });
    }
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

  return { evenements: out, panne: false };
}

async function margesParVirage(captureId: string): Promise<Morceau> {
  const { data, error } = await supabase
    .from('app_segment_analyses')
    .select('id, segment_index, segment_name, margin_percent, margin_zone')
    .eq('telemetry_session_id', captureId)
    .order('segment_index', { ascending: true });

  if (error) return PANNE;
  if (!Array.isArray(data)) return RIEN;

  const evenements = (data as Record<string, unknown>[])
    .map((row): EvenementFil | null => {
      const marge = row.margin_percent;
      if (typeof marge !== 'number' || !Number.isFinite(marge)) return null;
      const index = row.segment_index;
      const zone = libelleZone(row.margin_zone);
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
        corps: `Marge ${Math.round(marge)} %${zone !== null ? ` · ${zone}` : ''}`,
      };
    })
    .filter((e): e is EvenementFil => e !== null);

  return { evenements, panne: false };
}

async function toursBoucles(captureId: string): Promise<Morceau> {
  const { data, error } = await supabase
    .from('laps')
    .select('id, lap_number, ended_at, duration_seconds, is_best_lap, is_outlap, is_inlap')
    .eq('session_id', captureId)
    .order('lap_number', { ascending: true });

  if (error) return PANNE;
  if (!Array.isArray(data)) return RIEN;

  const evenements = (data as Record<string, unknown>[])
    .map((row): EvenementFil | null => {
      const fin = instant(row.ended_at as string | null);
      if (fin === null) return null; // sans fin de tour, pas d'événement daté
      const numero = row.lap_number;
      // `duration_seconds` est NUMERIC : PostgREST peut le rendre en chaîne.
      // `formatChronoTenths` est le formateur du dépôt — il arrondit AVANT de
      // découper les minutes, ce qui évite le « 1:60.0 » qu'une réécriture
      // maison produisait sur les tours tombant juste sous la minute ronde.
      const secondes = Number(row.duration_seconds);
      const duree = Number.isFinite(secondes) && secondes > 0 ? formatChronoTenths(secondes) : null;
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

  return { evenements, panne: false };
}

/**
 * Les trames de la capture, pour resoudre les marqueurs.
 *
 * Chargees SEULEMENT si au moins une annotation porte un marqueur : lire des
 * milliers de trames pour un fil qui n'en a pas besoin serait du gachis, et le
 * fil doit rester ouvrable au bord d'une piste.
 */
/**
 * Marge de trames chargée de part et d'autre d'un marqueur.
 *
 * Le résolveur ne regarde JAMAIS plus loin que `FENETRE_FREINAGE_MS` en arrière
 * (2 s) et `ECART_TRAME_MAX_MS` en avant (1 s). Trois secondes de chaque côté
 * couvrent les deux avec de la marge, y compris si un trou de GPS décale la
 * trame la plus proche.
 */
const MARGE_TRAMES_MS = 3000;

/** Au-delà, l'URL du filtre devient plus coûteuse que la lecture complète. */
const FENETRES_MAX = 25;

/**
 * Trames d'une capture, pour résoudre des marqueurs.
 *
 * `instantsMs` — les instants à résoudre. Fourni, on ne lit QUE les quelques
 * secondes utiles autour de chacun ; absent, on lit toute la capture.
 *
 * Ce n'est pas une optimisation de confort. Une séance de vingt minutes à 25 Hz
 * fait TRENTE MILLE trames : les télécharger entièrement pour afficher trois
 * cases à cocher se paie sur le réseau du circuit, celui-là même qui est mauvais
 * le jour où le coach en a besoin. Relevé par la revue adversariale du
 * 02/08/2026.
 */
export async function tramesPourMarqueurs(
  captureId: string,
  instantsMs?: readonly number[]
): Promise<TrameMarqueur[]> {
  const instants = Array.isArray(instantsMs)
    ? instantsMs.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    : [];

  let requete = supabase
    .from('telemetry_frames')
    .select('elapsed_ms, latitude, longitude, speed_kmh, g_force_x')
    .eq('session_id', captureId);

  if (instants.length > 0 && instants.length <= FENETRES_MAX) {
    // Une branche par marqueur. PostgREST rend chaque ligne une seule fois même
    // si deux fenêtres se recouvrent — pas de dédoublonnage à faire ici.
    const branches = instants.map(
      (t) =>
        `and(elapsed_ms.gte.${Math.max(0, t - MARGE_TRAMES_MS)},elapsed_ms.lte.${t + MARGE_TRAMES_MS})`
    );
    requete = requete.or(branches.join(','));
  }

  const { data, error } = await requete
    .order('elapsed_ms', { ascending: true })
    // PostgREST plafonne à 1000 lignes par défaut — QUARANTE SECONDES à 25 Hz.
    // Sans borne explicite, les marqueurs tardifs perdaient leurs faits en
    // silence. Relevé par la revue adversariale du 02/08/2026.
    .range(0, 49999);

  if (error || !Array.isArray(data)) return [];

  // PostgREST rend le NUMERIC en CHAINE : sans coercition, chaque comparaison
  // serait lexicographique et le resolveur travaillerait sur du texte.
  return (data as Record<string, unknown>[]).map((r) => ({
    elapsedMs: Number(r.elapsed_ms),
    lat: r.latitude === null ? null : Number(r.latitude),
    lon: r.longitude === null ? null : Number(r.longitude),
    speedKmh: r.speed_kmh === null ? null : Number(r.speed_kmh),
    gForceX: r.g_force_x === null ? null : Number(r.g_force_x),
  }));
}

/**
 * Bornes de tour en ms ECOULEES, pour situer un marqueur dans un tour.
 *
 * Les tours portent des horodatages ABSOLUS, les trames un temps ECOULE depuis
 * le debut de la capture. On ramene les bornes sur la meme origine — sans quoi
 * la comparaison n'aurait aucun sens et chaque marqueur tomberait hors tour.
 */
export async function bornesDesTours(
  captureId: string,
  debutIso: string | null
): Promise<BorneTour[]> {
  const debut = instant(debutIso);
  if (debut === null) return [];

  const { data, error } = await supabase
    .from('laps')
    .select('lap_number, started_at, ended_at')
    .eq('session_id', captureId)
    .order('lap_number', { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return (data as Record<string, unknown>[])
    .map((r): BorneTour | null => {
      const d = instant(r.started_at as string | null);
      const f = instant(r.ended_at as string | null);
      const n = r.lap_number;
      if (d === null || f === null || !nombreFini(n)) return null;
      return { numero: n, debutMs: d - debut, finMs: f - debut };
    })
    .filter((b): b is BorneTour => b !== null);
}

async function annotationsCoach(captureId: string, debutIso: string | null): Promise<Morceau> {
  const { data, error } = await supabase
    .from('coach_annotations')
    .select(
      'id, body, corner_index, lap_index, created_at, audio_url, marker_elapsed_ms, marker_lat, marker_lon'
    )
    .eq('telemetry_session_id', captureId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) return PANNE;
  if (!Array.isArray(data)) return RIEN;

  const lignes = data as Record<string, unknown>[];

  // LE MARQUEUR EST RESOLU A LA LECTURE, jamais stocke resolu — c'est la lettre
  // du plan. On ne charge les trames que s'il y a quelque chose a resoudre.
  const instants = lignes.map((r) => r.marker_elapsed_ms).filter((v): v is number => nombreFini(v));
  const [trames, bornes] =
    instants.length > 0
      ? await Promise.all([
          tramesPourMarqueurs(captureId, instants),
          bornesDesTours(captureId, debutIso),
        ])
      : [[] as TrameMarqueur[], [] as BorneTour[]];

  const evenements = lignes
    .map((row): EvenementFil | null => {
      const corps = row.body;
      const aAudio = typeof row.audio_url === 'string' && row.audio_url.length > 0;
      const aMarqueur = nombreFini(row.marker_elapsed_ms);
      // Une annotation sans texte, sans audio NI marqueur ne porte rien.
      //
      // LE MARQUEUR MANQUAIT À CETTE LISTE, et c'est ce qui rendait fausse la
      // phrase « À retrouver dans le fil » affichée après le geste : un
      // marqueur naît SANS TEXTE, il était donc écarté avant même d'être
      // résolu. Relevé par la revue adversariale du 02/08/2026.
      if ((typeof corps !== 'string' || corps.trim().length === 0) && !aAudio && !aMarqueur) {
        return null;
      }
      const virage = row.corner_index;
      const tour = row.lap_index;

      // UN MARQUEUR POSE : on le resout ICI. Ce que le calcul rend PRIME sur les
      // index saisis a la main — la mesure sait ou etait le pilote, la saisie
      // dit ou le coach croyait qu'il etait.
      const m = nombreFini(row.marker_elapsed_ms)
        ? resoudreMarqueur(row.marker_elapsed_ms, trames, bornes, [])
        : null;
      const faits = m !== null ? phraseMarqueur(m) : null;
      const texte = typeof corps === 'string' && corps.trim().length > 0 ? corps : null;

      return {
        id: `annotation-${String(row.id)}`,
        registre: 'coach',
        instantMs: instant(row.created_at as string | null),
        tour: m?.tour ?? (nombreFini(tour) ? tour : null),
        virage: m?.virage ?? (nombreFini(virage) ? virage : null),
        // Écran LU PAR LE COACH : c'est SA note, pas celle d'un tiers.
        titre: m !== null ? 'Votre marqueur' : aAudio ? 'Votre note vocale' : 'Votre note',
        // Les FAITS d'abord, la note ensuite : il a vu, la machine dit ou et
        // quoi, personne n'interprete.
        corps: [faits, texte].filter(Boolean).join(' — ') || null,
      };
    })
    .filter((e): e is EvenementFil => e !== null);

  return { evenements, panne: false };
}

async function intentionPilote(captureId: string): Promise<Morceau> {
  // `session_intentions.session_id` ne porte AUCUNE contrainte d'unicité : deux
  // intentions peuvent viser la même capture. `.maybeSingle()` lèverait alors.
  // On prend la plus récente, comme le lecteur pilote voisin.
  const { data, error } = await supabase
    .from('session_intentions')
    .select('id, body, created_at')
    .eq('session_id', captureId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return PANNE;
  if (!Array.isArray(data) || data.length === 0) return RIEN;

  const r = data[0] as { id: string; body: string | null };
  if (typeof r.body !== 'string' || r.body.trim().length === 0) return RIEN;

  return {
    evenements: [
      {
        id: `intention-${r.id}`,
        registre: 'pilote',
        // Posée AVANT le roulage : la dater dans le fil la placerait au mauvais
        // endroit. Elle encadre la séance, elle n'en est pas un moment.
        instantMs: null,
        tour: null,
        virage: null,
        // Écran LU PAR LE COACH : c'est l'intention du PILOTE.
        titre: 'Ce que le pilote voulait garder en tête',
        corps: r.body,
      },
    ],
    panne: false,
  };
}

/** Le fil, plus l'aveu qu'une source au moins n'a pas répondu. */
export interface FilCharge {
  fil: FilSeance;
  /** Vrai si UNE source au moins a échoué. Un fil incomplet le dit. */
  panne: boolean;
}

/**
 * Charge le fil d'une capture. Ne rejette jamais — mais distingue l'ÉCHEC du
 * VIDE, pour que l'écran ne présente pas une panne comme une séance sans
 * matière.
 */
export async function chargerFilSeance(captureId: string): Promise<FilCharge> {
  if (typeof captureId !== 'string' || captureId.length === 0) {
    return { fil: assembleFil([]), panne: false };
  }

  // Origine des temps de la capture : les trames comptent en ms ECOULEES, les
  // tours en horodatages absolus. Sans cette origine, aucun marqueur ne peut
  // etre situe dans un tour.
  const { data: seance } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('id', captureId)
    .maybeSingle();
  const debutIso = (seance as { started_at?: string | null } | null)?.started_at ?? null;

  const morceaux = await Promise.all([
    lectureGlobale(captureId).catch(() => PANNE),
    margesParVirage(captureId).catch(() => PANNE),
    toursBoucles(captureId).catch(() => PANNE),
    annotationsCoach(captureId, debutIso).catch(() => PANNE),
    intentionPilote(captureId).catch(() => PANNE),
  ]);

  return {
    fil: assembleFil(morceaux.flatMap((m) => m.evenements)),
    panne: morceaux.some((m) => m.panne),
  };
}
