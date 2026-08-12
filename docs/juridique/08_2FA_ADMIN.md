# Second facteur des comptes administrateurs

*Écrit le 12/08/2026, après la veille juridique.*

---

## Ce que je ne peux pas faire, et pourquoi ce n'est pas une formalité

Vous m'avez demandé d'enrôler les comptes. **Je ne le peux pas, et personne ne
le peut à votre place.**

Un facteur enrôlé par un tiers est un secret que ce tiers connaît. Ce n'est
alors plus un *second* facteur : c'est un premier facteur dupliqué. La mesure
existerait sur le papier et ne protégerait rien — exactement le défaut qu'on
est en train de corriger, reproduit une couche plus bas.

L'enrôlement suppose trois gestes qui n'appartiennent qu'au titulaire : scanner
le code avec **son** application, lire le code à six chiffres qu'elle affiche,
et le saisir. Aucune API d'administration ne remplace cela, et si l'une le
permettait, il ne faudrait pas l'employer.

**Ce que j'ai fait à la place : tout le reste.** L'enrôlement se fait
maintenant depuis l'application, en trois minutes, sans quitter OXV.

---

## La marche à suivre — trois minutes par compte

1. Installez une application d'authentification si vous n'en avez pas :
   Google Authenticator, Aegis, ou celle de votre gestionnaire de mots de
   passe (1Password, Bitwarden, le trousseau iCloud).
2. Dans OXV, espace administrateur → **Sécurité du compte**.
3. « Ajouter un second facteur ». Scannez le QR affiché.
4. Saisissez le code à six chiffres. **Tant que ce pas n'est pas franchi, le
   facteur reste non vérifié et ne protège rien.**
5. Répétez pour les trois comptes administrateurs.

Si le QR ne se scanne pas, la clé est affichée en clair juste dessous et se
saisit à la main.

---

## Ce qu'il faut faire tout de suite après, et qu'on oublie toujours

**Enrôlez un second appareil, ou conservez un accès de récupération hors
ligne.** Supabase ne génère pas de codes de secours.

Sans cela, la perte du téléphone ferme le compte définitivement. Et une mesure
de sécurité qui fait perdre un compte est une mesure qu'on finit par
désactiver — c'est ainsi que le 2FA meurt en pratique, pas par attaque.

---

## Comment la garde se comporte, et pourquoi elle est asymétrique

Deux règles, volontairement dissemblables :

- un compte **qui a** un facteur mais dont la session ne l'a pas présenté est
  **barré** jusqu'à ce qu'il le présente ;
- un compte **sans** facteur est **averti**, jamais barré.

Barrer les comptes sans facteur fermerait l'espace administrateur à tout le
monde d'un seul coup — les trois comptes sont dans ce cas aujourd'hui — et
priverait chacun de l'écran depuis lequel on en pose un. **La garde se resserre
d'elle-même à mesure que les comptes s'enrôlent.**

Deux portes restent ouvertes en toute circonstance, et c'est délibéré :

- **l'écran de sécurité lui-même**, sans quoi la garde deviendrait
  irréparable depuis l'application ;
- **une panne réseau ne barre pas.** `doitPresenterFacteur` rend `false` quand
  le niveau d'assurance est illisible. C'est exactement le défaut que le garde
  de profil de cet espace a déjà connu — un administrateur éjecté en plein
  pointage, sur la 4G du circuit, sans un mot. Il n'avait pas à être reproduit
  à l'étage du dessus.

Un test vérifie que les deux règles ne sont jamais vraies ensemble, sur les
neuf combinaisons possibles : un écran qui demande un code qu'aucun facteur ne
peut produire serait pire que pas de garde du tout.

---

## Ce que le droit dit, et ce qu'il ne dit pas

**Le RGPD n'impose pas le 2FA.** Ni l'article 5.1.f ni l'article 32 ne
l'exigent à eux seuls. Ne l'écrivez jamais dans un document : un contrôleur le
sait, et l'affirmation affaiblirait OXV sur le reste.

**La CNIL le recommande expressément** dans deux hypothèses qui visent OXV de
plein fouet : les traitements de données sensibles au sens de l'article 9 — le
cardio des pilotes en est — et les comptes à privilèges.

Ce qui se sanctionne n'est donc pas l'absence de 2FA en soi. C'est **l'écart
entre ce qui est annoncé et ce qui existe**. Tant que la politique annonce
« 2FA TOTP obligatoire » sans qu'aucun facteur ne soit enrôlé, l'écart est
entier.

**TOTP, pas SMS.** Le SMS s'intercepte et se détourne par portabilité
frauduleuse. Ne basculez pas « pour la commodité » le jour où l'un des trois
comptes trouvera le TOTP fastidieux.

---

## L'état, à tenir à jour

| Compte | Facteur enrôlé | Date |
|---|---|---|
| admin 1 | — | — |
| admin 2 | — | — |
| admin 3 | — | — |

Vérification en base :

```sql
select u.role, u.public_handle, count(f.id) as facteurs
  from public.users u
  left join auth.mfa_factors f on f.user_id = u.id and f.status = 'verified'
 where u.role = 'admin'
 group by u.role, u.public_handle;
```

**Tant que cette table porte des tirets, la ligne « 2FA TOTP obligatoire » de
la politique de confidentialité décrit une mesure qui n'existe pas.** Deux
issues, et une seule est honnête aujourd'hui : enrôler, ou retirer la ligne
jusque-là. Je n'ai pas tranché à votre place — retirer une mesure de sécurité
annoncée est une décision qui vous appartient.
