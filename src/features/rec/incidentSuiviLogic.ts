/**
 * Le suivi d'une déclaration d'incident — jalon 3, lot 21g. Logique PURE.
 *
 * ===========================================================================
 * CE QUI MANQUAIT, ET CE QUE LE PILOTE VIVAIT
 * ===========================================================================
 *
 * Le plan demande, pour l'étape 8 : *« incident à ÉTAT SUIVI »*.
 *
 * La table `incident_followups` existe en production depuis le 02/08/2026, avec
 * une politique de lecture pour le pilote déclarant. **Rien ne l'écrivait, rien
 * ne la lisait.** `incidentService.listMine()` n'avait aucun appelant.
 *
 * Autrement dit : un pilote déclarait un incident, lisait « votre déclaration
 * est enregistrée », et n'en entendait plus jamais parler. Sur le seul chemin
 * de sécurité du produit, le silence est le pire des retours.
 *
 * ===========================================================================
 * L'ÉTAT EST DU TEXTE LIBRE EN BASE, ET C'EST MESURÉ
 * ===========================================================================
 *
 * Vérifié le 05/08/2026 : la seule contrainte de la table porte sur la LONGUEUR
 * de la note. La colonne `state` n'a **aucun CHECK**. N'importe quelle chaîne y
 * entrerait.
 *
 * Deux réponses possibles, et j'ai retenu la seconde.
 *
 * Poser une contrainte serait la garde la plus ferme — mais elle fixerait un
 * vocabulaire que personne n'a arrêté, et ferait échouer la première écriture
 * d'un administrateur qui emploierait un mot voisin. Sur une table encore vide,
 * c'est contraindre avant de savoir.
 *
 * Ce module **traduit ce qu'il connaît, et dit qu'il ne connaît pas le reste**.
 * Un état inattendu ne casse rien, ne s'invente pas un libellé, et n'est pas
 * masqué : il s'affiche pour ce qu'il est. Le jour où le vocabulaire sera
 * arrêté, la contrainte tient en une migration.
 */

/**
 * Les états que l'application sait nommer.
 *
 * ===========================================================================
 * « en_examen » N'A JAMAIS PU EXISTER EN BASE — CORRIGÉ LE 14/08/2026
 * ===========================================================================
 *
 * Le CHECK de `incident_followups` borne `state` à `('recu','traite','clos')`.
 * Ce module nommait `en_examen`, que la contrainte refuse.
 *
 * Deux conséquences, toutes deux silencieuses :
 *
 *   • une écriture applicative en `en_examen` aurait été rejetée par Postgres ;
 *   • et une ligne écrite en `traite` — la seule possible — s'affichait au
 *     pilote comme un état INCONNU, c'est-à-dire la chaîne brute « traite ».
 *
 * Le vocabulaire de la base fait foi : c'est elle qui arbitre, et le typage
 * TypeScript ne voit pas les CHECK. Aucune ligne héritée n'est à reprendre,
 * précisément parce que la contrainte n'en a jamais laissé passer.
 */
export type EtatSuivi = 'recu' | 'traite' | 'clos';

export interface LibelleEtat {
  /** Ce que le pilote lit. */
  texte: string;
  /** Vrai quand l'état vient d'un vocabulaire que l'application ne connaît pas. */
  inconnu: boolean;
}

const CONNUS: Record<EtatSuivi, string> = {
  recu: 'Reçue',
  traite: 'En cours de traitement',
  clos: 'Clôturée',
};

/**
 * Traduit un état venu de la base.
 *
 * NE JETTE JAMAIS et n'invente jamais. Un état inconnu rend son propre texte,
 * marqué comme tel — l'écran choisit alors de le présenter sobrement plutôt que
 * de prétendre le comprendre.
 */
export function libelleEtat(brut: string | null | undefined): LibelleEtat {
  const cle = (brut ?? '').trim().toLowerCase();
  if (cle.length === 0) return { texte: 'État non communiqué', inconnu: true };
  if (cle in CONNUS) return { texte: CONNUS[cle as EtatSuivi], inconnu: false };
  return { texte: cle, inconnu: true };
}

/** Un suivi, tel que l'écran le consomme. */
export interface SuiviAffichable {
  id: string;
  etat: LibelleEtat;
  note: string | null;
  /** Horodatage ISO, tel qu'il vient de la base. */
  le: string;
}

export interface SuiviBrut {
  id: string;
  state: string | null;
  note: string | null;
  created_at: string | null;
}

/**
 * Ordonne et traduit les suivis d'une déclaration.
 *
 * Du plus RÉCENT au plus ancien : le pilote veut savoir où ça en est, pas d'où
 * ça vient. Une ligne sans horodatage lisible passe en fin plutôt que d'être
 * écartée — elle existe, elle se voit.
 */
export function suivisAffichables(lignes: readonly SuiviBrut[]): SuiviAffichable[] {
  const instant = (s: string | null): number => {
    if (typeof s !== 'string') return Number.NEGATIVE_INFINITY;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };
  return [...lignes]
    .sort((a, b) => instant(b.created_at) - instant(a.created_at))
    .map((l) => ({
      id: l.id,
      etat: libelleEtat(l.state),
      note: typeof l.note === 'string' && l.note.trim().length > 0 ? l.note.trim() : null,
      le: l.created_at ?? '',
    }));
}

/**
 * L'état COURANT d'une déclaration : celui de son suivi le plus récent.
 *
 * Aucun suivi ne veut pas dire « rien ne se passe » — cela veut dire que la
 * déclaration a été reçue et n'a pas encore été examinée. C'est un fait, et
 * c'est ce qu'on dit. On ne laisse pas un vide que le pilote interpréterait
 * comme un oubli.
 */
export function etatCourant(suivis: readonly SuiviAffichable[]): LibelleEtat {
  if (suivis.length === 0) return { texte: 'Reçue, pas encore examinée', inconnu: false };
  return suivis[0].etat;
}

/**
 * Date lisible, en français, sans fabriquer ce qui manque.
 *
 * Un horodatage illisible rend `null` : l'écran affiche alors la ligne sans sa
 * date, plutôt qu'une date inventée ou un « Invalid Date ».
 */
export function dateCourte(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
