# Bloc C — Restitution

*Réécrit le 30/08/2026, après lecture du dépôt et de la base de production.*

> **Avertissement sur la version précédente.** Le premier bloc C a été écrit sans
> avoir lu le dépôt. Il proposait quatre choses qui existent déjà : le mécanisme
> de lien révocable, le filtre de sûreté de sortie, le composeur déterministe de
> débrief, et une partie du moteur d'insights. Il posait aussi un critère
> d'acceptation qui aurait cassé une garde du dépôt. La version aveugle est
> conservée sous `C_Restitution.aveugle.bak` pour mémoire. Ce qui suit part de ce
> qui est là.

---

## C-0 · Ce qui existe déjà, et qu'il ne faut pas réécrire

| Besoin | Ce que le dépôt porte | État |
|---|---|---|
| Lien public révocable | `app_progression_shares` (`share_token`, `share_scope`, `included_metrics`, `expires_at`, `revoked_at`, `view_count`, `last_viewed_at`) + trois fonctions `SECURITY DEFINER` sur `p_token` | **en production** |
| Filtre doctrinal de sortie | `src/services/aiSafetyFilter.ts` — 52 termes proscrits | atteignable |
| Débrief déterministe | `src/services/debriefGenerator.ts` — repli local sans modèle | atteignable |
| Débrief rédigé | `supabase/functions/generate-debrief-ai` (v23) + déclencheur SQL + `app_ai_debrief_optout` | en production |
| Ceinture de rendu | `src/services/debriefRenderGuard.ts` | **dormant** — le Bilan tient la sienne (`isDoctrineSafe`) |
| Choix de la lecture à ouvrir | `compositionLogic` + `registrePresentations` (65 fiches) | **dormant, testé** |
| Sources du moteur | `sourcesCompositionService` + `pilot_presentation_views` / `pilot_presentation_work` | **dormant, base prête** |
| Disponibilité des six lectures | `components/insights/disponibilite.ts` | atteignable |
| Insights de séance | `compute-session-insights-v3` (v11) + `sessionInsightsEngine` (app) | fonction active · moteur app **dormant** |

**Règle de travail qui découle de ce tableau :** avant d'écrire une fonction,
chercher son homonyme dans `modulesOrphelins.guard.test.ts`. Quarante modules y
sont listés avec leur raison et leur condition de sortie.

---

## C-1 · Débrief J+1 — la page envoyée sous 24 h

`app/(app2)/bilan/debrief/[sessionId].tsx` · page publique côté `oxv-site` —
**à créer** · le mécanisme de partage, lui, **existe**.

**Ce qu'elle contient.** L'intention de la séance · le meilleur tour · la trace ·
les secteurs officiels face au chronométrage · les notes du camion à leur heure ·
la mesure d'écart. Rien de plus.

**Feuille de données (G-8).** Mots-clés seuls. Aucune phrase.

**Ce qu'il reste réellement à faire — trois choses, pas un mécanisme.**

1. Un `share_scope` nouveau (`debrief_seance`) et sa liste blanche de métriques
   dans `included_metrics`. La liste blanche est le contrôle : ce qui n'y est pas
   ne sort pas, même si la page le demande.
2. La page publique, qui appelle la fonction `SECURITY DEFINER` avec le jeton et
   rien d'autre.
3. L'écran de révocation côté pilote, qui écrit `revoked_at`.

`expires_at`, `revoked_at`, `view_count` et `last_viewed_at` sont déjà là. Le
compteur de vues n'est pas décoratif : c'est lui qui vous dira, après Albi, si la
page a circulé dans l'écurie ou si elle est restée sur un téléphone.

**Acceptation.**
1. Le lien s'ouvre sans compte OXV, en 4G moyenne, sous trois secondes.
2. Révoqué depuis l'application, il rend une page qui le dit — pas une erreur.
3. Une métrique hors `included_metrics` ne s'affiche pas, même en forçant l'appel.
4. Chaque chiffre porte sa provenance.
5. Zéro phrase au sens de G-2 sur la page.

---

## C-2 · Assistant « Questionner ses données »

`src/ui/data/AssistantQuestion.tsx` · fonction serveur — **à créer**, allumé au
Mans, sur un filtre qui **existe déjà**.

Vous l'allumez complètement. Je ne rediscute pas la décision ; je la rends
survivable.

**L'architecture, en une phrase.** Le modèle **écrit la requête**, la base
**répond** sous RLS, un filtre relit la sortie. Le modèle ne produit jamais un
chiffre. Un nombre qui n'est pas sorti de la base ne s'affiche pas.

**Correction de la version aveugle.** J'avais spécifié une garde
`assistantSansConseil` avec son propre lexique. `aiSafetyFilter` fait déjà ce
travail, avec 52 termes, et il est testé. **On l'étend, on ne le double pas** :
deux implémentations d'une même règle finissent par diverger, et c'est toujours
la copie qui ment.

**Les trois barrières, dans cet ordre.**

1. **Périmètre de requête.** Lecture seule, tables autorisées nommées, données du
   pilote connecté uniquement. Refus côté serveur, jamais côté invite.
2. **`aiSafetyFilter`, étendu.** Le lexique causal et prescriptif qui manque —
   *parce que, donc, grâce à, à cause de, la raison est* — s'ajoute à la liste
   existante, dans le même fichier, avec son test.
3. **Refus formaté.** À « que dois-je faire ? », « où je perds du temps ? »,
   « je freine trop tard ? » : une réponse fixe, écrite à l'avance, suivie de
   faits — jamais d'une reformulation du conseil.

**L'interrupteur.** Un drapeau dans `app_feature_flags`, relu à chaque appel.
La table existe. L'assistant s'éteint partout depuis le paddock, sans
déploiement.

**Le corpus de questions pièges.** Trente minimum, écrites **avant** le code,
dont dix formulées comme un pilote professionnel les poserait. Garde bloquante :
tant qu'elle est rouge, l'assistant reste éteint.

**Hors réseau, il ne tourne pas et il le dit.** Un assistant qui répond mal hors
ligne est pire qu'un assistant absent.

**Acceptation.**
1. Les trente questions passent, application et serveur, sur le même corpus.
2. Aucun chiffre de la réponse n'est absent de la réponse de la base — recoupement
   automatique.
3. L'interrupteur éteint en moins de dix secondes, sans redéploiement.
4. Journal des questions posées, relisible après le week-end.

---

## C-3 · La feuille de faits — remplace le « Récit de faits »

**Ce que j'avais écrit :** créer `recitService.ts` pour remplacer
`debriefGenerator` et `generate-debrief-ai`. **C'était faux sur les trois points.**
`debriefGenerator` est déjà le composeur déterministe, il est atteignable, et
`generate-debrief-ai` est protégé par un filtre, un repli local, une garde de
rendu et un déclencheur SQL. Remplacer cela par un module neuf jetterait quatre
mécanismes de sûreté pour gagner un nom.

**Ce qui reste, et c'est réel :** le débrief rédigé est une **feuille de récit**
(G-8) ; il ne va pas sur la feuille de données. La feuille de données a besoin,
elle, des mêmes faits en mots-clés :

```
TOUR 2 · MEILLEUR
TOUR 3 · V MAX 104,5
TOUR 1 · 360,485
ÉCART S2 · 0,84
```

**Où cela vit.** Une projection de `keyMoments` / `traceNarrative` vers des
libellés courts, dans la couche de restitution — pas un service de plus. Aucun
modèle de langage. Deux exécutions sur la même séance rendent la même sortie, au
caractère près.

**Acceptation.**
1. Rejeu deux fois sur la séance de Bouteville (`ff384ace…`) : sortie identique.
2. Zéro phrase au sens de G-2.
3. Chaque fait porte son tour.
4. `debriefGenerator` et `generate-debrief-ai` sont **inchangés**.

---

## C-4 · Les modules dormants à brancher

**Correction.** J'avais écrit « les quatre orphelins » et posé comme critère
`modulesOrphelins` transitif = 0. Il y en a **quarante**, et ce critère
casserait la garde elle-même : son premier test exige `mesures.length > 0`,
précisément pour qu'un résolveur cassé ne rende pas la liste artificiellement
verte.

**Le bon critère :** un module branché **sort de la liste `CONNUS` dans le même
commit**. Le second test du dépôt (« aucune entrée périmée ») l'impose déjà. Il
n'y a rien à inventer.

Les quatre à brancher avant Le Mans :

| Module | Deux appelants | Ce qu'il faut surveiller |
|---|---|---|
| `DataConfidenceBanner` | Bilan · Séance | Porte la mesure d'écart. Prérequis de la preuve P-1 |
| `LapScrubber` | Séance · Comparer | Rend la Séance lisible tour par tour, debout au camion |
| `RadarEmpreinte` | Signature · Studio | **Sera vide au Mans.** Voir ci-dessous |
| `DebriefMirror` | Bilan · notification J+1 | Alimente C-1 |

**Le cas `RadarEmpreinte`.** Il lui faut plusieurs séances. Au Mans il en aura
une — deux si Bouteville du 12/08 compte, ce qui est à vérifier avant de le
promettre. Son état vide nomme son entrée manquante et compte :
`SIGNATURE · 1 / 3 SÉANCES`.

Bien traité, c'est la démonstration la plus courte de la doctrine : un outil qui
refuse de conclure sur une séance, devant un professionnel qui a vu passer
beaucoup de promesses. Mal traité — cinq branches à zéro — c'est un écran cassé.

**Vocabulaire des cinq axes, figé :** Cap, Visée, Plongée, Trajectoire,
Anticipation. Aucun renommage avant données réelles.

**Acceptation.**
1. Chaque module a **deux** appelants réels — garde `deuxEntrees`.
2. Chaque module sort de `CONNUS` dans le commit qui le branche.
3. `RadarEmpreinte` sur une séance unique affiche son compteur, pas un radar plat.

---

## C-5 · Trois défauts à corriger avant d'ouvrir quoi que ce soit

Trouvés en base le 30/08. Ils passent avant les écrans.

**C-5.a — La ligne de démonstration en production.** `session_insights` ne
contient qu'une ligne : `mirror-insights-demo`, sur une séance à zéro trame, avec
un tour idéal fabriqué. **L'application ne la voit pas** — `MOTEURS_INSIGHTS_REELS`,
`insightsMesures` et le filtre en requête de `sessionInsightsService` la refusent
trois fois, et un test nommé la vise explicitement. Rien à coder.
*Reste :* elle est le seul contenu de la table, donc visible de tout ce qui lit la
table sans passer par le service. À sortir de la production.

**C-5.b — Les branches inertielles du QDI mesurent de la vibration.** Diagnostic
fait : jerk latéral de médiane 0,286 g/s mais de moyenne 2,240 et de p95 14,0 —
0,56 g entre deux trames, sur un signal d'amplitude totale 1,14 g. Un lissage sur
13 trames ramène la moyenne à 0,629, soit une fluidité de 78 au lieu de 0. Les
seuils sont bons ; le signal envoyé est brut. Correctif = filtre + incrément de
`QDI_ALGO_VERSION` + recalcul de l'historique : **décision fondateur**, pas effet
de bord de lot. Sinon, le premier chiffre qu'un pilote professionnel verra de nous
sera un zéro.

**C-5.c — Le cap est nul sur 100 % des trames.** Aucun écran ne peut afficher
une orientation. Soit on la dérive de la trajectoire — et elle devient fausse à
basse vitesse —, soit on ne l'affiche pas. **Ne pas l'afficher** tant que la
première option n'est pas mesurée.

---

## C-6 · Le lot des écrans — ce que le moteur de composition attend

Le moteur choisit **quelle lecture ouvrir**. Il est écrit, testé, et sa base est
prête depuis le 29/08. Il lui manque une surface.

**Ce que la surface doit faire, et rien de plus.**

1. Appeler `composerPresentations` avec la surface, l'expérience, le souhait, la
   disponibilité et le travail actif.
2. Rendre `presentations` dans l'ordre donné — sans retrier.
3. Ouvrir d'elles-mêmes celles dont `parDefaut` est vrai ; les autres restent
   dans la liste, à un geste.
4. Afficher `motifs` et `ecartees` **en mots-clés** (G-9).
5. Écrire dans `pilot_presentation_views` à l'ouverture, dans
   `pilot_presentation_work` à l'ouverture et à la clôture d'une opportunité.

**Ce qu'elle ne fait pas :** décider. Aucun tri, aucun score, aucun rang. Le
moteur a déjà tranché, et son revers (`ecartees`) est ce qui rend le choix
lisible.

**Deux faits à connaître avant de promettre.** `cycle_steps` et
`coach_annotations` comptent zéro ligne en production. `lireAcquisValide` et
`lireVoixCoach` rendront donc `false` pour tout le monde, et les fiches P36 et
P46 à P51 — passeport de compétences, carte de preuve, rétention — resteront
écartées au Mans, avec leur motif. C'est correct. Ce n'est pas ce qu'on montre à
une écurie en disant « voici ce que ça fait ».
