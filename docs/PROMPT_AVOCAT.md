# Prompt — préparer le dossier de consultation juridique

> À donner tel quel à l'agent chargé de préparer l'envoi au conseil. Il est
> autonome : il ne suppose aucune connaissance de nos échanges.
>
> **Ce prompt ne demande à personne de rendre un avis juridique.** Il demande
> d'assembler un dossier factuel, vérifié, à destination d'un avocat qui, lui,
> rendra l'avis.

---

## LA LIGNE À NE JAMAIS FRANCHIR

Vous n'êtes pas avocat et le dossier que vous préparez ne doit contenir **aucune
réponse** aux questions posées.

- **N'analysez pas** l'opposabilité d'une clause.
- **Ne concluez pas** qu'un mécanisme est conforme.
- **N'atténuez aucune question** parce que la réponse vous paraît évidente.
- **N'en supprimez aucune** parce qu'elle est gênante.

Votre travail est l'inverse : **rendre chaque question répondable**, en
fournissant au conseil les faits exacts dont il a besoin, et en signalant les
endroits où le produit ne fait pas ce que le dossier affirme.

Si vous découvrez un écart entre ce qui est écrit et ce que le code fait,
**écrivez-le**. C'est la contribution la plus utile que vous puissiez apporter.

---

## CE QUI EXISTE DÉJÀ

### Le dossier de consultation

`docs/programme-v3/OXV_Dossier_Avocat.md` — 248 lignes, daté du 27 juillet 2026.

Il est **bien construit** : un contexte, une position réglementaire, puis huit
pièces. Chaque pièce suit la même forme — ce qui existe, le mécanisme prévu, ce
qui a été décidé, et les questions au conseil.

Les huit pièces :

1. La décharge de responsabilité
2. Le pacte mutuel d'onboarding
3. Le mandat d'encaissement des coachs
4. La charte coach
5. La comparaison entre pilotes de la même journée
6. La comparaison d'élèves par un coach
7. La rétention des signalements d'incident
8. La responsabilité d'organisateur sur les roulages de coach

**Ne le réécrivez pas.** Complétez-le.

### Les textes eux-mêmes

`docs/juridique/` contient les documents rédigés :

```
00_SYNTHESE_JURIDIQUE_BRIEF_AVOCAT.md
01_PACTE_DE_PILOTAGE.md
02_CGU_APP_OXV_MIRROR.md
03_CGV_PRESTATIONS_OXV.md
04_POLITIQUE_CONFIDENTIALITE.md
05_DECHARGE_RESPONSABILITE.md
06_PACTE_DE_COACHING.md
consentement_biometrie.md
RELECTURE_OXV_MIRROR.md
```

**Quatre d'entre eux sont embarqués dans l'application**, générés par
`node scripts/genlegal.js` vers `src/legal/legalDocuments.ts`, avec un hachage
SHA-256 par document : le pacte, les CGU, la politique de confidentialité, la
décharge.

**Vérifié le 29/07/2026 : la source et l'embarqué sont identiques.** La commande
complète est `node scripts/genlegal.js && npm run format` — sans le formatage,
le fichier diffère par sa seule mise en forme, ce qui ressemble à tort à une
divergence de contenu. Refaites cette vérification avant l'envoi : le conseil
doit relire **le texte que l'application affiche réellement**.

Notez que `03_CGV_PRESTATIONS_OXV.md`, `06_PACTE_DE_COACHING.md` et
`consentement_biometrie.md` ne sont **pas** embarqués. Établissez si c'est voulu,
et où ces textes sont présentés au pilote ou au coach — sur le site, au paddock,
nulle part.

---

## VOTRE TRAVAIL, EN QUATRE TEMPS

### Temps 1 — Vérifier chaque affirmation de fait du dossier

Le dossier affirme des choses sur le produit. Le conseil bâtira son avis dessus.
**Chacune doit être vérifiée dans le code ou dans la base**, et corrigée si elle
a changé.

Le dossier date du 27 juillet. **Plusieurs choses ont bougé depuis** ; certaines
touchent directement des pièces. À vérifier au minimum :

| Affirmation du dossier | Où la vérifier |
|---|---|
| « L'application ne publie aucun classement, aucun ordre par chronomètre » | Le scanner doctrinal du dépôt (`npm run doctrine`) et la revue des écrans de comparaison |
| « Le tableau de marche du paddock n'affiche aucun temps comparatif » | Chercher `BOARD_MODE` dans le code |
| La décharge est « derrière un drapeau fermé, aucun pilote ne l'a signée » | Le drapeau réel, et le compte de signatures en base |
| « Une signature vaut définitivement, mais la version signée est enregistrée » | Le schéma de la table de signatures : la version et le hachage y sont-ils ? |
| Le coach « voit vos séances, votre télémétrie, votre cardio et votre carnet » | Les policies RLS réelles, pas la phrase de consentement |
| Les liens de partage | La durée d'expiration est passée à 7 ou 30 jours, l'option « sans limite » a été retirée le 29/07/2026 |

**Méthode** : pour chaque affirmation, citez le fichier et la ligne, ou la
requête SQL et son résultat. Une affirmation que vous n'avez pas pu vérifier se
dit **« non vérifié »**, jamais « conforme ».

### Temps 2 — Fournir les pièces annexes qui manquent

Le conseil ne peut pas juger un texte qu'il n'a pas.

- **Joindre les textes intégraux** des pièces qu'il doit relire — décharge,
  pacte, CGU, politique de confidentialité, pacte de coaching, consentement
  biométrie.
- **Pour chaque texte, indiquer où et quand il est présenté** : à quel écran, à
  quel moment du parcours, avec quel geste d'acceptation, et ce qui se passe si
  le pilote refuse.
- **Fournir l'inventaire des données réellement collectées** : quelles tables,
  quels champs, quelle durée de conservation appliquée aujourd'hui — pas celle
  qui est annoncée. Si aucune purge n'est implémentée, dites-le.

### Temps 3 — Établir la carte des accès

Plusieurs pièces (4, 5, 6) portent sur **qui voit quoi**. Le conseil a besoin de
la réalité technique, pas de l'intention.

Produisez une carte : pour chaque catégorie de données du pilote — séances,
télémétrie, carnet, intentions, biométrie, médias, documents — **qui peut la
lire**, en vertu de quelle policy, et sur quel consentement.

Deux points méritent une attention particulière :

- **Le coach.** Une faille réelle a été fermée le 29/07/2026 : la fonction
  `is_coach_of()` ne vérifiait pas le rôle du compte, si bien qu'un compte
  rétrogradé conservait l'accès. Vérifiez l'état actuel et dites-le.
- **La biométrie.** Elle voyage aujourd'hui sur un canal partagé entre tous les
  coachs à l'écoute. La correction — un canal par coach — est planifiée, pas
  faite. **Le conseil doit savoir que ce n'est pas encore corrigé.**

### Temps 4 — Signaler les écarts entre le dit et le fait

C'est le cœur de votre valeur. Trois exemples relevés le 29/07/2026, à
re-vérifier et à compléter :

- La carte de fin de séance promet « **révocable à tout moment** » pour le
  partage d'une intention avec le coach. La fonction de révocation n'avait
  **aucun appelant** dans tout le dépôt ; elle a été câblée le jour même.
  Cherchez les autres promesses du même genre.
- Les liens de partage n'expiraient **jamais** depuis deux écrans, faute d'un
  argument passé au service. Corrigé, et une garde de type l'empêche désormais.
- Le fuseau du pilote était annoncé comme stocké ; la colonne existait, **vide
  sur les quatorze comptes**. L'écriture a été posée le 29/07/2026.

**Cherchez systématiquement** : chaque fois qu'un texte juridique ou une phrase
d'interface promet une capacité — révoquer, effacer, exporter, limiter,
s'opposer — vérifiez que le code la porte. Une promesse sans code est un risque
juridique, pas un détail.

---

## CE QUE LE CONSEIL DOIT SAVOIR AVANT TOUT

À placer en tête du dossier, en toutes lettres :

**Rien n'a jamais tourné en conditions réelles.** Au 29 juillet 2026, la base de
production porte : 14 comptes, 1 journée de circuit, 1 inscription, **0 compte
coach**, 53 trames de télémétrie, 1 tour enregistré, 1 lien de partage.

Aucun pilote n'a signé de décharge. Aucun coach n'a lu de séance. Aucune donnée
biométrique n'a été collectée.

**Cela change la nature de la consultation** : le conseil se prononce sur une
architecture et des textes, pas sur une pratique constatée. Il doit le savoir
pour calibrer ses réserves — et c'est aussi une bonne nouvelle, puisque rien
n'est encore à rattraper.

---

## LES QUATRE POINTS QUI BLOQUENT DU DÉVELOPPEMENT

Le dossier pose huit pièces. Quatre réponses débloquent du code aujourd'hui, les
autres peuvent attendre. **Signalez-le au conseil pour qu'il ordonne son
travail** — sans le presser sur le reste.

| Pièce | Ce qui attend |
|---|---|
| **Pièce 5** — comparaison entre pilotes de la même journée | Un écran entier, décidé, non écrit. Il ne sera pas bâti avant la réponse : la zone grise porte sur le consentement, et on construirait une surface à défaire. |
| **Pièce 2** — pacte mutuel d'onboarding | Le nouvel onboarding en cinq étapes en dépend explicitement. |
| **Pièce 1 + Pièce 7** — décharge et rétention des signalements | Les décharges électroniques sont écrites mais **volontairement désactivées** en attendant la relecture. La durée de rétention manque. |
| **Pièce 6** — comparaison d'élèves par un coach | La phrase de consentement doit dire que le coach peut comparer ses pilotes entre eux. Elle ne le dit pas aujourd'hui. |

---

## LA FORME ATTENDUE

Un document unique, envoyable, qui reprend la structure des huit pièces et
ajoute pour chacune :

1. **Les faits vérifiés**, avec leur source — fichier et ligne, ou requête et
   résultat.
2. **Les pièces jointes** — le texte intégral concerné.
3. **Ce qui n'a pas pu être vérifié**, nommément.
4. **Les questions**, inchangées.

Écrivez en français, au vouvoiement, sans emoji, en phrases courtes. Le
destinataire est un professionnel : ne lui expliquez pas son métier, et ne
déguisez pas une incertitude en affirmation.

**Une section finale, obligatoire** : « Ce que nous n'avons pas pu vérifier ».
Si elle est vide, c'est qu'elle est fausse.
