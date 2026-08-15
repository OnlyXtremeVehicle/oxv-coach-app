# SPÉCIFICATION — interactions de séance validées au prototype

> 15/08/2026. Quatre lots, validés visuellement sur `oxv-proto-interactif.html`
> (trames réelles). Cibles vérifiées dans le dépôt du 14/08 — si un fichier a
> bougé depuis, remesurer l'ancre avant d'écrire.

---

## LOT A — Sélecteur de tours (écran `data/session/[id]`)

**Existant.** L'écran porte déjà `selectedLap` (`useMemo` des `cornerMarkers`
en dépend, l. 1180) et le libellé `TOUR n / SÉANCE ENTIÈRE`. Le lot est donc
un habillage, pas une plomberie.

- Composant : contrôle segmenté `[SÉANCE] [T1] [T2] [T3…]`, pattern visuel du
  prototype (fond `#0D0F12`, pastille active `bg.card2`, JAMAIS le rouge pour
  la sélection de donnée — le rouge sélectionne une *action*, pas un tour).
- À la bascule : le tracé (`TraceCircuit`) reçoit les trames du tour seul ;
  transition d'opacité 180 ms par vague (voir prototype), les chiffres animent
  vers leur valeur en 420 ms easing cubique — **désactivé** si
  `useReduceMotion()` (50 fichiers font déjà ce geste).
- Le badge à droite du sélecteur : `MEILLEUR TOUR` ou `+X,X s` — calculé,
  jamais stocké.

## LOT B — Rejeu au doigt (onglet comparaison, même écran)

**Existant.** `cartesLogic` borne la sélection à 2 cartes (`MAX_SELECTION`) ;
le delta curviligne est spécifié au banc v2.

- Un `Slider` (0..1) pilote DEUX vues synchronisées : point + traînée sur le
  tracé, ligne verticale sur la courbe de delta. Un seul état
  (`progress: number`), deux consommateurs — pas deux états.
- Readout au-dessus : `distance · vitesse(réf) · delta`, delta coloré
  `POLES_DELTA` (grammaireViz), bande morte 0,05 s → neutre.
- Profil distance→temps : intégration sur les trames du tour (le prototype
  documente ~1 s de tolérance en bout de tour sur données rééchantillonnées ;
  sur trames pleines l'erreur tombe) — les chronos officiels restent la
  référence affichée.

## LOT C — Zoom virage (même écran, sur le tracé)

**La demande du 15/08 : voir la trajectoire précise du virage.**

- Gestes : pincer pour zoomer, glisser pour se déplacer (le prototype web
  utilise molette/boutons — en RN : `Gesture.Pinch` + `Gesture.Pan`,
  gesture-handler est déjà dans l'écran bilan). Préréglages : un bouton par
  virage segmenté (`corner_index`), cadré sur la bbox du segment + 20 %.
- **Niveau de détail (le contrat qui compte)** :
  - vue d'ensemble : la décimation actuelle (inchangée) ;
  - **au-delà de ×3** : requête des trames pleine résolution **bornée par le
    rectangle visible et la fenêtre temporelle du tour** — jamais tout le tour
    en 25 Hz en mémoire. Requête type validée en production le 15/08 :
    bbox lat/lon + fenêtre `created_at` du tour, tri **`elapsed_ms`**
    (⚠ jamais `created_at` : c'est un ordre d'insertion, mesuré — les points
    s'entremêlent).
  - superposition : jusqu'à 3 tours, couleurs T1 `#7FC4EE` · réf `#2A78D6` ·
    T3 `#D95926` ; `vector-effect: non-scaling-stroke` (épaisseur constante
    au zoom).
- **Faits de zoom** : les points `v < 2 km/h` se marquent (blanc). Mesuré sur
  l'épingle de Bouteville : le tour 1 y est à l'arrêt complet ≈ 2,6 s — un
  fait 25 Hz invisible en vue d'ensemble, consommable par le Récit.
- RLS : les trames sont déjà lisibles par leur propriétaire ; la requête bbox
  n'ouvre rien de neuf.

## LOT D — Mode Stand (écran neuf, `app/(app2)/rec/stand.tsx` ou surimpression)

- **Machine à états, trois seuils** (aucun bouton en production) :
  `EN_ROULAGE` (v > 15 km/h) → `ARRET_CANDIDAT` (v < 5 km/h, tenir 20 s) →
  `STAND` (affiché) → retour `EN_ROULAGE` (v > 15 km/h). Hystérésis 5/15
  obligatoire — sinon l'écran clignote au ralenti dans la voie des stands.
- Contenu STAND : trois chiffres — dernier tour, meilleur, écart — tailles du
  prototype (46/38/38), `tabular-nums`, contraste maximal, **aucune** action
  tactile requise. Transition 350 ms, `hide` par opacité+translateY.
- En ROULAGE : l'écran REC actuel, inchangé — le silence reste la règle
  (Principe 3). La pastille REC pulse (2 s, désactivée sous reduce motion).
- Le coach n'est pas concerné : sa lecture en roulage est le fil live et les
  lunettes (décision du 15/08).

## Vérification commune

- Chaque lot : `useReduceMotion()` court-circuite toute animation.
- Aucune couleur nouvelle : tout vient de `grammaireViz` + jetons existants.
- Gardes : étendre `vocabulairePilote` aux nouveaux écrans ; un test par
  machine à états (Stand : les trois transitions + hystérésis).
