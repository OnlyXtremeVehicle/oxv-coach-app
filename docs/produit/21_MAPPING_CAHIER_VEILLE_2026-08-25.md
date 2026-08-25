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

## B — Ce qui n'existe pas (chantiers réels)

| Module | Nature | Remarque |
|---|---|---|
| M01 Plan de run | écran + logique | compatible doctrine si formulé en observation (« ce que je veux regarder »), pas en consigne |
| M06 Progression de session | vue | tendance robuste + interventions superposées — dérivable des données existantes |
| M07 Carte des opportunités | vue | le tracé a déjà les pastilles de marge ; la coloration gain/perte par segment réconciliée au delta est à écrire |
| M09 Gestionnaire de références | logique + écran | le score de comparabilité (véhicule/conditions/qualité) n'existe pas ; le « seul comparant = vous » actuel est un sous-ensemble |
| M14/M15 Trail / rotation | algos | dérivables des canaux existants (Gx/Gy/yaw) ; labels sous/survirage interdits — déjà l'esprit de l'app |
| M26 Passeport de compétences | produit | ATTENTION doctrine : proche d'un « score global » ; à cadrer avec le fondateur |
| M29–M33 Live coach | infrastructure | WebSocket, état live, console flotte 20 voitures, alertes, modes dégradés — le seul vrai chantier d'architecture ; l'app a déjà `en-direct` (roster en piste) comme embryon |
| M34 CAN/OBD | matériel + intégration | P3, hors Mini S — plus tard, comme le dit le cahier |

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

Aucune migration DB. Gardes du dépôt respectées après passage : cliquet typo
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
