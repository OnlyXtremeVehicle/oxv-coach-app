# Proposition — réécriture du §8.3 de la Politique de confidentialité

> **NON APPLIQUÉE.** Le texte de `src/legal/legalDocuments.ts` n'est pas modifié.
> Un texte juridique demande votre validation (CLAUDE.md). Vous relisez, je
> commite.

Rédigé le 02/08/2026, après votre arbitrage : *« Réécrire §8.3 : l'outil EST actif. »*

---

## Pourquoi ce texte doit changer

Le §8.3 actuel, embarqué dans l'application et lisible par le pilote depuis
**Vous → Licence & documents → Politique de confidentialité**, dit ceci :

> ### 8.3 — Outil de mesure d'audience (prévu)
>
> OXV **envisage de déployer** un outil de mesure d'audience respectueux de la
> vie privée, tel que Plausible Analytics (service européen). […]
>
> **Lorsque cet outil sera activé, la présente politique sera mise à jour** pour
> le mentionner explicitement. Aucun consentement préalable ne sera requis, car
> l'outil ne traite aucune donnée personnelle au sens du RGPD.

Trois écarts avec la réalité mesurée :

1. **L'outil n'est pas « envisagé », il est câblé.** `eas.json` injecte
   `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` dans les profils *preview* **et** *production*.
2. **La promesse de mise à jour n'a pas été tenue.** C'est le point le plus
   sérieux : le texte engage OXV sur un acte précis, et cet acte n'a pas eu lieu.
3. **« Aucun consentement préalable ne sera requis »** décrivait le choix
   d'origine. Depuis le 02/08/2026, le code exige au contraire un accord et reste
   fermé par défaut — le texte promet donc moins de protection qu'il n'en existe.

> Le troisième écart va dans le bon sens pour le pilote. Les deux premiers, non.

---

## Ce que le code fait exactement, aujourd'hui

À vérifier avant de figer le texte — c'est ce que la politique doit décrire, ni
plus ni moins.

| Fait | Où |
| --- | --- |
| Aucun évènement n'est émis sans accord explicite, **fermé par défaut** | `src/services/analyticsService.ts` |
| L'accord est recueilli à l'acceptation des CGU et de la politique | `app/(onboarding)/cgu.tsx` → `acceptCguAndPrivacy` |
| Il fait foi côté serveur | `users.privacy_accepted_at` |
| Le pilote peut le retirer à tout moment | Vous → Réglages → « Statistiques d'usage » |
| Un stockage illisible vaut **refus**, jamais accord | `hasAnalyticsConsent()` |
| Aucune donnée identifiante n'est transmise | garde qui **casse en développement** si une clé interdite apparaît |
| Ce qui part | un nom d'évènement, un pseudo-URL `app://oxv-mirror/<évènement>`, des propriétés non identifiantes |
| Où | `plausible.io` (service européen, aucun cookie) |
| Sous quelle propriété | `mirror.oxvehicle.fr` — distincte de celle du site |

---

## Texte proposé

```markdown
### 8.3 — Mesure d'audience

OXV utilise **Plausible Analytics**, un outil de mesure d'audience européen. Il
ne dépose **aucun cookie**, ne suit personne d'un site à l'autre, et ne collecte
aucune donnée permettant de vous identifier.

**Ce qui est transmis**

Uniquement le nom d'un évènement (par exemple : ouverture de l'application,
consultation d'un bilan) et, le cas échéant, une information non identifiante
qui le qualifie (par exemple : le nom d'un écran).

Ne sont jamais transmis : votre nom, votre adresse électronique, votre
identifiant de compte, vos coordonnées géographiques, ni aucune donnée de
télémétrie. Cette interdiction n'est pas seulement une intention : elle est
vérifiée automatiquement, et toute tentative d'y déroger interrompt la
construction de l'application.

**Votre accord**

Aucune mesure n'est transmise tant que vous n'avez pas accepté la présente
politique. En cas de doute technique — accord illisible, stockage indisponible —
rien n'est transmis.

Vous pouvez retirer votre accord à tout moment depuis **Vous → Réglages →
Statistiques d'usage**. L'effet est immédiat.

**Mesure distincte du site**

Les données de l'application sont comptées séparément de celles du site
oxvehicle.fr. Les deux ne sont pas rapprochées.
```

---

## Trois points sur lesquels je veux votre décision

**1. La base légale.** Le texte d'origine affirmait qu'aucun consentement n'était
requis, l'outil ne traitant « aucune donnée personnelle au sens du RGPD ». C'est
la lecture habituelle pour une mesure d'audience exemptée — la CNIL l'admet sous
conditions strictes. Le code, lui, demande désormais un accord.

Ma proposition décrit ce que le code fait, sans discuter de la base légale : elle
dit *« aucune mesure n'est transmise tant que vous n'avez pas accepté »*, ce qui
est vrai quelle que soit la qualification retenue. **Le choix de revendiquer ou
non l'exemption revient à votre conseil** — c'est une des pièces à porter au
dossier de `docs/PROMPT_AVOCAT.md`.

**2. La version du document.** `PRIVACY_VERSION` est enregistrée dans
`users.privacy_accepted_at` / `privacy_version` à l'acceptation. Modifier le
texte devrait faire monter cette version, faute de quoi personne ne sera invité à
relire. Mais la faire monter **ré-affiche l'écran de consentement à tous les
comptes existants** (14 en production, dont les vôtres).

Dites-moi si je la fais monter. À ce stade — aucun pilote réel, aucune journée
validée — c'est le moment le moins coûteux pour le faire.

**3. Le §8.4 et les autres sections.** Je n'ai relu que le §8.3, celui que
l'audit a mis en cause. Je n'affirme rien sur le reste du document : il peut
porter d'autres écarts que personne n'a mesurés.
