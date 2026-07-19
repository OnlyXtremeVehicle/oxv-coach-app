# PROMPT CLAUDE CODE — LOT V2-L5 · PORTE CLUB (7 écrans + Groupes + Convoi + Carnet Heritage)
### Repo oxv-app · DA Instrument · niveau Airbnb · un lot = un commit — 18/07/2026

---

## CONTEXTE
Les autres : coaching, amis, territoire, partenaires, galerie, pass — et la couche sociale nouvelle (A3 groupes, C2 convois, C3 carnet Heritage). Prérequis : L0, BE-1, L1, L4. Services existants + BE-1 (`referralService`, `convoysService`). Doctrine : social = faits partagés, JAMAIS de classement, jamais de gagnant.
Contraintes standard · commit `feat(v2): L5 CLUB sensoriel — coaching, territoire, galerie, groupes`.

---

## ÉCRAN 1/7 — CLUB HUB · `app/(app2)/club/index.tsx`
Fil vertical de blocs (Stagger), chacun n'apparaît que s'il a du contenu — le hub respire :
1. Header condensable « CLUB » display + eyebrow « LE PADDOCK » accent.
2. **Mon coaching** : si binôme actif — carte coach : `Photo` avatar 48px, nom, prochaine réservation, dernier message aperçu → `/club/coaching`. Sinon carte découverte : « Un regard extérieur sur votre pilotage » + visages des coachs publiés (rail 40px chevauchés −8px, patron Airbnb) → coaching.
3. 🆕 **Mon groupe (A3)** : si crew — carte icône `groupe` : « Le groupe de {owner} », rail avatars membres, dernier fait factuel (« Pierre a roulé jeudi · Haute Saintonge » — depuis sessions des membres opt-in `show_attendance`, service `referralService.getMyCrew` + jointure attendance). AUCUN chrono d'autrui affiché ici (doctrine : le fait de rouler, pas la performance).
4. **Roulages à venir** : cartes invitation (avatar, date, circuit, Accepter/Décliner PressScale) — `roulagesService`.
5. **Pass** : prochaine inscription QR compacte → `/club/pass`.
6. **Partenaires** : rail horizontal `Photo` logos/visuels 72px → `/club/partenaires`. Jamais de push télémétrique (garde-fou v1 conservé).

## ÉCRAN 2/7 — COACHING · `club/coaching.tsx`
3 onglets Chip swipe (Trouver · Mon coach · Demandes) :
- **Trouver** : FlashList cartes coach — `HeroPhoto` 130px (photo pro du coach), nom display 12, spécialités chips, expérience mono ; tap → **Sheet fiche** : photo, bio, avis factuels (`coach_reviews` — citations, PAS de note moyenne étoilée : doctrine sans scoring), calendrier dispo, « DEMANDER UNE SESSION » accent → `requestBooking` (formulaire date/attentes).
- **Mon coach** : carte binôme + consentements granulaires (switches — `pilotConsentService`, révocation immédiate) + factures (`pilotCoachBillingService`, lien paiement externe, flag coach_billing respecté) + bouton fin de binôme (Sheet confirmation sobre).
- **Demandes** : timeline hairline états (envoyée/acceptée/passée) + avis post-session (texte libre, pas d'étoiles).

## ÉCRAN 3/7 — ROULAGES & AMIS · `club/roulages.tsx`
2 onglets :
- **Roulages** : invitations + historique « roulé ensemble ×{n} » (cartes date/circuit/avatars).
- **Amis** : recherche @handle (champ + résultats live), FlashList amis (avatar, dernier circuit factuel), demande/acceptation. Action sur ami : « Comparer côte à côte » → `/data/comparer?friend=` (L3 ; placeholder accepté d'ici là). 🆕 badge `groupe` sur les amis du même crew.

## ÉCRAN 4/7 — TERRITOIRE · `club/territoire.tsx` ⭐ l'écran carte
3 onglets (Carte · Routes · Créer) :
- **Carte** : plein écran (module carto v1, garde isExpoGo) — style sombre titane si le provider le permet (sinon défaut) ; pins OXV : circuits (insigne mini), pings sociaux (`social_pings`), belles routes (trait or pointillé). Bottom sheet persistante à poignée (patron Airbnb Maps) : liste de ce qui est visible à l'écran, synchronisée au pan.
- **Routes** : FlashList cartes route — mini-tracé Skia `GlowStroke` or sur `bg.card`, nom, distance/durée mono, badge « CERTIFIÉE OXV » hairline or si certifiée ; tap → détail : tracé plein, étapes, « Ouvrir dans Plans » ; 🆕 **C2** si route certifiée liée à une journée à venir : bloc convoi (RDV, participants rail avatars, REJOINDRE — `convoysService`, flag `convoys`).
- **Créer** : creer-route (GraphHopper/Overpass v1) + creer-trace (import OSM v1) habillés v2 — l'aperçu du tracé se dessine en Skia au fil de la saisie.

## ÉCRAN 5/7 — PARTENAIRES · `club/partenaires.tsx`
FlashList cartes — `HeroPhoto` visuel partenaire 120px (fallback monogramme v1), catégorie chip, offre catalogue si publiée (`listMarketplace`) ; tap → Sheet fiche : visuel, description, offres, **« ÊTRE MIS EN RELATION »** accent → consentement explicite une phrase factuelle (« Vos coordonnées — jamais vos données de pilotage — seront transmises ») → `requestPartnerContact`. Catalogue vide prod → StateView empty propre (« Les offres arrivent »).

## ÉCRAN 6/7 — GALERIE · `club/galerie.tsx` ⭐ l'écran émotion
- **Grille photos** : FlashList masonry 2 colonnes `Photo` (blurhash), Stagger — tous médias (`listAllPilotMedia`) groupés par séance (headers date/circuit sticky discrets).
- **Viewer plein écran** : pinch zoom + swipe horizontal entre photos + dismiss swipe bas (gesture-handler, fond noir pur, infos séance en bas — patron photos Airbnb exact).
- **Partages** : onglet — carte trophée (view-shot, rendu v2 : chrono + tracé or sur titane) ; liens de partage scopés (`sharesService`) avec liste des liens actifs révocables `ListRow`.
- 🆕 **C3 Carnet Heritage** (tier Heritage uniquement, sinon section ABSENTE — pas teasée) : carte `HeritageBand` « VOTRE SAISON {année} » → génération livret PDF luxe : couverture insigne or, 4 Signatures (une page/session : chrono, tracé, piliers, photo), page évolution, colophon. Étend `bilanPdfExport` en `heritageBookExport` (service NOUVEAU AUTORISÉ, réutilise les briques PDF existantes). Progression de génération en Dial. Partage fichier natif.
- Cellule « ◉ VIDÉO DU TOUR » si flag `video_overlay` (OFF → absente).

## ÉCRAN 7/7 — PASS OXV · `club/pass.tsx`
Cartes inscription à venir : date display, circuit, offre chip, **QR plein** (luminosité max au tap) ; historique hairline dessous ; état « aucune inscription » → illustration + CTA vers réservation (flag) ou club. (Scan côté admin inchangé.)

---

## PREUVES
tsc 0 · jest vert (crew fact feed sans chrono d'autrui — test explicite doctrine, convoi join/leave, consentement partenaire, gating Heritage C3, viewer gestures) · greps 0 (attention particulière aux fiches coach : zéro vocabulaire de scoring) · captures 7 écrans + viewer + livret Heritage (`roadmap/rapports/v2-l5.md`).

## HORS PÉRIMÈTRE
Comparateur ami (L3) · vidéo B1 · paiements · écran board TV.
