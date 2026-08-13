# OXV Mirror V3 — Arbre pilote, spécification écran par écran

**26 juillet 2026** · Complément au dossier de travail V3
Établi à partir de `docs/INVENTAIRE_ECRANS.md` (relevé du dépôt) et de trente-trois arbitrages.

**Périmètre** : les 37 routes de `app/(app2)`, layout exclu. Aucune n'est omise.

---

# I. LES QUATRE ZONES

Pour la première fois, elles se distinguent par leur **fonction**, pas par leur contenu.

| Zone | Fonction |
|---|---|
| **Miroir** | ce que vous avez vécu |
| **Data** | ce que le boîtier a mesuré |
| **Club** | votre appartenance, et ce que vous partagez |
| **VOUS** | ce qui est à vous et qui ne se mesure pas |

**Quatre portes stables**, icône et libellé — jamais l'icône seule. **Le bouton central ouvre le Pass.**

Conséquence de frontière : *Data porte votre mesure, le Club porte la mesure partagée.* C'est ce qui autorise la comparaison entre amis à vivre dans le Club.

---

# II. MIROIR

## `/(app2)` — L'accueil

**1 068 lignes.** Point de retour de 64 écrans. Ne consulte aucun drapeau — défaut à corriger.

**Rôle : dire où vous en êtes, et donner l'action du moment.** Il ne présente rien, ne résume rien.

**Cinq visages**, un seul chiffre roi et une seule action chacun :

| Visage | Chiffre roi | Action |
|---|---|---|
| **Premier jour** — aucune séance | ce qui vous attend | découvrir |
| **Rien de réservé** — état dominant | **la date de la prochaine journée ouverte** | réserver |
| **Journée réservée** | le compte à rebours | préparer |
| **Jour J** | l'heure du prochain départ | entrer dans REC |
| **Séance fraîche** — moins de 48 h | le chrono du jour | ouvrir le bilan |

**Le visage dominant porte trois leviers de récurrence**, tous honnêtes : *l'opportunité* — la journée ouverte, avec ses places restantes comme fait (« 4 places sur 18 », jamais « plus que ») ; *l'affaire inachevée* — la variable que le pilote a posée lui-même ; *la référence* — son meilleur tour.

**Interdit** : tout décompte du temps écoulé depuis la dernière séance. C'est un reproche déguisé, banni des notifications comme de l'écran.

**Le bouton « Réserver » ouvre le Pass**, y compris quand `app_payments` est fermé.

**Sans variable posée** : il propose d'en poser une — sauf au premier jour, où le pilote n'a pas de circuit à connaître.

**Second plan, identique sur tous les visages** : signature en barres compactes (cinq branches ; le pilier physiologique « Aplomb » reste séparé, en moignon tant qu'il n'est pas mesuré), faits de saison. **Deux sorties** : Data et la Saison.

## `/(app2)/signature`

**465 lignes.** Le portrait. Seul endroit où le radar est autorisé.

**Vocabulaire technique** — Trajectoire, Fluidité, Freinage, Accélération, Régularité. **Cinq branches, pas six** : voir plus bas pourquoi « Intensité » en est retirée.

**Le double vocabulaire NE disparaît PAS — corrigé le 13/08/2026.** Le supprimer aurait détruit cinq mots de marque pour régler un problème qui n'avait qu'une occurrence. Le défaut réel était un homonyme : « Trajectoire » désignait la branche `regularite`, et le QDI de Bouteville affichait 34 sous un mot dont la clé homonyme valait 97. **Une seule correspondance a été échangée** — `trajectoire` reprend « Trajectoire », `regularite` prend « Cap ». Visée, Plongée, Anticipation ne bougent pas. Le verrou de test ne tombe pas : il est REFAIT, et énonce désormais la règle plutôt que cinq paires littérales.

**Trois couches** : le radar plein écran · **le sélecteur de paire circuit-véhicule, en bas** · l'empreinte mensuelle, qui reste ici.

**Intensité n'est PAS une sixième branche — retiré le 13/08/2026, et voici pourquoi.**

Le radar se lit « plus haut, mieux ». Une branche Intensité y signifierait qu'un
pilote améliore sa figure **en roulant plus près de la limite**. Ce serait
transformer une restitution en incitation, sur un produit dont ces mêmes
documents écrivent qu'il n'est pas agréé pour évaluer — et dont le premier
principe est la sécurité avant la performance.

Le motif est écrit ici parce que, sans motif, le mot revient dans six semaines.

**Ce que le code fait déjà, et qui était juste.** Le pilier physiologique existe
sous le nom **« Aplomb »** (`PHYSIO_PILLAR_LABEL`), il vit **hors du radar**, en
barre séparée, et il est fermé sur trois conditions — drapeau `biometry`,
consentement de capture, trois séances au moins. Il rend `null` aujourd'hui.
C'est la bonne place : une mesure physiologique n'est pas un axe de pilotage.

Le QDI garde donc **cinq** branches — Trajectoire, Fluidité, Freinage,
Accélération, Régularité — et c'est ce que porte `QDI_BRANCHES`.


**Le radar affiche la moyenne générale par défaut**, et le sélecteur l'affine. Une ligne sous le radar dit toujours ce qu'il montre : « Signature générale · 11 séances » ou « Haute Saintonge · 911 GT3 · 4 séances ».

**Une icône d'information par branche** ouvre la méthode publiée.

**À corriger** : `useSignature` ne filtre ni par circuit ni par véhicule aujourd'hui.

## `/(app2)/bilan/[sessionId]`

**1 181 lignes.** Le premier regard, dans Miroir.

**La frontière avec la Séance est la zone, pas la longueur.** Le Bilan porte le vécu — ressenti, variable, photos, carte-trophée. La Séance porte la mesure.

**Structure** : la variable posée en tête, avec son fait mesuré · ce que le pilote avait senti · le tracé et le chrono · les photos · le reste de la séance en lignes, chacune portant son compte.

**Sans variable posée** : il montre ce que le pilote a nommé lui-même.

**Aucun delta coloré.** Deux valeurs côte à côte, le pilote lit lui-même.

**Une seule sortie : la Séance.** Le retour est le geste arrière, jamais un bouton croisé.

**L'export PDF passe côté serveur.** La carte-trophée devient une section de la carte-souvenir serveur — elle sort de la liste des écrans V1 à porter.

---

# III. DATA

## `/(app2)/data` — La Saison

**Le hub Data devient la Saison.** `data/saison` (1 308 lignes, orphelin) fusionne dans `data/index` (745 lignes). La route `/(app2)/data/saison` disparaît.

C'est la seule solution qui règle trois défauts d'un coup : l'orphelin disparaît, le hub cesse d'être une liste sans destination, et « la saison est l'objet principal » devient vrai littéralement.

**La page porte, dans l'ordre** :

*La saison* — tour de référence en chiffre roi, progression, faits, **filtre par paire circuit-véhicule**.
*Les deux ou trois séances récentes*, visibles sur la page.
*Le carnet*, en section visuellement séparée.

**La liste complète des séances est une feuille modale.**

**Deux territoires séparés à l'œil** : ce que le boîtier a mesuré, ce que le pilote a écrit. La frontière est de mise en page, pas de convention de couleur.

**Ancres collantes et rendu différé obligatoires** : la page approche 2 900 lignes avec le carnet. Sans cela, le budget de 16,66 ms ne tient pas.

**`dataExportService` part dans VOUS** s'il s'agit de l'export RGPD.

## `/(app2)/data/session/[id]` — La séance

**2 058 lignes.** L'écran de la mesure. Porte les six visualisations d'insight.

**Structure par densité décroissante, avec ancres collantes** : le tracé coloré par la vitesse et le chrono · la variable posée, mesurée · les tours en barres · le diagramme g-g décimé, coloré par la vitesse · les canaux avec curseur · les virages et leur évolution · les conditions en faits · les six lectures.

**Les six lectures s'effacent tant qu'elles sont vides.** La liste blanche à trois états les rend toutes `absent` jusqu'à la première mesure réelle ; un bloc sans matière disparaît.

**Aucune sortie vers le Bilan.**

**Trois services jamais discutés** : `cornerEvolutionService`, `weatherCorrelationService`, `trajectoryLogic`.

**Réserve doctrinale sur la corrélation météo** — « vous êtes plus rapide quand il fait chaud » est une affirmation causale. Un fait acceptable est « 18 °C, piste sèche » à côté du chrono. **À vérifier dans le service avant de trancher.**

## `/(app2)/data/comparer`

**1 627 lignes**, le plus gros du pilote. Importe `duelService`, `friendshipsService`, `comparerLogic`, `seasonLogic`.

**Il se scinde en deux écrans.** Celui-ci garde **la comparaison de deux séances à soi**. La comparaison avec un ami part dans le Club.

**Aucune table de comparaison n'est créée.** `duels` est supprimée ; la comparaison est **éphémère, sans trace**. Le lot « table `comparaisons` » est annulé.

**L'amitié est le consentement** — `are_friends()` exige déjà `status = 'accepted'` des deux côtés. Le consentement supplémentaire par comparaison est annulé, il était redondant.

**La comparaison à un an d'écart vit dans la Saison**, pas ici.

**Loi d'affichage, quel que soit le mode** : deux colonnes, aucun vainqueur, aucun delta coloré. **Le filtre par paire s'applique**, sinon la comparaison ment.

## Le carnet — remonté de VOUS

**915 lignes.** Lit `pilotGoalsService` et **`developmentCycleService`**.

**Il vit entièrement dans la page saison**, en section séparée — pas en écran derrière.

**Quatre matières** : intentions · objectifs · **cycles de développement** · ressentis, dont les passés, rattrapables ici.

**Les cycles** : le pilote les crée, **le coach peut en proposer** — le pilote accepte ou refuse.

**Visibilité** : le carnet rejoint le **niveau détaillé** du consentement coach. La phrase de consentement doit le dire en toutes lettres : « il voit vos séances, votre télémétrie, votre cardio et votre carnet ».

**Les quatre onglets sont vides en production**, et l'écriture n'existe pas encore.

---

# IV. REC — Le flux du jour J

**Huit étapes** dans le cas nominal. **Contraste renforcé sur les huit** : le texte secondaire prend la valeur du primaire, le tertiaire est interdit, les filets montent d'un cran. Mêmes couleurs, échelon supérieur.

**Barre d'onglets masquée en roulage uniquement.**

## `/(app2)/rec` — L'aiguilleur

**261 lignes. Toujours invisible.** Il ne montre jamais la structure, ne se traverse jamais. Il consulte `captureStepLogic` et envoie à l'étape courante.

**Le retour se fait d'écran à écran** — une chaîne, pas une étoile. Chaque étape porte son lien vers la précédente.

**Règle absolue : revenir, c'est consulter, jamais rembobiner.** L'état de la séance ne recule pas. Sans cela, revenir sur `placement` relancerait la capture.

## `/(app2)/rec/preparation` — Étape 2

**1 081 lignes.** « PEAU v2 sur les mêmes données » — un habillage, pas une refonte. Drapeau `convoys`.

**Rôle : suis-je prêt pour mardi ?**

*Ce qui manque* — les items d'éligibilité non déclarés ou non contrôlés, **en tête**.
*La journée* — circuit, horaires, météo prévue, créneau.
*Le coach actif* — la désignation, ici.

**L'éligibilité vient ici quoi qu'il arrive** — aucun service d'éligibilité n'apparaît dans les imports, sa localisation actuelle est inconnue.

**La table existe** : `public.eligibility_items`, **neuf** items contraints, quatre statuts (`pending`, `ok`, `refused`, `na`), **clé sur `registration_id`** et non sur le pilote. Elle porte déjà `validated_by`, `validated_at` et un `document_id` vers `documents`. **Une seule colonne manque : `declared_at`.** L'article L321-1 fait peser l'obligation sur l'organisateur : « le pilote a déclaré le 3 avril, nous avons contrôlé le 14 » n'a pas la valeur d'une case cochée.

**Elle lit les documents** : un document porte sa date d'expiration, l'item d'éligibilité la lit.

**Le parrainage quitte cet écran** — `referralService` doit trouver sa place ailleurs. Point ouvert.

**Elle lit `sessions` pour le circuit et `events` pour les balades.** *Réserve* : si elle sert les deux, le flux REC diverge après elle — une balade n'a ni ligne d'arrivée, ni tours, ni entre-runs. La bifurcation se fait par la zone : les balades vivent dans `club/routes`.

## `/(app2)/rec/arrivee` — Étape 3

**230 lignes.** Le moment cérémoniel — l'insigne se dessine, **passable d'un geste**.

**Elle porte le QR de pointage**, grand, lisible en plein soleil, avec le numéro du jour en clair à côté. Le QR vit aussi dans le Pass.

**Bascule automatique** : géolocalisation **et** heure. Le couple vérifie qu'il est au **bon circuit, le bon jour** — ce dont l'administrateur a besoin au pointage.

**Trois conséquences techniques.** Le libellé de permission doit changer : `app.json` déclare aujourd'hui la localisation pour le seul scan Bluetooth, et un autre usage sans libellé exact est un motif de rejet en revue. Aucune détection en arrière-plan — pas d'`UIBackgroundModes`, donc la position ne se lit qu'application ouverte. **Un repli manuel est obligatoire** : permission refusée, GPS qui ne fixe pas, circuit sans coordonnées — aucun de ces cas ne bloque la journée.

## `/(app2)/rec/appairage` — Étape 4a · **NOUVEAU**

Scindé de `rec/equipement` (1 146 lignes). Porte `deviceHealthService`.

**Diagnostic dès le premier échec**, la reconnexion continuant en arrière-plan. Si la connexion aboutit pendant l'affichage, l'écran passe.

**Le diagnostic sépare le vérifié du supposé.**

| Vérifiable | Question au pilote |
|---|---|
| Bluetooth activé | le boîtier est-il allumé |
| Autorisation Bluetooth | sa batterie est-elle chargée |
| **Autorisation de localisation** | est-il à portée |
| | est-il déjà lié à un autre téléphone |

La localisation est **signalée dès l'échec, avec un lien vers les réglages** : c'est la cause la plus fréquente et la moins comprise, iOS l'exigeant pour scanner en Bluetooth.

Les quatre causes non vérifiables sont posées **en questions, jamais en affirmations**.

**Issue de secours** : rouler sans mesure, la séance étant marquée **non mesurée** — jamais vide, jamais à zéro.

## `/(app2)/rec/consentement` — Étape 4b · **NOUVEAU**

**Affiché la première fois seulement.** Le consentement valant jusqu'à révocation, un écran qui n'existerait que pour rappeler viole la règle du bloc sans matière. Le rappel devient une ligne sur l'appairage.

**Le flux reste donc à huit étapes** dans le cas nominal.

Porte `setBiometryCaptureConsent` et `setBiometryCoachShareConsent` — donnée sensible au sens de l'article 9.

## `/(app2)/rec/placement` — Étape 5

**424 lignes.** Écrit `startCaptureSession`. L'écran le plus critique : après lui, le boîtier enregistre.

**L'avertissement de verrouillage est en tête**, formulé précisément : ne pas appuyer sur le bouton latéral. Pas « laissez l'écran allumé », qui décrit le mauvais geste. Le verrou `expo-keep-awake` empêche la mise en veille automatique, jamais un verrouillage manuel — aucune application iOS ne le peut.

**Boîtier déconnecté au moment d'armer : l'armement est refusé**, retour à l'appairage. Cela ne bloque pas la journée, cela la route par le diagnostic, où « rouler sans mesure » reste ouvert.

**La ligne d'arrivée** se joue ici, via `captureFinishLineLogic`. Rayon de Valence à porter de 10 à 15–20 m avant la séance.

## `/(app2)/rec/roulage` — Étape 6

**275 lignes.** L'écran qu'on ne regarde pas. Trois imports seulement — aucune analyse ne tourne pendant la capture.

**Il affiche le chrono et le dernier tour bouclé.** *Mesure de sécurité* : **le chrono ne s'anime pas, il se fige au tour bouclé.** Rien ne défile, donc rien n'attire l'œil entre deux passages.

Plus : le point d'enregistrement, les tours détectés, l'état de la liaison.

**Perte de boîtier : reprise silencieuse, aucune alerte au volant.** Le pilote ne peut rien y faire à 180 km/h.

**Seuil d'interruption** : la durée sans trame dépasse le **tour de référence du pilote sur ce circuit**, repli en secondes si inconnu. Le critère ne peut pas être « un tour manqué » compté — sans trames, on ne compte pas.

**L'arrêt propose les deux** : entre-runs, ou l'accueil.

**Vérification en attente** : `captureLinkStatusLogic` traite-t-il le boîtier connecté mais muet, distinct d'une déconnexion ?

## `/(app2)/rec/entre-runs` — Étape 7

**431 lignes.** Écrit `addNote`. Drapeau `biometry`.

**Le QCM de ressenti n'existe pas** — seul `addNote`, du texte libre, existe. Or un texte libre ne se croise pas : « sur quatorze runs, vous avez nommé le freinage neuf fois » est incalculable sur de la prose.

**Le ressenti structuré étend `pilot_notes`** — même geste, même moment, même séance.

**L'écran s'ouvre sur la question seule**, chiffres masqués, passable en haut à droite. Deux questions, trois à quatre cibles larges. Aucune option ne juge : « plus difficile » décrit un état, un run peut être plus difficile et meilleur.

**Au premier run de la journée**, la question de comparaison n'a pas de référence : seule la zone d'attention est posée.

**Puis le cadran de pause en chiffre roi** — le seul chiffre roi décroissant de l'application. Il reste factuel : « prochain départ à 14h20, dans 8 min », jamais une pression. « — » si l'horaire est inconnu.

En dessous : le meilleur tour du jour, la biométrie si le drapeau et le consentement le permettent.

**La note libre reste à côté du QCM, jamais à sa place.**

**Un ressenti passé se rattrape depuis le carnet.**

## `/(app2)/rec/fin` — Étape 8

**678 lignes.** Porte `incidentService`, `incidentOffline`, `healthKitService`, `bio1Trigger`. Écrit `saveSamples`.

**HealthKit se lit ici** : la fréquence cardiaque n'est pas capturée en direct, elle est **relue après coup**. Plus sobre que prévu.

**Quatre actes, dans cet ordre.**

*Signaler, si nécessaire* — l'incident vient en premier parce qu'il est urgent et qu'on l'oublie une fois rentré.
*Résumer la journée* — runs, tours, distance, meilleur tour. La journée devient une trace.
*Poser la variable de la prochaine fois* — avec préséance : si le coach en a posé une, elle est montrée et peut être gardée ou remplacée. **En cas de divergence, la variable du pilote prime.**
*Raccrocher à l'inscription* — `registration_id` se pose, `status` bascule à `attended` par transition gardée.

**Clôture proposée au premier des deux événements** : fin de la plage horaire (`sessions.end_time`) ou inactivité prolongée. Le pilote confirme.

### Les incidents

**Périmètre : tout événement anormal** — sortie de piste, contact, casse, **malaise**.

**Deux conséquences lourdes.** Le malaise est une **donnée de santé au sens de l'article 9** : rétention bornée, accès restreint, consentement explicite pour tout partage. Et l'accès du coach ne peut donc pas reposer sur `is_coach_of()` seul — il lui faut la même garde que la biométrie : **niveau détaillé plus consentement de partage**.

**Vus par l'administrateur et le coach du pilote.**

**Signalables à tout moment.** Le hub REC étant invisible et la barre disparaissant en roulage, il faut une **affordance permanente** pendant la journée — sur chaque écran du flux, ou dans le Pass.

---

# V. CLUB

## `/(app2)/club` — Le hub

**646 lignes.** Il ne sort aujourd'hui que vers **trois de ses sept enfants**.

**Fonction énonçable** : votre appartenance, ce que vous partagez, et ce que le club vous ouvre.

**Trois couches** :

*Ce que vous possédez* — **le Pass, en tête, en pleine largeur.** Le bouton central l'ouvre : c'est l'écran le plus important du Club, pas un item parmi sept.
*Ce que vous partagez* — coach, amis et roulages, comparaison, galerie.
*Ce que vous découvrez* — partenaires, territoire, routes.

Cette structure rend une entrée aux deux orphelins et libère `roulages` de sa dépendance à une notification.

## `/(app2)/club/pass`

**496 lignes.** Drapeau `app_payments`.

**Il existe dès maintenant, sans attendre le paiement** : c'est l'écran de ce que le pilote **possède**, avant d'être un objet de vente.

**Quatre choses** : votre appartenance — statut fondateur, palier, numéro de voiture · vos journées à venir, la prochaine en tête avec créneau, offre et **QR de pointage** · le chemin pour réserver.

**Ni la décharge — elle reste dans VOUS — ni l'historique — il appartient à la Saison.**

**À corriger** : il lit `eventsService`, donc `events`. Un pass de journée de circuit doit lire `registrations` et `sessions`.

**Quand `app_payments` est fermé** : un **lien vers le site, avec le chemin exact**. Jamais un bouton mort.

## `/(app2)/club/coachs` — **NOUVEAU**

L'annuaire, scindé de `club/coaching` (1 267 lignes).

**Pour un pilote sans coach.** Les coachs vérifiés, leurs spécialités, leurs circuits.

**Deux validations tierces, aucune n'est une note.** *La vérification OXV*, faite une fois à l'entrée dans le club, marqueur « Profil vérifié » sans date. *Les faits d'activité*, dérivés de `coaching_bookings` : « 12 séances accompagnées cette saison, sur 3 circuits » — un relevé, que le coach ne peut pas écrire lui-même.

**`coach_testimonials` est supprimée.**

**Risque assumé** : le profil reste modifiable après vérification et le marqueur ne porte pas de date. OXV cautionne donc des contenus qu'il n'a pas vus.

Une action : demander une affiliation.

## `/(app2)/club/mon-coach` — **NOUVEAU**

La relation, scindée de `club/coaching`.

Votre coach, vos séances partagées, vos échanges, vos factures — **la facturation passe en feuille**, elle est rare et administrative.

**Les consentements se lisent en une phrase et se changent d'un geste** — « il voit vos séances, votre télémétrie, votre cardio et votre carnet ». Jamais une liste de cases.

**Deux niveaux** : simple, détaillé. Le détaillé porte le cardio **et le carnet**.

**Plusieurs coachs possibles, un seul actif par journée.** La désignation vit dans une **table dédiée par journée**, posée par le pilote **à la préparation**. Sa contrainte d'unicité sur le couple pilote-journée *est* la règle — elle ne s'applique pas par convention, elle est impossible à violer.

**Conséquence majeure** : le canal `live:session:` n'ayant plus qu'un auditeur, la règle biométrie « tout ou rien » perd son objet. *À revérifier dans le code du relais avant de la lever.*

## `/(app2)/club/roulages` — Les amis

**1 033 lignes.** Devient l'écran **des amis**, pas des roulages.

*Vos amis* — avec **la réciprocité affichée** : ce que chacun a ouvert à l'autre. L'amitié étant le consentement, elle doit se voir.
*Qui roule quand* — les journées où un ami est inscrit, et celles où vous l'êtes tous les deux.
*La comparaison* — un geste depuis chaque ami.

**Les convois déménagent ici**, quittant le Territoire : aller au circuit ensemble est une affaire d'amis, pas de lieux.

**Deux consentements de visibilité** : *amitié* — accès aux données · *club* — présence publique aux journées. **Défaut : club, ouvert à tous.**

*Réserve* : l'article 25 du RGPD impose la protection par défaut et vise l'accessibilité « à un nombre indéterminé de personnes ». Un club fermé n'en est pas un — position défendable, à confirmer par l'avocat.

## `/(app2)/club/comparer` — **NOUVEAU**

La comparaison entre amis, sortie de `data/comparer`.

**Deux colonnes, aucun vainqueur, aucun delta coloré.** Le filtre par paire circuit-véhicule s'applique.

**Aucune trace, aucune table.** L'amitié suffit comme consentement.

## `/(app2)/club/territoire`

**1 428 lignes**, le plus gros orphelin. Il garde **le circuit et son entourage** :

*Le circuit* — services, accès, horaires.
*Autour* — hébergements, restaurants. **`is_premium` supprimé sur les quatre tables** : un lieu ne se distingue jamais par ce qu'il a payé. C'est un vestige d'un modèle abandonné par décision du 12 juillet 2026 — « régie 100 % saison ».
*Les annonces* — `social_pings`, **réservées aux partenaires**, règles éditoriales portées par le contrat.

**Les convois et les belles routes le quittent.**

**`attendancePublicService` — la présence publique** : elle reste, sous le consentement de visibilité club.

## `/(app2)/club/routes` — **NOUVEAU**

**Les belles routes**, enrichies d'une **saisie d'itinéraire souhaité** en plus des critères existants. Portées depuis V1 avec `creer-route`, `creer-trace`, `mes-routes` et leur certification.

**Et les balades** — c'est le domicile de `events`, que rien n'hébergeait dans l'application.

## `/(app2)/club/galerie`

**1 003 lignes**, orphelin. Son unique sortie est elle-même : les photos sont un cul-de-sac.

**`useHeritageBook` y vit** — le livret de saison existe déjà, nous le croyions à créer.

**Par journée**, pas en mur continu. **Chaque photo ouvre sa séance** — ce qui relie l'émotion à la mesure. **Le livret de saison en tête**, une fois la saison finie.

**ThumbHash s'applique ici en premier** : c'est l'écran le plus dense en images, et celui où l'aplat unique se voit le plus.

## `/(app2)/club/partenaires`

**460 lignes** aujourd'hui — le catalogue dessiné le fera grossir.

**Vocabulaire figé** : `type` en trois valeurs · `contact_policy` en cinq modes · `channel` en cinq origines.

**La fiche d'offre est un écran** — contenu riche, lien profond partageable.

**Après la mise en relation : un état persistant.** Le pilote voit qu'il attend une réponse. **Une section « vos demandes »** dans cet écran.

**Aucune urgence fabriquée**, même si un partenaire l'exige — position contractuelle.

---

# VI. RÉSERVER

**Trois écrans**, entièrement redéfinis.

## Le modèle : dossier complet dans l'application, facturation sur le site

L'application **connaît le pilote** — garage, documents, éligibilité, numéro — et constitue le dossier en trois gestes. Le site **sait encaisser**.

**Cela évacue la question de la commission Apple** : aucun paiement dans l'application, donc aucune appréciation en revue.

**Le panier pré-rempli.** L'authentification Supabase étant partagée, le pilote se connecte au site et **trouve sa demande déjà rédigée**. Rien à ressaisir, aucune perte en route. Effet secondaire : cela rend `pair-app` moins critique pour ce parcours.

**Complétude bloquante, mais sur le dossier seulement** : offre, créneau, véhicule, identité. **La décharge est demandée, non bloquante** — un pilote réserve en mars pour rouler en avril, et le drapeau `pilot_waivers` est fermé. Si la complétude confondait les deux, plus aucune réservation ne serait possible.

**Le prix ne se calcule pas dans l'application** — sinon il devient modifiable par le client.

**Le pilote atteint le paiement par les trois canaux** : lien profond, courriel, notification « votre journée ».

**Il peut modifier après transmission.** Règle de propriété : **le dossier appartient à l'application tant qu'il n'est pas payé, au site une fois payé.**

**`reserver/paiement` ne paie plus rien** : il dit où trouver sa demande sur le site.

**Point à trancher avec le site** : l'application écrit-elle directement dans `registrations` ? C'est la 148ᵉ demande du dossier de raccordement, et l'une des rares bloquantes.

---

# VII. VOUS

## `/(app2)/vous` — Le hub

**643 lignes.** Le seul hub qui fonctionne — il sort vers ses huit enfants.

**Fonction : ce qui est à vous et qui ne se mesure pas.**

**Trois couches** : *qui vous êtes* — profil, statut fondateur, numéro · *ce que vous avez* — garage, matériel · *vos papiers et réglages* — documents, décharge, notifications, visibilité, support.

**Le hub montre ce qui manque** : document expiré, décharge non signée, véhicule sans photo. C'est l'endroit où l'incomplet se voit, puisque c'est l'endroit où l'on complète.

## `/(app2)/vous/profil`

**830 lignes** — et **aucun service, hook ni magasin importé**.

**Anomalie à vérifier avant toute refonte** : on ne redessine pas un écran dont on ignore s'il affiche des données réelles.

**Contenu** : nom, pseudonyme public, numéro de voiture, photo, statut fondateur, biographie, visibilité à deux niveaux.

**Trois colonnes existent en base et ne sont câblées nulle part** : `bio`, `car_number`, `pavilion_name_optin`. La migration est appliquée ; le code garde un repli 42703 inutile. **Le numéro reste à trancher avec le site**, qui le collecte à l'inscription.

## `/(app2)/vous/garage`

**979 lignes** — même anomalie, aucun import, mais il écrit `addMyPilotMedia`.

**Vos véhicules, leurs photos, et le véhicule principal** — colonne qui n'existe pas, `garageService` n'ayant ni `is_primary` ni `setPrimary`.

**Le garage porte aussi le filtre** : depuis un véhicule, un raccourci vers ses données. On regarde sa voiture, on veut voir ce qu'elle a fait.

## `/(app2)/vous/equipement` → **« Votre matériel »**

**423 lignes.** Renommé : **deux écrans s'appelaient « équipement »**, celui-ci et celui de REC, sans rien de commun.

**Un inventaire** : casque et sa date de péremption, combinaison, HANS, boîtier personnel.

**Il devient une source d'éligibilité** — un casque périmé est un item que la préparation doit lire. C'est le lien qui manque aujourd'hui.

## `/(app2)/vous/documents` · `document/[doc]` · `decharge`

Un seul sujet : **vos papiers**, et ils alimentent l'éligibilité.

**Le document est le support, l'item d'éligibilité est son état à une date.** Le pilote dépose son attestation ; la préparation lit qu'elle existe et n'est pas périmée ; l'admin contrôle et pose `validated_by`. **Le lien existe déjà en base** : `eligibility_items.document_id` référence `public.documents`.

**Le document porte sa date d'expiration, l'éligibilité la lit.**

**Alerte d'expiration : notification dès qu'un document expire**, sans attendre qu'une journée soit réservée.

**La décharge** — 503 lignes, drapeau `pilot_waivers` fermé, en attente de l'avocat.

Elle **ne bloque pas la réservation**, mais bloque la piste : c'est un item d'éligibilité.

**Une signature vaut définitivement**, sans resignature imposée. *Mais la version signée doit être enregistrée* : en cas de litige, il faut produire **le texte exact accepté**, et une date seule ne le permet pas. Point porté à l'avocat.

## `/(app2)/vous/fondateur`

**473 lignes**, drapeau `founders` fermé, écrit `apply`.

**Le fondateur est un statut, pas un espace.** Cet écran est la **candidature** ; le statut vit sur le profil, avec `founder_since` et le numéro **privé**.

**473 lignes sont excessives** pour une motivation, un code de parrainage et un envoi : c'est une feuille depuis le profil, pas une destination.

## `/(app2)/vous/reglages`

**675 lignes.** Porte `reglagesRitualsLogic`, `reglagesConsentLogic`, `useReglages`.

**Il porte** : les quatre canaux de notification — séance, journée, club, coach, tous actifs par défaut · la visibilité à deux niveaux · le fuseau horaire, nécessaire au report nocturne 22 h – 8 h · l'export RGPD.

**Chaque réglage porte sa conséquence en une phrase** — « vos amis voient les journées où vous êtes inscrit », jamais « visibilité de l'agenda ».

**Les « rituels » sont à éclaircir** avant toute refonte.

## `/(app2)/vous/support`

**506 lignes.** Aide, contact, mentions. Le seul écran sans enjeu.

## `/(app2)/dev-galerie`

**764 lignes**, coupée hors développement. **Conservée** — elle sert au développement.

---

# VIII. RÉCAPITULATIF

## Six écrans naissent

| Écran | Origine |
|---|---|
| `rec/appairage` | scindé de `rec/equipement` |
| `rec/consentement` | scindé, première fois seulement |
| `club/coachs` | l'annuaire, scindé de `club/coaching` |
| `club/mon-coach` | la relation, scindé de `club/coaching` |
| `club/comparer` | la comparaison entre amis |
| `club/routes` | belles routes et balades |

## Deux disparaissent

`data/saison` fusionne dans le hub Data. `club/coaching` se scinde et cesse d'exister.

**De 36 à 40 écrans de production.**

## Trois écrans changent de zone

Le **carnet** monte de VOUS vers Data. Les **convois** passent du Territoire aux amis. Les **belles routes** quittent le Territoire.

---

# IX. VÉRIFICATIONS — RÉSULTAT DU 26 JUILLET

Le rapport `docs/VERIFICATIONS_V3.md` a répondu à quatorze questions. Résumé de ce qui change.

## Ce qui est résolu

| # | Objet | Résultat |
|---|---|---|
| 1 | `vous/profil` et `vous/garage` « sans import » | **Faux — artefact d'extraction.** Les imports multi-lignes n'étaient pas détectés. `profil` lit `@/lib/queries/profil` (`:42`), `pilotMediaService` (`:48`), `profilLogic` (`:61`) ; `garage` lit `garageService` (`:55`), `pilotMediaService` (`:61`), `garageLogic` (`:76`). **Écrans fonctionnels.** |
| 2 | `weatherCorrelationService` | **Aucun coefficient.** C'est une **jointure** : une ligne par séance, chrono mesuré et météo mesurée côte à côte. Trois garanties dans l'en-tête — self-only, strict (une panne remonte au lieu d'être masquée en agrégat vide), agrégation en logique pure. **Doctrinalement propre.** |
| 4 | Où vit l'éligibilité | `public.eligibility_items`, migration `20260703200426`. **Neuf** items, quatre statuts, clé sur `registration_id`. Consommée par `preparationLogic`, `miroirHomeLogic`, `useMiroirHome`, plus une tâche de relance. |
| 5 | `dataExportService` | **Portabilité RGPD article 20.** JSON structuré, partage natif, sans backend. Exclut `telemetry_frames` (rétention 12 mois, sur demande). **Va dans VOUS.** |
| 6 | `reglagesRitualsLogic` | Préférences fines de notification dans `users.notification_preferences` (JSONB). `bilan` → `debrief`, `j3` → `ritual_j3`. **Le stockage existe.** |
| 7 | `referralService` | **Parrainage et écuries.** RPC `oxv_get_my_referral_code`, `oxv_redeem_referral`. Toute la logique est serveur, fail-closed. Voir IV.19 du dossier de travail. |
| 10 | La liste des orphelins | **Corrigée.** Les six écrans coach ne sont pas orphelins : ils sont reliés par une grille de tuiles (`app/(coach)/index.tsx:514`). `club/coaching` l'est aussi, par deux chemins. |
| 12 | Provenance de l'éligibilité | `validated_by` et `validated_at` existent, plus `document_id` vers `documents`. **Une seule colonne à ajouter : `declared_at`.** |

## Les orphelins réels — quatre, pas dix

| Route | Lignes |
|---|---|
| `/(app2)/club/territoire` | 1 428 |
| `/(app2)/data/saison` | 1 308 |
| `/(app2)/club/galerie` | 1 003 |
| `/(app2)/dev-galerie` | 764 · garde `__DEV__` |

**4 503 lignes**, dont 3 739 hors écran de développement. **Aucun orphelin côté coach.**

## Ce qui reste inconnu

| # | Objet | Ce qui manquerait |
|---|---|---|
| 3 | `captureLinkStatusLogic` | l'écran n'importe qu'une fonction, `captureLinkMessage`, qui produit un message et non un état. **Lire le fichier et son test**, qui énumère probablement les cas |
| 13 | **Marge et QDI** | `qdiLogic.ts` ne contient **aucune occurrence** de `margin` ni `marge` — le QDI ne consomme pas la marge par un chemin nommé. Reste à savoir s'ils partagent une **entrée commune** en amont. Lire `qdiLogic.ts` en entier et le confronter à `src/trackviz/analysis.ts` |
| — | `correlateWeather` | son contenu dans `weatherCorrelationLogic.ts` n'a pas été lu ; une phrase ou une tendance s'y trouverait |
| — | L'avantage du parrainage | rien dans le service ne le décrit. `crews` et `crew_members` sont à **zéro ligne** |
| — | Qui écrit `eligibility_items` | aucun écran de `(app2)` ne l'écrit. Le commentaire de table attribue l'écriture à l'admin et au système — vérifier si le site l'exerce |

## Deux faits techniques qui pèsent

**`src/circuit/hauteSaintonge.ts` porte de la géométrie**, pas des noms : **73 points lat/lon** à sept décimales, OSM way 54412766, tracé fermé. **Sous licence ODbL** — toute remontée en base transporte l'obligation d'attribution à OpenStreetMap. Les noms de virages vivent ailleurs, dans `circuitTopology.ts` (`BELTOISE_CORNERS`).

**Trente mégaoctets sont supprimables.** `three` (29 Mo) et `@react-three/fiber` (996 Ko) ne sont importés que par `src/circuit/CircuitTrace.tsx`, monté uniquement depuis l'arbre gelé. **Aucun écran de `(app2)` ne les touche.** `expo-gl` n'est dans aucun import — il est tiré transitivement.

**Et la technique du ruban n'existe pas** : dans les 23 fichiers Skia, `Vertices`, `Atlas`, `RuntimeEffect`, `Picture` et `useFont` totalisent **zéro occurrence**. Tout le rendu identitaire est à écrire.

| Dépendance | Fichiers | Note |
|---|---|---|
| `react-native-svg` | **79** | la plus grande surface de migration |
| `react-native-reanimated` | **61** | `createWorkletRuntime` : zéro |
| `@shopify/react-native-skia` | 23 | APIs avancées : zéro |
| `expo-av` | **2** | `Audio` seulement, aucun usage vidéo — **migration triviale** |
| `react-native-mmkv` | 1 direct, 15 consommateurs | la file de capture repose sur `expo-file-system`, **pas** sur MMKV |
| `react-native-maps` | 3 écrans | un seul actif : `club/territoire` |
| `react-native-webview` | 1 écran | `coach/ar`, qui encapsule `https://app.oxvehicle.fr/ar-view` |
