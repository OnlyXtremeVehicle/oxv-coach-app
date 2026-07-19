# Smoke test — banque photo/vidéo (Lot M1.2)

> Protocole de vérification OBLIGATOIRE de la chaîne média, à dérouler sur
> device réel avant toute journée client (Valence = répétition générale).
> La promesse commerciale du site (« banque photo & vidéo », les 3 offres)
> repose sur cette chaîne.

## Chaîne vérifiée

```
Upload admin (app (admin)/sessions-media, expo-image-picker)
  → bucket privé session-media/{user_id}/{session_id}/…
  → ligne session_media (RLS : owner + ami accepté + coach consenti + admin)
  → visibilité pilote (app (app)/session-media/[sessionId] + galerie)
  → URL signée (60 min) à l'affichage
```

## Parcours nominal (à cocher)

1. **Admin** : ouvrir Régie → Médias de session, choisir une session
   `completed` d'un pilote de test. L'indicateur affiche « En attente ».
2. Uploader 1 photo (≤ 5 Mo) et 1 vidéo courte. Attendu : apparition dans la
   grille admin, indicateur passe à « 2 médias ».
3. **Pilote** (compte propriétaire de la session) : ouvrir Bilan →
   Médias de la séance. Attendu : les 2 médias visibles, URLs signées qui
   s'affichent (pas d'icône cassée).
4. **Pilote, galerie globale** : l'onglet galerie liste les mêmes médias.
5. **Autre pilote (non ami)** : la session ne doit exposer AUCUN média
   (RLS). Vérifier via un 2ᵉ compte de test.

## Cas d'échec à couvrir (chacun doit dégrader PROPREMENT)

| Cas                                                           | Attendu                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Média orphelin (ligne session_media sans fichier bucket)      | vignette d'erreur sobre, pas de crash, pas de spinner infini         |
| URL signée expirée (laisser l'écran ouvert > 60 min, revenir) | rechargement de l'URL au focus, ou état d'erreur re-tentable         |
| Mauvais dossier user_id (fichier déposé hors `{user_id}/…`)   | invisible pilote (RLS folder-based) — vérifier qu'il n'apparaît PAS  |
| Vidéo lourde en 4G (> 50 Mo)                                  | chargement progressif ou état d'attente honnête ; jamais d'app figée |
| Suppression douce (admin retire un média)                     | disparaît côté pilote au rechargement ; l'indicateur admin décompte  |
| Session sans média                                            | état vide digne (« Vos médias arriveront ici ») des deux côtés       |

## Indicateur admin

Régie → Médias de session : chaque session des 50 dernières affiche
« N médias » (bronze) ou « En attente » (neutre). C'est l'outil de contrôle
de la promesse de livraison, session par session, le soir d'une journée.

## Résultats

| Date | Testeur | Device | Nominal | Échecs couverts | Notes               |
| ---- | ------- | ------ | ------- | --------------- | ------------------- |
| —    | —       | —      | ☐       | ☐               | à remplir à Valence |
