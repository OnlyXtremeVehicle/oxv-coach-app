# Rapport — PR-G · Signature : empreinte RADAR 5 axes (maquette 20.2)

> Réalisation d'une maquette `specs-bundle-v4` encore non implémentée (audit maquettes/prototypes).
> Zéro schéma. Choisie comme « prochaine étape » par l'audit + critique (valeur/risque/effort optimal, non bloquée par Valence).

## Le gap
La maquette 20.2 centre la Signature sur un **radar empreinte 5 axes** (Cap · Visée · Plongée · Trajectoire · Anticipation). Le code ne produisait que **4 traits**, aucun composant radar (grep négatif). Le radar était le manque central.

## Ce que j'ai fait
- **`pilotSignatureService`** : 5 axes ajoutés, **chacun adossé à une mesure RÉELLE** dérivée des segments (aucune table touchée) :
  - Cap = G latéral · Visée = reproductibilité des entrées (faible écart) · Plongée = G de frein · Trajectoire = vitesse portée (apex/entrée) · Anticipation = précocité de réaccélération (sortie/apex).
  - `value` = position normalisée **0–1 (silhouette, pas note)** ; **donnée absente → `null`** (jamais inventée). Les 4 traits restent intacts.
- **`components/signature/RadarEmpreinte.tsx`** (net-neuf, react-native-svg) : pentagone gradué neutre + **liseré or = donnée**, libellés vouvoyés, **aucune zone cible/idéale**, un axe sans mesure = sommet absent + « donnée à venir », silhouette tracée **seulement complète**, légende exposant la mesure réelle de chaque axe (transparence).
- **`signature.tsx`** : le radar devient le **visuel dominant** sous le manifeste ; les traits passent en détail mesuré dessous. Phrase doctrinale conservée.
- **Test** : 5 axes sur données complètes (bornés 0–1, detail présent) ; mesure extrême bornée à 1 ; donnée absente = `null` (pas de fausse valeur) ; 4 traits inchangés ; segments non-virage ignorés.

## Doctrine
« **Empreinte, pas score** » (maquette) : silhouette factuelle, un seul visuel dominant, descriptive, sans idéal à atteindre, sans classement. Ne touche jamais au contenu écrit par le pilote. Or = donnée.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 817 (+5).

## En suspens — build requis
- Rendu du radar sur device (proportions du pentagone, libellés, silhouette réelle). Avec `telemetry_frames = 0`, le radar montrera surtout « donnée à venir » jusqu'à une capture réelle (Valence) — état honnête voulu.
