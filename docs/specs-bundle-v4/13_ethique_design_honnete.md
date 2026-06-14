# 13 — Éthique : design honnête (charte + déclinaison technique)

> Axe : **aucun dark pattern, aucune boucle d'engagement addictive.**
> Rejoint la couche doctrine (à côté de `00_CLAUDE.md`, `01`, `10`, `11`, `12`).
> Là où la charte bien-être (10) interdit de pousser au RISQUE, celle-ci interdit de
> manipuler l'UTILISATEUR — commercialement et dans son attention.

---

## PRÉAMBULE — honnête ne veut pas dire anti-marketing

Un design honnête n'interdit pas de vendre ni de mettre en valeur. Il interdit de
**tromper** : fabriquer une urgence qui n'existe pas, rendre la sortie difficile,
piéger l'attention. La nuance est nette : une rareté RÉELLE (le plafond de 20 pilotes
par session) peut être communiquée ; une rareté INVENTÉE est un dark pattern. La ligne
n'est pas « ne jamais montrer de limite » — c'est « ne jamais en manufacturer une ».

---

# PARTIE I — LA CHARTE (les engagements)

### D1. La sortie est aussi simple que l'entrée.
Se désabonner ou résilier se fait en autant de gestes que s'abonner. Jamais de « roach
motel » (facile d'entrer, pénible de sortir), jamais de résiliation par téléphone seul.

### D2. Pas de fausse urgence ni de rareté artificielle.
Aucun compte à rebours fabriqué, aucun « plus que 2 places » qui ne soit pas
littéralement vrai. La rareté réelle (plafond 20 pilotes) se dit ; la fausse, jamais.

### D3. Pas de confirmshaming, pas de cases pré-cochées.
Les choix sont neutres et actifs. Pas de « Non merci, je préfère rester moins bon ».
Le consentement n'est jamais pré-coché (cf. RGPD, fiche 07).

### D4. Prix et renouvellement clairs et exacts.
Le reconduction automatique est annoncée avant l'achat. La copie tarifaire correspond
exactement au prix réel. Aucun frais caché.

### D5. Notifications sobres et maîtrisées.
Peu nombreuses, factuelles, à fréquence contrôlée par l'utilisateur. Jamais de
harcèlement (« revenez ! », « vous nous manquez »).

### D6. Les défauts servent l'utilisateur, pas la métrique.
Les réglages par défaut protègent (notifications au minimum, partage en privé par
défaut) plutôt que de maximiser l'engagement.

### D7. L'app n'optimise pas le temps passé.
Le succès, c'est que l'utilisateur obtienne ce qu'il est venu chercher — pas qu'il
reste. Pas de fil infini, pas de piège attentionnel. L'app est un outil, pas un flux.

---

# PARTIE II — LA DÉCLINAISON TECHNIQUE (vérifiable)

## A. Garanties déjà VÉRIFIÉES en base
- **Aucune mécanique d'engagement** (streak / badge / succès / classement) — vérifié
  (fiche 10). Rien à désamorcer.
- **Prix Heritage correct** : `pricing` → `heritage` = 249000 cents (2490 €), actif
  2026 et 2027. La valeur en base est juste.
- **Annulation modélisée** : `registrations.cancelled_by` existe (parcours de résiliation
  prévu côté track day).

## B. Règles que Claude Code DOIT appliquer
| Eng. | Règle de code / présentation |
|---|---|
| D1 | Abonnement SaaS (Stripe) : résiliation en self-service, même nombre de clics que la souscription. Jamais d'obstacle. |
| D2 | Aucun minuteur fabriqué. « Places restantes » UNIQUEMENT dérivé du compte réel d'inscriptions vs plafond 20. Rareté = vraie ou rien. |
| D3 | Zéro case pré-cochée. Zéro copie culpabilisante sur les refus. Consentement actif (fiche 07). |
| D4 | La copie tarifaire correspond à la table `pricing`. **Heritage : aligner « payez 3, 4e offert » sur 2490 € réels, ou retirer la formule.** Reconduction annoncée avant achat. |
| D5 | Fréquence des notifications plafonnée et réglable. Copie de `ritual_dispatcher` / `notify-*` factuelle (audit convergent). |
| D6 | Défauts protecteurs : notifications au minimum, `app_progression_shares` en privé par défaut (déjà le cas). |
| D7 | Aucune métrique qui optimise le temps passé. Pas de fil infini. |

## C. Vérification — prix de référence (la copie doit s'y conformer)
```sql
-- Source de vérité des prix : toute copie marketing doit correspondre à ceci
select offer_key, format, season, price_first_session_cents/100.0 as prix_euros, active
from pricing where active = true order by offer_key, season;
-- Règle : aucun montant affiché en façade ne doit contredire une ligne active ici.
-- Cas connu : Heritage = 2490 €, donc « payez 3 (×890=2670), 4e offert » est FAUX → corriger la copie.
```

## D. Points d'AUDIT / chantiers (à faire)
1. **Copie Heritage** : réconcilier « payez 3, 4e offert » avec 2490 € réels. Connu, à corriger.
2. **Notifications** : fréquence + copie de `ritual_dispatcher` et des `notify-*` contre
   D5 et le garde-langage (fiche 10 §C). Audit convergent avec les fiches 10/11/12.
3. **Résiliation SaaS** : quand Stripe sera actif (post-SIRET), vérifier la sortie self-service.

---

# PARTIE III — LA LIGNE, EN UNE PHRASE

Vendre n'est pas tromper. OXV peut mettre en valeur son offre, dire une rareté qui
existe, et rappeler une session à venir — mais jamais fabriquer une urgence, piéger une
sortie, ou pré-cocher un consentement. Le test : si un réglage existe pour servir la
métrique d'engagement plutôt que l'utilisateur, il est interdit.
