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
  // Catégorie 7 : VOCABULAIRE OBLIGATOIRE — § 07 du catalogue d'expérience
  // (« Règles de vérité RaceBox Mini S », 25/08/2026).
  //
  // Ce n'est pas une question de style : c'est une question de VÉRITÉ DE
  // CANAL. Le Mini S ne mesure ni la pression de frein, ni la pédale, ni
  // l'angle du volant. Dire « vous freinez » nomme une ACTION du pilote là où
  // l'appareil n'a vu qu'une décélération ; dire « angle du volant » nomme un
  // canal ABSENT. La règle vaut donc à tous les niveaux de lecture — le § 01
  // autorise la densité au niveau 3, il n'autorise nulle part d'affirmer une
  // mesure qui n'existe pas. Le coach est concerné comme le pilote.
  //
  // Le catalogue tutoie ses exemples (« tu freines ») ; l'app vouvoie. Les
  // deux formes sont donc visées, et « vous freinez » l'était déjà par
  // `\bfreinez\b` (catégorie 1) — inutile de la répéter ici.
  {
    pattern: /\btu freines\b/gi,
    verb: 'tu freines (→ « la voiture commence à décélérer », § 07)',
    portee: 'prose',
  },
  {
    pattern: /\b(?:tu remets|vous remettez|remise des|remettre les|remet les)\s*(?:les\s+)?gaz\b/gi,
    verb: 'remise des gaz (→ « reprise d’accélération observée », § 07)',
    portee: 'prose',
  },
  {
    pattern: /\bangle\s+(?:du\s+|au\s+)?volant\b/gi,
    verb: 'angle du volant (canal absent sans CAN/OBD → « rotation », § 07)',
    portee: 'prose',
  },
  // Catégorie 8 : termes d'ingénierie EN ANGLAIS — charte anti-jargon, § 02 du
  // même catalogue. Ils prolongent la catégorie 4 : la doctrine OXV est en
  // français, et un terme anglais d'ingénieur n'est le mot juste dans aucune
  // interface, pas même celle du coach. Portée `prose` pour la même raison que
  // `tap` / `swipe` : `yawRate`, `throttle`, `brakePoint` sont des noms de
  // variables parfaitement légitimes, et doivent le rester.
  //
  // Les équivalents français adoptés — « apex », « jerk », « delta » — ne sont
  // PAS ici : le § 01 autorise leur densité au niveau 3 (Lab, coach, analyste).
  // Ils sont gardés côté pilote seulement, dans
  // `src/__tests__/vocabulairePilote.guard.test.ts`.
  {
    pattern: /\byaw\s*rate\b/gi,
    verb: 'yaw rate (→ « le moment où la voiture tourne », § 02)',
    portee: 'prose',
  },
  {
    pattern: /\blateral\s*offset\b/gi,
    verb: 'lateral offset (→ « votre placement sur la piste », § 02)',
    portee: 'prose',
  },
  {
    pattern: /\bbrake\s*point\b/gi,
    verb: 'brake point (→ « début de décélération observée », § 02)',
    portee: 'prose',
  },
  {
    pattern: /\bthrottle\s*application\b/gi,
    verb: 'throttle application (→ « reprise d’accélération observée », § 02)',
    portee: 'prose',
  },
  {
    pattern: /\boptimal\s*lap\b/gi,
    verb: 'optimal lap (→ « potentiel démontré », jamais « tour garanti », § 02)',
    portee: 'prose',
  },
  {
    pattern: /\bconfidence\s*score\b/gi,
    verb: 'confidence score (→ « fiabilité de la conclusion », § 02)',
    portee: 'prose',
  },
];
