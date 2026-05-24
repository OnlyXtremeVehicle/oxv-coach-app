# Sitemap — Carte 1 : Architecture statique

> Vue d'ensemble structurelle : quels écrans existent et comment ils sont organisés.

---

## Les 6 zones de l'app

### Zone 1 — Onboarding (écrans #01-06)

Parcours unique à la première installation. **6 écrans linéaires** :
1. Accueil philosophique
2. Doctrine
3. Méthode
4. Niveau pilote
5. CGU/RGPD
6. Pacte de pilotage

**Caractéristique** : ne se réaffiche jamais sauf si le pacte est modifié (V2.0+).

---

### Zone 2 — Paddock et arrivée (écrans #07-09)

Déclenchés par géolocalisation au circuit. **3 écrans en séquence** :
1. Vous y êtes
2. Détection équipement
3. Placement

**Caractéristique** : se réaffichent à chaque arrivée au circuit.

---

### Zone 3 — Retour aux stands (écrans #10-12)

Déclenchés par fin de session détectée. **3 écrans en séquence** :
1. Vous avez piloté
2. Vos données sont en sécurité
3. Votre bilan est prêt

**Caractéristique** : se réaffichent à chaque fin de session.

---

### Zone 4 — Analyse (écrans #13-18)

Le **cœur de l'app**. 6 écrans accessibles depuis le hub. Les 5 principaux :
1. Bilan (#13) — entrée principale
2. Carte du circuit (#14)
3. Zoom virage (#15)
4. La prochaine fois (#16)
5. Progression (#17)

Plus le comparateur (#18) pour la vue long terme.

**Caractéristique** : accessibles à tout moment hors-piste, contenu mis à jour à chaque session.

---

### Zone 5 — Debrief différé (écran #19)

**Un seul écran** : Debrief J+1, généré le lendemain.

**Caractéristique** : envoyé en notification push 24h après la session.

---

### Zone 6 — Hub et système (écrans #20-27)

- #20 — Accueil (hub central, 3 modes)
- #21 — Accueil en route
- #22 — Paddock entre runs
- #23 — Notifications
- #24 — Settings
- #25 — BLE error
- #26 — Offline mode
- #27 — App update

**Caractéristique** : accessibles depuis n'importe quel point de l'app.

---

## Section admin (séparée, couleur bronze)

3 vues réservées au staff OXV, non accessibles aux pilotes :
- Préparation (avant session)
- En cours (pendant session)
- Analytique (après session)

---

## Comptage final

- **26 écrans pilote** (numérotés #01 à #27, #21 = variante de #20)
- **3 vues admin** (couleur bronze)
- **Total : 29 écrans/vues**

---

## Hiérarchie d'importance

**Tier 1 — Écrans critiques** (à coder en priorité semaines 5-7) :
- #13 Bilan
- #14 Carte
- #15 Zoom virage
- #16 La prochaine fois
- #17 Progression

**Tier 2 — Écrans secondaires** (semaines 8-10) :
- Onboarding complet
- Paddock + retour stands
- Settings

**Tier 3 — Écrans contextuels** (semaine 11) :
- #20 Hub avec ses 3 modes
- #23 Notifications
- #18 Comparateur
- #19 Debrief J+1

**Tier 4 — Edge cases** (semaine 11-12) :
- BLE error, offline, update
- Modes off-track

---

*Carte 1/4 — Architecture statique — Mai 2026*
