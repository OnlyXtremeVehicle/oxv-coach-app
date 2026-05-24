# OXV Coach — Projet de développement

> Dossier projet complet pour le développement de l'application mobile OXV Coach avec Claude Code.

---

## Vue d'ensemble

Ce dossier contient **tout ce qui est nécessaire** pour développer l'application OXV Coach avec Claude Code, par étapes hebdomadaires.

Il a été produit le 23 mai 2026 en consolidation de plusieurs mois de réflexion produit, design, technique et juridique.

---

## Démarrage rapide

### 1. Décompresser le projet

Dézipper ce dossier dans un emplacement de votre choix, par exemple :

```bash
unzip oxv-coach-app.zip
cd oxv-coach-app
```

### 2. Vérifier que Claude Code est installé

Si pas déjà fait :

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

Vous devez avoir Node.js installé (vous l'avez déjà puisque vous codez oxv-site).

### 3. Authentification

```bash
claude
```

Au premier lancement, Claude Code vous demande de vous connecter avec votre compte Anthropic (Pro ou API).

### 4. Lancer Claude Code dans le projet

Une fois dans le dossier `oxv-coach-app/` :

```bash
claude
```

Claude Code va automatiquement lire `CLAUDE.md` à la racine et comprendre le contexte du projet.

### 5. Premier message à envoyer

Recommandation : commencez par ce message simple :

```
Salut. Lis le fichier CLAUDE.md, puis les documents dans l'ordre
indiqué, puis produis le rapport semaine-0-onboarding pour me
montrer que tu as bien compris le projet. Ne code rien encore.
```

---

## Structure du dossier

```
oxv-coach-app/
├── CLAUDE.md                          ← Point d'entrée pour Claude Code
├── README.md                          ← Ce fichier (pour vous)
├── docs/
│   ├── architecture/                  ← Trilogie technique (3 parties)
│   ├── screens/                       ← Description des 26 écrans
│   ├── sitemap/                       ← Les 4 cartes du sitemap
│   ├── juridique/                     ← 5 documents juridiques
│   ├── rituels/                       ← Pack rituels pré-session (zip)
│   ├── test_alpha/                    ← 4 documents pour le test du 5 juillet
│   └── app_store/                     ← Kit publication App Store
├── roadmap/
│   ├── SEMAINES.md                    ← Le plan hebdomadaire à suivre
│   └── rapports/                      ← Les rapports de Claude Code à chaque fin de semaine
├── assets/
│   ├── icons/                         ← Icônes de l'app à produire
│   └── mockups/                       ← Mockups visuels (à remplir)
└── scripts/                           ← Scripts utilitaires (à compléter)
```

---

## Workflow recommandé

### Étape 1 — Onboarding de Claude Code (semaine 0)

Avant de coder, vérifiez que Claude Code a bien compris le projet :

1. Demandez-lui le rapport `semaine-0-onboarding`
2. Lisez le rapport
3. Validez ou corrigez les compréhensions erronées

Cette étape prend 1-2 heures et évite des semaines de dev dans la mauvaise direction.

### Étape 2 — Développement hebdomadaire (semaines 1 à 14)

Pour chaque semaine :

1. **Lundi matin** : demandez à Claude Code de démarrer la semaine N
2. **Tout au long de la semaine** : Claude Code code, vous interagissez
3. **Vendredi soir** : Claude Code produit le rapport de fin de semaine
4. **Week-end** : vous relisez, testez, validez
5. **Lundi suivant** : ajustements puis démarrage semaine N+1

### Étape 3 — Validation par un humain expérimenté

À mi-parcours (semaine 6-7), je recommande fortement de **faire relire le code par un développeur senior humain** (1-2 jours de mission, environ 800-1500€).

Claude Code est compétent, mais un œil humain externe détecte des problèmes architecturaux que Claude Code peut manquer.

### Étape 4 — Soumission stores (semaines 13-14)

Le kit App Store est dans `docs/app_store/`. Suivez-le pour la publication.

---

## Estimation des coûts

| Poste | Coût |
|---|---|
| Claude Code (votre abonnement) | Inclus dans Claude Pro / API |
| Apple Developer Program | 99 USD/an (~92 €) |
| Google Play Console | 25 USD une fois (~23 €) |
| Supabase Pro | 25 USD/mois (~300 €/an) — déjà payé |
| EAS Build (Expo) | Plan Free suffit en général |
| Hardware test (RaceBox + Flic) | 400-600 € |
| Audit dev senior à mi-parcours | 800-1500 € |
| Captures App Store par designer | 400-800 € |
| **TOTAL year 1** | **2 000-3 500 €** |

C'est entre 10 et 20 fois moins qu'un développement traditionnel par un freelance senior.

---

## Documents importants à connaître

**Pour comprendre la vision** :
- `CLAUDE.md` → la doctrine OXV en clair
- `docs/screens/00_OVERVIEW_26_ECRANS.md` → vue d'ensemble visuelle

**Pour comprendre le quoi** :
- `docs/architecture/01_PARTIE_1_stack_supabase.md` → la stack
- `docs/architecture/02_PARTIE_2_algorithmes.md` → les algorithmes
- `docs/architecture/03_PARTIE_3_deploiement.md` → le déploiement

**Pour comprendre le quand** :
- `roadmap/SEMAINES.md` → la feuille de route

**Pour comprendre le pourquoi** :
- `docs/juridique/01_PACTE_DE_PILOTAGE.md` → la doctrine en deux phrases

---

## Conseils stratégiques

### Conseil 1 — Ne court-circuitez pas les semaines

La tentation va être forte de demander à Claude Code "fais-moi tout d'un coup". Ne le faites pas. Claude Code excelle quand il travaille par incréments validés. Au-delà de 500-1000 lignes de code produites d'un coup, la qualité baisse.

### Conseil 2 — Testez en vrai chaque semaine

À la fin de chaque semaine, **installez l'app sur votre téléphone** (via Expo Go ou EAS Build preview) et testez-la. Les bugs trouvés en testant valent 10 fois ce que vous lirez dans un rapport.

### Conseil 3 — Gardez un compte rendu personnel

En parallèle des rapports de Claude Code, tenez votre propre journal de bord. Les phrases du type "j'ai senti que cet écran était bizarre" valent de l'or pour la V1.1.

### Conseil 4 — Ne déployez pas sous pression

Si à la semaine 12 l'app n'est pas prête, **reportez le lancement de 2-4 semaines** plutôt que publier un produit médiocre. OXV est une marque premium. Mieux vaut sortir en novembre avec une app excellente qu'en septembre avec une app moyenne.

### Conseil 5 — Le test alpha du 5 juillet est crucial

Le dossier `docs/test_alpha/` contient un plan pour tester l'expérience client le 5 juillet 2026 à Bouteville. **Ne sautez pas cette étape**. Elle vous donnera des données réelles pour calibrer la suite du développement.

---

## En cas de blocage

### Si Claude Code propose quelque chose qui contredit la doctrine

Repointez-le vers `CLAUDE.md` section "Principes non négociables". Il doit ajuster.

### Si Claude Code dit qu'il ne peut pas faire quelque chose

Demandez-lui pourquoi, et quelles seraient les alternatives. Parfois la limitation est réelle (par exemple, il ne peut pas tester l'app sur un vrai iPhone). D'autres fois, il faut juste mieux formuler la demande.

### Si vous voulez modifier la roadmap

Modifiez `roadmap/SEMAINES.md` puis demandez à Claude Code d'en tenir compte. La roadmap n'est pas sacrée, c'est un outil de cadrage.

### Si vous êtes vraiment bloqué

Revenez vers moi (Claude dans le chat). Je peux vous aider à débloquer la situation en relisant un rapport ou en ajustant la stratégie.

---

## Limites à connaître

Claude Code, même très bon, **ne peut pas** :

- Tester sur de vrais smartphones
- Se connecter physiquement à un RaceBox
- Publier sur l'App Store (action humaine 2FA obligatoire)
- Garantir 100% l'absence de bugs en production
- Remplacer un audit de sécurité avant production

Tout cela reste à faire par vous ou par un développeur senior humain.

---

## Contact

Si vous rencontrez un problème avec ce dossier, vous pouvez :

- Relire les documents en cas de doute
- Revenir vers Claude (chat) qui a produit ce dossier
- Consulter la documentation Claude Code sur docs.claude.com

Bonne route avec OXV Coach.

— Claude (chat), 23 mai 2026
