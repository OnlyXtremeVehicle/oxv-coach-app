# Proposition — « Méthodes du coach appliquées à la restitution » (§10.3)

> **Statut : PROPOSITION, non implémentée.** Ce document cadre le 3ᵉ volet de
> l'enrichissement coach (cahier v3 §10.3). Il attend la validation de Gabin
> avant tout développement. Les deux premiers volets du §10.3 sont déjà livrés
> (annotations textuelles ; paramètres contextuels niveau/objectif/matériel/météo).

---

## 1. Le point à trancher

Le cahier v3 §10.3 liste trois formes d'enrichissement par le coach. La troisième :

> « Ses propres repères et méthodes, que l'application applique à la restitution
> destinée à ses élèves. »

C'est volontairement flou, et c'est le volet le plus délicat : faire en sorte
qu'un **tiers façonne ce que voit le pilote** frôle la frontière doctrinale
« l'app est un miroir, pas un coach ». Avant de coder, il faut décider **ce que
« méthode appliquée à la restitution » veut dire concrètement**.

## 2. La tension doctrinale, et pourquoi elle est gérable

La doctrine dit : OXV ne coache pas, ne juge pas, n'ordonne pas. Mais le cahier
§10.3 résout lui-même la tension :

> « C'est le coach — professionnel agréé, sous sa propre responsabilité — qui
> apporte l'interprétation. OXV continue de ne fournir que l'outil et la donnée
> brute factuelle. »

**Conclusion** : une « méthode du coach » est acceptable **si et seulement si** :

1. elle est **explicitement attribuée au coach** (« Repère de votre coach », jamais
   « OXV recommande ») ;
2. elle reste **descriptive** (un fait, un repère, un ordre d'affichage) et
   **jamais prescriptive** (pas de « freinez plus tôt », pas de note, pas de
   classement) ;
3. le pilote peut **l'ignorer / la replier** — elle ne s'impose pas au-dessus de
   sa propre lecture.

Tant que ces trois garde-fous tiennent, OXV reste un miroir ; l'interprétation
est portée par un tiers identifié.

## 3. Quatre interprétations possibles (de la plus sûre à la plus risquée)

### Option A — Repères de référence du coach (overlay factuel)
Le coach définit, par virage, **ses repères** : point de freinage de référence,
trajectoire-type, vitesse de passage visée. L'app les **superpose** à la donnée
du pilote, en les **étiquetant « Repère de votre coach »**, sous forme de simple
comparaison factuelle (« votre freinage : 95 m — repère du coach : 110 m »).
- ✅ Descriptif, attribué, le pilote tire ses propres conclusions.
- ⚠️ Un « repère de vitesse visée » peut glisser vers de l'objectif de perf →
  cadrer le vocabulaire (repère, pas consigne).

### Option B — Priorisation / curation de la restitution (recommandée)
Le coach choisit, pour **ce pilote**, **quels virages / quelles vues mettre en
avant** et dans **quel ordre** sur le bilan. Il ne crée aucun contenu prescriptif :
il **ordonne** la restitution existante (« commencez par le virage 4 »).
- ✅ Le plus sûr : aucune donnée nouvelle, aucune injonction, juste un ordre de
  lecture proposé et attribué (« Mis en avant par votre coach »).
- ✅ Faible coût technique, fort effet « personnalisé ».

### Option C — Gabarits de commentaire réutilisables
Les observations récurrentes du coach deviennent des **modèles** qu'il applique
vite à ses annotations (déjà existantes). Pur confort de saisie côté coach.
- ✅ Zéro risque doctrinal (ce sont les annotations déjà cadrées).
- ➖ N'« applique » rien automatiquement à la restitution — périmètre limité.

### Option D — Méthode interprétative automatique
L'app applique seule la « méthode » du coach pour **réécrire / réinterpréter** la
donnée du pilote (ex. recalculer une marge selon les pondérations du coach).
- ❌ **À éviter** : l'app porterait l'interprétation → contradiction doctrinale
  directe et risque juridique (retour du coaching algorithmique).

## 4. Recommandation

**Option B (priorisation/curation) en socle, + Option A (repères factuels
étiquetés) en complément**, toutes deux strictement attribuées au coach et
descriptives. On écarte D. C est déjà couvert par les annotations.

Concrètement, côté pilote, le bilan afficherait :
- un éventuel **ordre de lecture** « Mis en avant par votre coach » (B) ;
- des **repères du coach** par virage, en comparaison factuelle, repliables (A).

Le tout sous le même cartouche bleu coach que le contexte (§10.3 déjà livré),
jamais mélangé à la voix d'OXV.

## 5. Esquisse technique (si validé)

- Table `coach_pilot_method` (par couple coach↔pilote, ou par session) :
  - `highlight_corner_indexes int[]` (Option B — virages mis en avant) ;
  - `reference_markers jsonb` (Option A — repères par virage : freinage, trajectoire) ;
  - `note text` (intro libre du coach) ;
  - RLS : coach gère les siens (is_coach_of) ; pilote lit les siens.
- UI coach : éditeur depuis la vue pilote (à côté de « Contexte de séance »).
- UI pilote : section repliable sur le bilan, cartouche coach, étiquetage explicite.
- Garde-fous : passage au scanner doctrinal (verbes interdits) sur tout texte ;
  rendu toujours préfixé « Votre coach », jamais impératif.

## 6. Décision attendue de Gabin

1. Valide-t-on l'orientation **B + A étiquetées**, ou un sous-ensemble ?
2. Le périmètre est-il **par session** ou **par pilote** (méthode durable) ?
3. Confirme-t-on l'exclusion de l'option D (réinterprétation automatique) ?

Tant que ce n'est pas tranché, **rien n'est codé sur ce volet** — les deux autres
volets du §10.3 (annotations, paramètres contextuels) sont, eux, opérationnels.
