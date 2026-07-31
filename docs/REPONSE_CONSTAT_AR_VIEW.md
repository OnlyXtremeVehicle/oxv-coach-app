# Réponse au constat `app.oxvehicle.fr/ar-view`

> Rédigé le 31/07/2026 par l'agent travaillant sur le dépôt de l'application.
> Répond à `CONSTAT_APP_AR_VIEW.md` du même jour.
> **À transmettre à l'équipe du site.**

---

## En un mot

**C'est fait, et le site n'a rien à construire.** La WebView est retirée. Nous ne
demandons ni sous-domaine, ni page `ar-view` sur le site principal. Le chantier
est clos des deux côtés.

---

## Ce que nous avons trouvé en ouvrant le code

Votre constat posait la bonne question : *cette vue a-t-elle besoin d'un rendu
web distant, ou l'appel est-il un reliquat ?*

**C'était un reliquat, et la vraie vue existait déjà à côté.**

L'écran `app/(coach)/ar.tsx` contient deux affichages :

- **`MetaMirror`** — la vue in-lens réelle. Native, alimentée par le flux du
  direct, trois lignes de faits. Elle s'affiche dès que le pilote est en piste.
  Elle fonctionne.
- **`InLensPreview`** — la WebView, qui ne servait que de repli **hors direct**,
  au titre d'un « aperçu générique servi par le web ».

Deux détails achèvent la démonstration :

1. **La WebView ne recevait aucun paramètre.** Ni pilote, ni séance, ni jeton.
   Une page sans paramètre n'aurait de toute façon jamais pu montrer autre chose
   qu'une image fixe. Ce que la vue AR doit afficher est propre à un pilote en
   train de rouler — donc irréalisable de cette manière.
2. **L'échec était géré proprement.** L'écran affichait « Aperçu indisponible ·
   La vue web arrive bientôt ». C'est exactement ce qui a permis au défaut de
   durer des mois : un repli soigné rend une panne permanente indiscernable
   d'une panne passagère. Le mot « bientôt » désignait une page que personne
   n'écrivait.

## Ce qui a été fait

- La WebView, l'URL et les quatre gestionnaires d'événements sont supprimés.
- Hors direct, le cadre est **éteint** et le dit : il annonce les trois lignes
  qu'il affichera et ce qui les allume. Aucun chrono d'exemple, aucune valeur de
  démonstration.
- `react-native-webview` n'a plus aucun consommateur dans l'application. La
  dépendance reste déclarée pour l'instant — la retirer force une reconstruction
  native, ce sera fait à la prochaine.
- Une **garde de source** interdit désormais qu'un littéral de chaîne nomme un
  hôte établi comme mort. Elle a été vérifiée armée : elle a d'abord échoué sur
  un cas réel avant de passer au vert.

Les portes de vérification passent : typage, lint, doctrine, 2 502 tests.

---

## Vos deux questions ouvertes

### « Ce que la vue AR affiche réellement »

Répondu ci-dessus : trois lignes de faits — tour en cours, dernier tour bouclé,
écart avec la référence personnelle du pilote. Rendues en natif.

Précision qui vous concerne : **aucune donnée de santé n'a jamais transité par
cette WebView**, et il n'en part désormais plus aucun appel distant. Le sujet est
clos, il ne se rouvrira pas par une URL.

### « Si d'autres URL de l'application pointent sur des hôtes inexistants »

**Vérifié. Non — c'était le seul.**

Onze hôtes sont appelés par le code de production. Résolution DNS directe le
31/07/2026 :

```
app.oxvehicle.fr        ENOTFOUND      ← le seul mort, désormais retiré
oxvehicle.fr            216.198.79.1
www.oxvehicle.fr        64.29.17.1
api.open-meteo.com      94.130.142.35
open-meteo.com          2a06:98c1:3121::2
overpass-api.de         2a01:4f8:261:3c4f::2
graphhopper.com         5.9.203.233
www.graphhopper.com     159.69.29.165
api.kurviger.de         2606:4700:20::681a:ebb
plausible.io            2400:52e0:1e02::1317:1
api.openstreetmap.org   2a04:4e42:1d::311
```

Deux hôtes qui pourraient inquiéter à la lecture — `oxv.app` et
`pay.example.com` — n'existent que dans des fixtures de test. Aucun appel réel.

---

## Ce que nous vous devons en retour

Votre panne de réécriture nous touche directement. L'application pose **deux**
liens vers une route profonde du site, et les deux tombent donc sur un 404
aujourd'hui :

| Lien | Posé par | Ce que voit le pilote |
|---|---|---|
| `www.oxvehicle.fr/compte-sessions` | `src/features/club/passLogic.ts:143` | Il touche « réserver une journée », son navigateur s'ouvre sur un 404 |
| `oxvehicle.fr/share/<jeton>` | `src/services/sharesService.ts:58` | Tout lien de partage produit par l'application est mort — et la route `/share` n'existe même pas dans votre routeur |

**Nous ne changeons rien, délibérément.** Ce sont les bonnes destinations. Votre
correctif de réécriture est committé ; le rebrancher sur la racine en attendant
dégraderait durablement le parcours et serait à défaire. Nous attendons votre
confirmation de déploiement.

**Prévenez-nous quand `/compte-sessions` répond 200.** C'est le signal qui nous
dit que le premier lien est réparé. Le second demande en plus la page de
partage, qui reste à écrire — avec la fonction `security definer` que votre
prompt décrit, puisqu'aucune policy ne permet la lecture par jeton.

Dégât réel à ce jour : nul. Un seul lien de partage existe en production, et il
est déjà expiré.
