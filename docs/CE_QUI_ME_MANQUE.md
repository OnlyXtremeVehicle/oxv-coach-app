# Ce dont j'ai besoin pour finir

> Établi le 29 juillet 2026, après le jalon 5.
>
> Chaque demande dit **ce qu'elle débloque** et **ce que je fais en attendant**.
> Rien ici n'est une question de confort : ce sont les points où le code
> s'arrête, ou avance sur une hypothèse.
>
> Les dossiers `OXV_Dossier_Raccordement_Site.md` et `OXV_Dossier_Avocat.md`
> posent déjà les questions. Ce document-ci fait la seule chose qu'ils ne font
> pas : **relier chaque réponse au code qu'elle libère**, et les classer par ce
> qui coûte le plus à attendre.

---

## 1 — CE QUI BLOQUE LE PLUS, ET QUI NE DÉPEND QUE DE VOUS

### 1.1 Les 43 journées disparues (D-01)

`sessions` porte **une ligne** en production. Une sauvegarde antérieure en
portait 44.

**Ce que cela bloque** : tout. Sans journées, il n'y a ni prochaine journée
ouverte, ni réservation, ni préparation, ni Pass rempli. Chaque écran que je
bâtis se teste sur un vide, et je ne peux pas distinguer « l'écran est correct
et la base est vide » de « l'écran ne sait pas afficher ».

**Ce dont j'ai besoin** : laquelle des cinq sauvegardes fait référence (D-02), et
si les 43 lignes sont récupérables. C'est une opération Supabase, pas du code.

**En attendant** : je continue, et chaque écran concerné rend un vide honnête.
Mais je ne peux affirmer d'aucun d'eux qu'il fonctionne.

### 1.2 Un appareil, et un build

Aucun build EAS n'existe.

**Ce que cela bloque** : toute vérification de rendu. La trouvaille la plus
grave de la revue d'aujourd'hui — la feuille virage qui ne défile pas, le bouton
d'annotation hors cadre — a été **raisonnée**, pas vue. Les hauteurs Skia, les
cibles tactiles, le comportement du clavier : je les déduis du code.

**Ce dont j'ai besoin** : que vous lanciez un build de prévisualisation iOS et
me disiez ce que vous voyez, écran par écran. Ou l'accès pour le lancer.

### 1.3 Un compte coach en production

`users` compte **zéro** ligne de rôle `coach`. Il existe pourtant **un** binôme
dans `coach_pilots`.

**Ce que cela bloque** : l'épreuve de la RLS. Je lis les policies ; je ne les
exerce pas. Tout le jalon 6 repose sur ce que voit un coach — et personne n'a
jamais ouvert l'application en coach.

**Ce dont j'ai besoin** : un compte coach de test, et si possible un binôme avec
un compte pilote portant des séances. Il n'y a **qu'un seul projet Supabase** —
la production. Tout essai s'y ferait, ce qui demande votre accord explicite.

### 1.4 Le boîtier

**Ce que cela bloque** : la capture réelle, donc la validation de tout l'amont.
La base porte 53 trames et **un** tour de 22 millisecondes. `app_segment_analyses`
est **vide** : la feuille virage bâtie aujourd'hui — tracé, barres de G, ancre
`?corner=` — n'a aucune donnée à afficher nulle part.

**Ce dont j'ai besoin** : une journée avec un RaceBox Mini et un bouton Flic. Le
banc de capture est prêt et lit désormais les vraies lignes d'arrivée, Valence
comprise.

---

## 2 — LES ARBITRAGES QUI VOUS REVIENNENT

| # | Question | Ce que ça débloque |
|---|---|---|
| A | **`drop duels`** — la table porte un `status` et un `resolved_at`, donc un vainqueur. Zéro ligne, zéro lecteur. Destructif : tenu par la règle 0.5. | Fin de la phase 4quinquies |
| B | **`PROPOSITION_L10_purge_completude.sql`** et **`L21_consentement_premiere_fois.sql`** — écrites, non appliquées. | Deux points de dette |
| C | **La date de retrait de `app/(pro)`** — recâblé sur app2, mais toujours dans l'application. Le dossier dit qu'il part sur le web, sans dire quand. | Sept écrans de moins |
| D | **Priorité : jalon 6 (coach) ou D-01 d'abord ?** Le plan dit jalon 6. Je pense que D-01 le précède : sans journées, tout se teste à vide. | L'ordre du reste |
| E | **`liveRelayRunner.ts` — le `catch` vide** dans un fichier protégé (D-6 de la dette). | Un point de dette |

---

## 3 — CE QU'IL FAUT DU SITE

Ces demandes existent déjà dans `OXV_Dossier_Raccordement_Site.md`. Voici
**celles qui bloquent du code aujourd'hui**, et ce qu'elles libèrent.

| Réf | Ce qu'il me faut | Ce que ça débloque |
|---|---|---|
| **D-13** | **Qui écrit `eligibility_items`** — le site, l'application, ou les deux ? | « Votre matériel » comme source d'éligibilité. **C'est le prochain lot du jalon 5** : un casque périmé doit être un item que la préparation lit. Je ne peux pas l'écrire sans savoir qui possède la ligne. |
| **D-07** | La **liste exhaustive** des états de `registrations.status` et leurs transitions côté site | La transition gardée vers `attended`. Aujourd'hui l'application n'écrit que depuis `pending` ou `confirmed` — sans la liste, je ne peux pas prouver qu'aucune collision n'est possible. |
| **D-06** | L'**URL exacte et stable** de la page de paiement d'une demande donnée | Le Pass mène pour l'instant à l'espace compte, chemin vérifié mais générique. C'est écrit dans le code comme un pis-aller. |
| **D-12** | Le site écrit-il `users.timezone`, ou l'application seule ? | J'ai posé l'écriture côté application ce soir. Si le site écrit aussi, il faut décider qui gagne. |
| **D-11** | La **forme exacte** de `users.notification_preferences` (JSONB) côté site | Les quatre canaux et les « rituels ». Sans la forme, j'écris un format que le site ne lira pas. |
| **D-08 / D-09 / D-10** | Qui écrit `car_number`, `role`, `public_handle` | `role` est le plus sensible : c'est lui qui commande `is_coach_of()`, donc l'accès d'un coach aux données d'un pilote. |
| **D-14 / D-15** | Le vocabulaire figé (`type` en quatre valeurs, `contact_policy` en cinq, `channel` en cinq) et la suppression d'`is_premium` | Tout le bloc partenaires du jalon 7 |
| **D-17** | La jonction entre candidature et signature pour le numéro de fondateur | Phase 5bis du jalon 6 |
| **D-18 / D-19** | Le parrainage : qui paie, quel avantage | Les écuries, phase 5ter |
| **D-20** | Ce qui doit être généré **côté serveur** | Le jalon 8 entier |
| **D-22** | `app_pairing_codes` — le mécanisme retenu | L'appairage application ↔ site |

**La plus urgente est D-13**, parce qu'elle bloque le lot suivant. Les autres
peuvent attendre leur jalon.

---

## 4 — CE QU'IL FAUT DE L'AVOCAT

Même chose : les questions sont dans `OXV_Dossier_Avocat.md`. Voici celles qui
tiennent du code à l'arrêt.

| Pièce | Ce que ça débloque | Urgence |
|---|---|---|
| **Pièce 5** — la comparaison entre pilotes de la même journée | **L'écran de comparaison entre amis dans le Club** — dernier écran du jalon 5. Je ne l'écris pas avant : la zone grise identifiée porte sur le consentement, et je bâtirais une surface qu'il faudrait défaire. | **Bloquant maintenant** |
| **Pièce 2** — le pacte mutuel d'onboarding | L'onboarding à cinq étapes, dont le plan dit explicitement qu'il dépend de cette pièce. | Bloquant maintenant |
| **Pièce 6** — la comparaison d'élèves par un coach | La phrase de consentement doit dire que le coach « peut les comparer à celles de ses autres pilotes ». Elle ne le dit pas aujourd'hui. | Jalon 6 |
| **Pièce 1** + **Pièce 7** — décharge et rétention des signalements d'incident | Les décharges e-sign sont livrées mais **gatées fermées**. La durée de rétention manque. | Avant la première journée |
| **Pièce 3** — le mandat d'encaissement des coachs | La facturation coach. Dépend aussi du SIRET. | Jalon 6 |
| **Pièce 8** — responsabilité d'organisateur sur les roulages de coach | Les roulages proposés par un coach. | Jalon 6 |
| **Article 25** — la durée des liens de partage | Tranché par vous à 7/30 jours, appliqué. Reste la confirmation que « sans limite » devait bien disparaître. | Confirmation |

---

## 5 — CE QUI ATTEND UNE FORMALITÉ

- **Le SIRET** — Tap to Pay sur iPhone, et le mandat d'encaissement coach.
- **`origin/main`** — la branche `migration/sdk-55` porte tout le travail et est
  poussée. Avancer `main` est une décision de publication ; vous ne l'avez pas
  prise, et je ne l'ai pas prise à votre place.

---

## 6 — CE QUE JE FAIS SANS ATTENDRE PERSONNE

Pour que la liste ci-dessus ne ressemble pas à un arrêt de travail. Sans une
seule réponse, il me reste :

- **Jalon 6, le fil de séance** — il rend inutiles quatre écrans, 1 983 lignes.
  Le temps réel se teste sans coach : c'est un canal, pas un rôle.
- **Le canal biométrie par coach** (`live:bio:<coachId>:<sessionId>`) —
  aujourd'hui, un cardio n'est émis que si TOUS les coachs à l'écoute sont au
  niveau détaillé, parce que le canal est partagé.
- **Jalon 7, les trois défauts structurels de l'admin** : l'espace n'a pas
  d'entrée (six gestes pour l'atteindre), aucun bouton de déconnexion n'existe,
  et l'inspecteur est codé en dur sur Haute Saintonge alors qu'il devient
  l'éditeur des trois circuits.
- **La dette** : le séparateur décimal contourné en 77 endroits, 37 écrans sur
  157 pas passés à la marge d'écran, D-20 et D-21.

---

## 7 — CE QUE JE NE PEUX PAS COMPENSER

À dire franchement, parce que c'est ce qui limite la valeur de tout le reste.

**Rien n'a jamais tourné.** Chaque affirmation de ce dépôt sur le comportement
réel est une lecture de code. Les tests couvrent la logique ; ils ne couvrent ni
le rendu, ni la RLS en situation, ni le boîtier.

**Mes propres outils m'ont menti deux fois aujourd'hui** : un relevé de
dépendances qui ne suivait que les imports `@/…` a déclaré mort le calcul de la
marge — le chiffre central de l'application ; et la garde d'expiration des
partages que j'avais posée était franchie par `expiresInDays: x ?? undefined`.
Les deux n'ont été rattrapés que parce que le résultat paraissait absurde.

C'est la raison pour laquelle je demande un appareil et un compte coach plutôt
que davantage de temps.
