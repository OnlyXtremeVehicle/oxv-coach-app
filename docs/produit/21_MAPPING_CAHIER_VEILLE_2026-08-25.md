# Cahier « Veille Télémétrie » × état réel de l'app — mapping d'exécution

> Source : `OXV_Mirror_Veille_Telemetrie_Cahier_Produit_2026.docx` (v1.0, 25/08/2026).
> Établi le 25/08/2026 contre le code de la branche `migration/sdk-55`.
> Règle du programme v4 appliquée : chaque « existe » ci-dessous a été vu dans le
> code ou en prod pendant les travaux d'août ; les « à confirmer » sont marqués.

## Verdict d'ensemble

Le cahier est bon — et il redécouvre en partie l'app. Sur les **neuf surfaces
du prototype recommandé** (M04, M07, M08, M12, M13, M17, M18, M22, M23),
**sept existent en tout ou grande partie**. Le vrai chantier neuf est le
**live** (M29–M33) et la couche **véhicule** (M34–M35) — que le cahier
lui-même place après la fiabilité du post-run, qui est déjà là.

Trois points du cahier **contredisent la doctrine fondatrice** et exigent un
arbitrage du fondateur avant toute ligne de code (voir § Conflits).

## A — Ce qui existe déjà (vérifié)

| Module du cahier | Dans l'app aujourd'hui |
|---|---|
| Chaîne d'acquisition (§03 1-4) | Parser UBX 88 o + Fletcher-8, BLE, file hors-ligne sur fichiers, reprise sans doublon, 27 000 mesures réelles en prod |
| M03 Qualité/confiance (partiel) | Trous BLE > 200 ms exclus ; provenance affichée ; écran « Méthode » M/D/I (27 grandeurs) = exactement « observé / dérivé / estimé » du §07 |
| M04 Flash débrief | Le Bilan du soir : chrono, marge, **une** zone à explorer, débrief J+1 en 3 actes |
| M05 Tableau des tours | Section Tours de l'écran Séance : histogramme, sélection, tour de référence au liseré or |
| M08 Delta Δt(s) | Section Delta + StripMap (tracé déroulé en axe distance) de l'écran Séance |
| M11/M12 Index + fiche virage | Pilules V1-V7, feuille virage 480 (vitesses entrée/corde/sortie, appui maxi, « CE QUE LA VOITURE A VÉCU », onglet Évolution = superposition des passages) |
| M13/M17 Freinage / sortie estimés | Branches QDI Visée (σ(ΔG/Δt) par phase de freinage ≥ 4 mesures) et Plongée (remise des gaz ≥ +0,15 g) ; vocabulaire déjà conforme à l'INTERDICTION PRODUIT du §02 (« décélération estimée », jamais « pression de frein ») |
| M16 Apex | « virages détectés par courbure, apex mesuré » (écran Séance) |
| M18 Trajectoire n(s) | Branche Trajectoire : rééchantillonnage 40 points à fractions de distance égales, dispersion inter-tours en mètres |
| M19 Trace vitesse | Onglet « Au fil du tour » : vitesse + G longitudinal, curseur 60 i/s |
| M20 G-G | Nuage d'appuis à échelle honnête (« Cercle : X g », jamais écrêté — commit b00f8bb) + Constat « Diagramme G-G » niveau 2 |
| M10 Potentiel démontré (partiel) | Constat « **Tour idéal composé** » dans les lectures approfondies — la continuité aux jonctions est à auditer contre le §03 |
| M22 Régularité | Branche Cap (CV = σ/moyenne, min 3 tours) + Constat « Dispersion de trajectoire » |
| M21 Fluidité | Branche Anticipation (moy Δ|G_lat/Δt|) + Constat « Cohérence du flow » |
| M23 Annotations coach | Écran coach `annoter` (notes par virage), bande « NOTE DU COACH » au Bilan, liseré or |
| M25 Comparaison | Coach `comparer` / `comparer-pilotes` ; pilote « Comparer cette séance » ; aucun « gagnant » affiché |
| M27 Avant/après (partiel) | Fil coach + interventions ; la mesure d'effet appariée n'existe pas encore |
| M28 Rapport premium | Rapport PDF coach + carte-souvenir + Carnet Heritage |
| M24 Vidéo (partiel) | Alignement temporel vidéo (flag `video_overlay`) ; la vidéo ne quitte pas le téléphone ; synchro mesurée à faire |
| M02 Prévol (partiel) | Hub appareils, batterie/mémoire boîtier, parc admin ; l'écran « grands statuts » dédié pré-piste est à composer |
| M35 Conditions (partiel) | Météo par séance (température/humidité), tranches « tour de référence par conditions » |
| §07 IA | Déjà la règle d'or : moteur déterministe séparé, IA qui verbalise, **coach approuve avant diffusion**, filtre doctrinal à l'exécution, provenance affichée |
| §08 RGPD | Consentements granulaires par finalité, privé par défaut, export/suppression, AIPD inscrite au programme French Tech (ch. 21) |

## B — Ce qui reste à faire (au 26/08/2026)

> Cette section a été remise en phase le 26/08 : elle listait encore comme
> « n'existe pas » cinq modules livrés entre le 25 et le 26 (M01, M06, M07,
> M09, M14/M15). Un inventaire qui ne se corrige pas devient un inventaire
> qui ment — c'est la même règle que pour le dossier de candidature.

| Module | Nature | État |
|---|---|---|
| M24 Replay vidéo synchronisé | mesure + vue | **Prochain lot compatible.** L'alignement temporel existe (flag `video_overlay`, la vidéo ne quitte pas le téléphone) ; ce qui manque est l'exigence du cahier : une erreur de synchronisation **mesurée et affichée**, réglable par le pilote |
| M29 / M30 / M33 Live coach | infrastructure | WebSocket, état live, console flotte 20 voitures, alertes et modes dégradés. Seul vrai chantier d'architecture restant ; `en-direct` (roster en piste) en est l'embryon. Non commencé — et à ne lancer qu'après le terrain |
| M34 / M35 CAN/OBD | matériel + intégration | P3, hors RaceBox Mini S. Dépend d'un boîtier que le projet n'a pas encore |
| M10 Potentiel démontré | audit | Le Constat « Tour idéal composé » existe ; sa continuité aux jonctions (§03 du cahier) n'a pas été auditée contre les tolérances vitesse/position/accélération |
| M02 Prévol (reste) | écran | Livré au lot 5 (9 postes dans `placement.tsx`). Reste : le test de 15–30 s que le cahier décrit, qui exige un vrai boîtier |

**Retirés par arbitrage du fondateur (25/08), définitivement :** M31/M32
(consignes au tour suivant, audio coach→pilote en roulage — le silence en
piste reste la signature) et M26 (passeport de compétences — trop proche du
score global que la doctrine bannit). M04 conserve « une seule zone à
explorer », contre les trois cartes du cahier.

**Hors de portée logicielle**, quel que soit le lot : phase 0 du cahier (banc
de paquets sur vrais boîtiers), validation face au chronométrage officiel
multi-circuits, et toute revue juridique préalable à une bêta publique.

> **ARBITRAGE FONDATEUR (25/08/2026)** : « enlève ce qui contredit la doctrine
> et c'est parti ». M31/M32 (consignes au tour suivant, audio coach→pilote en
> roulage) : RETIRÉS — le silence en piste reste la signature. M26 (passeport) :
> RETIRÉ. M04 : reste « une seule zone à explorer ». Les lots du §D sont lancés.

## C — Conflits doctrinaux : arbitrage fondateur requis AVANT d'écrire

1. **M31/M32 — consignes au tour suivant + audio coach→pilote en roulage.**
   Contredit frontalement le Principe 3 (« Silence en piste : aucun écran,
   aucun son ») et le Principe 2 (« aucune instruction de pilotage, jamais »).
   Le cahier le sait (« audio autorisé par circuit/encadrement/pilote »).
   Options : (a) refuser — le silence est la signature ; (b) accepter en
   produit COACH séparé, opt-in pilote explicite, jamais dans Mirror pilote ;
   (c) reporter après l'alpha. **Décision : Gabin.**
2. **M04 — « trois cartes opportunité »** vs Principe 1 (« UNE seule zone à
   explorer par séance »). L'app applique « une zone » ; le cahier en veut
   trois. **Décision : Gabin.**
3. **M26 Passeport** — frôle le score global que la doctrine bannit.
   Défendable si « preuves ouvertes, jamais une note » ; à cadrer.

## D — Lots doctrine-compatibles : **LIVRÉS le 25/08/2026**

| Lot | Modules | Livré |
|---|---|---|
| 1 « Vérité renforcée » | M03+ | `confianceLogic` (score par zone + motifs, agrégat = pire zone, seuils versionnés v1.0.0 « à valider sur piste ») + `confianceSource` + rangée « Confiance de mesure » au Résumé de l'écran Séance (Sheet motifs/zones) — 24+8 tests |
| 2 « Session » | M06 + M07 | `progressionLogic` (Theil–Sen, chauffe écartée avec motifs, « tendance tardive observée » jamais « fatigue ») + `opportunitesLogic` (perte par segment sur le `DeltaResult` existant de `@/telemetry/delta`, **réconciliation somme=delta testée**) + tendance dans Tours + segments sous le Delta — 30 tests |
| 3 « Virage fin » | M14 + M15 | `virageFinLogic` (« chevauchement décélération/rotation estimé », corrections observées, champ `alternatives` si signal insuffisant ; un test interdit « sous/survirage » dans les chaînes exportées) + 2 nouveaux Constats dans la Sheet — 22 tests |
| 4 « Coach » | M27 + M09 | `avantApresLogic` (fenêtres appariées, statuts non testée/probable/validée/non concluante, réserves) + `comparabiliteLogic` (score 0-100, circuits différents = bloquant) + bloc AVANT/APRÈS dans le fil coach + bandeau comparabilité en tête de `comparer` (informe, ne bloque pas) — 34 tests |

| 5 « Terrain » | M02 + projection | `projectionCurviligne` (géométrie pure, non-producteur au registre de provenance) + zones de confiance réduite **atténuées sur le tracé** (chantier du lot 1 soldé) + `prevolLogic` (9 postes en faits, « non mesuré » jamais vert, réseau absent = enregistrement seul) branché dans `placement.tsx` avant l'armement — 44 tests |

| 6 « Tours » | M05 | `validationToursLogic` (classement propre / hors chrono / suspect, chaque marque portant son **fait** chiffré, écart net robuste par MAD **dans les deux sens**, référence = meilleur tour PROPRE avec réserve factuelle si le meilleur brut ne l'est pas) + section Tours (tours douteux atténués, détail au toucher, réserve près du chrono de référence) — 28 tests dont un **verrou lexical** : aucune sortie ne peut prononcer « trafic », « drapeau » ni une faute |

| 6b « Déclaration » | M05 (humain) | Table **`lap_marks` appliquée en production** le 25/08 + types, `lapMarksService`, `marquesTourLogic`, et la Sheet « Déclarer » de la section Tours — 17 tests dont six verrouillent la **cohabitation** : le fait de la machine survit à la déclaration humaine, aucun genre ne retouche le classement |

| 7a « Plan de run » (26/08) | M01 | Construit SUR la brique d'intention existante, jamais à côté. La reconnaissance a trouvé le trou : `grep -n intention app/(app2)/rec/preparation.tsx` rendait **zéro occurrence**, alors que le hub PISTE annonce « Conditions, check-list, intention ». Le lot J5 avait relocalisé la saisie en sortie de séance (`rec/fin`) sans jamais la remettre à l'entrée — le pilote posait ce qu'il voulait regarder « la prochaine fois » et ne le revoyait qu'après avoir roulé. Livré : `planDeRunLogic` (composition PURE de la carte du run — intention + circuit + créneau + conditions **mesurées** ; une entrée absente ne produit AUCUNE ligne) + section « PLAN DU RUN » en préparation + `CarteProchaineFois` portant désormais son **moment** (`avant` / `apres`) : une seule surface d'écriture, un seul `savePendingIntention`, une seule ligne `session_intentions`. **Aucune migration DB.** — 25 tests, dont une garde à cliquet (`planDeRunPose`) qui tient les deux bouts : la promesse du hub, et l'interdit de verdict (« tenue », « réussi », « atteint », « score ») au voisinage de la carte |

**Ce que le lot 7a n'a PAS pris de M01, et pourquoi.** La fiche demande
« critères et conditions », « validation coach », « objectif formulé en action
mesurable » et un coach qui « verrouille les indicateurs de réussite ». Un
critère qu'un tiers verrouille est une consigne ; un score d'atteinte est un
verdict sur une phrase que l'application n'a pas comprise. Le coach LIT une
intention partagée (RLS `SELECT` seul, `session_intentions_coach_select`) ; il
ne l'écrit pas, il ne la borne pas. **La « référence » du cahier n'a pas été
fabriquée** : `choixPaireTours` désigne la référence d'une séance DÉJÀ courue,
et rien dans le dépôt ne persiste un repère choisi en amont — inventer la ligne
aurait été le chiffre fabriqué que la doctrine interdit. Le module nomme
l'absence et laisse la clé à ajouter le jour où la donnée existera.

**Décision de schéma — RENDUE le 25/08 : table dédiée `lap_marks`.** Appliquée
et vérifiée (7 colonnes, 3 politiques select/insert/delete, **aucune UPDATE** —
une marque se retire, elle ne se réécrit pas ; RLS active, trigger de cohérence
séance, zéro grant `anon`, zéro alerte de sécurité). Trois faits dictés par
l'inspection des politiques réelles plutôt que supposées : `laps` n'a pas la
politique « ami » de `telemetry_sessions` ; le coach écrit *sa* ligne à côté
sans toucher le tour ; et surtout **`purge_user_data` anonymise la ligne `users`
au lieu de la supprimer** — le cascade ne se serait jamais déclenché, la purge
est donc patchée à l'ancre avec échec bruyant si l'ancre bouge. Au passage, le
registre `APPLIQUEES_EN_PRODUCTION.txt` avait 19 versions de retard : remis en
phase.

**Historique de la décision (conservé) :** Le recensement de
`database.types.ts` est formel : `laps` n'a ni `tags`, ni `status`, ni `jsonb`,
ni auteur, ni motif — ses trois booléens (`is_outlap`, `is_inlap`,
`is_best_lap`) sont des calculs, pas des déclarations. Aucune table
`lap_marks` / `lap_tags` n'existe. Les trois candidats proches sont inadaptés :
`coach_annotations` exige un `coach_id` (un pilote sans coach ne peut rien y
écrire), `session_insights.lap_classification` est **recalculé** (toute marque
humaine y serait écrasée), `pilot_notes` et `session_feedback` sont au grain
séance. Conséquence : le critère du cahier — « chaque inclusion/exclusion
conserve un motif audité » — **ne peut pas être satisfait en base aujourd'hui**.
Le lot reste donc en lecture automatique pure et nomme le manque.
Deux voies, au choix du fondateur : table dédiée `lap_marks (lap_id,
session_id, author_id, kind, motif, created_at)` — un enregistrement par
décision, l'audit est natif — ou colonne `laps.marques jsonb`, plus simple et
moins auditable. Aucune migration écrite ni appliquée.

Aucune autre migration DB. Gardes du dépôt respectées après passage : cliquet typo
(9 tailles neuves converties à l'échelle `fontSize` de theme/v2), inventaire
des entrées optionnelles (+4 justifiées). Bonus : trois « Il faut » préexistants
reformulés (ecurieLogic, geocodeLogic, ressentiSaisonLogic).
État final : `tsc` 0 erreur · **3 682 tests verts, 0 échec** (291 suites).
Non fait (assumé, dit à l'écran par les modules) : marquage des zones de
confiance sur le tracé GPS (projection curviligne à construire — chantier à part).

## E — Ce qui ne dépend pas de moi

- Banc de paquets sur **vrais boîtiers** (phase 0 du cahier) : matériel requis.
- Validation chrono officiel multi-circuits (phase 1) : terrain.
- Audio en piste : revue juridique + accord circuits/assureurs (§08 du cahier).
- Achat du parc Mini S, procédure de montage : fondateur.

---

## F — Remesure du 29/08/2026

> Règle n° 1 du programme v4 : toute affirmation se remesure. Ce document en
> portait trois devenues fausses en quatre jours.

**Les chiffres de fin du §D sont périmés.** Il annonce « 3 682 tests verts, 0
échec (291 suites) ». Mesuré ce jour sur la même branche : **4 211 tests verts,
335 fichiers de suite** (317 passés, 18 ignorés), `tsc` à 0 erreur.

**Deux constats ont changé de nom le 26/08, et le §A cite encore les anciens.**
`src/components/insights/catalogue.ts` a renommé « Tour idéal composé » en
**« Potentiel démontré »** et « Diagramme G-G » en **« Appuis combinés »**.

**L'audit M10 réclamé par le §B a eu lieu — et sa réponse est écrite.** Le §B
posait « sa continuité aux jonctions n'a pas été auditée ». Elle l'a été le
26/08, et le résultat est consigné dans l'en-tête de
`src/components/insights/TourIdealViz.tsx` : les deux moteurs qui remplissent le
bloc `ideal_lap` écrivent le **meilleur tour RÉEL** de la séance, avec `gap_s: 0`
et `sector_sources: []` — vérifié ce jour à
`supabase/functions/compute-session-insights-v3/index.ts:267-269`. Aucune
composition n'est faite, donc aucune jonction n'existe à vérifier.

Ce qu'il faut en retenir n'est PAS que l'application ment : c'est l'inverse. Le
mot « MICRO-SECTEURS » a été retiré de l'écran, la barre de provenance a été
**supprimée plutôt que fabriquée**, et la ligne de source dit désormais « aucune
continuité vérifiée aux jonctions entre morceaux : jamais un tour garanti ». Le
« tour optimal réaliste » du §03 — blocs entrée-virage-sortie dont la continuité
vitesse / position / accélération est contrôlée — **n'est pas implémenté**, et
l'écran le déclare. Cette ligne du §B est donc close : ce n'est plus un audit à
mener, c'est un module à construire ou à laisser.

### Trois manques confirmés que ce document ne portait pas

- **§03 étape 3 — calibration : absente.** `sessionTelemetryMapping` lit les g
  bruts et se contente d'inverser un signe. Aucune orientation estimée, aucune
  compensation de gravité, aucun contrôle à l'arrêt, aucun couple brut/corrigé
  conservé. Recherché sans résultat dans toute la chaîne d'ingestion
  (« calibrat », « gravit », « orientation », « biais »). C'est le manque
  technique le plus substantiel du cahier qui ne soit pas un lot différé : il
  touche directement les branches Freinage, Accélération et Fluidité du QDI.
- **M16 apex — deux définitions calculées, une seule étiquette.** L'apex
  géométrique et la vitesse minimale de trajectoire sont tous deux calculés dans
  `src/trackviz/analysis.ts` ; l'écran n'en nomme qu'un, et bascule de l'un à
  l'autre en silence. La fiche demande d'afficher **celle utilisée et leur
  décalage**.
- **§09 KPIs produit — sept axes demandés, sept évènements en tout.**
  `src/services/analyticsEvents.ts` ne porte aucun délai, aucune latence, aucun
  compteur d'acceptation ou de rejet des propositions IA — alors que la matière
  existe en base (`coach_ai_drafts.status`). Les portes de sortie du §09 ne sont
  donc pas mesurables aujourd'hui.

### Le catalogue a désormais son propre état

Voir `docs/produit/22_ETAT_CATALOGUE_PRESENTATIONS_2026-08-29.md`. Le fait
dominant : les 65 fiches sont transcrites et le moteur de composition est écrit
et testé, mais **aucune surface ne l'appelle**, et les trois tables dont il
dépend ne sont pas appliquées en production.
