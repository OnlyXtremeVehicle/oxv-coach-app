# Bloc A0 — Compte (3 ecrans)

Reference : `01_doctrine_et_composants.md`.

---

## A0.1 — Profil pilote

- **But** : identite et informations du pilote.
- **Layout** :
  - `[Composant: AppBar]` titre « Profil ».
  - Champs : nom/pseudo, contact, lien vers Avatar (70.1) et Carte de pilote (70.2).
  - Statut d'adhesion (Heritage → accents `or`, et seulement la).
- **Donnees** : profil pilote (Supabase). Aligner avec l'espace pilote du site.
- **Doctrine** : neutre.
- **Etat vide** : champs par defaut.

---

## A0.2 — Preferences (RGPD / partage / suppression)

- **But** : le centre de controle du pilote sur ses donnees et son partage.
- **Layout** :
  - `[Composant: ConsentGate]` recapitulatif : etat des consentements de partage (feed,
    comparaison), tous **revocables**.
  - Reglages de notification (sobres ; **uniquement** ce que le bloc Communaute a reintroduit
    de facon opt-in — pas de notification de vanite imposee).
  - Confidentialite : acces a l'export (90.4), **suppression de compte** effective.
- **Donnees** : preferences + consentements (Supabase).
- **Doctrine** : controle total au pilote. La suppression est reelle et **propagee aux frames
  telemetriques** (droit a l'effacement). Pas de dark pattern de retention.
- **Etat vide** : valeurs par defaut, partage **OFF** par defaut.

---

## A0.3 — Etat capteur & materiel

- **But** : sante du RaceBox et de la chaine de capture.
- **Layout** :
  - `[Composant: MetricHero]` : etat de connexion du capteur.
  - `[Composant: FactRow]` : batterie capteur, derniere synchro, frames en attente d'envoi.
  - Action : reappairer (renvoi 10.3), forcer la synchro.
- **Donnees** : etat BLE (service V1) + file de `telemetry_frames` a pousser (Supabase).
- **Doctrine** : purement technique.
- **Etat vide** : « Aucun capteur connecte. »
