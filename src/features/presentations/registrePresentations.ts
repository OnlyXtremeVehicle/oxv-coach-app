/**
 * LE REGISTRE DES 65 PRÉSENTATIONS — le catalogue UX en donnée typée. PUR.
 *
 * Sans React, sans react-native, sans Supabase.
 *
 * ===========================================================================
 * CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS
 * ===========================================================================
 *
 * Le cahier « OXV Mirror — Le miroir du pilote » (v1.0, 25/08/2026) décrit
 * soixante-cinq présentations. Chaque fiche du §05 porte six lignes fixes :
 * QUESTION PILOTE, À L'ÉCRAN, POUR PROGRESSER, COACH, TEXTE, BASE.
 *
 * Ce module transcrit ce catalogue. Il ne l'interprète pas, il ne l'augmente
 * pas, et il ne rend aucun écran. C'est la TABLE que le moteur de composition
 * (`compositionLogic`) parcourt pour décider ce qu'une séance permet d'ouvrir.
 *
 * Trois champs seulement ne sont PAS écrits en toutes lettres dans le cahier,
 * et chacun est déduit d'une règle nommée ici :
 *
 *   • `niveau`      — déduit du §01 et de la section 05.x où la fiche se trouve.
 *   • `donneesRequises` — déduit de la ligne « À L'ÉCRAN » de la fiche.
 *   • `role`        — déduit du §00 (« Force d'abord », « Une seule opportunité »).
 *
 * Aucun autre jugement n'est ajouté. Pas de score, pas de rang, pas de note.
 *
 * ===========================================================================
 * LA RÈGLE DE NIVEAU, ÉCRITE UNE FOIS
 * ===========================================================================
 *
 * Le §01 donne trois niveaux de lecture : Flash (réussite · opportunité ·
 * suite, 10–90 s, trois cartes), Preuve (film, comparaison, repères et
 * confiance, 2–8 min) et Lab (traces, méthode, références et données brutes,
 * « densité autorisée pour coach/analyste »).
 *
 * La section du §05 les distribue :
 *
 *   05.A « Avant le verdict »            → 1 · flash   (le pilote parle)
 *   05.B « Mirror Flash »                → 1 · flash   (le titre le dit)
 *   05.C « Voir la preuve »              → 2 · preuve
 *   05.D « Relier le coach à l'action »  → 2 · preuve
 *   05.E « Transformer une journée »     → 2 · preuve
 *   05.F « Conserver la profondeur »     → 3 · lab
 *
 * Deux fiches sortent de leur section, et pour un motif écrit dans leur propre
 * fiche — jamais pour arrondir la règle :
 *
 *   P33, en 05.C, porte TEXTE « Caché par défaut » et BASE « ATLAS/MoTeC/AiM ».
 *        C'est la vue ingénieur derrière « Voir la preuve » : niveau 3.
 *   P45, en 05.D, porte TEXTE « 3 cartes » — le budget d'écran pilote du §02.
 *        Le coach y compose la version que le pilote lira : niveau 1.
 *
 * ===========================================================================
 * P55–P65 NE SONT PAS DES PRÉSENTATIONS PILOTE
 * ===========================================================================
 *
 * Le §06 est explicite : *« Le pilote n'ouvre par défaut que les P01–P54. Les
 * P55–P65 constituent le moteur de preuve professionnel du coach et de
 * l'analyste. »* Leur `surfaces` ne contient donc jamais `'pilote'`, et le
 * moteur pose en plus un verrou nommé sur l'intervalle — deux verrous pour une
 * règle, parce qu'une surface mal recopiée serait invisible.
 *
 * ===========================================================================
 * CE QUE LE CATALOGUE NE DEMANDE JAMAIS
 * ===========================================================================
 *
 * Aucune fiche ne demande de donnée biométrique. Le §07 « Règles de vérité
 * RaceBox Mini S » ne cite ni fréquence cardiaque, ni charge physiologique, ni
 * regard : ces canaux n'existent nulle part dans la chaîne. Déclarer une clé
 * `biometrie` que rien ne remplit fabriquerait un besoin, puis une absence à
 * afficher — exactement ce que la doctrine refuse. Le jour où un capteur entre
 * dans la chaîne, la clé s'ajoute avec lui.
 */

import type { ThemeQcm } from '@/features/rec/qcmLogic';

/** Version du registre — à incrémenter dès qu'une fiche change de contenu. */
export const VERSION_REGISTRE = 'registre-presentations-1.0.0';

// ===========================================================================
// Vocabulaire
// ===========================================================================

/**
 * Le choix éditorial de la fiche, tel que le §04 le donne.
 *
 * CRÉER = innovation OXV ; ADAPTER = logique existante simplifiée ;
 * REPRENDRE = vue professionnelle conservée derrière la preuve.
 */
export type ChoixPresentation = 'creer' | 'adapter' | 'reprendre';

/**
 * Les surfaces, telles que l'index du §04 les donne — pas une de plus.
 *
 * L'index écrit six mots : « Pilote », « coach », « Lab », « opérateur »,
 * « système », « client ». Les réduire à trois obligerait à ranger l'opérateur
 * chez le coach, alors que P02 et P64 distinguent précisément les deux :
 * *« L'opérateur traite les détails ; le pilote voit prêt/dégradé. »*
 */
export type SurfacePresentation = 'pilote' | 'coach' | 'lab' | 'operateur' | 'systeme' | 'client';

/** Les trois niveaux de lecture du §01. Le rang n'est pas un palier à gravir. */
export type NiveauLecture = 1 | 2 | 3;

/** Libellés des niveaux, pour les motifs rendus. */
export const LIBELLES_NIVEAUX: Readonly<Record<NiveauLecture, string>> = {
  1: 'flash',
  2: 'preuve',
  3: 'lab',
};

/**
 * Le rôle de la fiche dans le récit du §00.
 *
 * *« Force d'abord : chaque débrief commence par une réussite mesurée et
 * répétée »* et *« Une seule opportunité : les autres restent cachées jusqu'à
 * ce que le travail actif soit terminé »*. Ces deux phrases n'ont de sens
 * mécanique que si chaque fiche sait laquelle des deux elle est.
 *
 * `autre` n'est pas un fourre-tout paresseux : c'est le cas majoritaire, celui
 * des fiches qui ne prétendent ni ancrer un acquis ni désigner un chantier —
 * un cadrage, une preuve, une consigne, un souvenir.
 */
export type RolePresentation = 'reussite' | 'opportunite' | 'autre';

/**
 * Quand la fiche se lit : avant de rouler, ou après.
 *
 * Le §05.A porte son propre titre — « Avant le verdict : ressentir et cadrer »,
 * *« Le pilote parle avant que la donnée ne lui dise quoi penser »*. C'est un
 * ordre de lecture, pas un rang de valeur.
 */
export type MomentPresentation = 'avant' | 'apres';

// ===========================================================================
// Les données requises
// ===========================================================================

/**
 * Ce qu'une présentation demande pour AVOIR UN SENS.
 *
 * Déduit de la ligne « À L'ÉCRAN » de chaque fiche : si l'écran montre deux
 * fantômes, il faut deux tours comparables ; s'il montre une silhouette qui
 * tourne, il faut le gyroscope. Une fiche qui ne demande rien de mesuré (une
 * saisie de ressenti, un curseur) porte une liste vide — et c'est un fait, pas
 * un oubli.
 *
 * Les clés restent techniques parce qu'elles ne sont jamais affichées : ce que
 * le pilote lit, ce sont les `LIBELLES_DONNEES` ci-dessous. C'est la même
 * séparation que `src/telemetry/niveaux.ts` tient entre `CleNiveau` et `nom`.
 */
export type CleDonnee =
  // — Ce que le pilote a posé lui-même —
  | 'intention'
  | 'ressenti'
  | 'repere-piste'
  // — L'état de la chaîne de mesure —
  | 'sante-chaine'
  | 'etat-traitement'
  | 'confiance-mesure'
  // — Ce que la séance a mesuré —
  | 'tour-chronometre'
  | 'tours-comparables'
  | 'delta'
  | 'trace-position'
  | 'repetition'
  | 'freinage'
  | 'segmentation-virages'
  | 'gyroscope'
  | 'accelerations'
  // — Ce que le contexte apporte —
  | 'video'
  | 'coach-lie'
  | 'consigne-coach'
  | 'voix-coach'
  | 'acquis'
  | 'reference-partagee'
  | 'plusieurs-runs'
  | 'plusieurs-evenements'
  | 'plusieurs-circuits'
  | 'live'
  | 'flotte-live'
  | 'canaux-vehicule';

/**
 * Ce que chaque donnée s'appelle DEVANT LE PILOTE.
 *
 * La charte anti-jargon du §02 impose la traduction : « delta » se dit
 * « l'endroit où le temps change », « brake point » se dit « début de
 * décélération observée », jamais « tu freines » (§07, VOCABULAIRE
 * OBLIGATOIRE). Les libellés reprennent aussi ceux de `niveaux.ts`, pour que le
 * pilote ne lise pas deux noms pour la même chose.
 */
export const LIBELLES_DONNEES: Readonly<Record<CleDonnee, string>> = {
  intention: 'ce que vous aviez posé avant de rouler',
  ressenti: 'ce que vous avez nommé après le run',
  'repere-piste': 'un repère réel sur la piste',
  'sante-chaine': 'l’état de la chaîne de mesure',
  'etat-traitement': 'l’avancement du traitement de ce run',
  'confiance-mesure': 'la fiabilité de la mesure sur ce tour',
  'tour-chronometre': 'un tour chronométré',
  'tours-comparables': 'deux tours qui couvrent la même distance',
  delta: 'l’écart entre vos tours',
  'trace-position': 'votre passage situé sur le tracé',
  repetition: 'un même passage retrouvé sur plusieurs tours',
  freinage: 'le début de décélération observée',
  'segmentation-virages': 'le découpage du tour en droites et virages',
  gyroscope: 'le moment où la voiture tourne',
  accelerations: 'les appuis de la voiture',
  video: 'une vidéo du run',
  'coach-lie': 'un coach rattaché à votre compte',
  'consigne-coach': 'une consigne posée par votre coach',
  'voix-coach': 'un message vocal de votre coach',
  acquis: 'un acquis déjà validé',
  'reference-partagee': 'une référence publiée et consentie',
  'plusieurs-runs': 'plusieurs runs dans la journée',
  'plusieurs-evenements': 'plusieurs journées de piste',
  'plusieurs-circuits': 'plusieurs circuits roulés',
  live: 'le direct de votre run',
  'flotte-live': 'le direct de plusieurs pilotes',
  'canaux-vehicule': 'les canaux du véhicule',
};

/**
 * Les données qui sont des GRANDEURS MESURÉES, et pas des faits de contexte.
 *
 * Sert au moteur : quand la confiance de mesure du tour est faible, ce sont
 * celles-là qu'on refuse de présenter. `confiance-mesure` n'en fait
 * volontairement PAS partie — c'est l'écran qui dit pourquoi la confiance est
 * basse (P17, P64), et le fermer sur sa propre note serait absurde.
 */
export const DONNEES_MESUREES: ReadonlySet<CleDonnee> = new Set<CleDonnee>([
  'tour-chronometre',
  'tours-comparables',
  'delta',
  'trace-position',
  'repetition',
  'freinage',
  'segmentation-virages',
  'gyroscope',
  'accelerations',
]);

// ===========================================================================
// La fiche
// ===========================================================================

export interface Presentation {
  /** Identifiant du §04 — « P01 » … « P65 ». */
  readonly id: string;
  /** Nom de la fiche, tel que l'index le donne. */
  readonly nom: string;
  /**
   * LE LIBELLÉ AFFICHÉ SUR UNE FEUILLE DE DONNÉES — mot-clé, jamais phrase.
   *
   * `nom` est le nom du CATALOGUE : « Ce que je retiens », « Effet jusqu'à la
   * zone suivante ». Il se lit bien dans un index et dans un document ; sur une
   * feuille de données, il enfreint la règle des mots-clés — les soixante-cinq
   * la violent, mesuré le 01/09/2026.
   *
   * `court` est la forme que le pilote lit : majuscules, `SUJET` ou
   * `SUJET · PRÉCISION`, aucun mot outil, trois mots au plus de chaque côté du
   * point médian. La décision du fondateur du 30/08 le rend OBLIGATOIRE, et
   * `registreMotsCles.guard.test.ts` refuse toute fiche qui n'en porte pas un.
   *
   * Les deux coexistent : le nom du catalogue ne se perd pas, il cesse
   * seulement de s'afficher là où la règle l'interdit.
   */
  readonly court: string;
  /** CRÉER / ADAPTER / REPRENDRE. */
  readonly choix: ChoixPresentation;
  /** Surfaces de l'index, dans l'ordre où il les écrit. */
  readonly surfaces: readonly SurfacePresentation[];
  /** Niveau de lecture, déduit du §01 et de la section 05.x. */
  readonly niveau: NiveauLecture;
  /** Rôle dans le récit du §00. */
  readonly role: RolePresentation;
  /** Avant de rouler (05.A) ou après. */
  readonly moment: MomentPresentation;
  /** La ligne QUESTION PILOTE de la fiche, mot pour mot. */
  readonly question: string;
  /** La ligne BASE de la fiche — module M0x du cahier produit, ou origine. */
  readonly base: string;
  /** Ce qu'il faut avoir pour que la fiche ait un sens. Vide = rien de mesuré. */
  readonly donneesRequises: readonly CleDonnee[];
  /**
   * Le thème du QCM d'après-run que cette fiche éclaire, s'il y en a un.
   *
   * Sert au moteur à départager, jamais à filtrer : un thème nommé par le
   * pilote fait REMONTER une fiche, il n'en écarte aucune.
   */
  readonly themes: readonly ThemeQcm[];
}

// ===========================================================================
// LE REGISTRE — les 65 fiches, dans l'ordre du §04
// ===========================================================================

export const REGISTRE_PRESENTATIONS = [
  // ---- 05.A  Avant le verdict : ressentir et cadrer ----------------------
  {
    id: 'P01',
    nom: 'Objectif du run',
    court: 'OBJECTIF · RUN',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Qu’est-ce que je travaille ?',
    base: 'M01 Plan de run',
    donneesRequises: ['intention'],
    themes: [],
  },
  {
    id: 'P02',
    nom: 'Prévol sans jargon',
    court: 'PRÉVOL · SIMPLIFIÉ',
    choix: 'adapter',
    surfaces: ['pilote', 'operateur'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Mes données seront-elles utilisables ?',
    base: 'M02 + M33',
    donneesRequises: ['sante-chaine'],
    themes: [],
  },
  {
    id: 'P03',
    nom: 'Ressenti en six touches',
    court: 'RESSENTI · SIX TOUCHES',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Comment ai-je vécu ce run ?',
    base: 'Innovation OXV',
    // Une saisie. Elle ne demande aucune mesure — c'est tout son propos :
    // « Le pilote parle avant que la donnée ne lui dise quoi penser. »
    donneesRequises: [],
    themes: [],
  },
  {
    id: 'P04',
    nom: 'Note vocale 15 secondes',
    court: 'NOTE VOCALE · 15 SECONDES',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Qu’est-ce qui m’a marqué ?',
    base: 'M32 adapté pilote',
    donneesRequises: [],
    themes: [],
  },
  {
    id: 'P05',
    nom: 'Virage vécu comme difficile',
    court: 'VIRAGE · RESSENTI DIFFICILE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Où ai-je eu le plus de mal ?',
    base: 'Innovation OXV',
    // « Carte tactile ; un seul point à marquer » — il faut le tracé pour
    // pouvoir y poser un point.
    donneesRequises: ['trace-position'],
    themes: [],
  },
  {
    id: 'P06',
    nom: 'Confiance du pilote',
    court: 'CONFIANCE PILOTE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Est-ce que je savais ce que je faisais ?',
    base: 'Innovation OXV',
    donneesRequises: [],
    themes: [],
  },
  {
    id: 'P07',
    nom: 'Fin du run en un geste',
    court: 'CLÔTURE · GESTE UNIQUE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'avant',
    question: 'Que se passe-t-il maintenant ?',
    base: 'Innovation OXV',
    donneesRequises: ['etat-traitement'],
    themes: [],
  },

  // ---- 05.B  Mirror Flash : comprendre en 90 secondes --------------------
  {
    id: 'P08',
    nom: 'Verdict du run',
    court: 'VERDICT · RUN',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'apres',
    question: 'Ai-je progressé ?',
    base: 'Refonte M04',
    // « progression · stable · non comparable » : le troisième état exige que
    // la comparabilité soit une donnée, pas une hypothèse.
    donneesRequises: ['tours-comparables', 'delta'],
    themes: [],
  },
  {
    id: 'P09',
    nom: 'Réussite du run',
    court: 'RÉUSSITE · RUN',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'reussite',
    moment: 'apres',
    question: 'Qu’ai-je bien fait ?',
    base: 'Refonte M04',
    // « 1 carte verte avec zone, preuve et répétition ».
    donneesRequises: ['tours-comparables', 'delta', 'trace-position', 'repetition'],
    themes: [],
  },
  {
    id: 'P10',
    nom: 'Opportunité principale',
    court: 'OPPORTUNITÉ PRINCIPALE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'opportunite',
    moment: 'apres',
    question: 'Où puis-je progresser le plus ?',
    base: 'Refonte M04/M07',
    // « temps potentiel · confiance ».
    donneesRequises: ['tours-comparables', 'delta', 'trace-position', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P11',
    nom: 'Ce que je retiens',
    court: 'POINT RETENU',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'apres',
    question: 'Que dois-je garder en tête ?',
    base: 'Refonte M04',
    donneesRequises: ['tours-comparables', 'delta'],
    themes: [],
  },
  {
    id: 'P12',
    nom: 'Monnaie du temps',
    court: 'MONNAIE · TEMPS',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    // « Pièces de 0,1 s réparties sur 3 zones » : c'est une hiérarchie de
    // chantiers, donc une opportunité — et la règle du §00 vaut pour elle.
    role: 'opportunite',
    moment: 'apres',
    question: 'Combien vaut chaque zone ?',
    base: 'Innovation OXV',
    donneesRequises: ['tours-comparables', 'delta', 'trace-position'],
    themes: ['rythme'],
  },
  {
    id: 'P13',
    nom: 'Carte récit du circuit',
    court: 'CARTE RÉCIT · CIRCUIT',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    // Forces ET occasions sur la même carte : elle ne désigne pas un chantier
    // unique, elle raconte le tour. Rôle `autre`, à dessein.
    role: 'autre',
    moment: 'apres',
    question: 'Où sont mes forces et occasions ?',
    base: 'Refonte M07',
    donneesRequises: ['trace-position', 'delta', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P14',
    nom: 'Top 3 à ouvrir',
    court: 'TOP 3 · LECTURES',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'opportunite',
    moment: 'apres',
    question: 'Que regarder d’abord ?',
    base: 'Garmin/flows guidés + M04',
    // « classées par impact × répétition × confiance » — les trois sont requis.
    donneesRequises: [
      'tours-comparables',
      'delta',
      'trace-position',
      'repetition',
      'confiance-mesure',
    ],
    themes: [],
  },
  {
    id: 'P15',
    nom: 'Progression dans la session',
    court: 'PROGRESSION · SÉANCE',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'apres',
    question: 'Est-ce que je m’améliore au fil des runs ?',
    base: 'M06',
    donneesRequises: ['plusieurs-runs', 'tours-comparables'],
    themes: ['rythme'],
  },
  {
    id: 'P16',
    nom: 'Meilleur passage répétable',
    court: 'PASSAGE RÉPÉTABLE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'reussite',
    moment: 'apres',
    question: 'Quelle référence est vraiment à ma portée ?',
    base: 'M10 réinterprété',
    // « Passage réussi au moins 2 fois, pas tour théorique ».
    donneesRequises: ['tours-comparables', 'delta', 'trace-position', 'repetition'],
    themes: [],
  },
  {
    id: 'P17',
    nom: 'Fiabilité de la conclusion',
    court: 'FIABILITÉ · CONCLUSION',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 1,
    role: 'autre',
    moment: 'apres',
    question: 'Puis-je faire confiance à ce résultat ?',
    base: 'M03',
    // La seule donnée requise est la note elle-même : cet écran EXISTE pour
    // dire qu'elle est basse, il ne peut pas se fermer là-dessus.
    donneesRequises: ['confiance-mesure'],
    themes: [],
  },

  // ---- 05.C  Voir la preuve sans apprendre la télémétrie -----------------
  {
    id: 'P18',
    nom: 'Film du virage',
    court: 'FILM · VIRAGE',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Que s’est-il passé, dans l’ordre ?',
    base: 'Refonte M12',
    donneesRequises: ['trace-position', 'segmentation-virages', 'gyroscope'],
    themes: [],
  },
  {
    id: 'P19',
    nom: 'Ruban des quatre phases',
    court: 'RUBAN · QUATRE PHASES',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Dans quelle phase le temps change-t-il ?',
    base: 'M12 + M14',
    // « Approche · décélération observée · rotation · sortie » : la deuxième
    // phase exige le freinage, la troisième le découpage.
    donneesRequises: ['segmentation-virages', 'gyroscope', 'freinage', 'delta'],
    themes: ['freinage'],
  },
  {
    id: 'P20',
    nom: 'Mirror Twin',
    court: 'MIRROR TWIN',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'À quoi ressemble mon passage reproductible ?',
    base: 'M25 réinventé',
    donneesRequises: ['tours-comparables', 'trace-position', 'repetition'],
    themes: [],
  },
  {
    id: 'P21',
    nom: 'Différence seulement',
    court: 'DIFFÉRENCE SEULE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Qu’est-ce qui change vraiment ?',
    base: 'Innovation OXV',
    donneesRequises: ['tours-comparables', 'delta', 'trace-position'],
    themes: [],
  },
  {
    id: 'P22',
    nom: 'Avant / après côte à côte',
    court: 'AVANT · APRÈS',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Qu’ai-je changé après le coaching ?',
    base: 'M25 + M27',
    donneesRequises: ['plusieurs-runs', 'tours-comparables', 'trace-position', 'consigne-coach'],
    themes: [],
  },
  {
    id: 'P23',
    nom: 'Ressenti contre réalité',
    court: 'RESSENTI · MESURE',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Mon impression correspond-elle aux faits ?',
    base: 'Innovation OXV',
    // « Ressenti · donnée · lecture coach » : trois cartes, trois sources.
    donneesRequises: ['ressenti', 'tours-comparables', 'delta', 'coach-lie'],
    themes: [],
  },
  {
    id: 'P24',
    nom: 'Blind Reveal',
    court: 'BLIND REVEAL',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Où pensais-je perdre du temps ?',
    base: 'Innovation OXV',
    donneesRequises: ['tours-comparables', 'delta', 'trace-position'],
    themes: [],
  },
  {
    id: 'P25',
    nom: 'Effet jusqu’à la zone suivante',
    court: 'EFFET · ZONE SUIVANTE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Cette erreur coûte-t-elle après le virage ?',
    base: 'M17',
    donneesRequises: ['delta', 'segmentation-virages', 'trace-position'],
    themes: [],
  },
  {
    id: 'P26',
    nom: 'Couloir de placement',
    court: 'COULOIR · PLACEMENT',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Suis-je placé de manière régulière ?',
    base: 'M18',
    // « Trajectoire réelle + couloir répétable + incertitude GNSS ».
    donneesRequises: ['trace-position', 'repetition', 'confiance-mesure'],
    themes: ['placement'],
  },
  {
    id: 'P27',
    nom: 'Repère de décélération observée',
    court: 'REPÈRE · DÉCÉLÉRATION',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Où la voiture commence-t-elle à ralentir ?',
    base: 'M13',
    donneesRequises: ['freinage', 'trace-position', 'repetition'],
    themes: ['freinage'],
  },
  {
    id: 'P28',
    nom: 'Point le plus lent',
    court: 'POINT LENT',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Où suis-je le plus lent ?',
    base: 'M16',
    donneesRequises: ['segmentation-virages', 'tours-comparables', 'trace-position'],
    themes: ['placement'],
  },
  {
    id: 'P29',
    nom: 'Rotation et stabilité',
    court: 'ROTATION · STABILITÉ',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Quand la voiture change-t-elle de direction ?',
    base: 'M15 + M21',
    donneesRequises: ['gyroscope', 'segmentation-virages'],
    themes: ['voiture'],
  },
  {
    id: 'P30',
    nom: 'Grip simplifié',
    court: 'GRIP SIMPLIFIÉ',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Est-ce que je combine ralentir et tourner ?',
    base: 'M14 + M20',
    donneesRequises: ['accelerations'],
    themes: ['voiture'],
  },
  {
    id: 'P31',
    nom: 'Régularité par cases',
    court: 'RÉGULARITÉ · CASES',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Puis-je refaire mon bon passage ?',
    base: 'M22',
    donneesRequises: ['segmentation-virages', 'tours-comparables', 'repetition'],
    themes: ['rythme'],
  },
  {
    id: 'P32',
    nom: 'Vidéo synchronisée',
    court: 'VIDÉO SYNCHRONISÉE',
    choix: 'reprendre',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Qu’est-ce que je voyais et faisais ?',
    base: 'M24 / VBOX / AiM',
    donneesRequises: ['video', 'trace-position'],
    themes: [],
  },
  {
    id: 'P33',
    nom: 'Voir la preuve technique',
    court: 'PREUVE TECHNIQUE',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    // Exception de section, motivée par la fiche : TEXTE « Caché par défaut »,
    // BASE « ATLAS/MoTeC/AiM ». C'est la vue ingénieur, pas la preuve animée.
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Comment cette conclusion a-t-elle été calculée ?',
    base: 'ATLAS/MoTeC/AiM',
    donneesRequises: ['tours-comparables', 'delta', 'confiance-mesure'],
    themes: [],
  },

  // ---- 05.D  Relier le coach à l'action ----------------------------------
  {
    id: 'P34',
    nom: 'Pile de preuves coach',
    court: 'PILE · PREUVES COACH',
    choix: 'adapter',
    surfaces: ['coach'],
    niveau: 2,
    role: 'opportunite',
    moment: 'apres',
    question: 'Quel sujet mérite une intervention ?',
    base: 'M07/M12 + ATLAS',
    donneesRequises: ['coach-lie', 'tours-comparables', 'delta', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P35',
    nom: 'Phrase coach liée à la preuve',
    court: 'PHRASE COACH · PREUVE',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Pourquoi le coach me dit-il cela ?',
    base: 'M23 réinventé',
    donneesRequises: ['coach-lie', 'consigne-coach', 'trace-position'],
    themes: [],
  },
  {
    id: 'P36',
    nom: 'Voix coach sur le passage',
    court: 'VOIX COACH · PASSAGE',
    choix: 'adapter',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Puis-je réécouter au bon endroit ?',
    base: 'M23 + M32',
    donneesRequises: ['coach-lie', 'voix-coach', 'trace-position'],
    themes: [],
  },
  {
    id: 'P37',
    nom: 'Confirmation de compréhension',
    court: 'CONFIRMATION · COMPRÉHENSION',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Ai-je réellement compris ?',
    base: 'Innovation OXV',
    donneesRequises: ['consigne-coach'],
    themes: [],
  },
  {
    id: 'P38',
    nom: 'Repère mémoire',
    court: 'REPÈRE MÉMOIRE',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'À quel repère piste rattacher l’action ?',
    base: 'Innovation OXV',
    donneesRequises: ['repere-piste', 'coach-lie'],
    themes: [],
  },
  {
    id: 'P39',
    nom: 'Mode un seul changement',
    court: 'MODE · CHANGEMENT UNIQUE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Que dois-je modifier, et rien d’autre ?',
    base: 'Innovation OXV',
    donneesRequises: ['consigne-coach'],
    themes: [],
  },
  {
    id: 'P40',
    nom: 'Défi du prochain run',
    court: 'DÉFI · PROCHAIN RUN',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Que vais-je tester maintenant ?',
    base: 'M01 + innovation',
    donneesRequises: ['coach-lie', 'consigne-coach', 'trace-position'],
    themes: [],
  },
  {
    id: 'P41',
    nom: 'File de consignes live',
    court: 'FILE · CONSIGNES LIVE',
    choix: 'creer',
    surfaces: ['coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Quel message peut être envoyé au tour suivant ?',
    base: 'M31',
    donneesRequises: ['coach-lie', 'live'],
    themes: [],
  },
  {
    id: 'P42',
    nom: 'Fenêtre cognitive',
    court: 'FENÊTRE COGNITIVE',
    choix: 'creer',
    surfaces: ['coach', 'systeme'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Quand parler sans distraire ?',
    base: 'M31 innovation',
    donneesRequises: ['live', 'segmentation-virages', 'trace-position'],
    themes: [],
  },
  {
    id: 'P43',
    nom: 'Résultat après intervention',
    court: 'RÉSULTAT · APRÈS INTERVENTION',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Est-ce que l’action a fonctionné ?',
    base: 'M27',
    donneesRequises: [
      'consigne-coach',
      'plusieurs-runs',
      'tours-comparables',
      'delta',
      'repetition',
    ],
    themes: [],
  },
  {
    id: 'P44',
    nom: 'Résultat non concluant',
    court: 'RÉSULTAT NON CONCLUANT',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Pourquoi ne peut-on pas conclure ?',
    base: 'M27 + doctrine OXV',
    donneesRequises: ['consigne-coach', 'plusieurs-runs', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P45',
    nom: 'Résumé coach de session',
    court: 'RÉSUMÉ COACH · SÉANCE',
    choix: 'adapter',
    surfaces: ['coach'],
    // Exception de section, motivée par la fiche : TEXTE « 3 cartes », qui est
    // le budget d'écran pilote du §02. Le coach y compose la lecture flash.
    niveau: 1,
    role: 'autre',
    moment: 'apres',
    question: 'Quels trois points transmettre ?',
    base: 'M04/M28',
    donneesRequises: ['coach-lie', 'tours-comparables', 'delta'],
    themes: [],
  },

  // ---- 05.E  Transformer une journée en progression durable --------------
  {
    id: 'P46',
    nom: 'Passeport de compétences',
    court: 'PASSEPORT · COMPÉTENCES',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'reussite',
    moment: 'apres',
    question: 'Qu’est-ce que je sais mieux faire ?',
    base: 'M26 réinventé',
    donneesRequises: ['acquis', 'coach-lie'],
    themes: [],
  },
  {
    id: 'P47',
    nom: 'Carte preuve d’une compétence',
    court: 'CARTE PREUVE · COMPÉTENCE',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'reussite',
    moment: 'apres',
    question: 'Sur quoi repose cet acquis ?',
    base: 'Innovation OXV',
    donneesRequises: ['acquis', 'repetition', 'confiance-mesure', 'coach-lie'],
    themes: [],
  },
  {
    id: 'P48',
    nom: 'Rétention au prochain événement',
    court: 'RÉTENTION · PROCHAIN ÉVÉNEMENT',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Ai-je conservé ce que j’avais appris ?',
    base: 'Innovation OXV',
    donneesRequises: ['acquis', 'plusieurs-evenements', 'tours-comparables'],
    themes: [],
  },
  {
    id: 'P49',
    nom: 'Ligne du temps saison',
    court: 'CHRONOLOGIE · SAISON',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Comment évolue mon niveau ?',
    base: 'M06 + M35',
    donneesRequises: ['plusieurs-evenements'],
    themes: [],
  },
  {
    id: 'P50',
    nom: 'Album des forces',
    court: 'ALBUM · FORCES',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'reussite',
    moment: 'apres',
    question: 'Quels gestes dois-je préserver ?',
    base: 'Innovation OXV',
    // « Clips et preuves de réussites répétées » : le clip peut être le rejeu
    // du tracé, la vidéo n'est donc pas exigée — la répétition, si.
    donneesRequises: ['repetition', 'trace-position', 'plusieurs-runs'],
    themes: [],
  },
  {
    id: 'P51',
    nom: 'Transfert entre circuits',
    court: 'TRANSFERT · CIRCUITS',
    choix: 'creer',
    surfaces: ['pilote', 'coach'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Une compétence fonctionne-t-elle ailleurs ?',
    base: 'Innovation OXV',
    donneesRequises: ['plusieurs-circuits', 'segmentation-virages', 'acquis'],
    themes: [],
  },
  {
    id: 'P52',
    nom: 'Story de fin de journée',
    court: 'STORY · FIN JOURNÉE',
    choix: 'creer',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Quelle est l’histoire de ma progression ?',
    base: 'M28 réinventé',
    // « Départ · ressenti · preuve · coach · résultat » — les cinq chapitres.
    donneesRequises: ['plusieurs-runs', 'ressenti', 'delta', 'coach-lie'],
    themes: [],
  },
  {
    id: 'P53',
    nom: 'Clip partageable',
    court: 'CLIP PARTAGEABLE',
    choix: 'adapter',
    surfaces: ['pilote'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Puis-je montrer ma progression clairement ?',
    base: 'M24/M28',
    donneesRequises: ['video', 'delta'],
    themes: [],
  },
  {
    id: 'P54',
    nom: 'Rapport premium',
    court: 'RAPPORT PREMIUM',
    choix: 'adapter',
    surfaces: ['pilote', 'client'],
    niveau: 2,
    role: 'autre',
    moment: 'apres',
    question: 'Que vais-je conserver après le trackday ?',
    base: 'M28',
    donneesRequises: ['plusieurs-runs', 'delta', 'trace-position', 'coach-lie'],
    themes: [],
  },

  // ---- 05.F  Conserver la profondeur professionnelle ---------------------
  // §06 : « Le pilote n'ouvre par défaut que les P01–P54. » Aucune de ces
  // onze fiches ne porte la surface `pilote`.
  {
    id: 'P55',
    nom: 'Tableau des tours',
    court: 'TABLEAU · TOURS',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Quels tours sont propres et comparables ?',
    base: 'M05 / outils pro',
    donneesRequises: ['tour-chronometre', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P56',
    nom: 'Delta temps / distance',
    court: 'DELTA · TEMPS DISTANCE',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Où le chrono change-t-il précisément ?',
    base: 'M08 / MoTeC/VBOX/AiM',
    donneesRequises: ['tours-comparables', 'delta'],
    themes: [],
  },
  {
    id: 'P57',
    nom: 'Vitesse / distance',
    court: 'VITESSE · DISTANCE',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Comment les profils de vitesse diffèrent-ils ?',
    base: 'M19',
    donneesRequises: ['tours-comparables', 'trace-position'],
    themes: [],
  },
  {
    id: 'P58',
    nom: 'Index détaillé des virages',
    court: 'INDEX · VIRAGES',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'opportunite',
    moment: 'apres',
    question: 'Quel virage mérite l’analyse ?',
    base: 'M11',
    donneesRequises: ['segmentation-virages', 'delta', 'confiance-mesure', 'repetition'],
    themes: [],
  },
  {
    id: 'P59',
    nom: 'Gestionnaire de références',
    court: 'GESTIONNAIRE · RÉFÉRENCES',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'À qui ou à quoi se comparer ?',
    base: 'M09 + M35',
    donneesRequises: ['reference-partagee'],
    themes: [],
  },
  {
    id: 'P60',
    nom: 'Enveloppe G-G complète',
    court: 'ENVELOPPE G-G',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Comment le grip est-il utilisé ?',
    base: 'M20',
    donneesRequises: ['accelerations', 'segmentation-virages'],
    themes: [],
  },
  {
    id: 'P61',
    nom: 'Workspace à curseur commun',
    court: 'WORKSPACE · CURSEUR COMMUN',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Puis-je relier toutes les preuves au même instant ?',
    base: 'ATLAS/AiM/MoTeC',
    // La vidéo enrichit ce plan de travail sans le conditionner : sans elle,
    // carte, traces et annotations restent liées au même curseur.
    donneesRequises: ['tours-comparables', 'delta', 'trace-position'],
    themes: [],
  },
  {
    id: 'P62',
    nom: 'Live Wall flotte',
    court: 'LIVE WALL · FLOTTE',
    choix: 'reprendre',
    surfaces: ['coach', 'operateur'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Quel pilote regarder maintenant ?',
    base: 'M29',
    donneesRequises: ['flotte-live', 'sante-chaine'],
    themes: [],
  },
  {
    id: 'P63',
    nom: 'Live pilote sélectionné',
    court: 'LIVE · PILOTE SÉLECTIONNÉ',
    choix: 'reprendre',
    surfaces: ['coach'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Que se passe-t-il dans ce run ?',
    base: 'M30',
    donneesRequises: ['live', 'trace-position'],
    themes: [],
  },
  {
    id: 'P64',
    nom: 'Qualité et mode dégradé',
    court: 'QUALITÉ · MODE DÉGRADÉ',
    choix: 'reprendre',
    surfaces: ['coach', 'operateur'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'La chaîne de mesure est-elle saine ?',
    base: 'M03 + M33',
    donneesRequises: ['sante-chaine', 'confiance-mesure'],
    themes: [],
  },
  {
    id: 'P65',
    nom: 'Canaux véhicule optionnels',
    court: 'CANAUX VÉHICULE',
    choix: 'reprendre',
    surfaces: ['coach', 'lab'],
    niveau: 3,
    role: 'autre',
    moment: 'apres',
    question: 'Peut-on confirmer les commandes réelles ?',
    base: 'M34',
    donneesRequises: ['canaux-vehicule'],
    themes: [],
  },
] as const satisfies readonly Presentation[];

/** L'identifiant d'une présentation — l'union des 65, pas `string`. */
export type IdPresentation = (typeof REGISTRE_PRESENTATIONS)[number]['id'];

/**
 * Une fiche telle qu'on la manipule : le contrat `Presentation`, mais dont
 * l'identifiant reste l'union des soixante-cinq.
 *
 * `REGISTRE_PRESENTATIONS` est un tuple `as const` — précieux pour dériver
 * `IdPresentation`, pénible à parcourir (chaque champ y est un littéral, et
 * `themes: []` s'y lit `readonly never[]`). `FICHES` est la même donnée, vue
 * par son contrat.
 */
export interface FichePresentation extends Presentation {
  readonly id: IdPresentation;
}

/** Les 65 fiches, dans l'ordre du §04. */
export const FICHES: readonly FichePresentation[] = REGISTRE_PRESENTATIONS;

/** Index par identifiant. */
const PAR_ID: ReadonlyMap<string, Presentation> = new Map(
  REGISTRE_PRESENTATIONS.map((p) => [p.id, p as Presentation])
);

/** Une fiche par son identifiant, ou `undefined`. */
export function presentation(id: string): Presentation | undefined {
  return PAR_ID.get(id);
}

/**
 * Les identifiants réservés au moteur de preuve coach et Lab (§06).
 *
 * Écrit en clair plutôt que déduit de `surfaces` : c'est une règle du cahier,
 * et une règle doit pouvoir être vérifiée sans dépendre d'un champ recopié
 * soixante-cinq fois.
 */
export const PREMIER_ID_MOTEUR_PREUVE = 55;

/** La fiche est-elle réservée au coach et au Lab (P55–P65) ? */
export function estMoteurDePreuve(id: string): boolean {
  const n = Number.parseInt(id.slice(1), 10);
  return Number.isInteger(n) && n >= PREMIER_ID_MOTEUR_PREUVE;
}
