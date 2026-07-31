# Ce que le site doit ajouter — relevé du 29 juillet 2026

> Établi en interrogeant **le site en production**, pas les documents.
> Chaque constat dit s'il est **vérifié** ou **à confirmer**, et pourquoi.

---

## CE QUI EST CERTAIN

### 1. Le sous-domaine `app.oxvehicle.fr` n'existe pas

```
app.oxvehicle.fr → getaddrinfo ENOTFOUND
```

Pas une page absente : **le nom de domaine ne résout pas**. Aucune explication
technique ne peut l'atténuer.

**Ce que ça casse** : la vue en réalité augmentée du coach
(`app.oxvehicle.fr/ar-view`) est chargée dans une WebView de l'application.
Aujourd'hui elle ne peut rien afficher.

**À ajouter** : soit le sous-domaine et la page `ar-view`, soit une décision de
la servir ailleurs — auquel cas l'application doit être corrigée.

### 2. Le site annonce l'application pour le printemps 2027

Relevé sur la page d'accueil : *« application compagnon OXV Mirror, printemps
2027 »*, saison 2027, trente places de fondateurs.

Ce n'est pas un défaut — c'est un **calendrier public** qu'il faut tenir, et
qui doit rester cohérent avec ce que l'application affiche.

---

## CE QUI EST À CONFIRMER EN DIX SECONDES

### 3. Les routes profondes répondent-elles 404 aux robots ?

Le sitemap déclare 33 chemins. J'en ai interrogé deux qui y figurent :

```
/calendrier → HTTP 404
/booking    → HTTP 404
```

La racine, elle, rend parfaitement — sur `oxvehicle.fr` comme sur
`www.oxvehicle.fr`.

**Deux lectures possibles, et je ne peux pas trancher d'ici :**

- **Le site est une application monopage sans repli serveur.** Le navigateur
  d'un pilote afficherait la page normalement ; seuls les robots et les
  chargements directs reçoivent un 404. **Dans ce cas, votre sitemap déclare
  une trentaine d'URL qui répondent 404 aux moteurs de recherche — ils
  finissent par les retirer de l'index.**
- **Ou mon outil a été filtré** sur les routes profondes, et tout va bien.

**Le test** : ouvrez `oxvehicle.fr/calendrier` dans une fenêtre de navigation
privée. Si la page s'affiche, c'est la première lecture — et le repli serveur
est à ajouter. Si elle ne s'affiche pas, les pages sont à créer.

### 4. La page de partage `oxvehicle.fr/share/<jeton>`

```
/share/test-token-inexistant → HTTP 404
```

Sous la première lecture ci-dessus, ce 404 ne prouve rien. Mais **c'est la page
la plus critique de toutes** : l'application CRÉE ces liens, et un pilote les
envoie à qui il veut. Si elle n'existe pas, chaque partage est un lien mort
envoyé à un tiers.

J'ai durci ce flux ce soir — durée d'expiration obligatoire, métriques
choisies — sur des liens dont je ne peux pas prouver qu'ils mènent quelque part.

**À confirmer en priorité**, et à construire si elle manque. Elle doit
respecter deux règles que l'application applique déjà côté émission :

- **N'afficher que les métriques cochées** (`included_metrics`) — jamais plus ;
- **Refuser un lien expiré ou révoqué** (`expires_at`, `revoked_at`).

### 5. Les chemins de l'espace compte

L'application et trois courriels pointent vers :

| Chemin | Qui l'émet |
|---|---|
| `/compte-sessions` | le Pass de l'application, le courriel de retour de journée |
| `/compte-documents` | le courriel de rappel d'éligibilité |
| `/compte-preferences` | l'application |
| `/compte` | l'application |

**Aucun de ces quatre n'est dans le sitemap.** C'est normal pour des pages
derrière authentification — mais il faut vérifier que les chemins sont les bons.
Si l'espace pilote vit ailleurs (`/mon-compte`, `/pilote/...`), ce sont
**l'application et les courriels** qu'il faut corriger, pas le site.

**Ce dont j'ai besoin** : la liste exacte des chemins de l'espace pilote.

### 6. Les images des courriels

```
/email-assets/insigne-oxv.png
/email-assets/spotify-icon.png
/email-assets/weather-<...>.png
```

Servies dans les courriels envoyés aux pilotes. Une image manquante ne casse
rien, mais un courriel troué se remarque.

---

## CE QUE LE MODÈLE DE RÉSERVATION DEMANDE AU SITE

Décidé dans `OXV_Dossier_Raccordement_Site.md`, pas encore livré.

**Le partage des rôles** : *« L'application connaît le pilote — son garage, ses
documents, son éligibilité, son numéro — et constitue un dossier complet en
trois gestes. Le site sait encaisser. »*

Il faut donc du site :

1. **Retrouver une demande déjà rédigée dans l'application**, à la connexion —
   l'authentification étant partagée, le pilote ne doit rien ressaisir.
2. **Une URL de paiement stable pour une demande donnée** (D-06). C'est elle que
   l'application doit ouvrir ; à défaut, elle mène aujourd'hui à l'espace compte.
3. **La liste exhaustive des états de `registrations.status`** et des transitions
   autorisées côté site (D-07). L'application n'écrit `attended` que depuis
   `pending` ou `confirmed` ; sans la liste, personne ne peut prouver qu'aucune
   collision n'est possible.
4. **La règle de propriété** (D-05) : le dossier appartient à l'application tant
   qu'il n'est pas payé, au site une fois payé.

---

## ET LE POINT QUI PRÉCÈDE TOUT

**`sessions` porte UNE ligne en production.** Une sauvegarde antérieure en
portait quarante-quatre.

Le site affiche un calendrier et un tunnel de réservation. L'application lit la
même table. **Tant que ce point n'est pas tranché, ni l'un ni l'autre n'a de
journées à proposer** — et aucun développement d'écran ne peut être validé
autrement que sur du vide.

C'est D-01, et le dossier de raccordement le dit sans détour : *« C'est le
premier blocage du produit. »*
