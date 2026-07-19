# PROMPT CLAUDE CODE — LOT V2-L1 · PORTE MIROIR (3 écrans, version sensorielle)
### Repo oxv-app · DA Instrument · niveau Airbnb · un lot = un commit — 18/07/2026

---

## CONTEXTE
Premier lot d'écrans v2. Prérequis : L0 sensoriel + BE-1 mergés. Données via services EXISTANTS uniquement. Tout tappable = `PressScale`. Toute entrée d'écran = `useDoorTransition`. Toute liste = FlashList + `Stagger`. Aucun spinner : `Shimmer`.
Contraintes : tsc 0 · jest vert · grep doctrine 0 · zéro couleur en dur · StateView par section · flags sur écran · commit `feat(v2): L1 MIROir sensoriel — accueil, bilan, signature`.

---

## ÉCRAN 1/3 — ACCUEIL MIROIR · `app/(app2)/index.tsx`

### Hook `useMiroirHome()` (testé)
Promise.allSettled : `lastSession`+laps · `qdi` · `narrative` · `nextDay` · `stats` · `offerType` · **`vehiclePhoto`** (première photo du garage — `users.media` du véhicule principal, patron garage v1) · **`lastSessionPhoto`** (premier média de la dernière session). Mode : `apres_seance` (<7 j) / `entre_journees`. Modes capture S5/countdown/passif v1 prioritaires (logique extraite, non dupliquée).

### Layout
1. **Header condensable** (`useCondensingHeader`) : eyebrow « PADDOCK » `accent` (or « HERITAGE » si tier) · titre « MIROIR » display · avatar 34px `PressScale` → `/vous`. Au scroll : barre blur condensée.
2. **HÉROS — la photo d'abord** ⭐ :
   - `apres_seance` : `HeroPhoto` 200px (lastSessionPhoto ; fallback tracé Skia du circuit `GlowStroke` sur `bg.card`) — scrim bas, superposés : eyebrow « DERNIÈRE SÉANCE · {circuit} », `ChronoHero` m (RollingCounter au mount, `celebrate` si record), date `text.mid`. Tap → **`HeroMorph`** vers `/bilan/[id]` (le chrono et la photo voyagent).
   - `entre_journees` + nextDay : `HeroPhoto` 200px = **LA VOITURE DU MEMBRE** (vehiclePhoto — sa GT l'attend ; fallback visuel circuit) — scrim, superposés : `Dial` m compact (J-x, `NeedleSweep` au mount) à gauche, à droite « {circuit} » bodySemi 14 blanc + date + météo (≤7 j) + bouton « PRÉPARER » pill hairline claire. C'est l'écran d'attente émotionnel : sa voiture + le cadran.
   - `entre_journees` sans journée : carte `bg.card` : illustration SVG animée (tracé qui se dessine), « Aucune journée au calendrier », CTA « RÉSERVER » bord `accent` (flag `app_payments` OFF → `/club` + analytics `reserve_intent`).
3. **Signature compacte** : carte — header eyebrow « SIGNATURE · VOUS VS VOUS » + chevron ; `RadarQdi` s (tracé progressif au premier viewport, points qui claquent) + légende 5 pastilles. Tap → `/signature`.
4. **Fait** : texte nu (narrative ou `seasonFact(stats)` mono) — l'espace autour EST le design.
5. **Rangée stats hairline** : RECORD (millièmes accent) · SAISON km · HERITAGE or x/4 ou SÉANCES. Compteurs `RollingCounter` au premier viewport.
6. **Bandeau rituel B3** conditionnel (hairline, dismiss swipe, deep link).
7. `PullToRefreshDial` sur le scroll — le refresh EST un cadran.
Squelettes Shimmer aux formes réelles (héros 200px, radar pentagone). Stagger d'apparition global 45 ms.

### Tests
`useMiroirHome` (modes, boundary 7 j, fallbacks photo), `seasonFact`, rendu 3 variantes héros, gating flag.

---

## ÉCRAN 2/3 — BILAN DE SÉANCE · `app/(app2)/bilan/[sessionId].tsx`

### Hook `useBilan(sessionId)` — inchangé de spec (laps, analyse, keyMoments, annotations, thread, médias, biométrie gatée flag+consent, debrief).

### Layout
1. Arrivée par `HeroMorph` (depuis SessionCard/héros) sinon `useDoorTransition`. Header condensable : back · « {date} · {circuit} » mono · partage → Sheet export (PDF / carte trophée).
2. **Ouverture émotionnelle** : si médias session : `HeroPhoto` 180px (photo du jour, scrim) avec superposé eyebrow « BILAN » `accent` + `ChronoHero` l RollingCounter (`celebrate`+`RecordFlash`+haptic si record personnel) + « 22 tours · 87 km ». Sans média : même bloc sur fond base, tracé Skia en filigrane `text.dim` 8 % derrière le chrono.
3. **Carte tracé** : `TraceCircuit` Skia — trait fond + `GlowStroke` progression animée 1,2 s au viewport ; puces keyMoments pop spring séquencé (stagger 80 ms), puce OR si annotation coach au virage. Bande annotation coach sous le tracé (bord or 2px, eyebrow « NOTE DU COACH · {nom} », pagination points si plusieurs). Absente si aucune.
4. **Quatre piliers** : 4 `PillarBar` remplissage animé au viewport, valeurs absentes = « — ».
5. **Moments-clés** : `ListRow` hairline (puce QDI + fait) → `/data/session/[id]` (ancre).
6. **BiometryStrip** (flag+consent+données) : sparkline Skia, point pulsé au bpm moyen, badge source + confiance.
7. **Debrief J+1** : carte, texte 3 actes ; fallback pédagogique v1.
8. **Fil présentiel** : 3 dernières bulles + réponse (`useCoachThread`).
9. **Souvenirs** : FlashList horizontale `Photo` 64px radius cell, Stagger ; tap → viewer plein écran (zoom pinch gesture-handler, fond noir, dismiss swipe bas — patron photos Airbnb). Cellule « ◉ VIDÉO DU TOUR » si flag `video_overlay` (OFF → absente).
10. Footer : « Ouvrir dans Data » `ListRow` accentuée.

### Tests
Hook (gating fail-closed, record), RecordFlash déclenché une seule fois par session (garde persistée MMKV — un record ne se re-célèbre pas), mapping piliers, annotation présente/absente, viewer photos.

---

## ÉCRAN 3/3 — SIGNATURE · `app/(app2)/signature.tsx`
1. Header condensable : « SIGNATURE » display.
2. `RadarQdi` l plein largeur — **entrée théâtrale** : axes se dessinent (600 ms), polygone se déploie du centre (spring), points claquent avec `doorSnap` séquencé. Labels sommets : Cap · Trajectoire · Visée · Plongée · Anticipation (figés). Branches nulles masquées + « x/5 axes mesurés ».
3. « vous vs vous · 30 jours » mono centré.
4. **Empreinte** : FlashList horizontale mini-radars mensuels (`listMonthlyQdi`), Stagger, tap = le grand radar se MORPHE vers les valeurs du mois tapé (interpolation des 5 sommets, spring — le radar est vivant) + mois affiché ; re-tap = retour 30 j.
5. Pilier physiologique BIO-4 : section gatée flag+consent+≥3 séances, constante `PHYSIO_PILLAR_LABEL='Aplomb'` `// TODO_ARBITRAGE D2`. OFF aujourd'hui.
6. Lien « Voir la saison complète » `ListRow` → `/data/saison`.
Tests : morph valeurs mensuelles, labels snapshot, gating physio.

---

## PREUVES
tsc 0 · jest vert · greps 0 · captures (3 écrans × états, + vidéo courte du HeroMorph et du PullToRefreshDial) dans `roadmap/rapports/v2-l1.md` · perfs : aucune frame drop au profiler sur le morph (rapport) · navigation vérifiée sur les 6 chemins.

## HORS PÉRIMÈTRE
DATA/REC/CLUB/VOUS · services · activation de flags · vidéo B1.
