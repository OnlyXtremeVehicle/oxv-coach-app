# PROMPT CLAUDE CODE — LOT V2-L3 · PORTE DATA (4 écrans, version sensorielle)
### Repo oxv-app · DA Instrument · GATE : frames réelles (post-smoke-test) · un lot = un commit — 18/07/2026

---

## CONTEXTE
Le lot le plus technique : l'analyse. **GATE D'ENTRÉE : le smoke test terrain est fait et `telemetry_frames` contient au moins une vraie séance** — les 6 lectures Insight passent des données DÉMO aux frames réelles dans CE lot. Prérequis : L0, BE-1, L1, L2, L4, L5. Skia partout pour les graphes (60 fps, jamais de SVG animé pour les courbes denses). Doctrine : tout est factuel, self-only, le comparateur n'a jamais de gagnant.
Contraintes standard · commit `feat(v2): L3 DATA sensoriel — hub, séance unifiée, comparateur, saison`.

---

## ÉCRAN 1/4 — DATA HUB · `app/(app2)/data/index.tsx`
1. Header condensable « DATA » + eyebrow « VOS SÉANCES ».
2. Filtres `Chip` scrollables : Tous · par circuit (dynamique) · Cette saison.
3. **FlashList SessionCard** (photo média si dispo, chrono millièmes, mini-tracé, badge confiance donnée — `computeDataConfidence` : pastille pleine/partielle/creuse `text.dim`), Stagger, `PullToRefreshDial`.
4. **Mode comparaison** (le TODO v1 enfin réglé) : appui long sur une carte = mode sélection (haptic, bord accent, checkmark) ; barre flottante bas apparaît en spring : « {1|2}/2 sélectionnées · COMPARER » → `/data/comparer?a=&b=` pré-remplies.
5. Export CSV : icône header → `dataExportService` avec Dial de progression.
Vide : illustration tracé animé + « Vos séances apparaîtront ici après votre première journée ».

## ÉCRAN 2/4 — SÉANCE · `app/(app2)/data/session/[id].tsx` ⭐⭐ l'écran pivot de l'app
### Structure
Scroll unique à sections ancrées. **Header condensable + rail d'ancres** : chips horizontales collantes sous le header condensé (Résumé · Tours · Tracé · Télémétrie · Constats · Cœur · Conditions) — tap = scroll animé à l'ancre, la chip active suit le scroll (patron menu ancré Airbnb/UberEats). Hook `useSeance(id)` : allSettled par section.
### Sections
1. **Résumé** : `ChronoHero` m + stats hairline (tours, km, vitesse max — `fetchSessionLaps`).
2. **Tours** : graphe barres Skia — chaque tour une barre, hauteur = temps, **meilleur tour trait or**, delta au meilleur en étiquette mono ; tap barre = haptic tap + sélectionne le tour (état global d'écran `selectedLap` — pilote Tracé/Télémétrie/Cœur) ; scrub horizontal au doigt sur le graphe (gesture) = survol des tours avec tooltip chrono.
3. **Tracé & virages** : `TraceCircuit` Skia grand — trajectoire réelle du tour sélectionné (`loadSessionTrajectory`/`loadLapFrames`), `GlowStroke` ; **pastilles de marge par virage** (`getCornerMarginsZones` — taille = marge factuelle, couleur QDI du type dominant) ; tap virage = Sheet **zoom virage** : agrandissement Skia du segment, phases frein/apex/sortie (points colorés QDI freinage/trajectoire/acceleration), vitesses mono min/max, audio coach si annotation (`getAnnotationAudioUrl`, lecteur hairline) ; 🆕 **B4 dans la Sheet** : onglet « ÉVOLUTION » — superposition des passages de CE virage sur les N dernières séances (traits `text.dim` → plus récents plus clairs, actuel accent ; `cornerEvolutionService` NOUVEAU AUTORISÉ : pur, prend les frames par séance, découpe le segment, normalise) — « votre virage 3 dans le temps », self-only.
4. **Télémétrie** : onglets Chip internes (G-G · Canaux · Heatmap · Replay), TOUT en Skia :
   - G-G : nuage accélérations (points densité, enveloppe hairline), axes mono.
   - Canaux : vitesse + G long/lat empilés, **scrubbing au doigt** : curseur vertical + valeurs live mono qui suivent (60 fps, gesture worklet) — le tour se lit au doigt.
   - Heatmap : tracé coloré par vitesse (échelle QDI froid→chaud SANS rouge accent réservé), légende.
   - Replay : point qui parcourt le tracé au rythme réel (contrôles play/×2, `RollingCounter` du chrono qui défile) — réutilise la logique replay v1, rendu Skia.
5. **Constats** : `ListRow` par insight (`session_insights`) → Sheet lecture : **les 6 visualisations câblées sur les frames réelles** (fin des données DÉMO — supprimer les mocks des `*Viz.tsx`, brancher `loadLapFrames`/segments ; si frames insuffisantes pour une lecture : StateView empty honnête « Données insuffisantes sur cette séance »).
6. **Cœur** (flag+consent+données) : `BiometryStrip` étendue — courbe FC Skia calée sur le tour sélectionné, marqueurs virages en repères verticaux hairline, badge source/confiance. Fait affiché : « FC moyenne {x} · pic {y} au tour {n} » — factuel, jamais interprété.
7. **Conditions** : météo séance (`weather_snapshots`) + ressenti pilote (note du carnet liée) ; 🆕 **B5** : « VOS CHRONOS PAR CONDITIONS » — petits multiples Skia (chrono moyen par T° piste / humidité, sur TOUTES vos séances de ce circuit — `weatherCorrelationService` NOUVEAU : pur, agrégats factuels, aucune prédiction).
8. Footer : « Comparer cette séance » → hub mode sélection · « Bilan » → `/bilan/[id]`.

## ÉCRAN 3/4 — COMPARER · `app/(app2)/data/comparer.tsx`
3 modes (`Chip` : Séances · Tours · Ami) — **jamais de gagnant : deux colonnes symétriques, faits en regard, AUCUNE synthèse « mieux/moins bien »** (grep doctrine renforcé sur cet écran).
- **Séances** : 2 SessionCard en tête (remplaçables) ; dessous, lignes de faits en miroir : meilleur tour, régularité, vitesse max, km — valeurs mono, différence affichée en delta neutre (« +0.412 s ») sans couleur de jugement (les deux en `text.hi`).
- **Tours** : sélecteurs de tour (mini-graphes barres) ; **tracés superposés Skia** (A accent, B or — 2 couleurs d'identité, pas de hiérarchie) + canaux vitesse superposés avec scrubbing commun (le curseur lit les DEUX valeurs).
- **Ami** (`?friend=`) : côte-à-côte v1 rebrandé — mêmes règles, avatar de chacun sur sa colonne, RLS amis inchangée.
Entrée pré-remplie depuis hub/roulages. Partage : view-shot de la comparaison (carte sobre).

## ÉCRAN 4/4 — SAISON · `app/(app2)/data/saison.tsx`
1. **Courbe or** : progression du meilleur tour par circuit (sélecteur Chip circuit) — ligne Skia `heritage.gold` `GlowStroke` doux, points séances, tap point → la séance ; ligne pointillée = record. (`fetchAllSessions` + `computeRegularity`.)
2. **Régularité** : histogramme distribution des écarts (Skia), fait : « 68 % de vos tours à moins d'une seconde de votre meilleur ».
3. **Stats consolidées** : grille StatCell (`loadPilotStats`) RollingCounter au viewport.
4. **Circuits** : cartes circuit roulés (photo/tracé, record mono, nb séances) + silhouettes pointillées des circuits OXV non roulés (« À découvrir ») → Sheet détail circuit (info, records perso, écosystème `ecosystemService`).
Fin de page : « Votre signature » → `/signature` (la boucle se referme).

## PREUVES
tsc 0 · jest vert (cornerEvolution découpage/normalisation, weatherCorrelation agrégats, sélection lap propagée, comparateur sans vocabulaire de jugement — test lexical dédié) · greps 0 · perfs : scrubbing 60 fps profiler sur device (rapport) · captures des 4 écrans + zoom virage + évolution B4 + scrubbing (`roadmap/rapports/v2-l3.md`) · vérif : mocks DÉMO supprimés des 6 Viz, `git grep DEMO_DATA src/features/insights` = 0.

## HORS PÉRIMÈTRE
Vidéo B1 · board TV · services hors les 2 autorisés · toute écriture de données.
