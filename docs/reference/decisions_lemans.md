# Journal des décisions — Le Mans reco + Albi épreuve (phase questions close le 30/08/2026)

## Cadre
- Écurie : Team FFC, Championnat de France Camions FFSA. Pilote suivi : Fabrice Chaignaud (nom réservé aux documents internes — citation publique décidée après Le Mans, Q-21).
- Deux camions (un Renault, un Scania), deux pilotes, un pilote à la fois par camion.
- L'écurie n'a ni télémétrie, ni ingénieur dédié, ni donnée : chronométrage officiel + ressenti. Tout se passe dans le paddock, au camion. Pas de salle de télémétrie.
- Ils ne partageront pas leurs données (« peu probable ») ; on signe leur NDA s'ils en ont un.
- Dossier « Le Stratège » (rapport carrière/saison, PDF A4 ~12 pages) déjà produit dans une autre session : objet à remettre au pilote.

## Deux épreuves
- Le Mans, 24 Heures Camions, Circuit Bugatti (4,185 km), 26-27/09/2026 : reconnaissance instrumentée.
  - RaceBox Mini S en enregistrement autonome dans la cabine. Le boîtier change de camion entre les séances (deux comptes : Renault / Scania).
  - Entre les séances : récupération du boîtier, téléchargement mémoire (~4 min 40 pour 2 h 11 à 25 Hz), import, ouverture du Bilan avec le pilote, déplacement du boîtier.
  - Preuves : P-1 tours OXV vs feuilles de chronométrage officielles ; P-2 ; P-4 partiel. Pas de mesure de latence (pas de direct).
  - Je serai seul. Pass équipe fourni par l'écurie (Q-25) — à obtenir par écrit avant le 20/09.
  - Fixation du boîtier : emplacement décidé sur place le vendredi avec l'écurie (Q-26). Kit apporté quoi qu'il arrive : Dual Lock 3M, sangle, batterie chargée, vue ciel requise.
  - Pas d'enregistrement audio des débriefs (Q-17). Fixture « Le Mans » anonymisée conservée (trames GPS, sans nom ni numéro).
  - Accord données et image d'une page : données brutes, fixture dérivée anonymisée, images (Albi), citation du nom « à convenir » (Q-21 : décision après Le Mans).
  - Pas de décharge circuit (invité de l'écurie sur une épreuve officielle) ; avocat hors chemin critique (Q-15).
  - Ligne d'arrivée : ligne officielle du circuit.
  - Téléphone en voiture : sans objet (Q-19). Pas de Flic.
- Albi (3,565 km), 10-11/10/2026, finale : épreuve complète.
  - Passerelle OXV v1 (Pi Zero 2 W + LTE + batterie, 24 V → 5 V) — v1 d'abord, la date glisse si nécessaire ; validation route ouverte avant le 03/10.
  - Direct sur tablette + écran OXV apporté (24–27"). 4G OXV mesurée sur place.
  - NADIR (production d'images) présent à Albi, pas au Mans.
  - Circuit d'Albi en base (Q-22), comme Le Mans.
- Offre à l'écurie : décidée après Le Mans.
- Mini S : vérification firmware/mémoire = tâche utilisateur (Q-18).

## Point à réconcilier
- Note du 29/08 (autre session) : « l'import RaceBox 25 Hz, le découpage en zones, la trace de vitesse, la carte de chaleur et la comparaison de tours fonctionnent sur un circuit inconnu ». Mon registre garde six entrées coach câblées Beltoise (97, 441, 459, 502, 503, 594 : circuitTopology, BELTOISE_CORNERS, gardeFouMultiCircuit, CircuitMap). À vérifier sur la branche `migration/sdk-55` : quels écrans passent réellement sur circuit inconnu, lesquels restent bloqués.

## Idées — série 1 (30/08)
- I-1 RETENU : deux découpages. Secteurs calés sur les intermédiaires officiels (positions retrouvées en recoupant les temps S1/S2/S3 officiels avec la trace GPS) pour la preuve P-1 ligne à ligne + zones OXV par virage pour la lecture pilote.
- I-2 RETENU : un seul chemin d'ingestion. Le CSV du boîtier (Le Mans) et les trames de la passerelle (Albi) entrent par la même fonction. Le Mans teste réellement le chemin d'Albi.
- I-3 RETENU (variante) : notes libres saisies dans l'app, écran Débrief — pas de grille papier, pas d'audio.
  - Conséquences à porter au registre : champ notes libres réellement utilisable debout au camion (une main, plein soleil), écriture hors réseau avec synchronisation différée, et pas de perte si l'app est tuée. Sans cela, la seule trace du verbatim pilote disparaît.
- I-4 RETENU : deux comptes pilotes ordinaires (Renault, Scania) au Mans et à Albi. Objet écurie (chef, deux camions, deux pilotes, droits) spécifié après, sur du réel observé.

## Idées — série 2 (30/08)
- I-5 RETENU : écran OXV à Albi en deux temps — direct pendant la séance, bilan entre les séances. Ce sont les modes live et restitution de la page pavillon déjà en ligne (`/pavillon/coach`), pilotés depuis la tablette (`/pavillon/controle`). Aucune interface nouvelle.
- I-6 RETENU : une seule passerelle à Albi + le boîtier Mini S en enregistrement sur l'autre camion. Un seul matériel critique à fiabiliser avant le 03/10, et les deux modes démontrés dans le même week-end.
- I-7 RETENU (reformulé par l'utilisateur) : le pilote se compare à lui-même ET au plateau du circuit — pas à l'autre pilote de l'écurie. La référence plateau vient du chronométrage officiel, qui est public : OXV ne fabrique aucun classement, il lit celui qui existe déjà. Conséquence : nouvel objet « plateau » (référentiel de temps de l'épreuve) au registre.
- I-9 RETENU : une page envoyée sous 24 h (meilleur tour, trace, secteurs face au chronométrage officiel). Premier usage réel du module Débrief J+1 déjà inscrit au registre.

## Découverte — chronométrage officiel du championnat (vérifié le 30/08)
- Le Championnat de France Camions est chronométré par ITS. Deux surfaces publiques : résultats (its-results.com/cdfca/2026) et live timing (its-live.net/live/cdfca/2026), relayées depuis coursesdecamions.fr.
- Les deux sont des applications JavaScript : le contenu n'a pas pu être inspecté par simple récupération de page. À vérifier de visu : format exact des documents publiés (temps au tour par concurrent ? intermédiaires ?), et conditions d'utilisation d'ITS.
- Conséquence : la référence plateau existe, en direct comme après séance. Reste à trancher comment l'acquérir sans se mettre en faute.

## Idées — série 3 (30/08)
- I-7b RETENU par l'utilisateur, contre mon avis, confirmé après reprise : lecture automatisée du live timing ITS dès Le Mans, sans attendre d'autorisation.
  - Réserve consignée une fois pour toutes : conditions d'utilisation d'ITS inconnues, droit sui generis du producteur de base de données (art. L341-1 CPI), et posture délicate vis-à-vis du chronométreur officiel de la fédération. Je ne suis pas juriste ; le risque principal n'est pas financier, il est relationnel.
  - Garde-fous à inscrire au dossier, non négociables côté conception : lecture à cadence basse (une requête toutes les 5 à 10 s, jamais en rafale), aucune redistribution publique (la référence plateau ne sort jamais sur le mur du bar ni sur une page publique du site), usage interne au camion uniquement, contact OXV identifiable dans les en-têtes, arrêt immédiat sur demande.
  - Courrier à ITS et à la FFSA envoyé en parallèle malgré tout — il coûte une heure et il change la nature du geste.
  - Repli obligatoire au runbook : si le flux change de format ou tombe pendant le week-end, on demande la feuille officielle à l'écurie, séance par séance.
- I-10 RETENU : photo de la feuille de réglages de l'écurie, attachée à la séance. Demande explicite, jamais un dû ; clause dédiée dans l'accord d'une page.
- I-11 RETENU : une intention notée avant chaque séance, une ligne. La donnée du retour répond à cette phrase.
- I-13 RETENU (variante) : dossier « Le Stratège » envoyé avant Le Mans, discuté sur place le vendredi. Conséquence : l'envoi devient un jalon daté, à caler au moins cinq jours avant le 26/09 pour qu'il ait le temps de le lire.
- I-12 RETENU (variante) : à Albi, film avec donnée réelle et nom à l'image.
  - Dépendance dure : l'accord image et citation doit être signé avant le 10/10. Or Q-21 fixe la décision de citation « après Le Mans ». La fenêtre de décision est donc du 28/09 au 09/10, et elle est courte. Si elle se ferme sans accord, I-12 retombe sur le dispositif filmé avec un jeu anonymisé — à prévoir comme plan B au tournage, pas après.

## Décisions du 30/08 (après lecture du dépôt et de la base)
- G-9 RETENU : champ `court` obligatoire sur les 40 chaînes d'écran (27 libellés de données, 6 raisons d'absence, 7 motifs de composition). La phrase existante reste au second geste. L'exception datée est écartée. ~1 j.
- G-8 CONFIRMÉ : le débrief rédigé reste une feuille de récit. Les cinq mécanismes de sûreté (filtre 52 termes, repli local déterministe, garde de rendu, test de parité, déclencheur SQL) sont conservés.
- Ordre : P0 d'abord — le cap absent (ne pas afficher, 1 h) et le ménage de la ligne de démonstration en base (15 min). Le QDI attend une décision fondateur explicite.
- Constat de méthode : cinq manques signalés dans ce dossier, cinq déjà couverts par le dépôt (resample, projection curviligne, ingestion .ubx, /share/{token}, garde des moteurs de démonstration). Règle nouvelle : ne pas nommer un défaut sans avoir cité sa garde.

## Faits de base établis le 30/08
- Séance de référence : `ff384ace-d6ce-414b-8338-cef030218ee0`, Bouteville, 12/08/2026. 26 999 trames à 25,0 Hz, 3 tours (360,485 / 327,542 / 339,483 s ; 5 875,49 / 5 873,68 / 5 874,72 m). 100 % de fixes valides, 15,4 satellites, 0,23 m.
- `heading` nul sur 100 % des trames.
- QDI Bouteville : trajectoire 97 · régularité 34 · freinage 7 · fluidité 0 · accélération 0. Régularité reproduite à la main → plomberie juste. Fluidité 0 causée par un signal inertiel non conditionné (jerk latéral médiane 0,286 g/s, moyenne 2,240, p95 14,0 ; lissé 13 trames → moyenne 0,629 → score 78).
- `session_insights` : une seule ligne, `mirror-insights-demo`, filtrée trois fois par l'app.
- `cycle_steps` et `coach_annotations` : zéro ligne → P36 et P46–P51 resteront écartées au Mans.
- Migration `20260829163749 lot10c_presentations_vues_travail_actif_repere_memoire` APPLIQUÉE ; `pilot_presentation_views` et `pilot_presentation_work` existent.
- `app_progression_shares` porte déjà jeton, portée, liste blanche de métriques, expiration, révocation et compteur de vues, avec trois fonctions SECURITY DEFINER.
- 40 modules dormants listés dans `modulesOrphelins.guard.test.ts`, dont le registre des 65 présentations, le moteur de composition, le moteur d'insights app, la console coach.

## Recette P1 sur Bouteville (30/08)
- Port fidèle de `circuitGenerator.generateCircuit` + PARAMS_CENTERLINE validé sur Haute Saintonge : 8 virages sur 8, sens et apex identiques à ce qui est en base.
- Bouteville : 12 virages, longueur calculée 5 902 m (déclarée 5 910, tours mesurés 5 874). Les 12 corroborés par un ralentissement réel dans la trace.
- Réserve V6 : 58,2 km/h sur rayon annoncé 33 m = 0,81 g, or max mesuré 0,62 g. Rayon sous-estimé (tracé médian à 46 m de pas). À recaler sur la trajectoire.
- Réserve capture : boucle routière de nuit (23h35-23h54), deux arrêts à 7,8 et 12,2 km/h. Valide la chaîne, ne calibre pas un seuil de piste.
- Les CINQ niveaux de restitution sont ouverts (chrono, régularité au seuil exact de 3 tours, delta, phases, enveloppe).
- Composition calculée : 27 fiches sur 65 composables, 38 écartées avec motif. Débrief = P09 · P16 · P50 · P10 · P08 — trois réussites puis une opportunité, ordre du §00 tenu mécaniquement.
- 13 des 38 écartées tiennent au coach (consigne, rattachement, acquis) : un tiers du catalogue fermé au Mans sur un compte sans coach.
- DÉFAUT TROUVÉ : l'intention du 12/08 existe en base (`session_intentions`) mais son `session_id` est nul — rattachée au circuit, pas à la séance. P01 est donc écartée alors que le pilote a écrit son intention.
- À faire : lancer `detect-circuit-corners` sur Bouteville (jamais exécuté) ; rattacher l'intention ; ouvrir les 10 écrans annoncés et noter le réel.
