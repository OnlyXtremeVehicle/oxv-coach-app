OXV  /  MIRROR
TÉLÉMÉTRIE PILOTE
NOUVELLE GÉNÉRATION
Veille professionnelle, catalogue des présentations, méthodes de calcul
et architecture du coach connecté
RaceBox Mini S · restitution post-trackday · direct coach · innovation produit
Version 1.0  |  25 août 2026  |  Document de conception OXV
DOCUMENT DE TRAVAIL — seuils algorithmiques et objectifs de latence à valider sur piste.
# 00  Décision produit
Le meilleur produit n’est pas celui qui affiche le plus de télémétrie : c’est celui qui transforme une mesure fiable en une action que le pilote peut reproduire.
| RECOMMANDATION CENTRALE Construire OXV Mirror en trois surfaces complémentaires : un débrief pilote en 90 secondes, un espace coach de 10 minutes avec preuves synchronisées, puis un atelier d’analyse avancée. Le direct doit venir après la fiabilité du post-run, mais son architecture doit être prévue dès le premier prototype. |
|---|

- Positionnement : une restitution premium et pédagogique de trackday, inspirée des méthodes de compétition sans prétendre reproduire la quantité de capteurs d’une F1
- Avantage OXV : le coach humain reste responsable de la consigne ; l’IA trie, explique et prépare les preuves, sans inventer de canal absent
- Socle matériel : le RaceBox Mini S couvre le mouvement du véhicule et la trajectoire ; une option CAN/OBD complétera plus tard les commandes du pilote et l’état du véhicule
- Promesse pilote : comprendre où le temps est perdu, pourquoi, quoi changer, puis vérifier que le changement fonctionne plusieurs tours
- Promesse opérationnelle : 20 pilotes peuvent être servis par 20 boîtiers et 20 passerelles mobiles ; le BLE reste local à chaque voiture, le réseau assure la remontée vers le coach
| Livrable | Lecture | Question résolue | Audience |
|---|---|---|---|
| Mirror Flash | 60–90 s | Quels sont mes trois gains prioritaires ? | Pilote |
| Mirror Coach | 8–12 min | Quelle cause, quelle consigne, quelle preuve ? | Pilote + coach |
| Mirror Lab | libre | Comment comparer tours, pilotes, conditions et réglages ? | Coach / analyste |
| Mirror Live | continu | Que surveiller et quand intervenir sans distraire ? | Coach |
| Mirror Story | 2–4 min | Comment restituer une expérience premium au client ? | Client / privé |

# 01  Ce que font réellement les programmes professionnels
Les écrans internes des grandes écuries restent propriétaires. Cette veille s’appuie uniquement sur les pratiques publiquement documentées par les équipes et les plateformes utilisées au plus haut niveau.
Mercedes-AMG F1  distingue la télémétrie live, annoncée à environ 10 ms au garage et 30 ms aux usines européennes, du déchargement complet après le run. Le programme de roulage est défini avant la session et chaque changement vise un problème identifié. À reprendre : séparer surveillance immédiate, analyse complète et plan de run — pas le volume de données d’une F1. [S22]
McLaren Racing  décrit un débrief après chaque session : démarrage environ 20 minutes après, sujets urgents d’abord, puis verdict des pilotes, ingénieurs et spécialistes, pour environ 40 minutes. OXV doit automatiser la préparation et faire remonter en premier ce qui conditionne le run suivant. [S23]
Motion Applied / ATLAS  organise le travail autour de l’overlay live/historique, des alarmes, marqueurs, paramètres virtuels, stockage structuré, API et diffusion multi-clients. OXV Mirror doit reprendre cette architecture logique en version légère et orientée pilote. [S6–S10]
Formula 1 / graphiques de performance  documente une chaîne propre : nettoyer les données, appliquer des modèles physiques, puis transformer un résultat complexe en représentation compréhensible. La simplification est légitime seulement si la méthode et la confiance restent consultables. [S24]
| DOCTRINE OXV Le pilote ne doit pas recevoir la console d’un ingénieur. Il doit recevoir le verdict d’un ingénieur, avec la possibilité d’ouvrir la preuve. Une note sur 100 sans explication ne vaut rien ; une consigne sans canal mesuré doit être marquée comme hypothèse. |
|---|

| Référence | Méthode observée | À intégrer | À éviter |
|---|---|---|---|
| ATLAS | Live/historique, alarmes, marqueurs, paramètres calculés, store/API | Séparer brut, dérivés, vues et collaboration | Copier l’ergonomie ingénieur telle quelle |
| Cosworth Pi | >20 vues, maths/événements, live, cartes, rapports | Moteur de vues coach configurables | Exposer tout au pilote |
| Bosch WinDarab | Temps/distance, scatter, histogramme, FFT, segmentation | Lab avancé et canaux versionnés | FFT/3D sans besoin réel |
| MoTeC i2 | Workbooks, overlays, gain/perte, balises GPS, vidéo, CAN | Espaces de travail par rôle | Configuration manuelle complexe |
| AiM RS3 | Curseur commun trace/carte/vidéo/splits/histogrammes | Navigation synchronisée | Panneaux sans hiérarchie |
| VBOX | Idéal/multi-lap, vidéo côte à côte, ligne, maths | Expérience conducteur directe | Tour idéal présenté réalisable |
| Garmin | Top 3, audio, True Optimal Lap vidéo | Priorisation et tour suivant | Messages en zone de charge |
| Porsche PTPA | Position + véhicule + vidéo, référence personnelle | Future couche CAN | Attribuer ces canaux au Mini S |
| APEX Pro | Feedback, CrewView, OBD-II | Vue équipe légère | Score non explicable |
| Track Titan / trophi | Flux guidés, références, IA sur traces, voix | IA pédagogue | Texte sans preuve |

# 02  RaceBox Mini S : capacités, limites et contrat de vérité
Le protocole officiel révision 9 est assez ouvert pour une intégration directe dans OXV Mirror. Il impose une gestion rigoureuse du BLE, de la qualité GNSS et de la sécurité mémoire.
Figure 1 — Les trois couches de données à ne jamais confondre.
| Canal Mini S | Unité / débit | Usage OXV | Contrôle qualité |
|---|---|---|---|
| Temps UTC + iTOW | jusqu’à 25 Hz | horodatage, tours, secteurs, média | validité, monotonie, dérive |
| Latitude / longitude | facteur 10⁷ | trajectoire, distance s, écart n | fix 3D, hAcc, PDOP, satellites |
| Altitude WGS / MSL | millimètres | pente et contexte | faible confiance verticale, lissage |
| Vitesse | mm/s | trace, freinage, mini et sortie | speed accuracy, trous, plausibilité |
| Cap | 10⁻⁵ degré | direction, courbure, map matching | heading accuracy, basse vitesse |
| Gx / Gy / Gz | milli-g à 25 Hz | décélération, latéral, G-G | zéro, orientation, filtre |
| Roll/pitch/yaw rate | 0,01°/s à 25 Hz | rotation, transitions | orientation, bruit, saturation |
| Qualité GNSS | flags et estimations | confiance par zone | jamais masquée |
| Batterie / mémoire | % / messages | prévol et flotte | alerte et réconciliation |

Spécifications confirmées  BLE 5.2 compatible 4.2, portée annoncée jusqu’à 20 m, batterie annoncée à plus de 20 h, GNSS multi-constellation à 25 Hz, accéléromètre et gyroscope échantillonnés en interne à 1 kHz puis moyennés vers la sortie 25 Hz, stockage Mini S de 130 minutes à 25 Hz ou 325 minutes à 10 Hz. [S1–S2]
Intégration BLE  le client s’abonne au TX UART-over-BLE, reconstitue les paquets UBX fragmentés ou concaténés, vérifie le checksum, puis parse le message 0xFF/0x01 de 80 octets. Grand MTU et intervalle bas sont recommandés. Ne pas utiliser simultanément le protocole RaceBox et NMEA : le fabricant avertit d’un risque élevé de perte. [S2]
Direct et enregistrement  le Mini S peut enregistrer sans téléphone. Pour le direct coach, le téléphone reste connecté en BLE et transmet au serveur. Le téléchargement de la mémoire interne permet ensuite de combler les pertes réseau. [S2]
Précision  RaceBox annonce une précision pouvant atteindre 10 cm et plus de 99,5 % des mesures de temps dans le centième. OXV ne doit pas transformer cette promesse commerciale en garantie : afficher hAcc, PDOP, satellites, validité du fix et les résultats de validation face au chronométrage officiel. [S2, S5]
| INTERDICTION PRODUIT Avec le Mini S seul, les termes « pression de frein », « pédale d’accélérateur », « angle volant », « régime », « rapport », « ABS », « contrôle de traction », « température pneu/frein » ou « couple moteur » sont interdits. Employer « décélération estimée », « reprise d’accélération estimée », « rotation » et « trajectoire », avec confiance. |
|---|

# 03  Chaîne de calcul recommandée
Chaque résultat affiché doit conserver la version de l’algorithme, les échantillons sources et un niveau de confiance.
1. Acquisition  Buffer BLE, reconstitution UBX, checksum, timestamp de réception et journal brut append-only.
2. Validation  Fix 3D + flag valide, monotonie, hAcc/vAcc, PDOP, satellites, continuité, vitesse plausible.
3. Calibration  Orientation conforme, estimation du zéro, compensation gravité et contrôle à l’arrêt ; conserver brut et corrigé.
4. Normalisation  Unités SI, repère véhicule, resampling 25 Hz ; vues brute ingénieur et lissée pilote ; filtres versionnés.
5. Map matching  Projection sur la référence du circuit pour obtenir distance s et écart latéral n ; gestion croisements/branches.
6. Tours / secteurs  Porte orientée avec hystérésis, interpolation, pit/out/in-lap et invalidation explicite.
7. Événements  Freinage estimé, rotation, apex, sortie, transitions G et incidents qualité ; bornes validées coach.
8. Comparaison  Interpolation des tours sur la même grille de distance ; delta, vitesse, trajectoire et événements comparables.
9. Explication  Classer la perte par phase, quantifier l’opportunité, joindre une preuve et proposer au coach.
10. Présentation  Même moteur de vérité pour mobile, web, rapport, vidéo et direct.
## Formules et définitions minimales
| Indicateur | Principe | Interprétation |
|---|---|---|
| Delta Δt(s) | t_pilote(s) − t_référence(s) | À distance égale ; pente positive = perte locale. |
| Perte segment | Δt(sortie) − Δt(entrée) | Isole le coût sans attribuer automatiquement la cause. |
| Écart n(s) | distance latérale signée | Placement/répétabilité ; la référence n’est pas absolue. |
| Décélération | Gx corrigé + contrôle dv/dt | Début, pic, durée, relâché estimé ; pas pression pédale. |
| Rotation | yaw + Gy + courbure | Changement de direction ; pas angle volant. |
| Apex estimé | vitesse mini / courbure selon type | Méthode affichée et coach-validée. |
| Régularité | MAD robuste | Sépare tours propres, trafic et aberrants. |
| Fluidité | RMS jerk et yaw jerk | Transitions/corrections ; dépend du filtre. |
| Confiance | GNSS × complétude × calibration × contexte | Élevée / moyenne / faible sur chaque recommandation. |

## Tour optimal réaliste
Principe  Assembler les meilleurs micro-secteurs produit souvent un tour impossible. Mirror doit assembler des blocs complets entrée–virage–sortie, vérifier la continuité vitesse/position/accélération aux jonctions, puis nommer le résultat « potentiel démontré », non « tour garanti ».
# 04  Catalogue des présentations OXV Mirror
Chaque fiche décrit une surface concrète. P0 = premier produit ; P1 = différenciation coach ; P2 = direct ; P3 = extension véhicule/ingénierie.
# 04.A  Préparer et fiabiliser
## M01  Plan de run
But pilote  Entrer en piste avec un objectif unique et observable.
Présentation  Carte du run : objectif, 1–2 virages cibles, comportement à tester, référence, critères et conditions.
Données  Profil, circuit, véhicule, conditions déclarées et sessions antérieures.
Calcul / logique  Sélection des opportunités importantes puis validation coach ; objectif formulé en action mesurable.
Interaction coach  Le coach prépare/modifie le plan et verrouille les indicateurs de réussite.
Décision permise  Savoir quoi tenter et éviter « rouler plus fort partout ».
Limite à afficher  Conditions/réglages non captés à saisir ; ce n’est pas une consigne de sécurité piste.
Priorité  P0 · MVP    Critère d’acceptation  Le pilote peut reformuler l’objectif et l’écran montre comment le prouver.
## M02  Prévol RaceBox
But pilote  Éviter une session sans donnée exploitable.
Présentation  Grands statuts : boîtier, firmware, batterie, mémoire, fixation, orientation, fix 3D, hAcc, téléphone, réseau et audio.
Données  Device Info BLE, batterie, mémoire, état GNSS, débit, orientation au repos et connectivité.
Calcul / logique  Test 15–30 s ; seuils bloquants distincts des avertissements ; court mouvement pour confirmer les axes.
Interaction coach  Coach/opérateur voit la flotte non prête avant ouverture piste.
Décision permise  Partir seulement chaîne saine ; accepter explicitement l’enregistrement seul si direct indisponible.
Limite à afficher  Vert = conditions techniques, jamais activité sans risque.
Priorité  P0 · MVP    Critère d’acceptation  Chaque run choisit : prêt, mode dégradé accepté ou captation abandonnée.
## M03  Qualité et confiance
But pilote  Savoir si une conclusion est solide.
Présentation  Ruban de confiance sur carte/traces ; score par tour ; zones hachurées si GNSS/paquets dégradés ; détails ouvrables.
Données  Fix/flags, hAcc/vAcc, PDOP, satellites, speed/heading accuracy, fréquence réelle, trous BLE et calibration.
Calcul / logique  Score pondéré versionné, pénalité par zone et couverture valide sur le segment.
Interaction coach  Le coach exclut une zone ou conserve l’observation avec commentaire.
Décision permise  Distinguer erreur de pilotage et artefact.
Limite à afficher  Ne pas compresser la qualité en score opaque : montrer les causes.
Priorité  P0 · MVP    Critère d’acceptation  Toute métrique ouvre les échantillons et motifs de confiance.
## M04  Flash Débrief
But pilote  Recevoir en 90 secondes trois enseignements utiles.
Présentation  Verdict, trois cartes opportunité, progression, régularité, prochain objectif ; preuve ouvrable.
Données  Analyses validées, contexte et annotations coach.
Calcul / logique  Classement par temps potentiel × répétition × confiance × actionnabilité ; une force et deux axes maximum.
Interaction coach  Le coach accepte, modifie ou remplace chaque carte avant diffusion premium.
Décision permise  Quitter la session avec une priorité claire.
Limite à afficher  Aucune recommandation automatique à confiance faible.
Priorité  P0 · MVP    Critère d’acceptation  En 10 s : virage, phase, écart, action et preuve.
# 04.B  Comprendre le chrono
## M05  Tableau des tours
But pilote  Comprendre le déroulé et sélectionner les tours propres.
Présentation  Chronologie : temps, secteurs, validité, delta, confiance, trafic déclaré, note, conditions.
Données  Franchissements, secteurs, vitesse max, G, qualité et tags.
Calcul / logique  Détection out/in-lap, arrêt, raccourci, écart de ligne et trous ; validation manuelle.
Interaction coach  Le coach marque trafic, chauffe, essai, incident ou tour représentatif.
Décision permise  Choisir une référence pertinente, pas nécessairement la plus rapide.
Limite à afficher  Trafic/drapeau ne sont pas inférés sans source ; employer « suspect » puis confirmer.
Priorité  P0 · MVP    Critère d’acceptation  Chaque inclusion/exclusion conserve un motif audité.
## M06  Progression de session
But pilote  Voir si la performance progresse, plafonne ou se dégrade.
Présentation  Temps/tour et secteurs avec bandes confiance ; interventions coach et changements déclarés superposés.
Données  Temps, segments, ordre, notes, conditions et pauses.
Calcul / logique  Tendance robuste séparant chauffe/tours propres ; comparaison avant/après consigne.
Interaction coach  Le coach marque l’intervention et observe effet immédiat puis rétention.
Décision permise  Poursuivre le même travail ou changer d’objectif.
Limite à afficher  Ne pas conclure « fatigue » sans mesure ; parler de tendance tardive.
Priorité  P0 · MVP    Critère d’acceptation  Performance, validité et interventions sont visuellement séparées.
## M07  Carte des opportunités
But pilote  Localiser les gains et points forts.
Présentation  Circuit coloré par gain/perte ; halo = potentiel, texture = confiance ; filtre par phase.
Données  s/n, Δt, vitesse, G, yaw, segments et référence.
Calcul / logique  Perte = variation locale du delta ; attribution phase par règles explicables.
Interaction coach  Clic coach : preuve, annotation, catégorie et consigne.
Décision permise  Prioriser deux ou trois zones réellement rentables.
Limite à afficher  Rouge = perte relative, pas danger ni faute absolue.
Priorité  P0 · MVP    Critère d’acceptation  Somme des pertes réconciliée au delta du tour dans une tolérance documentée.
## M08  Delta temps sur distance
But pilote  Voir où le chrono se gagne ou se perd.
Présentation  Δt(s), pente, secteurs/virages, mini-carte et curseur synchronisé.
Données  Temps des tours interpolés sur grille distance, qualité et événements.
Calcul / logique  Alignement par s ; lissage visuel sans changer valeur finale ; perte locale.
Interaction coach  Le coach sélectionne deux points et crée un segment annoté.
Décision permise  Distinguer perte entrée, milieu ou sortie.
Limite à afficher  Invalide si map matching saute de branche ou référence avec trafic.
Priorité  P0 · MVP    Critère d’acceptation  Carte, vitesse, vidéo et événements montrent le même instant.
## M09  Gestionnaire de références
But pilote  Se comparer à une cible adaptée.
Présentation  Meilleur personnel, médiane top 3, coach, autre pilote autorisé, conditions comparables, potentiel démontré.
Données  Sessions, véhicules, pilotes, conditions, consentements et qualité.
Calcul / logique  Score comparabilité : configuration, véhicule, conditions, date, qualité et niveau ; blocage des incompatibilités.
Interaction coach  Le coach publie la référence et précise ce qu’elle démontre.
Décision permise  Éviter une comparaison fausse ou démotivante.
Limite à afficher  Partage inter-pilotes autorisé, équitable, révocable et anonymisable.
Priorité  P0 · MVP    Critère d’acceptation  Provenance, date, véhicule, conditions et compatibilité visibles.
## M10  Potentiel démontré
But pilote  Quantifier le temps déjà montré sans promettre l’impossible.
Présentation  Tour virtuel par blocs complets ; origine de chaque bloc et jauge de faisabilité.
Données  Meilleurs segments, états jonctions, position, vitesse, G et qualité.
Calcul / logique  Optimisation sous contraintes de continuité ; pénalité de jonction ; exclusion trafic/faible confiance.
Interaction coach  Le coach choisit des blocs pédagogiques et les transforme en plan.
Décision permise  Savoir ce qui est atteignable avec les performances réalisées.
Limite à afficher  Jamais « tour garanti » ; expliquer jonctions et conditions.
Priorité  P1 · Différenciation    Critère d’acceptation  Aucune jonction hors tolérances vitesse, position et accélération.
# 04.C  Analyser le virage
## M11  Index des virages
But pilote  Balayer le circuit virage par virage.
Présentation  Liste avec perte, confiance, vitesses entrée/min/sortie, régularité, phase dominante et acquis.
Données  Segmentation coach, événements, références et objectifs.
Calcul / logique  Agrégation robuste sur tours propres ; classement par opportunité et répétition.
Interaction coach  Le coach renomme, fusionne un complexe et fixe le vocabulaire local.
Décision permise  Choisir le prochain objectif.
Limite à afficher  Une erreur fréquente à faible coût ne masque pas une occasion rentable.
Priorité  P0 · MVP    Critère d’acceptation  Chaque ligne ouvre la fiche dans le même repère s/n.
## M12  Fiche virage 360°
But pilote  Comprendre un virage comme séquence.
Présentation  Carte locale et phases approche, décélération, rotation, apex, sortie ; delta/vitesse/G alignés.
Données  Position, vitesse, G, yaw, référence, événements et annotations.
Calcul / logique  Découpage stable ; perte par phase ; corrélation sans causalité automatique.
Interaction coach  Le coach déplace les bornes, ajoute un repère réel et valide la consigne.
Décision permise  Relier chrono à geste ou placement.
Limite à afficher  Sans vidéo/pédales, certaines causes restent alternatives et doivent être affichées.
Priorité  P0 · MVP    Critère d’acceptation  Verdict = phase + écart + preuve + confiance.
## M13  Freinage estimé
But pilote  Stabiliser point, intensité et durée de décélération.
Présentation  Débuts sur carte, distance apex, Gx/vitesse et nuage répétabilité.
Données  Gx corrigé, dv/dt, s, vitesse, pente estimée et référence.
Calcul / logique  Début par seuil soutenu et chute vitesse ; pic, aire, durée, distance et dispersion.
Interaction coach  Le coach fixe un repère et distingue plus tard, plus fort ou plus court.
Décision permise  Choisir un freinage répétable compatible avec la rotation.
Limite à afficher  Événement de décélération, pas pression pédale ; pente/traînée influencent.
Priorité  P0 · MVP    Critère d’acceptation  Début stable face au bruit et corrigeable manuellement.
## M14  Relâché / trail estimé
But pilote  Comprendre la transition ralentir-tourner.
Présentation  Diagramme Gx–Gy coloré dans le temps, relâché, chevauchement et référence.
Données  Gx, Gy, yaw, vitesse et phases.
Calcul / logique  Chevauchement décélération/latéral, pente relâché et moment rotation ; classification prudente.
Interaction coach  Le coach identifie relâché brusque, long ou précoce et crée un exercice.
Décision permise  Fluidifier mise en appui et préserver vitesse d’entrée.
Limite à afficher  Sans pression frein : afficher « chevauchement décélération/rotation estimé ».
Priorité  P1 · Différenciation    Critère d’acceptation  Proposer une explication alternative si le signal ne suffit pas.
## M15  Rotation et stabilité
But pilote  Voir quand et comment la voiture change de direction.
Présentation  Yaw, Gy, vitesse et trajectoire ; début, pic, oscillations et stabilisation.
Données  Yaw rate/jerk, Gy, cap et courbure.
Calcul / logique  Détection rotation/corrections à vitesse et position similaires.
Interaction coach  Le coach distingue rotation tardive, insuffisante ou corrections multiples.
Décision permise  Réduire corrections et préparer la sortie.
Limite à afficher  Pas de diagnostic certain sous/survirage sans volant et modèle pneus.
Priorité  P1 · Différenciation    Critère d’acceptation  Labels sous/survirage interdits en RaceBox seul.
## M16  Apex et vitesse minimale
But pilote  Caler le point lent et le placement.
Présentation  Apex géométrique coach, apex trajectoire, vitesse mini et pic Gy.
Données  s/n, vitesse, courbure, Gy, yaw et définition piste.
Calcul / logique  Plusieurs définitions ; afficher celle utilisée et leur décalage.
Interaction coach  Le coach choisit selon virage simple, double apex ou courbe continue.
Décision permise  Voir si le pilote ralentit tôt/longtemps ou place mal le point lent.
Limite à afficher  Vitesse minimale ≠ toujours apex réel.
Priorité  P0 · MVP    Critère d’acceptation  Apex multiples éditables sans retraiter le brut.
## M17  Sortie et traction estimée
But pilote  Maximiser la vitesse conservée sur la portion suivante.
Présentation  Vitesse/Gx après apex, délai de reprise, vitesses à distances fixes et delta aval.
Données  Vitesse, Gx, Gy, yaw, s et référence.
Calcul / logique  Reprise par accélération soutenue et décharge latérale ; coût jusqu’au prochain freinage.
Interaction coach  Le coach relie l’entrée à son coût de sortie et peut privilégier « sacrifier l’entrée ».
Décision permise  Juger la sortie par la ligne droite suivante.
Limite à afficher  Sans pédale/couple, dire « reprise observée », pas « gaz trop tard ».
Priorité  P0 · MVP    Critère d’acceptation  Quantifier le coût aval, pas seulement le virage.
## M18  Trajectoire et placement
But pilote  Comparer la ligne suivie à une référence.
Présentation  Carte piste, traces, n(s), couloirs répétabilité et curseur commun.
Données  Latitude/longitude, hAcc, centerline, largeur et référence.
Calcul / logique  Projection Frenet, correction offsets et couloir percentile.
Interaction coach  Le coach dessine une zone cible et ajoute un repère piste.
Décision permise  Améliorer entrée, corde et ouverture sortie.
Limite à afficher  Toujours afficher le corridor d’incertitude GNSS.
Priorité  P0 · MVP    Critère d’acceptation  Aucun écart inférieur à l’incertitude présenté significatif.
## M19  Trace vitesse professionnelle
But pilote  Lire le profil complet sans se perdre.
Présentation  Vitesse/distance, deux tours par défaut, lignes virages, delta vitesse, événements et zoom.
Données  Vitesse, s, secteurs, événements et référence.
Calcul / logique  Interpolation commune, différentiel et statistiques de zone ; curseur partagé.
Interaction coach  Le coach crée un snapshot annoté pour le rapport.
Décision permise  Voir freinage, vitesse mini et sortie d’un regard.
Limite à afficher  Plus vite n’est pas toujours mieux si la sortie est compromise.
Priorité  P0 · MVP    Critère d’acceptation  Mode pilote lisible mobile ; Lab accepte plus de traces.
## M20  Enveloppe d’adhérence G-G
But pilote  Comprendre l’utilisation combinée du grip.
Présentation  Nuage Gy/Gx par phase/vitesse, enveloppe percentile, comparaison et animation carte.
Données  Gx/Gy corrigés, vitesse, phase et qualité.
Calcul / logique  Enveloppe robuste par classes vitesse ; temps près enveloppe et qualité des transitions.
Interaction coach  Le coach explique freinage en ligne, combinaison, décharge et reprise.
Décision permise  Utiliser davantage l’adhérence progressivement.
Limite à afficher  Le G-G mélange pilote, véhicule, pneus et piste.
Priorité  P1 · Différenciation    Critère d’acceptation  Comparaisons seulement entre classes vitesse/conditions compatibles.
## M21  Fluidité et corrections
But pilote  Réduire gestes brusques et pertes de stabilité.
Présentation  Jerk longitudinal/lateral, yaw jerk, oscillations et zones répétées.
Données  Dérivées filtrées de G/yaw, vitesse et événements.
Calcul / logique  RMS/percentiles sur fenêtres ; détection d’alternances ; filtre versionné.
Interaction coach  Le coach vérifie vidéo/trajectoire avant de qualifier une correction.
Décision permise  Rendre les transitions plus progressives.
Limite à afficher  Vibreur, bosse ou bordure peut créer du jerk sans erreur pilote.
Priorité  P1 · Différenciation    Critère d’acceptation  Chaque événement ouvre qualité, ligne et vidéo.
# 04.D  Apprendre et restituer
## M22  Régularité et répétabilité
But pilote  Transformer un meilleur tour isolé en niveau réel.
Présentation  Matrice tours × virages, dispersion freinage/apex/sortie, MAD et profil constance.
Données  Événements des tours propres, temps, contexte et qualité.
Calcul / logique  Statistiques robustes ; séparation vitesse/position ; avant/après coaching.
Interaction coach  Le coach fixe une tolérance par niveau et type de virage.
Décision permise  Choisir vitesse pure ou capacité à répéter.
Limite à afficher  Ne pas mélanger trafic, pluie ou objectifs différents.
Priorité  P0 · MVP    Critère d’acceptation  Dispersion en mètres et temps, pas seulement une note.
## M23  Annotations coach liées aux données
But pilote  Retrouver exactement ce que le coach a vu et dit.
Présentation  Marqueurs carte/trace/vidéo, texte ou vocal, catégorie, priorité, action et statut.
Données  Timestamp, s, tour, canaux visibles, auteur et média.
Calcul / logique  Chaque commentaire crée un snapshot reproductible et conserve provenance/version.
Interaction coach  Le coach tague live ou débrief, assigne une action et clôture après validation.
Décision permise  Revoir la consigne dans son contexte.
Limite à afficher  La voix est une donnée personnelle ; information et conservation paramétrable. [S27]
Priorité  P1 · Coach    Critère d’acceptation  Commentaire = point + preuve + auteur ; éditions historisées.
## M24  Replay vidéo synchronisé
But pilote  Relier sensation visuelle et mesure.
Présentation  Vidéo simple/côte à côte, mini-carte, vitesse, delta, G-G et marqueurs.
Données  Vidéo téléphone/action cam, temps GNSS et télémétrie.
Calcul / logique  Timestamp puis correction via événements ; dérive contrôlée sur le run.
Interaction coach  Le coach crée clips 10–30 s avec voix/dessin et lien privé.
Décision permise  Comprendre placement, regard et contexte.
Limite à afficher  Aucun chiffre fabriqué ; marge de synchronisation affichée.
Priorité  P1 · Coach    Critère d’acceptation  Erreur synchro mesurée/réglable ; clip relié à la session.
## M25  Comparaison pilote / coach
But pilote  Apprendre d’une référence humaine sans jugement simpliste.
Présentation  Deux trajectoires, vidéos, traces et événements ; différence séparée de recommandation.
Données  Sessions autorisées, comparabilité, notes et droits.
Calcul / logique  Alignement distance ; écarts par phase ; exclusion zones incompatibles.
Interaction coach  Le coach choisit ce que la référence démontre.
Décision permise  Voir un exemple reproductible, pas seulement plus rapide.
Limite à afficher  Pas de classement public par défaut ; consentement et équité.
Priorité  P1 · Coach    Critère d’acceptation  Propriétaire contrôle partage, durée et anonymisation.
## M26  Passeport de compétences
But pilote  Suivre les acquis entre circuits et saisons.
Présentation  Historique : freinage, transition, rotation, placement, sortie, adaptation ; preuves récentes.
Données  Métriques normalisées par type de virage, niveau, véhicule et conditions.
Calcul / logique  Pondération récence, minimum d’observations et intervalle confiance.
Interaction coach  Le coach valide compétences et distingue acquisition de maîtrise.
Décision permise  Construire une progression personnalisée durable.
Limite à afficher  Pas de score global présenté comme vérité ; couverture visible.
Priorité  P1 · Innovation    Critère d’acceptation  Chaque compétence ouvre trois preuves sur tours distincts.
## M27  Avant / après intervention
But pilote  Vérifier qu’une consigne fonctionne.
Présentation  Comparaison appariée : événement, delta, régularité et maintien aux tours suivants.
Données  Marqueur intervention, tours comparables, métriques et contexte.
Calcul / logique  Fenêtres appariées, effet médian/dispersion et changements connus.
Interaction coach  Le coach clôture, reformule ou abandonne la consigne.
Décision permise  Apprendre ce qui fonctionne pour ce pilote.
Limite à afficher  Corrélation ≠ causalité ; signaler trafic, pneus et météo.
Priorité  P1 · Innovation    Critère d’acceptation  Statut : non testée, probable, validée ou non concluante.
## M28  Rapport premium client
But pilote  Repartir avec une restitution professionnelle.
Présentation  Couverture, résumé, carte, meilleur tour, trois apprentissages, clips, paroles coach et objectif.
Données  Vues validées, médias autorisés, identité et branding.
Calcul / logique  Gabarit ; aucune donnée non validée ; lien privé et PDF.
Interaction coach  Le coach approuve et peut enregistrer une conclusion.
Décision permise  Matérialiser la valeur du trackday.
Limite à afficher  Partage privé par défaut, expiration et export contrôlé.
Priorité  P1 · Commercial    Critère d’acceptation  Rapport disponible quelques minutes après validation.
# 04.E  Coacher en direct
## M29  Live Wall multi-pilotes
But pilote  Surveiller la flotte sans ouvrir vingt tableaux.
Présentation  Carte, connexions, tour/secteur, qualité, opportunité récente et file d’attention.
Données  Flux de chaque téléphone, états appareil et événements.
Calcul / logique  Mise à jour incrémentale ; priorité technique, fin run et besoin coach.
Interaction coach  Le coach filtre par groupe ; l’opérateur gère les appareils.
Décision permise  Savoir qui regarder maintenant.
Limite à afficher  Mirror n’est ni chronométrage officiel ni système sécurité piste.
Priorité  P2 · Live    Critère d’acceptation  20 pilotes lisibles ; technique critique prioritaire.
## M30  Live pilote sélectionné
But pilote  Comprendre le run avec une latence maîtrisée.
Présentation  Carte, delta secteur, vitesse, G, événements, plan, marqueurs et réseau.
Données  Flux 25 Hz, référence locale, calcul edge/cloud et annotations.
Calcul / logique  Calcul téléphone pour continuité ; correction post-run sur brut complet.
Interaction coach  Le coach tague, parle ou prépare le tour suivant.
Décision permise  Intervenir sur une tendance répétée.
Limite à afficher  Valeur live révisable après réconciliation, clairement signalée.
Priorité  P2 · Live    Critère d’acceptation  Cible p50 <0,4 s et p95 <1,5 s validée sur circuit.
## M31  File de consignes au tour suivant
But pilote  Recevoir la consigne au moment utile.
Présentation  Fenêtres de parole sur lignes droites, message court, priorité, motif, expiration.
Données  Position live, G, yaw, virage cible, tour précédent et plan.
Calcul / logique  Détecter après passage, préparer, livrer avant occurrence suivante en faible charge ; cooldown.
Interaction coach  IA propose ; coach approuve/reformule ; aucun auto au lancement.
Décision permise  Corriger au tour suivant avec une seule priorité.
Limite à afficher  Audio autorisé par circuit/encadrement/pilote ; jamais en phase critique.
Priorité  P2 · Innovation live    Critère d’acceptation  Aucune consigne non approuvée ; tout est journalisé.
## M32  Radio, voix et preuve
But pilote  Transformer la communication en donnée pédagogique.
Présentation  Push-to-talk, transcription, marqueur, snapshot, réponse pilote et statut.
Données  Audio WebRTC/radio autorisé, timestamps, s, canaux et consentement.
Calcul / logique  Synchronisation audio/télémétrie, transcription différée et rétention configurable.
Interaction coach  Le coach parle ; Mirror rattache au tour/virage et prépare le débrief.
Décision permise  Réduire oublis et mesurer l’effet.
Limite à afficher  Voix et géolocalisation sont personnelles ; enregistrement désactivable. [S25, S27]
Priorité  P2 · Live    Critère d’acceptation  Direct possible sans enregistrement ; durée respectée.
## M33  Alertes live et mode dégradé
But pilote  Éviter de coacher sur donnée fausse ou absente.
Présentation  Alertes BLE, réseau, GNSS, batterie, mémoire, calibration, paquets ; bannière dégradée.
Données  État complet de chaîne et accusés serveur.
Calcul / logique  Hystérésis, anti-spam, priorité et cause probable.
Interaction coach  Opérateur accuse/résout ; coach connaît la fiabilité.
Décision permise  Continuer local et réconcilier post-run.
Limite à afficher  Alerte technique/performance ≠ alerte sécurité véhicule.
Priorité  P2 · Live    Critère d’acceptation  Coupure réseau sans perte finale ; période live manquante indiquée.
# 04.F  Étendre vers la donnée véhicule
## M34  Canaux véhicule optionnels
But pilote  Passer de dynamique observée aux commandes réelles.
Présentation  Source/fréquence/qualité : accélérateur, frein, volant, RPM, rapport, roues, ABS/TC, températures.
Données  CAN/OBD/logger compatible et protocole par modèle.
Calcul / logique  Horloge commune, resampling, plausibilité, mapping véhicule et droits.
Interaction coach  Le coach confirme les diagnostics pédale/volant.
Décision permise  Expliquer précisément pourquoi la voiture réagit.
Limite à afficher  OBD générique lent/incomplet ; canaux variables par véhicule.
Priorité  P3 · Extension    Critère d’acceptation  Chaque canal affiche source, fréquence et validation.
## M35  Conditions et réglages
But pilote  Distinguer gain pilote, conditions et véhicule.
Présentation  Journal : pneus, pressions, carburant, météo, piste, réglages, passager.
Données  Saisie, données circuit et capteurs optionnels.
Calcul / logique  Un changement/un objectif ; regroupement conditions et avertissements de confusion.
Interaction coach  Le coach enregistre hypothèse et plan de test.
Décision permise  Décider progression ou réglage sans surinterpréter.
Limite à afficher  Donnée déclarative affichée comme telle.
Priorité  P3 · Lab    Critère d’acceptation  Aucune conclusion si facteurs majeurs changent ensemble.
# 05  Coach connecté : méthode professionnelle et innovations
Le direct ne doit pas être une pluie de conseils. Il doit former une boucle mesurable, avec une hiérarchie de communication et une responsabilité humaine claire.
Figure 2 — Boucle Mirror : objectif, preuve, consigne, validation et rétention.
## Organisation d’un run
| Moment | Responsable | Action | Surface |
|---|---|---|---|
| Avant | Coach + pilote | 1 objectif, 1–2 virages, référence, critères et règles audio | M01 |
| Tour de base | Système | observer sans corriger ; confirmer qualité et contexte | M02/M03/M30 |
| Détection | Moteur | classer une perte répétée et préparer les preuves | M07/M12 |
| Validation | Coach | choisir une cause/action ; rejeter si ambigu | M23/M31 |
| Transmission | Coach → pilote | message court en ligne droite, avant le virage cible | M31/M32 |
| Observation | Système + coach | mesurer effet sur 2–3 occurrences et régularité | M27 |
| Débrief | Coach + pilote | urgence/qualité, verdict, preuve et prochain objectif | M04/M28 |

## Console coach recommandée
- Niveau 1 — flotte : position, qualité et statut de chaque pilote ; file d’attention, jamais vingt traces simultanées
- Niveau 2 — pilote : plan de run, delta secteur, événements, qualité, messages et dernière intervention
- Niveau 3 — preuve : fiche virage synchronisant carte, vitesse, G, yaw et vidéo
- Niveau 4 — décision : consigne proposée, texte court, moment de diffusion, approbation, expiration et validation
- Rôles : coach = pédagogie ; opérateur = boîtiers/réseau ; responsable piste = autorité sécurité
## Format d’un message live
| GABARIT Repère + action + amplitude + raison, en quelques secondes. Forme possible : « Au panneau 100, garde la décélération un peu plus longtemps puis relâche progressivement ; tu récupères la rotation avant la corde. » Le coach adapte la phrase et ne l’utilise que si les canaux observés la soutiennent. |
|---|

- Une seule consigne active par run, sauf urgence opérationnelle.
- Message après l’erreur et avant la prochaine occurrence, jamais au milieu de la zone de charge.
- Pas de chiffre plus précis que l’incertitude de mesure.
- La consigne expire si conditions, tour ou qualité changent.
- L’IA ne parle pas directement au pilote en version initiale ; le coach approuve.
## Innovations réellement différenciantes
| Innovation | Fonctionnement |
|---|---|
| Evidence-locked AI | Chaque phrase cite tour, segment, canaux, calcul et confiance ; sinon l’IA dit qu’elle ne sait pas. |
| Coaching tour suivant | Détecter au passage, préparer puis livrer en zone calme avant la prochaine occurrence. |
| Fenêtre cognitive | Utiliser G/yaw/position pour éviter les messages en freinage/virage ; cooldown. |
| Sensation vs donnée | Le pilote dicte son ressenti à chaud ; Mirror l’aligne aux traces et au coach. |
| Référence conditionnée | Choisir une référence comparable plutôt que le record absolu. |
| Carte de confiance | Rendre visibles les zones où la mesure ne permet pas une conclusion fine. |
| Passeport | Suivre les aptitudes transférables par type de virage avec preuves et rétention. |
| Coach fingerprint | Mémoriser vocabulaire, exercices et tolérances du coach sans automatiser sa responsabilité. |
| Intervention A/B | Mesurer l’effet d’une consigne sur plusieurs tours et clôturer le cycle. |
| Story premium | Transformer les preuves en expérience vidéo claire sans donnée fictive. |

# 06  Architecture technique cible
Le téléphone dans chaque voiture est la passerelle indispensable : la portée BLE ne permet pas une réception centrale autour d’un circuit. Le système doit rester fonctionnel hors réseau.
Figure 3 — Architecture offline-first. Le brut reste local puis est réconcilié.
| Composant | Responsabilité | Choix recommandé |
|---|---|---|
| SDK RaceBox | scan, MTU, buffer, checksum, parsing et mémoire | bibliothèque native testée sur fragmentation/concaténation |
| App gateway | brut, prévol, tour local, cache, upload et audio | offline-first ; base locale chiffrée ; tâches de fond validées |
| Transport | échantillons, états, annotations et accusés | WebSocket TLS, lots courts, séquences et reprise |
| Ingestion | auth, ordering, déduplication et métriques | service léger ; pas de Kafka nécessaire pour 20–50 voitures |
| Live state | dernier état et événements rapides | Redis/équivalent avec TTL et WebSocket coach |
| Session store | pilotes, tours, segments, notes et droits | PostgreSQL, extension time-series si utile |
| Raw / média | fichiers bruts, exports, vidéo et snapshots | object storage ; Parquet ; checksums |
| Feature engine | map matching, événements, comparaisons et rapports | jobs versionnés, idempotents, recalculables |
| Audio coach | voix faible latence | WebRTC ou pont intercom/radio autorisé ; PTT |
| Front coach | flotte, pilote, preuves et messages | web desktop prioritaire |
| Pilote | Flash, Coach, Story et partage | mobile-first ; mêmes API de preuve |

## Budget de latence cible — à valider, pas à promettre
| Maillon | Cible indicative | Robustesse |
|---|---|---|
| Mini S → téléphone | 40–120 ms | MTU, buffer, séquences et débit observé |
| Traitement edge | < 50 ms | calcul incrémental ; aucune IA lourde |
| Uplink piste | 50–800 ms variable | lots courts, store-and-forward et état réseau |
| Serveur → coach | < 150 ms hors uplink | fan-out WebSocket, backpressure |
| Global | p50 <0,4 s ; p95 <1,5 s | mesure par circuit ; mode dégradé |
| Audio | à tester | WebRTC, PTT, réseau séparé si requis |

Ordre de grandeur  80 octets de payload jusqu’à 25 fois/s représentent environ 2 kB/s de payload brut par voiture avant enveloppes. Le volume n’est pas le principal risque ; la couverture, les coupures, l’arrière-plan mobile et la réconciliation le sont.
## Modèle de données minimal
| Entité | Champs clés | Raison |
|---|---|---|
| Device | serial, modèle, firmware, calibration, sécurité mémoire | flotte et traçabilité |
| Session | event, circuit, pilote, véhicule, objectif, conditions, droits | contexte |
| RawSample | timestamp, séquence, canaux décodés, qualité, source | preuve immuable |
| Lap / Segment | bornes, validité, motif, référence et métriques | comparaison |
| Event | type, s, t, valeur, confiance et version | phases |
| Annotation | auteur, audio/texte, snapshot, priorité et état | mémoire coach |
| Advice | preuves, hypothèses, consigne, approbation et résultat | IA auditée |
| Presentation | gabarit, vues, version, autorisations et export | cohérence |

# 07  IA : rôle autorisé, garde-fous et méthode
L’IA doit augmenter le coach, pas remplacer son jugement ni produire une explication séduisante mais fausse.
| Fonction | Entrée | Sortie | Garde-fou |
|---|---|---|---|
| Priorisation | opportunités + confiance + plan | top 3 | rien à faible confiance |
| Explication | faits structurés + snapshots | texte + preuve | contrainte aux faits fournis |
| Question naturelle | question pilote | vue + réponse | requête convertie en calcul |
| Consigne | diagnostic + playbook | message court | approbation coach |
| Résumé | vues validées + notes | Flash/rapport | aucun chiffre absent |
| Anomalie | historique pilote/appareil | zone atypique | jamais diagnostic panne |
| Parcours | passeport + rétention | exercice | coach modifie |
| Transcription | audio autorisé | texte lié au tour | option/correction/durée |

| RÈGLE D’OR La sortie IA doit être reconstructible sans IA : faits, calcul, référence, confiance et alternatives. Le modèle de langage ne calcule pas le delta et ne décide pas le début de freinage ; il verbalise les résultats du moteur déterministe. |
|---|

- Séparer moteur scientifique déterministe et moteur rédactionnel IA.
- Versionner prompts, modèles, playbooks et règles ; conserver la décision coach.
- Employer observé, dérivé, estimé et hypothèse coach.
- Tester les cas adverses : perte GNSS, boîtier inversé, trafic, tour coupé, double apex et pluie.
- Mesurer rejet/modification coach et effet des consignes, pas seulement qualité du texte.
# 08  Sécurité, confidentialité et droits
OXV Mirror traite géolocalisation, identité, potentiellement vidéo et voix. La conformité doit influencer l’architecture dès le premier sprint.
Géolocalisation  la CNIL rappelle qu’elle constitue une donnée personnelle lorsqu’elle identifie directement ou indirectement une personne, avec base légale, transparence, minimisation, sécurité et droits. [S25]
Privacy by Design  la CNIL recommande une vie privée intégrée au développement, des paramètres protecteurs par défaut et une AIPD selon les risques. [S26]
Voix et vidéo  voix, photos et enregistrements sont des données personnelles. Le direct audio doit pouvoir fonctionner sans enregistrement ; enregistrement, transcription et partage sont des choix distincts. [S27]
| Exigence | Décision recommandée |
|---|---|
| Finalités séparées | performance, appareil, média marketing et benchmark inter-pilotes ont des choix distincts |
| Privé par défaut | coach et pilote seulement ; aucun classement public automatique |
| Base légale | documenter par finalité ; ne pas supposer une base unique |
| Minimisation | live limité aux canaux utiles ; brut conservé selon politique annoncée |
| Durées | télémétrie, vidéo, audio, transcription et exports séparés |
| Droits | export, suppression, retrait partage, correction et historique |
| Sécurité | TLS, chiffrement repos, rôles, journal accès et rotation secrets |
| Autres pilotes | opt-in, portée/durée, anonymisation et révocation |
| Mineurs | représentant légal et partage renforcé |
| Sous-traitants | registre hébergeur, IA, voix, vidéo, support et localisation |

| AVANT BÊTA PUBLIQUE Réaliser une revue juridique française/RGPD, une analyse de risques produit et une validation avec circuits/assureurs sur l’audio en piste. Ce dossier est un cahier de conception, pas un avis juridique ni une homologation sécurité. |
|---|

# 09  Roadmap et critères de passage
La valeur arrive d’abord par la restitution post-run fiable. Le direct s’active après validation de l’acquisition, des algorithmes et de la discipline de coaching.
| Phase | Ordre | Contenu | Gate de sortie |
|---|---|---|---|
| 0 · Protocole | 3–4 sem. | parser BLE, brut, mémoire, banc paquets, trois boîtiers | zéro perte tests ; axes/horloges vérifiés |
| 1 · Vérité piste | 6–8 sem. | prévol, qualité, map matching, tours/secteurs, validation chrono | erreur chrono et invalidations testées multi-circuits |
| 2 · MVP | 8–10 sem. | M04–M09, M11–M19, M22 et rapport | rapport <2 min ; chiffres 100 % traçables |
| 3 · Coach | 6–8 sem. | M01, M10, M20–M28, vidéo et passeport | débrief préparé <5 min ; suggestions évaluées |
| 4 · Live fermé | 8–12 sem. | M29–M33 sur 3–5 voitures | p50/p95 mesurés ; zéro perte finale |
| 5 · Live 20 | 6–10 sem. | flotte, rôles, supervision et procédures | 20 flux, modes dégradés, 3 événements stables |
| 6 · CAN/OBD | progressif | M34–M35 par famille véhicule | chaque canal validé/versionné |

## Backlog des vingt premières décisions
- Acquérir un petit parc de Mini S identiques et figer la procédure de montage.
- Implémenter la révision 9 avec tests de fragmentation, concaténation et checksum.
- Conserver le paquet brut avant toute correction ou filtre.
- Créer des sessions de référence avec chronométrage officiel et vidéo.
- Versionner portes, secteurs, virages, apex coach et pit lane.
- Valider repère, calibration et détection du montage inversé.
- Définir les seuils qualité depuis les essais, pas arbitrairement.
- Construire Δt(s) et sa réconciliation exacte par secteur/tour.
- Implémenter vitesse, trajectoire, G, yaw, tours et régularité.
- Faire valider les événements par au moins deux coachs.
- Créer Flash Débrief puis fiche virage avant le Lab avancé.
- Intégrer mesuré/dérivé/estimé au design system.
- Créer annotations et snapshots avant d’ajouter l’IA.
- Synchroniser une vidéo et mesurer l’erreur.
- Écrire le playbook coach : vocabulaire, priorité, timing et interdits.
- Ajouter l’IA seulement sur faits structurés et approbation journalisée.
- Tester cache offline, coupures et réconciliation mémoire.
- Mesurer p50/p95, pertes, batterie, chauffe téléphone et arrière-plan.
- Réaliser revue RGPD/sécurité avant bêta client.
- N’ouvrir 20 pilotes qu’après trois journées pilotes stables.
## KPIs produit
| Axe | KPI | Pourquoi |
|---|---|---|
| Fiabilité | % échantillons réconciliés, trous, sessions perdues | la confiance précède l’analyse |
| Exactitude | écart chrono officiel, stabilité événements | éviter fausse précision |
| Opérations | temps sync→Flash et coach→rapport | tenir promesse trackday |
| Pédagogie | % pilotes reformulant l’action | mesurer compréhension |
| Efficacité | effet avant/après + rétention | prouver coaching |
| IA | acceptation, modification, rejet, faits faux | amélioration contrôlée |
| Live | latence p50/p95, coupures, messages hors fenêtre | robustesse cognitive |
| Confiance | partages révoqués, incidents et droits | gouvernance |

# 10  Conclusion : la signature OXV Mirror
Les outils professionnels rendent des milliers de canaux manipulables. OXV Mirror peut se différencier en rendant quelques canaux fiables pédagogiquement irrésistibles.
| SIGNATURE PROPOSÉE Une preuve visuelle, une phrase coach, une action au prochain run et une validation mesurée. Le pilote repart avec un récit de progression ; le coach garde la profondeur technique ; OXV conserve une chaîne de vérité auditable. |
|---|

- Professionnel : même modèle pour live, replay, débrief et rapport.
- Honnête : séparation mesuré, dérivé, estimé et option véhicule.
- Pédagogique : trois niveaux de lecture et une priorité active.
- Collaboratif : consigne liée à un instant, une zone, une preuve et un résultat.
- Innovant : tour suivant, fenêtre cognitive, passeport et IA verrouillée.
- Premium : restitution vidéo/narrative matérialisant la valeur du trackday.
Décision recommandée maintenant  lancer un prototype RaceBox Mini S + gateway mobile + débrief M04/M07/M08/M12/M13/M17/M18/M22/M23. Ces neuf surfaces valident la vérité du produit avant d’investir dans le live et la couche véhicule.
# A  Sources et traçabilité
Priorité aux fabricants, équipes, organisateurs et autorités. Les écrans exacts et méthodes privées des écuries ne sont pas publics ; aucune extrapolation n’est présentée comme fait interne.
[S1] RaceBox — Mini / Mini S - spécifications techniques (2026). Ouvrir la source
[S2] RaceBox — RaceBox BLE Protocol Documentation, révision 9 (4 août 2026). Ouvrir la source
[S3] RaceBox — How To Export RaceBox Sessions (25 août 2026). Ouvrir la source
[S4] RaceBox — Application mobile : analyse, live, partage et vidéo (25 août 2026). Ouvrir la source
[S5] RaceBox — RaceBox Mini S - page produit (25 août 2026). Ouvrir la source
[S6] Motion Applied — ATLAS Analyse (2026). Ouvrir la source
[S7] Motion Applied — ATLAS Store (2026). Ouvrir la source
[S8] Motion Applied — ATLAS Enrich (2026). Ouvrir la source
[S9] Motion Applied — ATLAS Integrate (2026). Ouvrir la source
[S10] Motion Applied — ATLAS Stream (2026). Ouvrir la source
[S11] Cosworth — Pi Toolbox (25 août 2026). Ouvrir la source
[S12] Cosworth — Partenariat iRacing : télémétrie distante en direct (28 août 2025). Ouvrir la source
[S13] Bosch Motorsport — WinDarab V7 (25 août 2026). Ouvrir la source
[S14] MoTeC — Formations i2 et acquisition/analyse (25 août 2026). Ouvrir la source
[S15] AiM — RaceStudio 3 Analysis - documentation (25 août 2026). Ouvrir la source
[S16] Racelogic VBOX — Circuit Tools 3 (25 août 2026). Ouvrir la source
[S17] Garmin — Catalyst 2 Driving Performance Optimizer (17 février 2026). Ouvrir la source
[S18] Porsche — Track Precision App (2 décembre 2021). Ouvrir la source
[S19] APEX Pro — Fonctionnalités, CrewView et OBD-II (25 août 2026). Ouvrir la source
[S20] Track Titan — Coaching Flows et Replay Deck (25 août 2026). Ouvrir la source
[S21] trophi.ai — Pro Telemetry et coaching IA (25 août 2026). Ouvrir la source
[S22] Mercedes-AMG PETRONAS F1 Team — How Do You Set Up a Formula One Car? (25 août 2026). Ouvrir la source
[S23] McLaren Racing — Organisation des débriefings de week-end de course (2024). Ouvrir la source
[S24] Formula 1 — Car Performance Scores : nettoyage, modèles et simplification (2020). Ouvrir la source
[S25] CNIL — Géolocalisation et applications mobiles : quelles règles ? (7 juillet 2026). Ouvrir la source
[S26] CNIL — Préparer son développement - Privacy by Design (25 août 2026). Ouvrir la source
[S27] CNIL — Identifier les données personnelles (25 août 2026). Ouvrir la source
Méthode de veille — Recherche arrêtée au 25 août 2026. Fonctionnalités et versions peuvent évoluer. Les spécifications RaceBox et comportements BLE doivent être revalidés sur les firmwares réellement déployés par OXV.