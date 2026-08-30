# Les paquets de travail — REMPLACÉ

*Ce document est périmé depuis le 30/08/2026. Il est conservé pour mémoire, pas
pour être suivi.*

---

## Suivez les lots numérotés

L'ordre de travail vit désormais dans les fichiers à la racine du dossier de
démarrage : `00_DEMARRAGE.md`, puis `10_P0`, `11_P0_A_Coller`, `20_P1`, `30_P2`,
`40_P3`, `50_P4`, et `60_Autres_Lots` pour les lots `L1` à `L9`. Le travail de
design est dans `design/`.

---

## Ce que cette version-ci se trompait à dire

Elle a été écrite **avant** la lecture du dépôt et de la base. Quatre de ses
affirmations sont fausses :

1. **« P0 · Reconnaissance »** — faite. Ses réponses sont dans
   `reference/OXV_P0bis_Lecture_Moteur_2026-08-30.md`.
2. **« P9 dépend de la décision `/share/{token}` »** — il n'y a pas de décision à
   prendre : `app_progression_shares` porte déjà le jeton, la portée, la liste
   blanche de métriques, l'expiration, la révocation et le compteur de vues, avec
   trois fonctions `SECURITY DEFINER`.
3. **« Circuits en base »** présenté comme une écriture — c'est un appel à
   `detect-circuit-corners` et deux identifiants OSM. Voir `30_P2_Circuits.md`.
4. **L'ordre lui-même** — il supposait qu'il fallait écrire les moteurs. Ils sont
   écrits, testés, et dormants. Le lot central est devenu le lot des écrans.

**La leçon vaut au-delà de ce fichier** : une planification faite sans le code
se paie en jours. Environ dix-huit, ici.
