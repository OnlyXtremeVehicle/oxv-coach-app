# Rapport semaine 6 — Carte du circuit + Zoom virage

**Date** : 24 mai 2026
**Auteur** : Claude Code (Opus 4.7 — 1M context)
**Statut** : Cœur de l'app continue. 5 jours livrés. La grammaire visuelle du circuit est en place.

---

## Ce que j'ai fait

### Jour 1 — Topologie Beltoise + helpers projection GPS → SVG

**[src/lib/circuitTopology.ts](src/lib/circuitTopology.ts)** — 14 virages hardcodés (placeholders V1, à recalibrer sem 11 via la procédure section 9 des algos) :

- `index` 1-14 + `name` (placeholder, ex. "V6 — Le S des chênes (entrée)")
- Position GPS approximative dans le bbox connu (`apexLat`, `apexLon`)
- Coords SVG dans le viewBox 1000×600 (`svgX`, `svgY`) pour rendu rapide sans projection
- Profil `pace: fast | medium | slow` — utilisable pour le manifeste contextuel par virage en V2
- Helpers : `getCorner(i)`, `nextCornerIndex(i)`, `previousCornerIndex(i)` (cycliques 1↔14)
- `mockCornerMargins(sessionId)` — PRNG reproductible (FNV-1a hash + sin) pour que la même session affiche les mêmes couleurs à chaque ouverture. Vraie data en sem 7+

Commentaire explicite dans le fichier : ces valeurs **sont des placeholders**. Le tracé SVG officiel en base est simplifié (221 chars, 12 segments). Les positions des 14 virages sont visuellement plausibles sur ce SVG mais ne correspondent pas à un relevé topométrique. Calibration officielle en sem 11.

**[src/lib/geoToSvg.ts](src/lib/geoToSvg.ts)** :
- `geoToSvg(lat, lon, bbox, viewBox)` — projection cartésienne 1D × 1D, latitude inversée (cohérence Y-down du SVG)
- Clamp dans le viewBox (un point hors-circuit reste sur le bord, pas hors-écran)
- `geoPolylineToSvg(points[], bbox, viewBox)` + `polylineToPathD(svgPoints[])` — helpers pour superposer un tracé du pilote sur le SVG circuit (utilisés à partir de sem 7 quand on aura des positions live)
- `null` si bbox dégénéré (largeur ou hauteur nulle)

**9 nouveaux tests** ([src/lib/__tests__/geoToSvg.test.ts](src/lib/__tests__/geoToSvg.test.ts)) : 4 coins du bbox, centre, clamp, bbox dégénéré, polyligne ordonnée, polylineToPathD (vide / single / multi).

**Total tests** : **52 passants**.

### Jour 2 — Écran #14 Carte du circuit

[app/(app)/carte.tsx](app/(app)/carte.tsx) :

- Eyebrow `CARTE DU CIRCUIT` + nom du circuit (`Haute Saintonge`)
- Container avec `aspectRatio: 1000/600`, fond `background.secondary`, bordure subtle
- `<Svg viewBox="0 0 1000 600">` + `<Path d={circuit.trackSvgPath} stroke=text.secondary>` pour le tracé
- 14 pastilles `<Pressable>` superposées via positionnement absolu en `%` (calculés depuis `svgX/svgY` et le viewBox)
  - Couleur = `mockCornerMargins[index]` (vert / jaune / rouge)
  - Numéro du virage centré dans la pastille (font `semibold`, contraste sur fond noir)
  - `transform: scale(0.92)` sur pressed pour feedback tactile
- Tap → `/(app)/virage?index={n}&sessionId={…}`
- Bouton "Retour au bilan" discret en bas

**Choix architectural** : pastilles en `<Pressable>` RN absolues, pas en `<Circle onPress>` côté SVG — `onPress` sur les éléments SVG est capricieux sur Android dans `react-native-svg` 15.x. L'approche absolue est triviale, performante, et permet un design pixel-perfect des hit-zones.

### Jour 3-4 — Écran #15 Zoom virage

[app/(app)/virage.tsx](app/(app)/virage.tsx) :

3 éclairages doctrine :

**Section TRAJECTOIRE** — "Votre tracé contre l'optimum"
- V1 placeholder : "Visualisation à venir. La sem. 7 connectera votre trajectoire réelle au tracé de référence Beltoise pour ce virage."

**Section PHYSIQUE** — "Ce que la voiture a vécu"
- 3 StatRows : Vitesse à l'entrée / G latéral max / Vitesse à la sortie
- Valeurs `—` en V1 (vraies stats sem 7-8 quand `margin_breakdown` portera les valeurs par virage)
- Caption : "Données par virage en cours de calcul (sem. 7-8)."

**Section QUESTION**
- Une seule phrase italique centrée : *"Était-ce volontaire ?"*
- Pas de réponse attendue. Pas d'instruction. Verbe doctrinal pur.

Navigation :
- Header : eyebrow `ZOOM VIRAGE 07`, titre du virage en mode `screenTitle`, étiquette `marginLabelOf(zone)` colorisée
- 2 boutons Précédent / Suivant (cycliques 1↔14) — `router.replace` pour éviter d'empiler les écrans dans la pile
- Retour en bas vers la carte

**Pas de swipe gestuel V1** : `react-native-gesture-handler` est installé, mais l'implémentation propre (avec `Reanimated`, transitions, edge cases) doublerait le scope. Renvoyé en V1.1.

État `VirageNotFound` si l'index n'est pas dans `[1, 14]`.

### Jour 5 — Polish + rapport

- Routes ouvertes : depuis le bilan, les 4 NavCards "Carte du circuit" + "Détails par virage" + … pointaient vers `/(app)/carte`, `/(app)/virage` (existants), `/(app)/prochaine-fois`, `/(app)/progression` (à faire sem 7)
- `Carte` → fonctionnel
- `Détails par virage` → la card du bilan ouvre `/(app)/virage` (sans paramètre), ce qui ouvre le virage 1 par défaut. Cohérent avec la navigation hub→carte→virage : depuis la carte on a le détail d'**un virage spécifique** ; depuis le bilan on entre dans le **flux des virages**.

---

## Ce qui est testé et fonctionnel

- [x] `npx tsc --noEmit` : ✅ 0 erreur
- [x] `npm run lint` : ✅ 0 erreur, 4 warnings legacy V1 (sessionsService inchangé)
- [x] `npm run format:check` : ✅ tout conforme
- [x] `npm test` : ✅ 52/52 tests, en ~10s
- [x] Le projection geo↔svg est testée sur le bbox réel de Beltoise

Pas validable sans device :
- [ ] Affichage du SVG circuit sur device (qualité du rendu RN-SVG sur iPhone / Android)
- [ ] Hit-test des pastilles (cibler une pastille de 36×36 avec un pouce — taille tactile mini Apple 44pt, marge à voir)
- [ ] Navigation hub → bilan → carte → virage et retour

---

## Ce qui reste en suspens

Identique aux semaines précédentes, plus :

- Les vraies marges par virage (sem 7-8 dans `margin_breakdown` jsonb)
- La trajectoire du pilote superposée au tracé (sem 7+, utilisera `geoPolylineToSvg`)
- Les stats Physique (vitesse entrée / G_lat / vitesse sortie) — nécessite découpage par virage des frames, à dériver des positions GPS

---

## Questions pour Gabin

### Q19 — Nommer les 14 virages de Beltoise

J'ai mis des placeholders ("V6 — Le S des chênes (entrée)" etc.). Pour que le rendu sonne juste, j'aurais besoin des **vrais noms** des 14 virages utilisés par les pilotes du club. Vous avez ça quelque part (briefing piste, hand-out FFSA, conversation pilotes) ?

Si vous n'avez pas tout, on peut faire :
- V1 — Numéros uniquement (le plus neutre, c'est ce que j'ai aujourd'hui sauf le S des chênes)
- V1.1 — Noms collectés lors du test alpha de juillet

### Q20 — SVG tracé : le 221-chars actuel suffit-il ?

Le `circuits.track_svg_path` du circuit officiel fait 221 caractères, donc 12 segments droits. C'est très schématique — bon pour une lecture rapide, mais sans la fluidité visuelle d'un vrai tracé courbé.

Le BACKUP en base (1138 chars) est plus détaillé mais n'est pas le bon circuit (lat ~45.24 vs 45.60).

Options :
- **A — Garder le 221-chars** pour V1, version "carte d'aéroport" simple et lisible
- **B — Générer un SVG plus détaillé** depuis vos données pistes (si vous avez un GeoJSON ou KML du tracé), je l'importe et le replace en base
- **C — Demander au designer** un SVG stylisé à la main (cohérent avec l'identité visuelle)

Recommandation : A en V1, B si vous avez les données sous la main (1h de travail), C en V2 quand un designer touchera l'identité.

### Q21 — Tap targets — pastilles à 36×36

Apple HIG recommande 44pt mini pour les tap targets ; mes pastilles font 36×36 (pour pas écraser un SVG petit sur écran 5"). Sur device, ça peut être inconfortable.

Trois options :
- **A — Garder 36×36** et compter sur le `scale` au press pour le feedback
- **B — Ramener à 44×44** quitte à rogner sur la lisibilité du SVG
- **C — Créer un drawer "Choisir un virage"** (liste verticale 1-14) en plus du tap-sur-pastille

Recommandation : A pour V1, validation sur device, ajustement si nécessaire en sem 12 (polish).

---

## Recommandations

### R20 — Lecture des docs test alpha avant la sem 7

Le dossier `docs/test_alpha/` (4 docs) est resté non-lu. Le test du 5 juillet est dans **6 semaines** et conditionne ce qu'il faut avoir prêt pour cette date. Si vous voulez qu'on s'aligne, dites-moi en début de sem 7 et je lirai les 4 docs en J1.

### R21 — Profitez du fait que c'est codé pour tester l'écran #15 sur device

Même sans vraies données (les stats Physique sont à `—`), le rendu de la **grammaire** (eyebrow, sections, manifeste centré "Était-ce volontaire ?") doit déjà ressembler à ce que vous aviez en tête. Si quelque chose cloche visuellement, c'est le moment de pivoter — avant qu'on remplisse les sections de vraies data.

---

## Estimation pour la semaine 7

Selon roadmap : **#16 (La prochaine fois) + #17 (Progression) + audit dev senior recommandé.**

- **J1-2** — #16 *La prochaine fois* : identifier UNE zone à creuser (depuis `margin_breakdown` ou heuristique simple sur le breakdown actuel), phrase contextuelle non-directive, marquage "Compris" / "Reporter" persistant
- **J3-4** — #17 *Progression* : courbe SVG simple de la marge globale sur N dernières sessions (lecture `app_session_analyses` ordonnée), granularité semaine / mois / global, phrase manifeste "Vous avancez."
- **J5** — Bout-en-bout sur les 5 écrans principaux + rapport + recommandation audit dev senior humain (mentionné explicitement dans `SEMAINES.md`)

Estimation : **5 jours-claude**. Probable accroche : on aura besoin de plus de data côté `app_session_analyses` (zones par virage, focus_corner_index). Sem 8 reprendra si nécessaire.

---

## En résumé

Le pilote peut maintenant parcourir hub → bilan → carte → zoom virage avec une grammaire visuelle stable. Les pastilles colorées sont reproductibles (même session = même rendu), la doctrine est respectée ("Était-ce volontaire ?" sur l'écran zoom), et la nav entre les 14 virages tourne en boucle.

20 commits totaux. 52 tests passants. Le code reste sans dette bloquante. La calibration topométrique du circuit reste le plus gros chantier ouvert mais il est cadré pour la sem 11.

— Claude Code, 24 mai 2026
