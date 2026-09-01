/**
 * LE FIL DE L'ÉCURIE — logique pure de la réservation groupée.
 *
 * Aucun accès réseau, aucun rendu, aucune horloge implicite : l'instant courant
 * est toujours passé en paramètre.
 *
 * ===========================================================================
 * LE SEUIL EST ÉCRIT ICI AUSSI, ET CE N'EST PAS UNE DUPLICATION
 * ===========================================================================
 *
 * `public.oxv_seuil_privatisation()` vaut 17 en base, et la colonne
 * `reservations_ecurie.formule` est GÉNÉRÉE : c'est la base qui décide, tout
 * le temps, sans exception.
 *
 * Ce module ne décide de rien. Il ANNONCE — « vous êtes douze, vous rejoindrez
 * une journée Access » — avant que la demande ne parte. Si les deux valeurs
 * divergeaient un jour, l'annonce serait fausse et la décision resterait juste :
 * le pilote lirait une chose et en obtiendrait une autre, ce qui est désagréable
 * mais jamais dangereux.
 *
 * C'est la différence avec le ratio masse / puissance, où une seconde
 * implémentation aurait produit une CLASSE fausse, donc des formules ouvertes à
 * tort. Ici, le pire est un texte à corriger.
 *
 * ===========================================================================
 * POURQUOI DIX-SEPT
 * ===========================================================================
 *
 * Le fondateur a dit « moins de 17 » et « plus de 17 ». Dix-sept lui-même
 * n'était couvert par aucune des deux phrases. Il est rangé en privatisation :
 * à 17 pilotes sur une capacité de 20, la journée est de fait celle de
 * l'écurie, et vendre les trois places restantes reviendrait à promettre une
 * journée publique à des pilotes qui rouleraient au milieu d'un groupe
 * constitué.
 */

/** Effectif à partir duquel le circuit est privatisé. Reflet de la base. */
export const SEUIL_PRIVATISATION = 17;

/** Capacité d'une journée. Sert à dire ce qui reste, jamais à décider. */
export const PLACES_PAR_JOURNEE = 20;

/** La remise consentie sur une réservation d'écurie confirmée, en pourcentage. */
export const REMISE_ECURIE_PCT = 10;

export type FormuleEcurie = 'insertion' | 'privatisation';

/**
 * La formule que la base retiendra pour cet effectif.
 *
 * Un effectif nul ou négatif n'est pas une insertion à zéro pilote : c'est une
 * absence de demande. On rend `null` plutôt qu'une formule par défaut — inventer
 * « insertion » pour zéro pilote afficherait une annonce sur du vide.
 */
export function formuleDepuisEffectif(effectif: number): FormuleEcurie | null {
  if (!Number.isFinite(effectif) || effectif < 1) return null;
  return effectif >= SEUIL_PRIVATISATION ? 'privatisation' : 'insertion';
}

/**
 * Ce que le capitaine lit avant d'envoyer sa demande.
 *
 * Le texte dit ce qui VA se passer, pas ce qu'il faudrait faire : le fil est un
 * miroir comme le reste de l'application. Aucun impératif, aucune injonction.
 */
export function annonceFormule(effectif: number): string | null {
  const formule = formuleDepuisEffectif(effectif);
  if (formule === null) return null;

  if (formule === 'privatisation') {
    return (
      `À ${effectif} pilotes, le circuit vous est privatisé. ` +
      `Vous proposez trois dates, OXV en retient une.`
    );
  }
  const restantes = PLACES_PAR_JOURNEE - effectif;
  return (
    `À ${effectif} pilotes, votre écurie rejoint une journée Access, ouverte aux trois classes. ` +
    `${restantes} place${restantes > 1 ? 's' : ''} y resteront ouvertes aux autres pilotes.`
  );
}

// ===========================================================================
// Les trois dates
// ===========================================================================

export type MotifDatesInvalides = 'nombre' | 'doublon' | 'passee';

export interface VerdictDates {
  valides: boolean;
  motif: MotifDatesInvalides | null;
  /** Phrase affichable, `null` quand les dates conviennent. */
  message: string | null;
}

const MESSAGE_MOTIF: Readonly<Record<MotifDatesInvalides, string>> = {
  nombre: 'Trois dates sont attendues.',
  doublon: 'Les trois dates doivent être différentes.',
  passee: 'Les dates proposées doivent être à venir.',
};

/**
 * Les trois dates conviennent-elles ?
 *
 * Le même contrôle existe en base, dans `oxv_deposer_reservation_ecurie`, et
 * c'est LUI qui fait foi. Celui-ci évite un aller-retour réseau pour dire au
 * capitaine ce qu'il verra de toute façon — et il le dit AVANT qu'il ait
 * rempli le reste.
 *
 * Un contrôle client qui remplacerait le contrôle serveur serait une faute ;
 * un contrôle client qui le double pour épargner une déception ne l'est pas.
 */
export function verifierDates(dates: readonly string[], aujourdhui: string): VerdictDates {
  const posees = dates.filter((d) => d.trim().length > 0);

  if (posees.length !== 3) {
    return { valides: false, motif: 'nombre', message: MESSAGE_MOTIF.nombre };
  }
  if (new Set(posees).size !== 3) {
    return { valides: false, motif: 'doublon', message: MESSAGE_MOTIF.doublon };
  }
  if (posees.some((d) => d <= aujourdhui)) {
    return { valides: false, motif: 'passee', message: MESSAGE_MOTIF.passee };
  }
  return { valides: true, motif: null, message: null };
}

// ===========================================================================
// Le fil
// ===========================================================================

export interface MessageFil {
  id: string;
  auteurId: string | null;
  nature: 'membre' | 'systeme';
  texte: string;
  creeLe: string;
}

export interface JourneeDeFil {
  /** Clé de tri, `AAAA-MM-JJ`. */
  jour: string;
  /** Libellé affiché : « Aujourd'hui », « Hier », ou la date en clair. */
  libelle: string;
  messages: MessageFil[];
}

function jourDe(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Le fil, groupé par jour, du plus ancien au plus récent.
 *
 * Un fil de discussion sans séparateurs de jour se lit mal dès la deuxième
 * page : on ne sait plus si « 14:20 » était hier ou il y a trois semaines.
 */
export function grouperParJour(messages: readonly MessageFil[], maintenant: Date): JourneeDeFil[] {
  const parJour = new Map<string, MessageFil[]>();

  for (const m of [...messages].sort((a, b) => a.creeLe.localeCompare(b.creeLe))) {
    const j = jourDe(m.creeLe);
    const seau = parJour.get(j);
    if (seau) seau.push(m);
    else parJour.set(j, [m]);
  }

  const auj = maintenant.toISOString().slice(0, 10);
  const hier = new Date(maintenant.getTime() - 86_400_000).toISOString().slice(0, 10);

  return [...parJour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, msgs]) => ({
      jour,
      libelle:
        jour === auj
          ? 'Aujourd’hui'
          : jour === hier
            ? 'Hier'
            : new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              }),
      messages: msgs,
    }));
}

// ===========================================================================
// L'état d'une demande
// ===========================================================================

export type StatutReservation = 'deposee' | 'dates_proposees' | 'confirmee' | 'close';

/**
 * Ce que le fil affiche en tête, quand une demande est en cours.
 *
 * `null` quand il n'y a rien à dire : une bannière permanente qui répète
 * « aucune demande » occupe la place sans rien apporter.
 */
export function bandeauDemande(
  statut: StatutReservation | null,
  formule: FormuleEcurie | null
): string | null {
  if (statut === null) return null;

  switch (statut) {
    case 'deposee':
      return 'Votre demande est déposée. OXV répond sous soixante-douze heures ouvrées.';
    case 'dates_proposees':
      return 'Vos trois dates sont transmises. OXV en retient une et vous répond.';
    case 'confirmee':
      return formule === 'privatisation'
        ? `Votre journée est privatisée. Chaque pilote s’inscrit pour lui-même, ${REMISE_ECURIE_PCT} % déduits.`
        : `Votre journée est retenue. Chaque pilote s’inscrit pour lui-même, ${REMISE_ECURIE_PCT} % déduits.`;
    case 'close':
      return null;
  }
}

/**
 * Le capitaine peut-il déposer une demande ?
 *
 * Une écurie ne porte qu'une demande ouverte à la fois — la base l'impose par
 * une contrainte d'exclusion. Proposer le geste alors qu'il échouera serait le
 * défaut que ce projet corrige partout ailleurs.
 */
export function peutDeposer(
  estCapitaine: boolean,
  statutEnCours: StatutReservation | null
): boolean {
  if (!estCapitaine) return false;
  return statutEnCours === null || statutEnCours === 'close';
}

// ===========================================================================
// L'avancement d'une sortie confirmée
// ===========================================================================

/**
 * La phrase que lit l'écurie une fois la sortie confirmée.
 *
 * ===========================================================================
 * C'EST ICI QUE LA CONVERSION SE JOUE
 * ===========================================================================
 *
 * Le capitaine a organisé, OXV a confirmé — et ensuite chacun s'inscrit seul.
 * Rien ne tient ces inscriptions : ni délai, ni compte, ni relance. Une sortie
 * organisée à vingt-deux qui se termine à huit inscrits est une journée louée
 * pour rien, et personne ne l'apprend avant le jour même.
 *
 * Deux nombres et une date suffisent à retourner cela. Le compte donne au
 * capitaine ce qu'OXV n'aura jamais : la mesure exacte de ce qui manque, entre
 * des mains qui peuvent en parler.
 *
 * `null` quand il n'y a rien à dire — une bannière qui répète « 0 sur 0 »
 * occupe la place sans rien apporter.
 */
export function phraseAvancement(
  effectifAnnonce: number,
  inscrits: number,
  restant: number,
  echeance: string | null
): string | null {
  if (effectifAnnonce < 1) return null;

  const jusquAu = echeance
    ? ` Les places vous sont réservées jusqu’au ${new Date(echeance).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}.`
    : '';

  if (restant === 0) {
    return `${inscrits} pilote${inscrits > 1 ? 's' : ''} inscrit${inscrits > 1 ? 's' : ''} sur ${effectifAnnonce} annoncé${effectifAnnonce > 1 ? 's' : ''}. Le compte y est.`;
  }
  return (
    `${inscrits} pilote${inscrits > 1 ? 's' : ''} inscrit${inscrits > 1 ? 's' : ''} sur ${effectifAnnonce} annoncé${effectifAnnonce > 1 ? 's' : ''} — ` +
    `il en manque ${restant}.${jusquAu}`
  );
}
