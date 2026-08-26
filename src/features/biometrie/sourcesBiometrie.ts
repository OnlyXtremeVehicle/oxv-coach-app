/**
 * sourcesBiometrie — le REGISTRE des sources de mesure cardiaque (lot 10a).
 *
 * Module PUR : aucun I/O, aucun React, aucun natif. Il ne mesure rien ; il DIT
 * ce que chaque source est, et ce qu'elle peut honnêtement prétendre.
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE
 * ===========================================================================
 *
 * La chaîne biométrie portait déjà deux sources — la ceinture par BLE, la
 * montre par Apple Santé — et ne connaissait qu'UNE attente : un point par
 * seconde. `biometryBufferLogic.DEFAULT_EXPECTED_HZ` vaut 1, et
 * `bio1Trigger.BIO1_EXPECTED_HZ` valait 1 lui aussi, appliqué à la montre.
 *
 * Or la montre ne rend pas un point par seconde. Apple Santé rend, en séance
 * d'effort, de l'ordre d'un point toutes les cinq secondes. La densité valait
 * donc environ 0,2 — et la qualité, produit de la densité par la couverture,
 * tombait autour de 20 sur 100. `biometryQualityOf` traduit 20 par « basse ».
 *
 * La montre était donc déclarée de qualité basse À CHAQUE SÉANCE, non parce
 * qu'elle avait mal mesuré, mais parce qu'on la mesurait à l'aune de la
 * ceinture. Un fait faux, présenté comme un fait mesuré.
 *
 * Une attente PAR SOURCE, déclarée ici, supprime ce défaut à sa racine : la
 * qualité redevient l'écart entre ce qu'une source a rendu et ce qu'ELLE
 * annonce.
 *
 * ===========================================================================
 * CE QUE CE REGISTRE N'EST PAS
 * ===========================================================================
 *
 * Il ne contient AUCUNE surface d'affichage. Les lunettes du coach lisent des
 * faits ; elles ne mesurent aucun battement. Elles vivent dans
 * `surfacesAffichage.ts`, et une garde vérifie que les deux ensembles
 * d'identifiants restent disjoints.
 */

/** Les sources de MESURE reconnues. Une source absente d'ici n'existe pas. */
export type IdSource = 'ceinture_ble' | 'montre_apple';

/** Par où la mesure arrive jusqu'à l'application. */
export type VoieAcquisition =
  /** Trame BLE 0x2A37 lue par l'application elle-même, battement par battement. */
  | 'ble_direct'
  /** Dossier de santé de l'appareil (HealthKit), relu APRÈS coup. */
  | 'sante_appareil';

/** Quand la mesure devient lisible — un fait de conception, pas une estimation. */
export type Latence =
  /** Disponible pendant le run (elle peut donc alimenter le canal coach). */
  | 'temps_reel'
  /** Disponible seulement une fois le run terminé, à la relecture. */
  | 'differe_fin_de_run';

/** Ce que `biometry_raw.source` peut valoir (miroir du CHECK en base). */
export type CleBase = 'polar_h10' | 'apple_watch';

export interface SourceBiometrique {
  id: IdSource;
  /** Valeur écrite en base. Le CHECK `biometry_raw.source` en fait foi. */
  cleBase: CleBase;
  /** Nom montré au pilote. Vouvoiement, sec, sans emoji. */
  libelle: string;
  /** Badge du `BiometryStrip` — son vocabulaire fermé ('montre' | 'ceinture'). */
  badge: 'montre' | 'ceinture';
  voie: VoieAcquisition;
  latence: Latence;
  /**
   * Cadence que la source ANNONCE, en hertz. C'est la référence de densité, et
   * donc de qualité. À VALIDER SUR PISTE : les deux valeurs ci-dessous viennent
   * du protocole (BLE : une notification par battement) et de l'observation
   * publique d'Apple Santé en séance d'effort (~1 point / 5 s). Une mesure
   * réelle sur le circuit les remplacera.
   */
  cadenceNominaleHz: number;
  /** Rapporte-t-elle les intervalles R-R (variabilité) ? */
  porteVariabilite: boolean;
  /**
   * Cette source n'est consentable — et mesurable — que si un coach affilié
   * accompagne le pilote. Arbitrage fondateur du 26/08/2026.
   *
   * La ceinture thoracique mesure en continu et porte la variabilité : c'est la
   * donnée de santé la plus fine du dispositif. Elle n'existe pas comme
   * équipement de confort, mais parce qu'un professionnel accompagne. La montre,
   * elle, ne dépend de personne.
   *
   * Tenu à DEUX endroits, et c'est voulu : la base refuse de poser un tel accord
   * sans affiliation (trigger `biometry_ceinture_exige_un_coach`), et
   * `decisionCapture` rejoue la règle à chaque séance — une affiliation peut
   * cesser après l'accord.
   */
  exigeCoachAffilie: boolean;
  /** Peut-elle alimenter le direct du coach ? (conséquence de la latence.) */
  alimenteLeDirect: boolean;
  /**
   * Ce que la mesure EST, dans les mots du document validé par le conseil
   * (docs/juridique/consentement_biometrie.md, 25/07/2026). On ne reformule pas
   * un texte validé : on le reprend.
   */
  natureMesure: string;
  /** Rang de départage, quand aucun fait ne sépare deux sources. Bas = d'abord. */
  rangDeclare: number;
}

/**
 * La ceinture thoracique (Polar H10 et compatibles Heart Rate Service 0x180D).
 *
 * Le parser `heartRateParser` décode la caractéristique standard 0x2A37 : la
 * source n'est donc pas « Polar », c'est « toute ceinture au standard BLE ».
 * La clé de base reste `polar_h10` — c'est ce que le CHECK accepte, et ce que
 * les lignes déjà écrites portent. Renommer la clé demanderait une migration de
 * données pour un gain nul.
 */
export const SOURCE_CEINTURE = {
  id: 'ceinture_ble',
  cleBase: 'polar_h10',
  libelle: 'Ceinture cardio',
  badge: 'ceinture',
  voie: 'ble_direct',
  latence: 'temps_reel',
  // Le profil BLE Heart Rate notifie une fois par battement : ~1 Hz au repos,
  // davantage à l'effort. 1 Hz est donc le plancher annoncé, pas un maximum.
  // À VALIDER SUR PISTE.
  cadenceNominaleHz: 1,
  porteVariabilite: true,
  // Arbitrage 26/08/2026 : la ceinture n'existe que si un coach accompagne.
  exigeCoachAffilie: true,
  alimenteLeDirect: true,
  natureMesure: 'Fréquence cardiaque et variabilité, mesure de précision.',
  rangDeclare: 0,
  // `as const satisfies` plutôt qu'une annotation `: SourceBiometrique`. La
  // différence n'est pas cosmétique : l'annotation ÉLARGIT `cleBase` à l'union,
  // et les appelants qui écrivent en base (`saveSamples`, dont la signature
  // exige le littéral) ne pourraient alors pas la lire ici — ils recopieraient
  // la chaîne, et le registre cesserait d'être la source unique.
} as const satisfies SourceBiometrique;

/**
 * La montre Apple, par Apple Santé.
 *
 * Ce n'est PAS une ceinture branchée autrement : la donnée ne vient pas d'un
 * capteur que l'application écoute, elle vient du dossier de santé de
 * l'appareil, relu après le run par `healthKitService`. Trois conséquences
 * portées ici plutôt que supposées ailleurs — la cadence est plus lâche, la
 * lecture est différée, et il n'y a pas d'intervalles R-R.
 */
export const SOURCE_MONTRE = {
  id: 'montre_apple',
  cleBase: 'apple_watch',
  libelle: 'Montre Apple',
  badge: 'montre',
  voie: 'sante_appareil',
  latence: 'differe_fin_de_run',
  // ~1 point toutes les 5 secondes en séance d'effort. À VALIDER SUR PISTE :
  // la cadence réelle dépend du mode d'entraînement actif sur la montre.
  cadenceNominaleHz: 0.2,
  porteVariabilite: false,
  // La montre ne dépend de personne : elle est au poignet du pilote.
  exigeCoachAffilie: false,
  alimenteLeDirect: false,
  natureMesure: 'Mesure au poignet, indicative.',
  rangDeclare: 1,
} as const satisfies SourceBiometrique;

/** Le registre complet, dans l'ordre déclaré. */
export const SOURCES: readonly SourceBiometrique[] = [SOURCE_CEINTURE, SOURCE_MONTRE];

/** Une source par son identifiant. Inconnu → `null` (jamais une source inventée). */
export function sourceParId(id: string): SourceBiometrique | null {
  return SOURCES.find((s) => s.id === id) ?? null;
}

/**
 * Une source par la valeur lue en base (`biometry_raw.source`).
 *
 * `null` sur une clé inconnue : une ligne écrite par une version future, ou
 * abîmée, ne doit pas se voir attribuer une source au hasard. Un battement sans
 * origine connue est un battement qu'on ne montre pas.
 */
export function sourceParCleBase(cleBase: string): SourceBiometrique | null {
  return SOURCES.find((s) => s.cleBase === cleBase) ?? null;
}

/**
 * La phrase qui DIT la latence au pilote. Constat, jamais consigne : aucun verbe
 * prescriptif, aucun jugement porté sur la source.
 */
export function phraseLatence(source: SourceBiometrique): string {
  return source.latence === 'temps_reel'
    ? 'Lisible pendant le run.'
    : 'Lisible après le run, relue depuis le dossier de santé de votre appareil.';
}

/**
 * La phrase qui DIT la cadence attendue. « Un point toutes les N secondes »
 * plutôt qu'un hertz : même mesure, dans les mots du pilote. Cadence non
 * exploitable → `null`, aucune phrase — jamais un chiffre fabriqué pour remplir
 * la ligne.
 */
export function phraseCadence(source: SourceBiometrique): string | null {
  const hz = source.cadenceNominaleHz;
  if (!Number.isFinite(hz) || hz <= 0) return null;
  if (hz >= 1) {
    const parSeconde = Math.round(hz);
    return parSeconde === 1
      ? 'Environ un point par seconde.'
      : 'Environ ' + String(parSeconde) + ' points par seconde.';
  }
  return 'Environ un point toutes les ' + String(Math.round(1 / hz)) + ' secondes.';
}
