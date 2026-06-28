# Rapport — Fusions de doublons (revue adversariale)

> Audit en parallèle (3 agents) + **revue adversariale** de chaque verdict
> (consigne : par défaut « merge d'abord » au moindre doute, ne jamais perdre une
> vue liste en redirigeant à l'aveugle).

## Verdict : **aucune redirection sûre**. Zéro `<Redirect>` appliqué.

| Doublon supposé | Verdict | Raison |
|---|---|---|
| `social → amis` | **GARDER** (audit + verif d'accord) | **Pas un doublon.** `social` = liste des points OXV (`social_pings`) avec actions externes (Direct/Détails/Contacter) + CTA carte. `amis` = amitiés (recherche @handle, accepter/décliner, côte-à-côte). Ils ne partagent que le **label** de zone Club. Un `<Redirect social → amis>` enverrait l'utilisateur sur le mauvais écran et casserait les 2 `router.replace('/(app)/social')` de `social-carte`. |
| `social-carte → carte-oxv` | **MERGE D'ABORD** (la verif a corrigé l'audit) | `carte-oxv` est un **sur-ensemble de la carte** (mêmes marqueurs `social_pings` + circuits + panneau riche). MAIS `social-carte` a une affordance unique : « Voir en liste » → `social` ; `carte-oxv` envoie vers `circuits`. Un redirect nu **supprime le seul chemin carte→liste-sociale** et **orpheline `social`**. À reprendre `appMap.ts:82` (`social-carte → club`) au passage. |
| `lieux → carte-oxv` | **MERGE D'ABORD** (audit + verif d'accord) | Données **radicalement distinctes** : `lieux` lit `partners` + `lodgings` + `restaurants` (3 tables publiées) avec filtres par genre, regroupement, badges Partenaire/Premium, tri « premium d'abord », vue liste + état vide. `carte-oxv` lit `circuits` + `social_pings`. Un redirect **orphelinerait 3 tables de données publiées**. **De plus** le schéma `places` est marqué « PROPOSITION non appliquée » (`08_carte_lieux.md:181`) → la déprécier est une **décision de schéma qui exige votre accord** (CLAUDE.md). |

## Ce que la revue adversariale a rattrapé
- L'intention de migration documentée (`social→amis, social-carte/lieux→carte-oxv`)
  était **partiellement fausse** : `social→amis` aurait honoré l'étiquette de zone
  mais **détruit le contenu** (les pings). Le vrai recouvrement de `social` est avec
  `carte-oxv` (même service `listSocialPings`), pas `amis`.
- Le commentaire trompeur dans `app/(app)/club/index.tsx` a été **corrigé** pour
  ne pas induire un futur passage en erreur.

## Décisions attendues (vous)
1. **`lieux` / modèle `places`** : on garde les 3 tables `partners/lodgings/restaurants`
   (et `lieux` reste un écran à part entière), **ou** on déprécie au profit de
   `social_pings` ? La 2ᵉ voie est une **modification de schéma** → votre accord.
2. **`social` + `social-carte`** : aujourd'hui ces deux écrans ne sont reliés qu'entre
   eux (le hub Club pointe vers `carte-oxv`, pas vers `social`). Trois options :
   (a) les laisser tels quels (liste + carte « territoire »), (b) fusionner leur
   contenu liste dans `carte-oxv` (onglet liste|carte) puis supprimer, (c) les
   supprimer franchement (DROP doctrine) si `carte-oxv` suffit. **Recommandation : (b)**
   au prochain build (merge de contenu, pas redirect), ou (c) si vous tranchez que la
   carte seule suffit.

## Testé (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797.

## En suspens — **build requis**
- Tout merge de contenu (option b) doit être validé sur device (la liste, les filtres,
  les marqueurs tappables). Aucune de ces fusions n'est faisable à l'aveugle sans risque
  de perdre une vue.
