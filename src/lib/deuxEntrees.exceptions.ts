/**
 * LES EXCEPTIONS À LA RÈGLE DES DEUX ENTRÉES — R1, `deuxEntrees`.
 *
 * ===========================================================================
 * CE QUE LA MESURE A DONNÉ, LE 05/09/2026
 * ===========================================================================
 *
 * Sur les **144 écrans** de `app/`, chemins normalisés et commentaires retirés :
 *
 *     0 entrée : 0        1 entrée : 97        2 et plus : 47
 *
 * **Zéro orphelin.** Ce n'est pas une évidence — le jalon 5 en comptait trois
 * pour le seul Club, et `orphelinsApp2.guard` tient cette moitié de la règle
 * depuis. Ce qui manque à R1 est la SECONDE entrée, pas la première.
 *
 * ===========================================================================
 * POURQUOI DES FAMILLES ET NON QUATRE-VINGT-DIX-SEPT PHRASES
 * ===========================================================================
 *
 * `D_Navigation.md:53` donne la forme `{ route, raison, jusquau }`, et pose sa
 * condition : « une liste d'exceptions datées se relit en trente secondes ».
 * **Quatre-vingt-dix-sept phrases ne se relisent pas en trente secondes** — six
 * familles, si.
 *
 * La forme de la spécification est respectée : `exceptionsDeuxEntrees()` rend
 * bien un `{ route, raison, jusquau }` par route. La raison et la date viennent
 * de la famille, ce qui est plus honnête que de recopier quatre-vingt-dix-sept
 * variantes d'une même phrase — et rend visible qu'une seule chose est en jeu
 * par famille.
 *
 * ===========================================================================
 * CINQ FAMILLES SONT DES FORMES JUSTES. UNE SEULE EST UNE DETTE.
 * ===========================================================================
 *
 * C'est le point que le tableau des sept règles ne disait pas : « 97 écrans à
 * une entrée » n'est pas « 97 défauts ». Une étape d'entonnoir à deux entrées
 * serait un DÉFAUT, pas une qualité. La dette réelle tient en **dix tiroirs
 * pilotes**, et c'est exactement ce que D-3 vise : « les tiroirs sous chaque
 * porte ».
 *
 * ===========================================================================
 * CE QUE CE FICHIER NE FAIT PAS
 * ===========================================================================
 *
 * Il ne relâche rien. Une route absente d'ici et pourvue d'une seule entrée
 * fait ÉCHOUER la garde. Une route listée ici qui gagne sa deuxième entrée fait
 * échouer la garde AUSSI — une exception périmée est une entrée morte, et c'est
 * la leçon que la liste des orphelins a déjà payée une fois.
 *
 * Et le 19 septembre, si les dix tiroirs n'ont pas bougé, la garde passe au
 * rouge. **Ce n'est pas un accident, c'est le mécanisme** : « une exception sans
 * date n'est pas une exception, c'est un abandon » (D-3).
 */

/** Une exception, à la forme exacte de `D_Navigation.md:53`. */
export interface ExceptionDeuxEntrees {
  /** Le motif de route, groupe compris, segments dynamiques en `*`. */
  route: string;
  /** Pourquoi une seule entrée suffit ici. En français, jamais vide. */
  raison: string;
  /** Date de relecture, `AAAA-MM-JJ`. Passée, la garde échoue. */
  jusquau: string;
}

interface Famille {
  raison: string;
  jusquau: string;
  routes: readonly string[];
}

/**
 * LE MOYEU — l'écran pend de l'unique porte de son groupe.
 *
 * La console admin, l'espace coach, l'espace partenaire et l'espace pro n'ont
 * qu'une porte : leur `index`, ou leur module de navigation (`coachNav`,
 * `proNav`). Donner une seconde entrée à chacun voudrait dire inter-lier une
 * console — personne ne l'a demandé, et ce serait du bruit sur un outil de
 * travail. Ces espaces ne sont pas l'application pilote, et D-3 parle des
 * tiroirs du pilote.
 */
const MOYEU: Famille = {
  raison:
    'Écran de console pendu à la porte unique de son groupe. Inter-lier une console serait du bruit sur un outil de travail ; D-3 vise les tiroirs du pilote.',
  jusquau: '2026-12-31',
  routes: [
    '/(admin)/ambassadeurs',
    '/(admin)/analytique',
    '/(admin)/circuit',
    '/(admin)/coachs',
    '/(admin)/creneaux-a-valider',
    '/(admin)/devices',
    '/(admin)/feature-flags',
    '/(admin)/file',
    '/(admin)/incidents',
    '/(admin)/maintenance',
    '/(admin)/moderation',
    '/(admin)/partenaires',
    '/(admin)/points-carte',
    '/(admin)/preparation',
    '/(admin)/presences',
    '/(admin)/routes-certification',
    '/(admin)/sessions-media',
    '/(admin)/support',
    '/(admin)/tour-controle',
    '/(admin)/utilisateurs',
    '/(coach)/ar',
    '/(coach)/assistant',
    '/(coach)/business',
    '/(coach)/calendrier',
    '/(coach)/comparer-pilotes',
    '/(coach)/cycles',
    '/(coach)/demandes',
    '/(coach)/en-direct',
    '/(coach)/gabarits',
    '/(coach)/lecture',
    '/(partner)/facturation',
    '/(partner)/leads',
    '/(partner)/offres',
    '/(partner)/performance',
    '/(partner)/point',
    '/(partner)/profil',
    '/(partner)/rapports',
    '/(pro)/ambassadeur',
    '/(pro)/equipe',
    '/(pro)/media',
    '/(pro)/performance',
  ],
};

/**
 * L'ENTONNOIR — une étape, et son unique entrée est l'étape d'avant.
 *
 * Les six écrans de capture pilotés par `captureStepLogic`, les deux du
 * paiement, les deux embarquements et la liaison de compte. **Deux entrées y
 * seraient un défaut** : on n'entre pas au milieu d'un consentement, ni entre
 * l'appairage et le placement du boîtier.
 */
const ENTONNOIR: Famille = {
  raison:
    "Étape d'un parcours linéaire ; son unique entrée est l'étape précédente. Deux entrées seraient un défaut : on n'entre pas au milieu d'un consentement.",
  jusquau: '2026-12-31',
  routes: [
    '/(app2)/rec/appairage',
    '/(app2)/rec/arrivee',
    '/(app2)/rec/consentement',
    '/(app2)/rec/entre-runs',
    '/(app2)/rec/fin',
    '/(app2)/rec/placement',
    '/(app2)/reserver/*',
    '/(app2)/reserver/paiement',
    '/(auth)/lier',
    '/(coach-onboarding)/mission',
    '/(coach-onboarding)/pacte',
    '/(onboarding)/cgu',
    '/(onboarding)/doctrine',
    '/(onboarding)/methode',
    '/(onboarding)/niveau',
    '/(onboarding)/pacte',
  ],
};

/**
 * DEPUIS SA LISTE — le détail, ou la création, atteint depuis la liste.
 *
 * Une fiche pilote s'ouvre depuis l'annuaire des pilotes, une facture neuve
 * depuis les factures. Une seconde entrée demanderait un moteur de recherche
 * global, qui n'existe pas et n'est pas demandé.
 */
const DEPUIS_SA_LISTE: Famille = {
  raison:
    "Détail ou création atteint depuis la liste qui le porte. Une seconde entrée supposerait une recherche globale, qui n'existe pas.",
  jusquau: '2026-12-31',
  routes: [
    '/(admin)/analyse-session/*',
    '/(admin)/coachs/*',
    '/(admin)/evenements/nouveau',
    '/(admin)/support/*',
    '/(admin)/utilisateurs/*',
    '/(app2)/vous/decharge',
    '/(app2)/vous/document/*',
    '/(coach)/cycles/*',
    '/(coach)/en-direct/*',
    '/(coach)/facture-nouvelle',
    '/(coach)/messages/*',
    '/(coach)/repere/*',
  ],
};

/**
 * DEPUIS SON ÉCRAN — l'action ou la vue dépend de ce qui l'a ouverte.
 *
 * « Annoter » n'a de sens qu'attaché à la séance en direct qu'on annote ;
 * « comparer » et « plan » n'ont de sens que sur la fiche du pilote concerné ;
 * la carte-souvenir n'existe que pour un bilan. **Les atteindre autrement
 * demanderait de choisir leur objet d'abord** — c'est-à-dire de repasser par
 * l'écran qui les porte.
 */
const DEPUIS_SON_ECRAN: Famille = {
  raison:
    "Action ou vue attachée à l'objet de l'écran qui l'ouvre. L'atteindre autrement supposerait d'en choisir l'objet d'abord, donc de repasser par cet écran.",
  jusquau: '2026-12-31',
  routes: [
    '/(admin)/b2b-rapport',
    '/(app2)/bilan/carte-souvenir',
    '/(app2)/club/fil',
    '/(app2)/club/importer-trace',
    '/(app2)/club/sortie',
    '/(app2)/methode',
    '/(app2)/reserver',
    '/(app2)/vous/declarations',
    '/(app2)/vous/pieces',
    '/(coach)/annoter',
    '/(coach)/comparer',
    '/(coach)/contexte',
    '/(coach)/fil',
    '/(coach)/plan',
    '/(coach)/priorites',
    '/(pro)/bibliotheque',
  ],
};

/**
 * OUTIL INTERNE — deux bancs, atteints depuis les réglages, et c'est assez.
 *
 * `dev-capture` et `dev-galerie` ne sont pas des écrans de produit. Leur donner
 * une seconde entrée les exposerait davantage, ce qui est le contraire du but.
 */
const OUTIL_INTERNE: Famille = {
  raison:
    "Banc interne atteint depuis les réglages. Une seconde entrée l'exposerait davantage, ce qui est le contraire du but.",
  jusquau: '2026-12-31',
  routes: ['/(app2)/dev-capture', '/(app2)/dev-galerie'],
};

/**
 * LE TIROIR PILOTE — **LA SEULE VRAIE DETTE**, et la seule datée court.
 *
 * Dix écrans qui ne s'atteignent que depuis l'index de leur porte. C'est
 * exactement la cible de D-3 : « Les tiroirs sous chaque porte. Chacun a deux
 * entrées. Aucun tiroir n'est atteignable par un lien unique. »
 *
 * **Décision du fondateur du 05/09 : les quatre du Club reçoivent une seconde
 * entrée.** Ce qui a été mesuré en cherchant où l'accrocher, et qui change la
 * question :
 *
 *     session_media   0 ligne      → la galerie n'a rien à montrer
 *     scenic_routes   0 ligne      → les belles routes non plus
 *     social_pings    0 ligne      → le territoire ne porte que les 6 circuits
 *     partner_offers  1 ligne
 *
 * Une seconde entrée conditionnée à ces données ne s'afficherait donc JAMAIS —
 * et ce défaut-là est déjà documenté : l'en-tête d'`orphelinsApp2.guard` dit
 * qu'« un lien enfermé sous une condition de donnée jamais vraie » satisfait la
 * garde sans rien ouvrir, « c'est précisément ce qui s'était produit ». La
 * seconde entrée doit donc être INCONDITIONNELLE, et mener à un état vide
 * honnête — ce que R6 exige déjà.
 *
 * **DEUX SONT SORTIES LE 05/09, dans le commit qui les a servies.**
 * `club/routes` et `club/territoire` se donnent désormais réciproquement leur
 * seconde entrée : la carte porte « Vos routes enregistrées », la liste porte
 * « Ouvrir la carte ». Ce n'est pas un renvoi de complaisance — l'en-tête de
 * `territoire.tsx` mesure la différence depuis le 14/08 : son onglet ROUTES
 * fait `mergeRoutes(listMyRoutes, listCertifiedRoutes)`, quand `club/routes`
 * ne montre que les vôtres. Deux contenus, deux écrans, un aller-retour.
 *
 * Le lien de la carte est posé HORS de `RoutesTab`, et c'est tout le point :
 * ce composant rend trois retours anticipés — chargement, erreur, vide — et un
 * lien placé dedans ne serait apparu que dans le quatrième cas, celui qui
 * n'arrive jamais avec zéro ligne en base.
 *
 * **Restent huit tiroirs.** La date est le **19 septembre** — la répétition de
 * Bouteville, point de non-retour du matériel. Passée, cette garde est rouge.
 */
const TIROIR_PILOTE: Famille = {
  raison:
    "Tiroir de porte pilote, atteignable par un lien unique. C'est la cible de D-3, et la seule vraie dette des quatre-vingt-dix-sept. Seconde entrée à poser, inconditionnelle.",
  jusquau: '2026-09-19',
  routes: [
    '/(app2)/club/ecurie',
    '/(app2)/club/galerie',
    '/(app2)/club/partenaires',
    '/(app2)/data/carnet',
    '/(app2)/vous/documents',
    '/(app2)/vous/equipement',
    '/(app2)/vous/profil',
    '/(app2)/vous/support',
  ],
};

export const FAMILLES = {
  moyeu: MOYEU,
  entonnoir: ENTONNOIR,
  depuisSaListe: DEPUIS_SA_LISTE,
  depuisSonEcran: DEPUIS_SON_ECRAN,
  outilInterne: OUTIL_INTERNE,
  tiroirPilote: TIROIR_PILOTE,
} as const;

/** La liste à plat, à la forme exacte que D-3 décrit. */
export function exceptionsDeuxEntrees(): ExceptionDeuxEntrees[] {
  return Object.values(FAMILLES).flatMap((f) =>
    f.routes.map((route) => ({ route, raison: f.raison, jusquau: f.jusquau }))
  );
}
