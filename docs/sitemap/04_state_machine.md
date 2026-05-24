# Sitemap — Carte 4 : Machine à états

> Les 10 états du pilote, leurs transitions, les écrans valides dans chaque état, et les conditions techniques modulatrices.

---

## Vue d'ensemble

Le pilote est à tout moment dans **UN état précis** qui détermine ce qu'il voit et ce qu'il peut faire. Cette machine à états est la **référence pour le développeur** : chaque écran n'est valide que dans certains états.

Implémentation recommandée : `useReducer` React Native ou bibliothèque XState pour les cas complexes.

---

## Les 10 états du pilote

### S1 — DÉCOUVERTE
**Nom** : Visiteur anonyme
**Conditions** :
```
user.account = null
session.has_active = false
```
**Écrans valides** : Site oxvehicle.fr, écran de téléchargement app
**Spécificité** : pas d'app installée ou utilisateur non connecté

---

### S2 — INITIATION
**Nom** : Onboarding en cours
**Conditions** :
```
user.account = exists
user.onboarding_complete = false
```
**Écrans valides** : #01 à #06 uniquement
**Spécificité** : flux linéaire, pas de hub accessible

---

### S3 — ATTENTE
**Nom** : Pilote sans session prévue
**Conditions** :
```
user.onboarding_complete = true
sessions.upcoming = []
sessions.past = []
```
**Écrans valides** : #20 (mode C accueil vide), #24 Settings
**Spécificité** : encourage la première réservation sans pression

---

### S4 — ANTICIPATION
**Nom** : Session à venir
**Conditions** :
```
sessions.upcoming.next_in_days <= 14
now < session.start - 12h
```
**Écrans valides** : #20 (mode A compte à rebours), #23 Notifications
**Spécificité** : état "fébrile", peut être déclenché par notification J-7/J-2/J-1

---

### S5 — APPROCHE
**Nom** : Pilote en route le jour J
**Conditions** :
```
now > session.start - 12h
geo.distance_to_circuit > 5km
geo.moving = true
```
**Écrans valides** : #21 (accueil en route)
**Spécificité** : app en silence, pas de notification

---

### S6 — ROULAGE
**Nom** : En piste, app silencieuse
**Conditions** :
```
session.recording = true
vehicle.speed_avg > 60 km/h
```
**Écrans valides** : **AUCUN ÉCRAN**
**Seul élément actif** : bouton BLE de marquage (Flic 2)
**Spécificité** : doctrine fondamentale du silence en piste

---

### S7 — PADDOCK
**Nom** : Au circuit, jumelage ou entre runs
**Conditions** :
```
geo.at_circuit = true
session.active_today = true
vehicle.speed = 0
```
**Écrans valides** : #07-09 (jumelage), #22 (entre runs)
**Spécificité** : transition entre S5 et S6, ou S6 et S6 (entre deux runs)

---

### S8 — ATTERRISSAGE
**Nom** : Retour aux stands
**Conditions** :
```
session.ended = true
now < session.end + 2h
data.synced = pending OR done
```
**Écrans valides** : #10-12 (séquence retour), #13 Bilan
**Spécificité** : état émotionnel important, reconnaissance du pilotage

---

### S9 — DÉCANTATION
**Nom** : Lendemain de session
**Conditions** :
```
session.ended_yesterday = true
debrief.published = true
```
**Écrans valides** : #19 Debrief J+1, #13-17 Analyse
**Spécificité** : déclenché par notification push du debrief

---

### S10 — REPOS
**Nom** : Entre deux sessions
**Conditions** :
```
last_session.end < now - 48h
next_session.start > now + 7j (ou pas de session prévue)
```
**Écrans valides** : #20 (mode C passif), #17 Progression, #18 Comparateur
**Spécificité** : pas de sollicitation, le pilote vient consulter de son plein gré

---

## Les transitions principales (cycle normal)

```
S1 (Découverte)
  ↓ inscription
S2 (Initiation)
  ↓ pacte accepté
S3 (Attente)
  ↓ réservation
S4 (Anticipation)
  ↓ jour J + trajet
S5 (Approche)
  ↓ arrivée circuit
S7 (Paddock)
  ↓ départ en piste                ↑ retour stand
  └──► S6 (Roulage) ────────────────┘
              ↓ fin de journée
        S8 (Atterrissage)
              ↓ +24h
        S9 (Décantation)
              ↓ +48h
        S10 (Repos)
              ↓ nouvelle réservation
        S4 (Anticipation)
              ↓ ... (boucle)
```

**11 transitions** au total.

**Double-sens crucial** : S7 ⇄ S6 (alternance paddock/piste pendant la session, typiquement 4-5 cycles).

**Boucle de fidélisation** : S10 → S4 — matérialise la récurrence économique (Heritage = 4 sessions/an = 4 passages par cette boucle).

---

## Conditions techniques modulatrices

6 dimensions qui **modulent** les états sans les changer. Elles peuvent déclencher des écrans superposés (modales, bannières) sans modifier l'état principal.

### Condition 1 — Réseau

| Valeur | Conséquence |
|---|---|
| Online | Aucun effet |
| Offline | Bandeau jaune en haut (#26) sur tous les écrans. Sync différée. |

---

### Condition 2 — Bluetooth

| Valeur | Conséquence |
|---|---|
| Stable | Aucun effet |
| Reconnexion (< 10s) | Indicateur discret, pas de modal |
| Perdu (> 30s) en S6/S7 | Modal BLE error (#25) |

---

### Condition 3 — Géolocalisation

| Valeur | Conséquence |
|---|---|
| Autorisée | Détection automatique S5/S7 |
| Refusée | Fallback sur calendrier seul, fonctionnalité dégradée |

**Important** : si géolocalisation refusée, prévenir le pilote que l'expérience sera dégradée mais ne pas bloquer l'usage.

---

### Condition 4 — Version app

| Valeur | Conséquence |
|---|---|
| À jour | Aucun effet |
| MAJ disponible | À la première ouverture post-MAJ, déclencher #27 (peu importe l'état) |

---

### Condition 5 — Équipement

| Valeur | Conséquence |
|---|---|
| Affecté | Pré-requis pour S7 |
| Non affecté | À l'arrivée circuit, bloquer le jumelage et alerter staff OXV |

**Cas d'usage admin** : l'équipement doit être affecté à un pilote avant la session via la vue admin "Préparation".

---

### Condition 6 — Pacte actif

| Valeur | Conséquence |
|---|---|
| Accepté | État normal |
| Expiré ou modifié | Si pacte modifié (V2.0 par exemple), forcer le passage par S2 pour re-acceptation avant tout autre écran |

---

## Implémentation TypeScript suggérée

```typescript
type PilotState = 
  | 'S1_decouverte'
  | 'S2_initiation'
  | 'S3_attente'
  | 'S4_anticipation'
  | 'S5_approche'
  | 'S6_roulage'
  | 'S7_paddock'
  | 'S8_atterrissage'
  | 'S9_decantation'
  | 'S10_repos'

type Conditions = {
  network: 'online' | 'offline'
  bluetooth: 'stable' | 'reconnecting' | 'lost'
  geolocation: 'granted' | 'denied'
  appVersion: 'current' | 'updateAvailable'
  equipment: 'assigned' | 'unassigned'
  pact: 'accepted' | 'expired'
}

type AppContext = {
  state: PilotState
  conditions: Conditions
  user: User | null
  activeSession: Session | null
}

// Fonction de détermination de l'état (à appeler à chaque changement de contexte)
function determineState(ctx: AppContext): PilotState {
  if (!ctx.user) return 'S1_decouverte'
  if (!ctx.user.onboardingComplete) return 'S2_initiation'
  // ... etc selon les conditions
}

// Fonction de validation d'écran
function isScreenValid(screenId: string, state: PilotState): boolean {
  const validScreens = SCREEN_VALIDITY[state]
  return validScreens.includes(screenId)
}
```

---

## Sécurité par défaut

**Règle d'or** : si le contexte est ambigu ou les données manquent, **par défaut on retourne à S20 (mode C accueil passif)**. Jamais d'écran fantôme, jamais d'état indéterminé.

Cette sécurité par défaut évite les bugs où un écran s'afficherait dans le mauvais contexte (par exemple paddock alors qu'on est chez soi).

---

## Tests à prévoir

Pour chaque transition, écrire au moins un test unitaire :

```typescript
describe('State transitions', () => {
  test('S3 → S4 when user creates reservation', () => {
    const ctx = { state: 'S3_attente', /* ... */ }
    const newCtx = { ...ctx, user: { ...ctx.user, upcomingSessions: [futureSession] }}
    expect(determineState(newCtx)).toBe('S4_anticipation')
  })
  
  test('S6 → S7 when speed drops to 0', () => {
    // ...
  })
  
  // etc.
})
```

Couverture cible : **80% minimum** sur la machine à états (c'est le cœur logique de l'app).

---

*Carte 4/4 — State machine — Mai 2026*
