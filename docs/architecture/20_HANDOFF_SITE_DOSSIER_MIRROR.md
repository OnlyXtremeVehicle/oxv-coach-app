# Handoff site — la version vivante du dossier French Tech

> Pour l'équipe du site oxvehicle.fr. Établi le 25/08/2026.
> Même mécanique que les handoffs 18 (tuiles) et 19 (confidentialité).

## Ce qu'il faut servir

| | |
|---|---|
| URL | `https://oxvehicle.fr/dossier-mirror` — **cette adresse est IMPRIMÉE en QR dans le PDF** : elle ne doit plus changer (au pire, une redirection 301 permanente) |
| Fichier | `docs/presentation/DOSSIER_FRENCH_TECH_2026-08-24.html` du dépôt app — autoportant (aucun asset externe hors Google Fonts), à servir tel quel |
| Indexation | `noindex` (en-tête `X-Robots-Tag` ou meta) — le dossier se partage par lien, il ne se référence pas |
| Accès | public sans authentification (les destinataires scannent un QR papier) |

## Ce que la page contient de plus que le PDF

Le fichier embarque un **module interactif** (section « Essayez le miroir »,
masquée à l'impression) : un extrait réel du banc d'essai — 829 mesures,
4 min 25 — avec tracé progressif, diagramme des appuis et lecture
vitesse/G au curseur. Tout est inline (données comprises) : zéro appel réseau,
zéro dépendance. Orientation et position du tracé neutralisées, aucune
coordonnée GPS embarquée.

## Mesure d'audience (optionnelle mais voulue)

Ajouter le script **Plausible** du site (domaine oxvehicle.fr) à la page —
sans cookie, conforme à la doctrine. Deux objectifs utiles : consultation de
la page, et un événement sur le bouton « Rouler ×8 » (`id="dPlay"`) pour
savoir si la démonstration a été essayée.

## Synchronisation

La source de vérité est le dépôt app (`docs/presentation/`). À chaque nouvelle
version du dossier, recopier le fichier — le nom de fichier ne change pas.
Le PDF assorti (`OXV_Mirror_Dossier_French_Tech.pdf`) vit au même endroit ;
le site peut aussi l'exposer en lien « télécharger le PDF » depuis la page.
