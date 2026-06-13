# Bloc B0 — Etats limites (2 ecrans)

Reference : `01_doctrine_et_composants.md`. Ces ecrans sont **critiques** : aujourd'hui
`telemetry_frames` est vide, donc l'app doit degrader proprement par defaut.

---

## B0.1 — Hors-ligne / perte BLE en piste

- **But** : gerer la perte de connexion capteur ou reseau, sans dramatiser.
- **Layout** :
  - Bandeau d'etat clair et calme (pas d'alarme rouge anxiogene).
  - `[Composant: FactRow]` : ce qui continue de fonctionner (capture locale en cours,
    consultation de l'historique), ce qui est en attente (synchro).
  - Reconnexion automatique geree en fond (service BLE V1 : reconnexion auto).
- **Donnees** : etat BLE + file locale de frames.
- **Doctrine** : honnete et factuel. **Aucune notification pendant le roulage** — l'etat se
  consulte au paddock, jamais en signal intrusif en piste.
- **Etat vide** : c'est l'ecran d'etat vide lui-meme.

---

## B0.2 — Session vide / aucune donnee

- **But** : le cas par defaut tant que la capture reelle n'est pas branchee (Valence, juillet
  2026). Doit etre **soigne**, pas un trou.
- **Layout** :
  - `[Composant: EmptyState]` central : explication factuelle (« Aucune donnee exploitable
    pour cette session. »).
  - Cause possible en clair (capteur non connecte / capture non demarree / pas assez de tours).
  - Action utile : reappairer (10.3), consulter l'historique, lire le journal.
- **Donnees** : detection d'absence de frames pour la session.
- **Doctrine** : ne jamais afficher de fausse donnee ni de maquette presentee comme reelle.
  Dire la verite, simplement. **C'est l'etat le plus frequent aujourd'hui** : le traiter avec
  le meme soin que les ecrans pleins.
- **Etat vide** : c'est l'ecran lui-meme.

---

## Note transverse pour Claude Code

Chaque ecran data des blocs 20, 30, 40, 70, 80 **doit** brancher un de ces deux etats quand
la donnee manque ou est partielle. Ne laisse jamais un ecran data « casser » ou afficher des
zeros bruts : route vers `[Composant: EmptyState]` avec un message factuel adapte.
