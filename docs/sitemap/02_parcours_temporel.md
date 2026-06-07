# Sitemap — Carte 2 : Parcours temporel

> Quand chaque écran apparaît dans la vie du pilote, sur la dramaturgie de 9 jours.

---

## Vue d'ensemble — Le récit en 9 jours

OXV Mirror n'est pas une app qu'on ouvre à la demande. C'est un **compagnon temporel** qui orchestre l'expérience de track day sur 9 jours, de J-7 à J+1.

```
J-7 ───── J-2 ───── J-1 ───── J0 ───── J+1
   │         │         │         │         │
   │         │         │         │         └─ Debrief littéraire
   │         │         │         └─────────── La session elle-même
   │         │         └───────────────────── Veille (rituel email)
   │         └─────────────────────────────── Audio personnalisé
   └───────────────────────────────────────── Confirmation
```

---

## Les 8 moments-clés

### Moment 1 — J-7 : Confirmation et playlist

**Canal** : email + notification push si app installée

**Contenu** :
- Confirmation de la session
- Liens vers playlist Spotify OXV
- Rappel logistique (heure, lieu, documents à apporter)

**Écran impliqué** : aucun directement. Les rituels sont gérés côté backend (Supabase + Resend).

**État du pilote** : S4 (Anticipation)

---

### Moment 2 — J-2 : Audio personnalisé

**Canal** : email avec fichier audio en pièce jointe

**Contenu** : audio personnalisé généré par OpenAI + ElevenLabs, qui parle au pilote par son prénom.

**Écran impliqué** : aucun. L'audio se télécharge depuis l'email.

**État du pilote** : S4 (Anticipation, mais montée en intensité)

---

### Moment 3 — J-1 : Rappel et préparation

**Canal** : email + notification push

**Contenu** :
- Rappel des consignes
- Météo annoncée
- Briefing horaire

**Écran impliqué** : si app installée, notification qui ouvre #20 mode A (compte à rebours)

**État du pilote** : S4 (Anticipation finale)

---

### Moment 4 — J0 matin : En route

**Trigger** : géolocalisation détecte mouvement vers le circuit

**Écran** : #21 — Accueil en route (variante de #20 mode B)

**Contenu** : *"Bon trajet vers Beltoise. Coupez l'app. Je conduis."*

**État du pilote** : S5 (Approche)

**Doctrine** : l'app se met en silence automatique. Pas de notifications.

---

### Moment 5 — J0 arrivée : Paddock

**Trigger** : géolocalisation détecte arrivée au circuit + vitesse 0

**Écrans** : #07 → #08 → #09 (séquence paddock)

**Contenu** :
- Bienvenue au circuit
- Jumelage équipement
- Instructions de placement

**État du pilote** : S7 (Paddock)

---

### Moment 6 — J0 roulage : Silence total

**Trigger** : vitesse > 60 km/h en moyenne

**Écran** : **AUCUN** (doctrine du silence en piste)

**Contenu** : rien affiché. Seul le bouton Flic 2 peut être pressé.

**État du pilote** : S6 (Roulage)

**Important** : la doctrine ici est centrale. Aucune notification, aucun son, aucun affichage.

---

### Moment 7 — J0 fin de session : Atterrissage

**Trigger** : fin de roulage détectée (vitesse 0 + timer)

**Écrans** : #10 → #11 → #12 → #13 (séquence retour stands + ouverture bilan)

**Contenu** :
- Reconnaissance émotionnelle ("Vous avez piloté")
- Préservation des données
- Annonce du bilan disponible
- Bilan principal (#13)

**État du pilote** : S8 (Atterrissage)

---

### Moment 8 — J+1 matin : Debrief littéraire

**Trigger** : notification programmée 24h après la fin de session

**Écran** : #19 — Debrief J+1

**Contenu** : récit en 3 actes généré par OpenAI

**État du pilote** : S9 (Décantation)

**Signature** : *"L'app se taira jusqu'à la veille de votre prochaine session. Profitez de cette pause."*

---

## Après J+1 : le silence

Du jour J+2 au jour précédant la prochaine réservation, **l'app se met en silence**. Pas de notifications. Pas de relance. Pas de prompt commercial.

Le pilote peut ouvrir l'app à tout moment pour consulter :
- #17 Progression
- #18 Comparateur
- Ses anciens bilans

Mais l'app ne le sollicite pas. C'est l'**état S10 (Repos)**.

---

## Quand le cycle reprend

Une nouvelle réservation déclenche un retour à **J-7** et le cycle redémarre.

```
S10 (Repos)
   ↓ nouvelle réservation
S4 (Anticipation J-7)
   ↓ ... 9 jours plus tard
S9 (Décantation J+1)
   ↓
S10 (Repos)
   ↓ nouvelle réservation
... boucle infinie
```

---

## Implémentation technique

### Triggers temporels (côté Supabase Edge Functions)

| Moment | Type | Mécanisme |
|---|---|---|
| J-7 | Email + push | Cron job quotidien à 9h |
| J-2 | Email avec audio | Cron job + génération OpenAI/ElevenLabs |
| J-1 | Email + push | Cron job |
| J+1 | Push + génération | Cron job 24h après fin de session |

### Triggers contextuels (côté app)

| Moment | Type | Mécanisme |
|---|---|---|
| J0 en route | Géolocalisation | API Expo Location |
| J0 paddock | Geo + vitesse | Calcul en temps réel |
| J0 roulage | Vitesse | Seuil 60 km/h |
| J0 fin | Vitesse + timer | Seuil 0 + 5 min |

---

*Carte 2/4 — Parcours temporel — Mai 2026*
