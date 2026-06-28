# PR-48 — Empreinte consolidée (reframe du « jumeau numérique », M3)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`
**Méthode** : workflow (7 agents : comprendre infra+doctrine+spec → concevoir avec **verdict** build/reframe/fold/drop → critique adversariale), décision Gabin = reframe.

## Verdict honnête : reframe, pas build

Le « jumeau numérique » tel que spécifié (PRO-2 « Performance avancée », comparaison
vous-vs-vous-idéal) est **doctrinalement inacceptable** : « jumeau » = un double à
égaler/dépasser, comparaison normative = classement déguisé (Principe 1 sécurité>perf,
Principe 2 pas de classement, Pacte Art. 2). Mais l'intention réelle est descriptive,
et l'infra révèle un **vrai trou** : signature/régularité/progression se **recalculent
à la lecture**, rien n'est persisté.

→ **Reframe** (validé par Gabin) : renoncer au mot « jumeau », livrer une **Empreinte
consolidée** — un instantané own-row qui **fige les sorties déjà conformes** de
`computeSignature` (bande de régularité, traits, axes) pour donner une **mémoire** au
miroir. Aucun score, aucune cible, aucune comparaison entre pilotes.

## Corrections de la critique intégrées

- **Marge médiane/amplitude retirées** : agrégats *nouveaux* non émis par le service →
  on ne fige que ce qui existe (régularité, traits, axes, échantillon). Évite de
  recréer une « marge à faire monter ».
- **Vocabulaire non dupliqué** : `regularity_band` stocke la valeur réelle de
  `regularityTrait` (`très réguliers`/`réguliers`/`variables`), pas de CHECK inventé.
- **Upsert assumé** (1 snapshot/séance, `computed_at` = dernier calcul, partage préservé).
- **`log_coach_view` réellement câblé** dans le service de lecture coach (RGPD).
- **Partage autonome documenté** : le pilote consent à partager *ce snapshot*, pas les
  séances sources (pas une voie de contournement).
- 🔒 **Garde UI dur** : la tendance n'affiche que des **constats juxtaposés** dans le
  temps — **jamais** de flèche « progresse/régresse », de delta coloré perf, ni de courbe
  chiffrée (la seule courbe temporelle reste le best-lap de Progression).

## Schéma (migration `0028`, appliquée en prod)

`pilot_signature_snapshots` : user_id (auth.users cascade), session_id (set null —
survit à la purge), computed_at, regularity_band (texte libre), traits jsonb, axes jsonb,
turn_sample_count, shared_with_coach. Index unique partiel (user_id, session_id). RLS
own-row strict (session bornée) + coach SELECT (shared + `is_coach_of`) ; partenaire
jamais ; admin pas de SELECT. `database.types.ts` régénéré (+54/-0). Advisors : RAS.

## App

- `src/services/pilotSignatureSnapshotService.ts` : `upsertSnapshotForSession` (réutilise
  exactement la dérivation de signature.tsx), `listMySnapshots`, `setSnapshotShared`,
  `listSharedSnapshotsForPilot` (journalisé).
- `app/(app)/signature.tsx` : fige l'empreinte de la séance affichée (lazy) + section
  « Votre empreinte dans le temps » (constats juxtaposés, partage opt-in par snapshot).
- `app/(coach)/pilote/[id].tsx` : bloc « Empreinte partagée » lecture seule.
- `app/(pro)/index.tsx` : renonce au mot « jumeau » (renvoie vers Ma signature).

## Vérifié

- `tsc` · `eslint` · `prettier`/`format:check` clean · `doctrine` 137 fichiers OK.
- `npx jest` : **918 passed, 0 échec**.
- Tests RLS `signatureSnapshotsRLS.test.ts` : 6 cas (pilote crée/voit ; coach consenti
  voit la partagée pas la privée ; coach non consenti rien ; coach n'écrit pas ; autre
  pilote rien ; partenaire rien).

## Doctrine

Aucun score / cible / classement / prédiction. « marge » jamais « limite ». Post-session
uniquement (silence en piste). Un portrait, pas un verdict.

## Reste / suite M3

- Dernière tranche M3 : **modération** (signalements communauté).
- Tester sur device au build du 1er juillet.
