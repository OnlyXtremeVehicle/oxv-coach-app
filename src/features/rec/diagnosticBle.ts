/**
 * Diagnostic d'appairage — jalon 3, lot 21c. Logique PURE.
 *
 * ---
 *
 * LE DÉFAUT
 *
 * `bluetoothService` émet `Connexion échouée : ${message}` où `message` est la
 * chaîne de `react-native-ble-plx` — en anglais : « Operation timed out »,
 * « Device <UUID> connection failed », « BluetoothLE is powered off ».
 * `equipement.tsx` la posait telle quelle dans `StateView`.
 *
 * Un pilote au paddock, casque à la main, lisait donc un identifiant technique
 * anglais. Sur le seul écran qui décide si sa journée sera mesurée.
 *
 * Le service BLE relève de la règle cardinale : on ne le modifie pas. La
 * traduction se fait donc ici, à la lecture — ce qui est de toute façon sa
 * place, un service ne devrait pas connaître la langue de son interface.
 *
 * ---
 *
 * « DIAGNOSTIC DÈS LE PREMIER ÉCHEC »
 *
 * Le dossier insiste sur un point : **une autorisation refusée est la cause la
 * plus fréquente et la moins comprise.** Le pilote ne cherche pas sa position
 * ni à régler son téléphone, il cherche son boîtier. Un message générique le
 * laisse chercher du côté du boîtier, qui n'y est pour rien.
 *
 * PRÉCISION APPORTÉE LE 05/08/2026, parce que le dossier et ce fichier
 * disaient tous deux « localisation » : depuis iOS 13, scanner en BLE demande
 * l'autorisation **Bluetooth**, pas la localisation. Celle-ci reste exigée sur
 * Android antérieur à 12. Les deux causes existent donc, mais elles ne se
 * confondent pas — et elles n'envoient pas au même panneau des Réglages.
 *
 * Chaque cause a donc son libellé, et son geste quand il y en a un.
 */

/** Ce que le pilote lit, et ce qu'il peut faire. */
export interface Diagnostic {
  /** Une phrase, la cause. */
  cause: string;
  /**
   * Le geste qui débloque, quand il existe et qu'il est à la portée du pilote.
   * Absent quand il n'y a qu'à réessayer — proposer un geste inutile use la
   * confiance dans les autres messages.
   */
  geste?: string;
  /** Repli technique conservé pour le journal, jamais affiché tel quel. */
  brut: string;
}

/**
 * Motifs reconnus dans les messages de `react-native-ble-plx`.
 *
 * L'ordre compte : le premier qui correspond gagne. Les causes les plus
 * spécifiques passent avant les génériques — « powered off » avant « failed ».
 */
const MOTIFS: { test: RegExp; cause: string; geste?: string }[] = [
  {
    /**
     * L'AUTORISATION BLUETOOTH PASSE AVANT LA LOCALISATION, ET CE N'EST PAS UN
     * DÉTAIL D'ORDRE.
     *
     * Le motif localisation portait `permission|unauthorized`. Il gagnait donc
     * sur les deux chaînes que l'application émet réellement — « Bluetooth non
     * disponible (état : Unauthorized) » et « Permissions Bluetooth refusées :
     * Bluetooth » — et le pilote lisait « La localisation est refusée ». Le mot
     * FRANÇAIS « Permissions » accrochait une expression écrite pour l'anglais.
     *
     * Conséquence au circuit : envoyé au mauvais panneau des Réglages, il
     * accordait une autorisation qui n'était pas la bloquante, et revenait
     * sur le même échec.
     *
     * Relevé le 05/08/2026. Aucune de ces chaînes françaises n'était testée.
     */
    test: /état\s*:\s*Unauthorized|Permissions?\s+Bluetooth\s+refus|not\s+authorized\s+to\s+use\s+Bluetooth|bluetooth.*unauthorized|unauthorized.*bluetooth/i,
    cause: 'L’autorisation Bluetooth est refusée.',
    geste: 'Réglages ▸ OXV ▸ Bluetooth.',
  },
  {
    // LA cause la plus fréquente, et la moins comprise. Le motif est resserré
    // sur la localisation SEULE : `permission` et `unauthorized` sont partis
    // au motif ci-dessus, qui est plus spécifique.
    test: /location|ACCESS_FINE_LOCATION|localisation/i,
    cause: 'La localisation est refusée.',
    geste: 'iOS l’exige pour chercher un appareil Bluetooth, même sans vous localiser.',
  },
  {
    // « Liaison interrompue — reconnexion… » (bluetoothService) tombait au
    // générique et se lisait comme un échec fermé. Une reconnexion EN COURS
    // n'est pas une panne : elle se dit au présent.
    test: /reconnexion|reconnect/i,
    cause: 'La liaison s’est interrompue, la reconnexion est en cours.',
    geste: 'Restez à proximité du boîtier.',
  },
  {
    test: /powered\s*off|poweredoff|bluetooth.*off|is off/i,
    cause: 'Le Bluetooth est éteint sur ce téléphone.',
  },
  {
    test: /unsupported|not supported/i,
    cause: 'Ce téléphone ne prend pas en charge le Bluetooth requis.',
  },
  {
    test: /timed?\s*out|timeout/i,
    cause: 'Le boîtier n’a pas répondu.',
    geste: 'Il est peut-être éteint, en veille, ou hors de portée.',
  },
  {
    test: /disconnect|was disconnected|connection lost/i,
    cause: 'La liaison avec le boîtier s’est interrompue.',
  },
  {
    test: /cancell?ed/i,
    cause: 'La connexion a été interrompue.',
  },
  {
    test: /connection failed|failed to connect|could not be connected/i,
    cause: 'La connexion au boîtier a échoué.',
    geste: 'Il est peut-être déjà appairé à un autre téléphone.',
  },
  {
    test: /resetting|reset/i,
    cause: 'Le Bluetooth du téléphone redémarre.',
  },
];

/**
 * Traduit un message d'erreur BLE en diagnostic lisible.
 *
 * Ne rend JAMAIS le message brut au pilote. Un message inconnu donne une cause
 * générique honnête — « la liaison n'a pas pu s'établir » — plutôt qu'une
 * chaîne anglaise : dire qu'on ne sait pas est préférable à dire quelque chose
 * d'incompréhensible.
 */
export function diagnostiquer(message: string | null | undefined): Diagnostic {
  const brut = (message ?? '').trim();
  if (brut.length === 0) {
    return { cause: 'La liaison avec le boîtier n’a pas pu s’établir.', brut: '' };
  }
  for (const m of MOTIFS) {
    if (m.test.test(brut)) return { cause: m.cause, geste: m.geste, brut };
  }
  return { cause: 'La liaison avec le boîtier n’a pas pu s’établir.', brut };
}

/** Le texte affiché : la cause, puis le geste s'il y en a un. */
export function texteDiagnostic(d: Diagnostic): string {
  return d.geste ? `${d.cause} ${d.geste}` : d.cause;
}
