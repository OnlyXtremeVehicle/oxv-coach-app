# Bloc 40 — Sessions & historique (3 ecrans)

Reference : `01_doctrine_et_composants.md`. Le socle « soi contre soi dans le temps ».

---

## 40.1 — Liste des sessions

- **But** : l'archive personnelle de toutes les sessions.
- **Layout** :
  - `[Composant: AppBar]` titre « Mes sessions », filtre par circuit / periode.
  - Liste de `[Composant: SessionCard]` (date, circuit, meteo, 1 fait saillant).
  - Tri par date par defaut.
- **Donnees** : sessions du pilote (Supabase).
- **Doctrine** : aucune session n'est marquee « meilleure » dans la liste. Pas de tri par
  « score ».
- **Etat vide** : `[Composant: EmptyState]` — « Aucune session enregistree pour l'instant. »

---

## 40.2 — Detail d'une session

- **But** : porte d'entree vers toute la restitution d'une session passee.
- **Layout** :
  - Reprend la structure de **20.1 Synthese** appliquee a une session historique.
  - Acces aux 4 piliers, tour de reference, secteurs, trace, detail data.
  - Action : ouvrir le journal de bord de cette session (90.1), partager un template (60.3).
- **Donnees** : indicateurs Supabase de la session.
- **Doctrine** : identique au bloc 20.
- **Etat vide** : session sans donnee exploitable → message factuel.

---

## 40.3 — Evolution long terme (V2 → V3 → V4)

- **But** : montrer la progression du pilote dans la duree **et a travers les versions de
  l'app**. La donnee historique survit aux montees de version.
- **Layout** :
  - `[Composant: TimelineEvolution]` longue portee (multi-sessions, multi-saisons).
  - `[Composant: MetricHero]` : tendance factuelle globale (« vos temps de reference ici
    baissent sur 6 sessions »).
  - `[Composant: ComparisonPair]` : deux jalons temporels au choix du pilote.
- **Donnees** : historique complet (Supabase), agrege cote serveur.
- **Doctrine** : « tendance » est factuel ; « bon progres / il faut continuer » ne l'est pas.
  Montrer la courbe, pas le commentaire de coach.
- **Etat vide** : « L'evolution long terme se construit a partir de plusieurs sessions. »
