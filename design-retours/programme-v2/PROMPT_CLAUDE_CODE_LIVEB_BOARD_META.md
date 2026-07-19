# PROMPT CLAUDE CODE — LOT LIVE-B · ÉCRAN PADDOCK + META DISPLAY + MULTI-LIVE
### Repo oxv-app + repo site · GATE : DÉCISION CLASSEMENT TRANCHÉE PAR LE FONDATEUR · un lot = un commit par repo — 18/07/2026

---

## CONTEXTE
La couche publique du live : l'écran TV du paddock, la vue Meta du coach, le roster multi-voitures. **GATE JURIDIQUE ABSOLUE : ne pas exécuter tant que la décision « classement » n'est pas tranchée** (dossier avocat §1 — un classement compétitif peut requalifier l'événement). Deux variantes de l'écran TV sont spécifiées ; le fondateur en active UNE.
Prérequis : BIO-2 (stripHealth existe). Canaux : on AJOUTE `live:board:<sessionId>` — les canaux coach existants ne bougent pas.

## LIVRABLE 1 — Canal board · Supabase
- Topic `live:board:<sessionId>` + policy `realtime.messages` : SELECT pour tout authentifié inscrit OU device board autorisé (compte service board, token dédié) ; INSERT réservé au relais (auth pilote en capture de la session).
- Émission depuis `liveRelayRunner` : événement `board` 1 Hz max par voiture, payload = **sortie de `stripHealth()` exclusivement** : {pilotHandle, carNo, lastLapMs, bestLapMs, sector, ts}. Test : payload biométrique injecté → jamais émis sur board.

## LIVRABLE 2 — Écran TV paddock (repo SITE, route `/board/<sessionId>` plein écran)
DA Instrument XXL (TV 4K à 6 m) : fond `#14151A`, JetBrains Mono très grand, insigne discret, **slot branding partenaire B2B** (D3 : logo sobre coin bas droit si session type b2b).
- **VARIANTE A — « TABLEAU DE MARCHE » (sans classement — conforme manifeste)** : liste ordonnée par NUMÉRO DE VOITURE (jamais par chrono), colonnes : n° · pilote · dernier tour · meilleur tour personnel · secteur en cours (pastille). Aucun rang, aucun tri par performance, aucune couleur de podium. Bandeau bas : « Vous ne pilotez contre personne d'autre que vous-même. »
- **VARIANTE B — « CLASSEMENT » (SI ET SEULEMENT SI le fondateur l'active après avis avocat)** : tri par meilleur tour, rangs affichés. Code présent derrière constante `BOARD_MODE` — défaut = A.
- Reconnexion silencieuse, état « en attente de voitures » élégant (tracé animé), rotation automatique si >12 voitures (pages 8 s).

## LIVRABLE 3 — Vue Meta Display (coach) · brancher `ar.tsx`
Le no-op existant devient l'abonné minimal du canal coach existant (`live:session:`) : rendu ultra-contraint (3 lignes max, contraste maximal) : pilote focus · dernier tour · **FC si consentie** (le coach y a droit — canal coach, pas board). Navigation vocale/tactile minimale entre pilotes du roster. Fallback propre si lunettes absentes (écran téléphone miroir).

## LIVRABLE 4 — Multi-live roulage (D1) · espace coach
Écran roster jour J étendu : FlashList voitures en piste (consommateur des événements board + coach), tri par n° de voiture, pastilles état (en piste/stands), tap → focus détaillé existant. Charge : 20 voitures × 1 Hz = trivial ; test de rendu à 20 simulées.

## PREUVES
tsc 0 · jest vert (policy board testée RLS, stripHealth sur chaque payload board, BOARD_MODE défaut A) · test réel : 2 téléphones + 1 navigateur TV · captures TV variante A (+ B désactivée) · grep : aucune donnée santé dans `app/board` ni dans les payloads board (test automatisé) · rapport `roadmap/rapports/live-b.md`.

## HORS PÉRIMÈTRE
Chronométrage officiel · transpondeurs · tout affichage santé public (interdit définitif).
