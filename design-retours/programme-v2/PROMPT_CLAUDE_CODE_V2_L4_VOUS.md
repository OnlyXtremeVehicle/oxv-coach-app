# PROMPT CLAUDE CODE — LOT V2-L4 · PORTE VOUS (8 écrans + Fondateurs + Parrainage + Réservation OFF)
### Repo oxv-app · DA Instrument · niveau Airbnb · un lot = un commit — 18/07/2026

---

## CONTEXTE
L'identité du pilote + les 3 chantiers business (A1 flag OFF, A2, A3). Prérequis : L0 sensoriel, BE-1, L1. Services existants + ceux de BE-1 (`founderService`, `referralService`, `consentService` étendu). Primitives L0 obligatoires partout (PressScale, Shimmer, Stagger, ListRow, door, header condensable).
Contraintes standard : tsc 0 · jest vert · greps 0 · StateView par section · flags sur écran · commit `feat(v2): L4 VOUS sensoriel — identité, fondateurs, parrainage, réservation (OFF)`.

---

## ÉCRAN 1/8 — VOUS HUB · `app/(app2)/vous/index.tsx`
1. **Héros passeport** ⭐ : `HeroPhoto` 190px — photo du véhicule principal du garage (fallback : insigne trait Skia sur base) ; scrim ; superposés : avatar 56px bord 2px (`heritage.gold` si Heritage sinon `border.strong`), nom bodySemi 16, @handle mono `text.mid`, ligne stats mono 10 : « {palier} · {records} records · {km} km » (`loadPassport`, RollingCounter au premier viewport). Si Heritage : eyebrow « HERITAGE » or + `heritage.glow` sous le trait de l'avatar.
2. 🆕 **A2 Carte Fondateur** (flag `founders`) : selon `founderService.getMyApplication()` :
   - aucune : carte hairline — icône `insigne`, « MEMBRE FONDATEUR », **jauge 12/30** (barre hairline remplie or, compte `getFoundersCount()` RollingCounter), « {n} places restantes » `text.mid`, CTA « CANDIDATER » bord accent → Sheet fondateur (cf. bas).
   - pending : même carte, badge « CANDIDATURE EN EXAMEN » `text.mid`, jauge live.
   - approved : bande `HeritageBand`-like mais accent : « FONDATEUR N° {rang:02d} » mono — le badge définitif (tranche l'arbitrage v1 : affiché après validation admin).
3. 🆕 **A3 Mon code** : carte compacte — « VOTRE CODE » eyebrow, code 8 car. monoSemi 18 letterspacing 4, bouton copier (haptic tap + toast « Copié ») + partage natif (message pré-écrit sobre : « Rejoignez-moi sur OXV — {code} »). Dessous si crew : `ListRow` icône `groupe` « Le groupe de {owner} · {n} membres » → `/club` (section groupe).
4. **Sections** : `ListRow` × 7 avec `OxvIcon` : Profil public (`casque`) · Garage (`cle`) · Carnet (`data`) · Équipement (`ceinture`) · Licence & documents (`drapeau-damier`) · Réglages (`cle`) · Support (`incident`) — Stagger d'apparition.
5. Pied : version app mono `text.dim` centré.

### Sheet Fondateur (A2) — `vous/fondateur` (Sheet plein)
Icône `insigne` trait qui se dessine (1,2 s) · « 30 membres. Jamais plus. » display 13 · jauge 12/30 · champ motivation (20-2000 car., compteur) · champ code parrain optionnel (préchargé si venu par A3) · « TRANSMETTRE » fond accent → `founderService.apply` → état pending avec haptic `record`. Erreurs inline (StateView error par champ). Flag OFF → la carte hub est absente, la route rend un empty.

---

## ÉCRAN 2/8 — PROFIL PUBLIC · `vous/profil.tsx`
Consultation = ce que voient les autres (patron aperçu Airbnb) : `HeroPhoto` couverture (photo dédiée si présente sinon véhicule) ; avatar chevauchant −28px ; nom, @handle, bio ; chips véhicules (nom + n° voiture) ; réseaux `ListRow`. Bouton « MODIFIER » bord accent → mode édition inline (mêmes blocs, champs actifs, photo remplaçable via picker → upload service v1) ; write-path couverture : réutiliser le patron upload garage (bucket users-media). Opt-in Pavillon : switch `ListRow` avec sous-texte factuel (migration pavillon existante). Sauvegarde : bouton collant bas, haptic tap, retour consultation animé (cross-fade door).

## ÉCRAN 3/8 — GARAGE · `vous/garage.tsx` ⭐ l'écran photo
FlashList verticale de **cartes véhicule plein cadre** : `HeroPhoto` 150px par véhicule (première photo), scrim, superposés nom bodySemi + specs mono `text.mid` ; Stagger. Tap → Sheet véhicule : carrousel photos (pager gesture, points), specs `ListRow`, **journal de réglages** (entrées datées hairline, ajout champ + date auto — service garage v1), bouton « Définir principal » (étoile — pilote le héros de l'accueil et du hub). Ajout véhicule : carte pointillée hairline + picker photos multi. Vide : illustration SVG animée + « Votre garage vous attend ».

## ÉCRAN 4/8 — CARNET · `vous/carnet.tsx`
4 onglets `Chip` (Notes · Intentions · Objectifs · Programme) — swipe horizontal entre onglets (gesture, indicateur hairline glissant spring) :
- **Notes** : FlashList hairline datées + météo du jour de la note (`pilot_notes` + weatherService), composer bas.
- **Intentions** : « la prochaine fois » — carte par intention liée à sa séance source (mini-tracé), état honoré/en attente factuel (`session_intentions`).
- **Objectifs** : perso, invisibles coach (mention explicite `text.dim` en tête — la confiance se dit) ; progression barre hairline SI l'objectif est mesurable (`pilotGoalsService`).
- **Programme** : lecture des cycles partagés par le coach (`listSharedCyclesForMe`) — cartes semaine, contenu coach affiché tel quel (espace prescriptif autorisé), badge coach.

## ÉCRAN 5/8 — ÉQUIPEMENT · `vous/equipement.tsx`
- Carte **boîtier** : visuel trait Skia du RaceBox, état pastille, batterie Dial s (LE cadran de l'écran), n° série, dernier appairage (`deviceHealthService`).
- 🆕 Carte **ceinture** (coachés) : icône `ceinture`, état appairage, « gérée au paddock ».
- 🆕 Carte **Apple Watch** : icône `montre`, statut autorisation HealthKit (accordée/refusée/non demandée) + bouton « Autoriser » → `healthKitService.requestAuthorization()` (gate consentement biometry — sinon renvoie vers Réglages consentements). iOS only ; Android : carte absente.

## ÉCRAN 6/8 — LICENCE & DOCUMENTS · `vous/documents.tsx`
- **Carte licence FFSA** : rendu carte physique (ratio carte bancaire, fond card2, insigne, n° mono) → plein écran luminosité max + view-shot partage.
- **Décharge** (flag `pilot_waivers`) : OFF → `ListRow` « Décharge — disponible prochainement » `text.dim` ; ON → flux e-sign v1 rebrandé (texte avocat).
- **Pacte · CGU · Confidentialité** : `ListRow` → lecteur markdown bundlé v1, typographie v2 (corps 15 lh 1.65 — le juridique aussi se lit bien).

## ÉCRAN 7/8 — RÉGLAGES · `vous/reglages.tsx`
UN écran, 4 groupes `SectionHeader` + `ListRow` switches :
1. **Notifications** : préférences par catégorie (existant) + 🆕 rituels B3 (J-3, bilan prêt, records) — switches individuels.
2. **Consentements** : IA débrief · IA coach · audience/analytics · live coach · 🆕 **biométrie** (kind BE-1) — chaque switch : sous-texte factuel une ligne + révocation immédiate (haptic warn à la révocation, confirmation Sheet pour biométrie : « Vos données cœur cessent d'être collectées. Les données passées restent visibles de vous seul. »).
3. **Données & sécurité** : Exporter mes données (`dataExportService`, progression) · Supprimer mon compte (`accountService` J+30 — Sheet confirmation double, texte factuel du délai).
4. **Session** : Déconnexion.

## ÉCRAN 8/8 — SUPPORT · `vous/support.tsx`
FlashList tickets (état pastille) + fil par ticket (bulles hairline) + composer — `supportService` v1, habillage v2. Vide : illustration + « Une question ? Écrivez-nous. »

---

## 🆕 FLUX RÉSERVATION A1 — `app/(app2)/reserver/` (CONSTRUIT COMPLET, FLAG `app_payments` OFF)
Patron checkout Uber Eats : simple, visuel, 3 pas max. Chaque écran vérifie le flag (OFF → écran « Réservations à l'ouverture — {founders_count}/30 fondateurs » + CTA candidature).
1. **Catalogue** `reserver/index` : FlashList de cartes journée — `HeroPhoto` circuit 120px, date display, offre `Chip` (Access/Signature), **places restantes** : jauge 20 segments hairline (remplis `text.dim`, restants accent) + « {n} places » — la rareté se voit ; complet → « LISTE D'ATTENTE » bord `border.strong`. Données : tables SITE `sessions`+`pricing` via service NOUVEAU AUTORISÉ ICI `bookingCatalogService` (SELECT read-only, inspection MCP préalable des colonnes réelles, correctif Heritage 249 000 cents vérifié).
2. **Détail & choix** `reserver/[sessionId]` : héros circuit plein, programme de la journée hairline timeline, sélection offre (cartes radio), récap prix TTC mono.
3. **Paiement** `reserver/paiement` : récap + méthodes — **structure prête, boutons inertes flag OFF** (Stripe PaymentSheet branché au lot A1-ON ; IAP abonnement idem). Mention légale placeholder `// TODO_AVOCAT CGV`.
Analytics à chaque pas (`reserve_funnel_1/2/3`) — même flag OFF via le CTA accueil, pour mesurer l'intention AVANT l'ouverture.

## PREUVES
tsc 0 · jest vert (founder states, referral copy/redeem UI, gating watch/consent, flag OFF partout, jauge places) · greps 0 · captures 8 écrans + sheet fondateur + 3 pas réservation (`roadmap/rapports/v2-l4.md`) · vérif : `bookingCatalogService` = SELECT only, zéro write.

## HORS PÉRIMÈTRE
Activation paiements (A1-ON) · e-sign décharge ON · scan Polar · écrans CLUB/DATA.
