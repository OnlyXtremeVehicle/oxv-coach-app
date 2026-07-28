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
 * Le dossier insiste sur un point : **la localisation refusée est la cause la
 * plus fréquente et la moins comprise.** iOS l'exige pour scanner en Bluetooth,
 * ce qui n'a aucun sens du point de vue du pilote — il ne cherche pas sa
 * position, il cherche son boîtier. Un message générique le laisse chercher du
 * côté du boîtier, qui n'y est pour rien.
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
    // LA cause la plus fréquente, et la moins comprise.
    test: /location|permission|unauthorized|not authorized/i,
    cause: 'La localisation est refusée.',
    geste: 'iOS l’exige pour chercher un appareil Bluetooth, même sans vous localiser.',
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
