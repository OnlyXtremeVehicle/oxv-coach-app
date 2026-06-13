# Bloc 70 — Identite pilote / Avatar (3 ecrans)

Reference : `01_doctrine_et_composants.md`.

**Principe directeur de ce bloc** : l'identite du pilote se construit a partir de **faits de
pilotage** (signature, circuits roules, regularite, historique), **jamais d'un score de
niveau**. L'avatar est un miroir d'identite, pas un rang de jeu video. Pas de XP, pas de
« niveau 12 », pas de palier de competence.

---

## 70.1 — Avatar driver

- **But** : une identite visuelle du pilote, derivee de ses faits de pilotage.
- **Layout** :
  - Representation de l'avatar (construit a partir de la **signature de pilotage**, des
    circuits roules, du volume de sessions — des faits, pas une note).
  - `[Composant: FactRow]` : ce qui compose l'avatar (ex. « signature etablie sur 3
    circuits », « 14 sessions »). Factuel.
  - Personnalisation esthetique possible (couleurs dans la charte ; **or reserve Heritage**).
- **Donnees** : profil + agregats factuels (Supabase).
- **Doctrine** : l'avatar ne « monte pas en niveau ». Il **reflete** une identite de pilotage,
  il ne la note pas. Pas de gamification dirigeante.
- **Etat vide** : avatar de base + « Votre signature s'affinera avec vos sessions. »

---

## 70.2 — Carte de pilote (licence OXV)

- **But** : un profil partageable facon « licence » — l'objet identitaire premium.
- **Layout** :
  - Carte au format licence : insigne OXV, nom/pseudo, avatar (70.1), faits cles factuels.
  - Statut de membre (ex. Heritage → accents `or`, **et seulement la**).
  - Action : partager au cercle (renvoi 60), exporter en image.
- **Donnees** : profil (Supabase).
- **Doctrine** : la carte affiche des faits et un statut d'adhesion, **pas un rang de
  performance** entre pilotes.
- **Etat vide** : carte avec champs par defaut.

---

## 70.3 — Empreinte de saison

- **But** : une synthese annuelle factuelle — le « bilan de saison » du pilote.
- **Layout** :
  - `[Composant: MetricHero]` : fait marquant de la saison (ex. « 14 sessions, 5 circuits »).
  - `[Composant: TimelineEvolution]` : la saison en frise.
  - `[Composant: FactRow]` : circuits roules, regularite moyenne, evolution perso.
  - Partageable (objet de fierte factuel, facon « rewind »).
- **Donnees** : agregation annuelle (Supabase).
- **Doctrine** : c'est un recapitulatif de faits, pas un palmares compare aux autres. Pas de
  « meilleur pilote de la saison ».
- **Etat vide** : « Votre empreinte de saison se construit au fil de l'annee. »
