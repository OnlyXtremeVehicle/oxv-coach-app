/**
 * Panneau de diagnostic d'appairage — jalon 3, lot 21c. Logique PURE.
 *
 * ===========================================================================
 * CE QUE LE PLAN DEMANDE, ET POURQUOI C'EST PLUS QU'UNE MISE EN PAGE
 * ===========================================================================
 *
 * *« Le diagnostic sépare le VÉRIFIÉ du SUPPOSÉ. […] Les quatre causes non
 * vérifiables sont posées EN QUESTIONS, JAMAIS EN AFFIRMATIONS. »*
 *
 * La distinction n'est pas de forme. Un écran qui affirme « le boîtier est hors
 * de portée » alors qu'il n'en sait rien envoie le pilote se rapprocher d'un
 * boîtier qui est simplement éteint. Il a perdu deux minutes et un peu de
 * confiance — et la prochaine fois, il ne croira pas non plus la ligne qui,
 * elle, était vraie.
 *
 * D'un côté ce que le téléphone peut établir. De l'autre ce que seul le pilote
 * peut regarder, posé sous forme de question.
 *
 * ===========================================================================
 * TROIS ÉTATS DU CÔTÉ VÉRIFIÉ, PAS DEUX
 * ===========================================================================
 *
 * `inconnu` existe et il compte. Une ligne dont on n'a pas pu lire l'état ne
 * s'affiche ni en vert ni en rouge : elle dit qu'on n'a pas pu savoir.
 *
 * C'est la conséquence directe de `permissionsLogic` : sur iOS, `unavailable`
 * signifie « la poignée n'est pas compilée », pas « refusé ». Prétendre le
 * contraire dans un panneau intitulé « vérifié » serait précisément la garde
 * posée non armée que ce dépôt collectionne.
 *
 * ===========================================================================
 * LA LOCALISATION N'EST PAS VÉRIFIABLE SUR iOS, ET ELLE CHANGE DE COLONNE
 * ===========================================================================
 *
 * Le plan la range parmi les trois lignes vérifiables. C'est vrai sur Android
 * antérieur à 12, où `ACCESS_FINE_LOCATION` est demandée et lisible.
 *
 * Sur iOS, non : `app.json` ne déclare que la poignée Bluetooth, donc
 * interroger la localisation rendrait `unavailable` — un « je ne sais pas »
 * qu'on afficherait comme un état. Elle passe donc du côté des questions, avec
 * son lien vers les Réglages. **Mesuré le 05/08/2026**, pas supposé.
 *
 * Le jour où `iosPermissions` sera étendu, elle remontera d'elle-même : c'est le
 * rôle du paramètre `localisationLisible`.
 */

/** Ce que le téléphone a pu établir. */
export interface LigneVerifiee {
  cle: 'bluetooth' | 'autorisationBluetooth' | 'localisation';
  libelle: string;
  /**
   * `ok` — établi et satisfait · `echec` — établi et bloquant ·
   * `inconnu` — non lisible, et c'est dit.
   */
  etat: 'ok' | 'echec' | 'inconnu';
  /** Où aller, quand le pilote peut y faire quelque chose. */
  geste?: string;
}

/** Ce que seul le pilote peut regarder. TOUJOURS interrogatif. */
export interface QuestionPilote {
  cle: 'allume' | 'batterie' | 'portee' | 'autreTelephone' | 'localisation';
  texte: string;
}

export interface Panneau {
  verifie: LigneVerifiee[];
  questions: QuestionPilote[];
}

export interface EntreePanneau {
  /**
   * La cause rendue par `diagnostiquer()`, ou `null` quand rien n'a encore
   * échoué. C'est la SEULE source d'état : on ne sonde pas l'adaptateur
   * nous-mêmes, ce qui demanderait de toucher au service protégé.
   */
  cause: string | null;
  /**
   * `true` quand la permission n'a pas pu être lue — le `indetermine` de
   * `permissionsLogic`. La ligne passe alors en `inconnu`, jamais en `ok`.
   */
  permissionIndeterminee: boolean;
  /**
   * `true` seulement là où la localisation est réellement interrogeable.
   * Faux sur iOS en l'état du manifeste.
   */
  localisationLisible: boolean;
}

/**
 * Les quatre questions du plan, mot pour mot, et dans son ordre.
 *
 * Elles ne varient pas selon l'échec : le plan ne les conditionne pas, et les
 * masquer selon une cause supposée reviendrait à affirmer par omission.
 */
const QUESTIONS: readonly QuestionPilote[] = [
  { cle: 'allume', texte: 'Le boîtier est-il allumé ?' },
  { cle: 'batterie', texte: 'Sa batterie est-elle chargée ?' },
  { cle: 'portee', texte: 'Est-il à portée ?' },
  { cle: 'autreTelephone', texte: 'Est-il déjà lié à un autre téléphone ?' },
] as const;

const QUESTION_LOCALISATION: QuestionPilote = {
  cle: 'localisation',
  // Posée en question parce qu'on ne peut pas la lire. Le geste vit dans la
  // ligne vérifiée quand elle est lisible ; ici il est dans le texte.
  texte: 'La localisation est-elle autorisée ? Réglages ▸ OXV.',
};

/** La cause désigne-t-elle un adaptateur éteint ? */
function bluetoothEteint(cause: string | null): boolean {
  return cause !== null && /éteint/i.test(cause);
}

/** La cause désigne-t-elle un refus d'autorisation Bluetooth ? */
function autorisationRefusee(cause: string | null): boolean {
  return cause !== null && /autorisation Bluetooth/i.test(cause);
}

/** La cause désigne-t-elle un refus de localisation ? */
function localisationRefusee(cause: string | null): boolean {
  return cause !== null && /localisation est refusée/i.test(cause);
}

/**
 * Bâtit les deux colonnes.
 *
 * Ne prend AUCUNE décision d'affichage : l'écran choisit s'il montre le
 * panneau. Cette fonction dit seulement ce qu'on sait et ce qu'on ignore.
 */
export function batirPanneau(entree: EntreePanneau): Panneau {
  const { cause, permissionIndeterminee, localisationLisible } = entree;

  const verifie: LigneVerifiee[] = [
    {
      cle: 'bluetooth',
      libelle: 'Bluetooth activé',
      // Rien ne permet d'affirmer qu'il est allumé : on ne sait qu'en cas
      // d'échec explicite. Sans échec, la ligne reste `inconnu` — ce qui est
      // vrai, et n'a jamais empêché personne d'appairer.
      etat: bluetoothEteint(cause) ? 'echec' : cause === null ? 'inconnu' : 'ok',
      geste: bluetoothEteint(cause) ? 'Centre de contrôle.' : undefined,
    },
    {
      cle: 'autorisationBluetooth',
      libelle: 'Autorisation Bluetooth',
      etat: autorisationRefusee(cause)
        ? 'echec'
        : permissionIndeterminee
          ? 'inconnu'
          : cause === null
            ? 'inconnu'
            : 'ok',
      geste: autorisationRefusee(cause) ? 'Réglages ▸ OXV ▸ Bluetooth.' : undefined,
    },
  ];

  if (localisationLisible) {
    verifie.push({
      cle: 'localisation',
      libelle: 'Autorisation de localisation',
      etat: localisationRefusee(cause) ? 'echec' : cause === null ? 'inconnu' : 'ok',
      geste: localisationRefusee(cause) ? 'Réglages ▸ OXV ▸ Position.' : undefined,
    });
  }

  const questions = localisationLisible ? [...QUESTIONS] : [...QUESTIONS, QUESTION_LOCALISATION];

  return { verifie, questions };
}
