# Point de fin — les jalons du programme V3

> **14 août 2026.** Branche `migration/sdk-55`, quatorze commits.
>
> Ce document remplace l'état de [`POINT_JALONS_2026-08-13.md`](POINT_JALONS_2026-08-13.md),
> qui garde sa valeur de constat de la veille. Le livrable d'acceptation
> [`BILAN_V3.md`](BILAN_V3.md) a été repris le même jour.

---

## En une ligne

**Tout ce qui pouvait s'écrire est écrit. Ce qui reste ne s'écrit pas :
il se déploie, il se branche, il se roule, ou il s'achète.**

---

## Comment cet état a été établi

Pas en relisant le plan. **Soixante-huit agents** ont mesuré les jalons 1, 5,
7 et 8 ligne par ligne dans le dépôt et les migrations, et chaque verdict
« absent » ou « fait » a été soumis à un second agent chargé de le **réfuter**.

C'est la leçon du 13 août, où j'ai annoncé un lot de 71 écrans en attente alors
que l'arbre était supprimé depuis des jours — parce que j'avais cru un document.

La mesure a rendu son verdict le plus utile sur le plan lui-même : **il se
trompe dans les deux sens, et plus souvent en se sous-estimant.**

---

## L'état par jalon

| | Jalon | 13/08 | 14/08 |
|---|---|---|---|
| 0 | Ce qui bloque tout | satisfait | inchangé |
| 1 | Technique | « fait sauf T2 » | **fait** — T2 tournait déjà, T3 est armé |
| 2 | Socle produit | fait | inchangé |
| 3 | Le jour J | éprouvé au terrain | inchangé — reste l'écran verrouillé |
| 4 | La restitution | 4 niveaux sur 5 | inchangé — le 5ᵉ attend une commande SQL |
| 5 | Les espaces | une ligne ouverte | **CLOS** |
| 6 | Coach | « non commencé » | **fait**, écuries comprises |
| 7 | Admin et partenaires | « non commencé » | **largement monté** |
| 8 | Innovations et serveur | « non commencé » | **partiel** — voir plus bas |

---

## Ce qui a été livré aujourd'hui

### La panne que j'avais causée

`adminUsersService` écrivait encore `is_admin` sur `users`. J'avais supprimé la
colonne la veille. PostgREST refuse une colonne inconnue **avant** d'atteindre
Postgres : depuis ce `DROP`, **tout changement de rôle depuis la console
échouait.**

Trois choses l'ont cachée. Un `as never` sur l'écriture — le compilateur ne
pouvait plus refuser. Le garde des non-changements, qui court-circuite les
écritures inutiles : l'échec ne survenait donc que lors d'un vrai changement de
rôle, le seul cas qui compte. Et ma migration vérifiait son travail en exécutant
un `UPDATE` — elle passait, précisément parce qu'elle ne nommait plus la
colonne.

**La règle : un `DROP COLUMN` se balaie aussi côté application, et un cast sur
une écriture est l'endroit exact où le balayage manque.**

### Le jalon 5, fermé

Sa dernière ligne portait deux sujets, dont un seul avait été traité. Le pilote
lisait encore quatre onglets en dur — **« Heatmap »** et **« Replay »** en
anglais —, deux sur-titres, et « G longitudinal » jusque dans ce que VoiceOver
prononce.

### Neuf choses écrites, testées, et que personne n'appelait

| Ce qui dormait | Depuis | Désormais |
|---|---|---|
| `nameMyCrew` — le baptême d'écurie | 04/07 | écran d'écurie |
| `crews_public_rows` — l'annuaire | 04/07 | idem |
| `getAnnotationAudioUrl` — la voix du coach | 18/06 | lecteur au bilan |
| `declare_eligibility_item` | 11/08 | écran « Vos pièces » |
| `incident_followups` en écriture | 02/08 | écran admin |
| `pilot_notes.theme` | — | ressenti de saison |
| l'intention de séance | 18/07 | rendue au bilan |
| `provenance.ts` — 27 grandeurs | — | écran de méthode |
| la géométrie des circuits | — | fiche du Territoire |

Chacune était complète et correcte. Il manquait l'appelant.

### Deux lois de couleur, énoncées et violées

`#E63946` mesure **4,37 / 4,04 / 3,78** sur les trois fonds : il échoue au seuil
AA partout, et deux endroits le posaient sur du texte. Le correctif **calcule**
le contraste plutôt que d'écrire une exception à la main — une exception
resterait juste par accident le jour où une teinte bouge.

Et « QDI » restait dans l'étiquette d'accessibilité du radar : le seul pilote à
qui l'application parlait en sigles était celui qui ne voyait pas l'écran.

---

## Où le plan se trompe, et dans quel sens

**Il se sous-estime** sur les jalons 7 et 8, qu'il déclare non commencés alors
que 31 écrans admin et 8 partenaire sont montés ; sur ThumbHash, « proposé »
alors que sa fonction Edge tourne depuis le 3 août ; sur « pourquoi ce chiffre
est absent », rangé en jalon 8 alors que le mécanisme était livré.

**Il se surestime** sur les numéros en piste — une colonne que rien n'écrit —,
sur le temps réel, posé sur le seul écran que la ligne excluait, et sur une
table d'audit livrée en trois colonnes qui ne journalisent rien.

---

## Trois fois où j'ai corrigé la mesure

Elle est adversariale, pas infaillible. Vérification faite :

1. **Le radar compact** était donné pour une violation partout. Sur l'accueil,
   une légende complète l'accompagne — la couleur n'y est jamais seule. Le
   manque était dans la grille des mois seulement.
2. **L'onglet Routes du Territoire** devait être supprimé comme doublon. Il rend
   `mergeRoutes(listMyRoutes, listCertifiedRoutes)` ; l'écran dédié ne rend que
   les miennes. C'est un sur-ensemble — le supprimer aurait retiré la
   **découverte**, une régression déguisée en nettoyage.
3. **Ma propre garde couleur** accusait `bilanLogic`, qui pose `color` sur un
   marqueur de tracé. Un verdict faux fait corriger ce qui allait bien.

---

## Ce qui reste, et qui ne s'écrit pas

### Le geste qui presse — et ce n'est pas celui que j'avais mis en tête

~~**Déployer la version 21 du cron d'analyse.**~~ — **FAIT, 14/08.**

`cron-analyze-pending-sessions` **version 21**, `verify_jwt: false`, ACTIVE.
Déployée depuis le fichier du dépôt par la CLI plutôt que retranscrite dans un
appel : 393 lignes recopiées à la main, dans une fonction de production sans
test sur l'artefact déployé, c'est un risque qu'aucun gain ne payait.

`verify_jwt` est resté à `false` parce que `config.toml` le déclare — le piège
du matin, où un déploiement l'avait basculé à `true` par omission et aurait
fait rejeter le cron en 401, ne pouvait pas se reproduire par cette voie.

**À vérifier à l'heure ronde suivante** : `margin_global` doit valoir **51,44**
sur Bouteville, `margin_breakdown` porter `consistency` et non `regularity`, et
`algo_version` valoir `cron-v2.0` sur les onze lignes.

Une vérification en production, le 14/08 à 14 h 10, a montré ce que je n'avais
pas vu. Le correctif du matin fermait la boucle infinie — et fermait avec elle
le **rattrapage** :

> Bouteville, la seule séance de la base portant une vraie mesure, garde
> `margin_global = 39.20` et `breakdown.regularity = 0` — l'ancienne clé et
> l'ancienne formule — alors que le calcul livré le matin donne **51,44**. La
> fonction tourne toutes les heures, rend 200, et traite zéro séance.
> Correctement, du point de vue du critère.

Et rien d'autre ne pouvait la rattraper. J'avais écrit dans l'en-tête de ma
migration qu'elle serait reprise « jusqu'à ce que l'application rouvre la
séance » : **c'était faux, et je ne l'avais pas vérifié.**
`analyzeAndPersistSession` n'est appelée que par `rec/fin`, à la clôture.
Rouvrir une séance ne recalcule rien.

Le correctif retenu ne répare pas ce cas mais sa CLASSE : le critère porte
désormais sur `ALGO_VERSION`, pas sur l'existence d'une ligne. Toute correction
future de formule rattrapera l'historique en incrémentant une constante.

### Et `ritual_dispatcher`, que j'avais mal classé

Je l'avais placé en tête, sous le titre *« un geste qui coûte quelque chose
chaque jour »*. **La mesure dit le contraire :**

| | mesuré le 14/08 |
|---|---:|
| lignes dans `ritual_dispatches` | **0** — aucun rituel n'a jamais été envoyé |
| sessions à venir | **1**, le 24/12/2026 |
| inscrits confirmés sur celle-ci | **0** |

La fonction s'exécute quatre fois par jour et n'a **aucun destinataire**. Le
zéro fabriqué existe dans le code déployé — version 28, du 21/07, vérifiée en
ligne : deux occurrences de « Conditions à confirmer », zéro de « Prévision
indisponible ». Il n'atteint personne, et n'atteindra personne avant le 23/12.

Elle doit être déployée. Elle ne pressait pas, et la placer en tête a détourné
l'attention de Bouteville.

### Ce qui attend une commande

| | |
|---|---|
| Les **cinq** migrations `PROPOSITION_` | et non trois : le registre comptait faux |
| `laps.distance_meters` | une exécution de `scripts/sql/backfill_laps_distance.sql` ouvre le 5ᵉ niveau |
| La colonne `is_premium` | le tri achetable est parti ; la colonne attend |
| Le vocabulaire partenaire | une décision de SENS avant une migration — deux contradictions internes à trancher |

### Ce qui attend le monde

**Deux comptes coach** distincts de l'admin, et l'affiliation du 22/06 restée
`pending`. **Le terrain** : l'écran verrouillé, dix minutes de roulage.
**Une machine à appareil** pour la mesure T3 — deux lignes à changer le jour où
elle existe. **Le SIRET**, **une clé de transcription**, **du Swift** pour les
surfaces iOS, et **des saisons** pour la mémoire du circuit.

### Ce que je n'ai délibérément pas fait

**Le hub admin du jour J.** L'ordre des familles est conforme, la substance des
zones ne l'est pas : le milieu ne contient que des cartes qui renvoient
ailleurs, le bas que des liens. C'est un remaniement de produit, pas la
correction d'un défaut — et il se décide devant l'écran, avec quelqu'un qui a
tenu une journée.

**La suppression du portage ThumbHash.** Du code mort n'est pas de
l'anti-doctrine, et votre règle réserve la suppression franche à ce qui
contredit la doctrine. Il est annoté, la garde d'orphelins le surveille.

---

## Et une leçon de supervision, qui vaut pour les neuf tâches planifiées

Le 14/08 au matin, j'ai déployé le cron avec `verify_jwt` basculé à `true` par
omission — la plateforme rejetait alors en 401 **avant** d'entrer dans la
fonction. Je m'en suis rassuré en lisant `cron.job_run_details`, qui ne
montrait aucune exécution dans la fenêtre.

**Cette lecture ne pouvait rien me dire.** `pg_cron` rapporte `succeeded` à
chaque exécution, y compris pendant un 401 : il ne mesure que l'ÉMISSION du
`net.http_post`, qui est asynchrone. Il dira toujours « réussi ».

La seule preuve est du côté de la fonction :

```sql
select timestamp, event_message
  from logs
 where source = 'function_edge_logs'
   and log_attributes['function_id'] = '90dba0b3-bacb-4340-b9c2-e22eba743b9f'
 order by timestamp desc
```

C'est là que se lisent le code retour, la version servie et la taille de la
réponse — les trois chiffres qui ont établi que la fonction traitait zéro
séance. **`cron.job_run_details` est aveugle ; `function_edge_logs` voit.**

---

## Une anomalie que je signale sans l'expliquer

Toute la journée, mes appels MCP portaient `project_id = gjwvcgexcsjeqfhnpvyc`,
et ils ont réussi. Or le projet lié, celui que `.env` utilise et que la
vérification a lu, est **`fouvuqkdxarjpjbqnsjq` — « oxv-platform »**.

Deux références différentes pour des écritures qui ont manifestement atteint la
même base : la vérification a retrouvé mes cinq migrations et ma version 20. Je
ne sais pas laquelle des deux le serveur MCP honore réellement, et je préfère
le dire plutôt que d'inventer une explication.

**Ce qui est établi** : l'identifiant de la fonction déployée aujourd'hui
(`90dba0b3-bacb-4340-b9c2-e22eba743b9f`) est celui que la vérification cite
pour lire les journaux. Même projet, même fonction.

---

## Les gardes posées aujourd'hui

Neuf, et toutes falsifiées avant d'être livrées :

`colonneSupprimeeBalayee` · `chaineAudioArmee` · `ecurieSansChrono` ·
`intentionJuxtaposee` · `loiCouleurTexte` · `vocabulairePilote` ·
`rangNonAchetable` · `methodePubliee` · `eligibiliteArmee` ·
`rattrapageParVersion`

**Quatre** d'entre elles ont d'abord rendu un **verdict faux** et ont été
reprises — la dernière, `cronMemeFormule`, accusait le fichier de porter encore
`max_g_lateral ?? 0` parce que mon propre en-tête citait le motif retiré. Elle
ne dépouillait que les commentaires de ligne.

Une garde qui accuse ce qui va bien fait défaire du travail juste.

**tsc 0 · lint 0 · jest 3 358.**
