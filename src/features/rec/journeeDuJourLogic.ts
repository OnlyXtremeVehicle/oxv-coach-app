/**
 * LE CIRCUIT DE LA JOURNÉE RÉSERVÉE — choix pur, testable sans réseau.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * Nuit du 12 au 13/08/2026, premier essai terrain. Le fondateur avait une
 * journée réservée à **Bouteville**. Le Paddock la lui affichait. Le Pass la
 * lui affichait. Il a appairé son boîtier, fait la check-list, armé la capture.
 *
 * **La séance a été enregistrée sur Haute Saintonge.**
 *
 * Relevé en base après coup : `circuit_name = 'Haute Saintonge'`, zéro tour,
 * zéro trame. La ligne d'arrivée employée était à quarante kilomètres de
 * l'endroit où il roulait.
 *
 * La cause tient en une ligne de `rec/placement.tsx` :
 *
 *     const def = await getDefaultCircuit();
 *     setSelectedId(def?.id ?? list[0]?.id ?? null);
 *
 * `getDefaultCircuit()` rend le circuit marqué `is_default` — Haute Saintonge,
 * depuis toujours. L'écran d'armement ne consultait JAMAIS la journée réservée.
 * Il proposait bien Bouteville dans la rangée de choix, mais en second, et il
 * fallait le désigner à la main : un geste de plus, de nuit, avec des gants,
 * sur un écran dont les rangées se chevauchaient.
 *
 * Toute l'application savait où il allait rouler. L'écran qui arme ne le
 * demandait à personne.
 *
 * ===========================================================================
 * CE QUE CE MODULE DÉCIDE, ET CE QU'IL REFUSE DE DÉCIDER
 * ===========================================================================
 *
 * Il choisit, parmi les inscriptions du pilote, celle dont la journée est en
 * cours ou imminente, et rend SON circuit. Rien d'autre.
 *
 * Il rend `null` volontiers — aucune inscription, journée trop lointaine,
 * journée privée illisible, séance sans circuit rattaché. L'appelant retombe
 * alors sur le comportement d'avant. **Une pré-sélection est un confort ; elle
 * ne doit jamais empêcher d'armer.**
 */

/** Une inscription du pilote, réduite à ce qui sert au choix. */
export interface InscriptionJournee {
  /** Statut de l'inscription (`registration_status_enum`). */
  status: string | null;
  /** Date de la journée, `YYYY-MM-DD`. */
  date: string | null;
  /** Heure de début, `HH:MM[:SS]`, heure locale du circuit. */
  startTime: string | null;
  /** Heure de fin, `HH:MM[:SS]`. */
  endTime: string | null;
  /** Circuit de la journée. `null` = séance sans circuit rattaché. */
  circuitId: string | null;
  circuitName: string | null;
}

export interface JourneeRetenue {
  circuitId: string;
  circuitName: string | null;
  date: string;
  /** `true` si l'instant courant tombe dans la plage horaire de la journée. */
  enCours: boolean;
}

/**
 * Statuts qui donnent droit à rouler.
 *
 * `cancelled` et `no_show` sont exclus, évidemment. `pending` et
 * `pending_payment` sont INCLUS : un règlement en attente n'empêche pas le
 * pilote d'être sur place, et lui refuser la pré-sélection le renverrait au
 * défaut — c'est-à-dire au mauvais circuit. La barrière du paiement n'a pas à
 * s'exercer ici ; elle s'exerce au portail.
 */
const STATUTS_VALIDES = new Set(['confirmed', 'attended', 'pending', 'pending_payment']);

/**
 * Fenêtre d'attraction autour de l'instant courant.
 *
 * Dix-huit heures de part et d'autre : assez large pour qu'un pilote qui ouvre
 * l'application la veille au soir, ou qui roule à 00h20 sur une journée datée
 * de la veille, retrouve son circuit. Assez étroite pour qu'une journée
 * réservée la semaine prochaine ne détourne rien.
 */
const FENETRE_MS = 18 * 60 * 60 * 1000;

/**
 * Construit un instant local depuis une date et une heure de la base.
 *
 * `date` est un DATE et `start_time`/`end_time` des TIME sans fuseau : ce sont
 * des heures MURALES du circuit. On les interprète donc dans le fuseau de
 * l'appareil, qui est celui du circuit — c'est le seul rapprochement correct,
 * et coller un `Z` en ferait des heures UTC (deux heures d'écart en été).
 */
function instantLocal(date: string, heure: string | null, defaut: string): number | null {
  const h = (heure ?? defaut).slice(0, 8);
  const complet = h.length === 5 ? `${h}:00` : h;
  const t = new Date(`${date}T${complet}`).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Le circuit de la journée à rouler maintenant, ou `null`.
 *
 * @param inscriptions les inscriptions du pilote (ordre indifférent)
 * @param maintenantMs l'instant courant, en ms
 */
export function circuitDeLaJournee(
  inscriptions: readonly InscriptionJournee[],
  maintenantMs: number
): JourneeRetenue | null {
  let meilleure: { r: JourneeRetenue; ecart: number; debut: number } | null = null;

  for (const i of inscriptions) {
    if (!i.date || !i.circuitId) continue;
    if (!STATUTS_VALIDES.has(i.status ?? '')) continue;

    const debut = instantLocal(i.date, i.startTime, '00:00:00');
    if (debut === null) continue;
    let fin = instantLocal(i.date, i.endTime, '23:59:59');
    if (fin === null) fin = debut;
    // Journée de NUIT qui franchit minuit (00h20 → 06h00 est le cas nominal,
    // mais 22h00 → 02h00 existe aussi) : la fin appartient au lendemain.
    if (fin < debut) fin += 24 * 60 * 60 * 1000;

    const enCours = maintenantMs >= debut && maintenantMs <= fin;
    const ecart = enCours
      ? 0
      : Math.min(Math.abs(debut - maintenantMs), Math.abs(fin - maintenantMs));
    if (ecart > FENETRE_MS) continue;

    // À écart égal, la journée qui commence le plus tôt l'emporte : deux
    // séances le même jour se départagent par l'ordre du programme, pas par
    // l'ordre où la base a rendu les lignes.
    if (
      meilleure === null ||
      ecart < meilleure.ecart ||
      (ecart === meilleure.ecart && debut < meilleure.debut)
    ) {
      meilleure = {
        r: { circuitId: i.circuitId, circuitName: i.circuitName, date: i.date, enCours },
        ecart,
        debut,
      };
    }
  }

  return meilleure?.r ?? null;
}

/**
 * La phrase qui dit d'où vient le circuit armé.
 *
 * Elle n'est pas décorative. Le défaut du 13/08 était SILENCIEUX : l'écran
 * affichait un circuit, le pilote a supposé que c'était le sien, et il a roulé
 * une séance entière sur la ligne d'arrivée d'un autre. Une pré-sélection qui
 * ne se nomme pas reproduit exactement ce défaut, à l'envers.
 *
 * Rend `null` quand il n'y a rien de factuel à dire — jamais une phrase vide
 * de sens pour meubler.
 */
export function libelleOrigineCircuit(
  retenue: JourneeRetenue | null,
  circuitArmeId: string | null
): string | null {
  if (retenue === null || circuitArmeId === null) return null;
  if (retenue.circuitId !== circuitArmeId) {
    // Le pilote a changé de circuit à la main. On ne le contredit pas — on lui
    // rappelle ce que sa journée disait, et il tranche.
    return retenue.circuitName ? `Votre journée réservée est à ${retenue.circuitName}.` : null;
  }
  return retenue.enCours
    ? 'Circuit de votre journée en cours.'
    : 'Circuit de votre journée réservée.';
}
