# Sitemap — Carte 3 : Flux de navigation

> Comment on accède à chaque écran depuis n'importe quel point de l'app.

---

## Le hub central : écran #20

L'**écran #20 (Accueil)** est le hub central. C'est l'écran par défaut quand on ouvre l'app hors-contexte spécifique.

Tous les chemins partent de #20 ou y reviennent.

---

## Topbar persistante (visible sur la plupart des écrans)

Présente sur tous les écrans hors onboarding, paddock immersif, et roulage :

```
┌─────────────────────────────────────────┐
│  ←  [Titre écran]      🔔[badge]    ⚙️  │
├─────────────────────────────────────────┤
```

- **←** Bouton retour (sauf sur #20)
- **🔔** Bouton notifications → ouvre #23 (badge rouge si actions à traiter)
- **⚙️** Bouton settings → ouvre #24

---

## Les 3 branches principales depuis #20

### Branche 1 — Analyse de session

```
#20 (Accueil)
  └── #13 (Bilan) ───┬─── #14 (Carte du circuit)
                     │       └── #15 (Zoom virage)
                     ├─── #15 (Zoom virage) directement
                     ├─── #16 (La prochaine fois)
                     └─── #17 (Progression)
                              └── #18 (Comparateur)
```

**Profondeur max** : 3 niveaux (#20 → #14 → #15 par exemple)

**Retour** : bouton ← ramène toujours au niveau parent. Tap sur #20 dans la topbar ramène toujours au hub.

---

### Branche 2 — Paddock (déclenchée par contexte)

```
#20 (Accueil mode A)
  └── (géolocalisation détecte arrivée circuit)
        └── #07 (Vous y êtes)
              └── #08 (Détection équipement)
                    └── #09 (Placement)
                          └── [État S6 : roulage, aucun écran]
                                └── (fin de session détectée)
                                      └── #10 (Vous avez piloté)
                                            └── #11 (Données sécurité)
                                                  └── #12 (Bilan prêt)
                                                        └── #13 (Bilan)
```

**Spécificité** : ces écrans ne sont **pas accessibles manuellement** depuis le hub. Ils s'enclenchent uniquement par contexte (géolocalisation, vitesse, timer).

---

### Branche 3 — Système

```
#20 (Accueil)
  ├── #23 (Notifications) via icône 🔔
  └── #24 (Settings) via icône ⚙️
        ├── Pacte de pilotage (consultation)
        ├── CGU (consultation)
        ├── Politique de confidentialité (consultation)
        ├── Export données
        └── Supprimer compte
```

---

## Couches conditionnelles (superposées sur n'importe quel écran)

### Couche A — Notifications push

Une notification reçue peut ouvrir n'importe quel écran selon son type :
- Notification J-1 → ouvre #20 mode A
- Notification debrief disponible → ouvre #19
- Notification générique → ouvre #23 sur le tab pertinent

### Couche B — Bannière offline (#26)

Apparaît automatiquement en haut de **tous les écrans** si réseau perdu. Ne bloque pas l'usage de l'app, signale juste l'état.

### Couche C — Modale BLE error (#25)

Apparaît en modal au-dessus de l'écran courant si la connexion BLE échoue pendant une session. Bloque l'écran courant tant qu'elle n'est pas dismissée.

### Couche D — Modale update (#27)

Apparaît à la première ouverture après une MAJ disponible. Peut être différée par le pilote.

---

## Règles de navigation

### Règle 1 — Retour cohérent

Le bouton retour (←) doit toujours ramener à l'écran logique parent, pas forcément à l'écran précédent chronologiquement.

Exemple :
- Si on est sur #15 via la séquence `#20 → #13 → #14 → #15`, le retour ramène à #14
- Si on est sur #15 via deep link, le retour ramène à #13 (parent logique)

### Règle 2 — Navigation tactile

Pas de gestes complexes pour la V1 :
- Tap sur card → navigation
- Swipe horizontal sur #15 → virage suivant/précédent
- Pas de pinch-to-zoom, pas de gestes multi-doigts

### Règle 3 — État conservé

L'app conserve l'état de chaque écran en mémoire pendant la session d'usage :
- Si on quitte #18 et qu'on y revient, les sélections sont conservées
- Si on change de session récente, l'état est invalidé (nouveau bilan)

### Règle 4 — Deep links

L'app supporte les deep links via le scheme `oxvcoach://` :
- `oxvcoach://bilan/[session_id]` → ouvre #13 pour cette session
- `oxvcoach://debrief/[session_id]` → ouvre #19
- `oxvcoach://settings` → ouvre #24

Utile pour les emails de rituels qui contiennent des liens directs.

---

## Diagramme de transitions principales

```
        ┌──────────────────────────────┐
        │                              │
        │    #20 ACCUEIL (HUB)         │◄──── (default)
        │                              │
        └──┬────┬────┬────┬────┬──────┘
           │    │    │    │    │
           ▼    ▼    ▼    ▼    ▼
        #13  #17  #18  #23  #24
        Bilan Prog Comp Notif Sett
           │
           ├──► #14 (Carte)
           │      └──► #15 (Zoom)
           ├──► #15 (Zoom) directement
           ├──► #16 (Prochaine fois)
           └──► #17 (Progression)
```

---

## Cas particulier : modes de #20

L'écran #20 a 3 modes selon le contexte. La sélection du mode est **automatique** :

```
Si geo.at_circuit = true ET session.active_today = true
  → mode "Paddock" (#22 plutôt que #20 mode B)

Sinon si geo.moving = true ET geo.heading_to_circuit = true
  → mode B (#21 — En route)

Sinon si sessions.upcoming_in_days <= 14
  → mode A (compte à rebours)

Sinon
  → mode C (accueil passif)
```

---

## Implémentation react-navigation

Structure recommandée :

```typescript
RootStack
├── OnboardingStack (si !user.onboarding_complete)
│   ├── Screen01
│   ├── Screen02
│   ├── Screen03
│   ├── Screen04
│   ├── Screen05
│   └── Screen06
│
├── MainTabs (si user.onboarding_complete)
│   ├── HomeTab → Screen20
│   ├── AnalysisTab → Screen13 (default), avec sub-stack pour #14, #15, etc.
│   ├── ProgressionTab → Screen17
│   └── SettingsTab → Screen24
│
└── ModalStack
    ├── PaddockFlow (paddock immersif, fullscreen)
    │   ├── Screen07
    │   ├── Screen08
    │   └── Screen09
    │
    ├── PostSessionFlow (retour stands)
    │   ├── Screen10
    │   ├── Screen11
    │   └── Screen12
    │
    ├── Screen19 (Debrief J+1, accessible via deep link)
    ├── Screen23 (Notifications)
    ├── Screen25 (BLE error)
    ├── Screen26 (Offline banner)
    └── Screen27 (Update)
```

---

*Carte 3/4 — Flux de navigation — Mai 2026*
