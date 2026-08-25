# Handoff site — page publique de politique de confidentialité

> Pour l'équipe du site oxvehicle.fr. Établi le 24/08/2026.
> Même mécanique que `18_HANDOFF_SITE_TUILES_CARTO.md` : ce document est la
> spécification, le site est l'exécutant.

## Pourquoi c'est bloquant

App Store Connect et Google Play Console exigent tous deux une **URL publique**
de politique de confidentialité au moment de créer la fiche de l'app. La
politique d'OXV Mirror n'existe aujourd'hui qu'embarquée dans l'app
(`src/legal/legalDocuments.ts`) — aucune URL à fournir aux consoles.

## Ce qu'il faut servir

| | |
|---|---|
| URL | `https://oxvehicle.fr/confidentialite` (200, HTML, publique, sans authentification) |
| Source de vérité | `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` du dépôt app |
| Rendu | markdown → HTML dans la charte du site ; pas de résumé, pas de coupe — le texte intégral |
| En-tête requis | titre, version (« Version 1.0 »), date d'entrée en vigueur |

Prérequis côté app AVANT publication de la page : les champs
`[SIRET à compléter]`, siège social, RCS et `[date de mise en service]` doivent
être renseignés dans la source (action fondateur — voir
`roadmap/CHECKLIST_PUBLICATION_2026-08-24.md` §2). **Ne pas publier la page
avec les placeholders** : une politique publique à trous est pire qu'absente.

## Règle de synchronisation

La version embarquée in-app et la page publique viennent du **même fichier
markdown**. À chaque évolution du texte :

1. le dépôt app modifie `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md`
   et régénère l'embarqué (`node scripts/genlegal.js && npm run format`) ;
2. le site republie la page depuis le même contenu.

Un écart entre les deux versions est un incident de conformité, pas un détail :
le pilote qui compare l'app et le site doit lire le même texte.

## Détails utiles

- La correction du 24/08 (hébergement « Frankfurt » → **Dublin, Irlande** —
  région réelle du projet Supabase, vérifiée par l'API) est déjà dans la source.
- Les consoles demandent l'URL à ces endroits : App Store Connect → App Privacy
  → Privacy Policy URL ; Play Console → Store presence → Privacy policy.
- Optionnel mais recommandé : servir aussi `https://oxvehicle.fr/cgu` depuis
  `docs/juridique/02_CGU_APP_OXV_MIRROR.md`, même mécanique.
