# INTÉGRATION — le Programme V4 dans Claude Code

> Un fichier neuf (`docs/programme-v4/PROGRAMME_V4.md`, livré dans cette
> archive) + un remplacement exact dans `CLAUDE.md` pour qu'il soit lu en tête
> de chaque session. Ancre vérifiée unique le 15/08.

## Remplacement — `CLAUDE.md`

```
CHERCHER :
> Ce fichier est ton point d'entrée. Lis-le complètement avant tout travail.

REMPLACER PAR :
> Ce fichier est ton point d'entrée. Lis-le complètement avant tout travail.

> **PROGRAMME COURANT : `docs/programme-v4/PROGRAMME_V4.md` (15/08/2026).**
> C'est l'état audité et le plan d'exécution — lis-le APRÈS ce fichier et
> AVANT tout lot. Sa règle n° 1 s'applique à lui-même : toute affirmation de
> plus de deux semaines se REMESURE (base, dépôt, journaux) avant d'être
> traitée. Quatre chantiers d'août étaient déjà faits quand on a mesuré.
> Deux pièges de données à ne jamais recroiser : `telemetry_frames.created_at`
> est un ordre d'INSERTION (trier sur `elapsed_ms`), et aucune migration ne
> s'applique hors de la chaîne `schema_migrations`.
```

## Vérification

`git diff` doit montrer : 1 fichier créé, 1 fichier modifié de 9 lignes.
Aucun autre document n'est touché — le V3 et `DETTE.md` restent l'historique.
