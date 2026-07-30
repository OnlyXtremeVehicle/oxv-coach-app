/**
 * REGLES DOCTRINALES — la liste de ce que l'application ne dit jamais.
 *
 * Extraite de `check-doctrine.ts` le 29/07/2026 pour avoir UNE source.
 *
 * Elle était enfermée dans le scanner des écrans, qui ne lit que `app/` et
 * `src/` en `.tsx`. Or le jalon 5 exige « le test de registre sur TOUS les
 * messages de notification » — et une vingtaine de fonctions serveur portent
 * leur propre copie, hors de tout scan. Recopier la liste là-bas l'aurait fait
 * diverger au premier ajout.
 *
 * *« L'interdit ne s'arrête pas au bord de l'application. »* — Plan de montage,
 * jalon 5.
 */

/**
 * `prose` restreint la recherche au texte réellement affichable — littéraux de
 * chaîne contenant une espace, et nœuds de texte JSX. Sans cette portée, un
 * terme anglais employé comme IDENTIFIANT (`haptic="tap"`, `const swipe = …`)
 * remonte comme violation : soixante-quinze fois, ce qui rendait le scanner
 * rouge en permanence et donc inutile. Un scanner qu'on n'écoute plus n'attrape
 * plus rien de réel.
 */
export type Portee = 'ligne' | 'prose';

export const FORBIDDEN_PATTERNS: { pattern: RegExp; verb: string; portee?: Portee }[] = [
  // Catégorie 1 : verbes de pilotage
  { pattern: /\bfreinez\b/gi, verb: 'freinez' },
  { pattern: /\baccélérez\b/gi, verb: 'accélérez' },
  { pattern: /\bouvrez les gaz\b/gi, verb: 'ouvrez les gaz' },
  { pattern: /\btracez\b/gi, verb: 'tracez' },
  { pattern: /\bévitez\b/gi, verb: 'évitez' },
  { pattern: /\bil faut\b/gi, verb: 'il faut' },
  { pattern: /\bvous devez\b/gi, verb: 'vous devez' },
  { pattern: /\bvous devriez\b/gi, verb: 'vous devriez' },
  { pattern: /\btu dois\b/gi, verb: 'tu dois' },
  { pattern: /\btu peux\b/gi, verb: 'tu peux' },
  // Catégorie 2 : impératifs UI paternalistes
  { pattern: /\bappuyez sur\b/gi, verb: 'appuyez sur' },
  { pattern: /\bcliquez sur\b/gi, verb: 'cliquez sur' },
  { pattern: /\btapez sur\b/gi, verb: 'tapez sur' },
  { pattern: /\bn'oubliez pas\b/gi, verb: "n'oubliez pas" },
  { pattern: /\bn'hésitez pas\b/gi, verb: "n'hésitez pas" },
  { pattern: /\bpensez à\b/gi, verb: 'pensez à' },
  { pattern: /\bessayez de\b/gi, verb: 'essayez de' },
  // Catégorie 3 : jugements gratuits
  { pattern: /\bbravo\b/gi, verb: 'bravo' },
  { pattern: /\bbien joué\b/gi, verb: 'bien joué' },
  { pattern: /\bsuper\s*!/gi, verb: 'super !' },
  { pattern: /\bparfait\s*!/gi, verb: 'parfait !' },
  { pattern: /\bexcellent\s*!/gi, verb: 'excellent !' },
  { pattern: /\battention\s*!/gi, verb: 'attention !' },
  // Catégorie 4 : termes anglais dans texte UI (la doctrine OXV est en français).
  // Portée `prose` : ces mots sont aussi le vocabulaire de Gesture Handler et du
  // service haptique. Les chercher sur la ligne entière confondait le texte lu
  // par le pilote avec le nom d'une variable.
  { pattern: /\btap\b/gi, verb: 'tap (anglais)', portee: 'prose' },
  { pattern: /\bswipe\b/gi, verb: 'swipe (anglais)', portee: 'prose' },
  { pattern: /\bclick\b/gi, verb: 'click (anglais)', portee: 'prose' },
  // Catégorie 5 : conseils reformulés en groupe nominal (frontière fait/cause,
  // Pattern 4). Le scanner par verbes ne les capte pas ; ces tournures
  // désignent une cause à corriger et sont réservées au CoachBand (coach
  // agréé, attribué), jamais au miroir du pilote. Cf. focusCorner.ts.
  { pattern: /\brepère de freinage\b/gi, verb: 'repère de freinage' },
  { pattern: /\brepère de corde\b/gi, verb: 'repère de corde' },
  { pattern: /\bpatience à la corde\b/gi, verb: 'patience à la corde' },
  { pattern: /\bfreiner plus (tôt|tard)\b/gi, verb: 'freiner plus tôt/tard' },
  { pattern: /\brelâch(?:er|ez) plus (tôt|tard)\b/gi, verb: 'relâcher plus tôt/tard' },
  // Catégorie 6 : NOMS de jugement (fiche 10 §C — garde-langage bien-être). On
  // décrit des faits, jamais une note sur la personne ou sa performance.
  // Exclus volontairement : « échec » (alertes techniques légitimes) et
  // « faible » (usage factuel : « dispersion faible »). « lent/rapide » NU est
  // factuel (dégradé de vitesse, antonyme neutre) et AUTORISÉ ; seul le JUGEMENT
  // « trop lent » est proscrit (fiche 09 §C : « Trop lent au 3 » → « Vitesse mini
  // au virage 3 »). Viser « lent » nu cassait aussi sur l'accent (« ré-vèlent »).
  {
    pattern: /\btrop\s+lent(?:e|es|s)?\b/gi,
    verb: 'trop lent (→ « vitesse mini/basse », fiche 09 §C)',
  },
  { pattern: /\bmauvais(?:e)?\b/gi, verb: 'mauvais' },
  { pattern: /\bmédiocre\b/gi, verb: 'médiocre' },
  { pattern: /\bdécevant(?:e)?\b/gi, verb: 'décevant' },
  { pattern: /\braté(?:e)?\b/gi, verb: 'raté' },
];
