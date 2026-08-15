# PROPOSITION — quatre arbitrages du 15/08, remplacements exacts

> Rendu après vos quatre réponses au QCM. Chaque bloc CHERCHER est extrait du
> dépôt par programme — il existe mot pour mot. La garde `policesChargees`
> couvre la consolidation : une graisse citée mais déchargée ferait échouer
> jest, une graisse chargée mais inemployée lèverait l'avertissement.
>
> **Votre décision polices va plus loin que ma recommandation** (consolidation
> complète, sans regarder PROFIL d'abord). Je l'exécute — avec ce garde-fou :
> le commentaire de `tokens.ts` que je remplace le disait lui-même, « on ne
> bascule pas une identité à l'aveugle », et le quota de builds iOS est épuisé
> jusqu'au 1er septembre. **Le premier build de septembre doit commencer par
> PROFIL, les cartes et un écran du flux REC.** La réversibilité est totale :
> six remplacements inverses, aucune donnée.

---

## 1 · POLICES — consolidation complète (18 → 11 fichiers au splash)

### 1a — `src/theme/fonts.ts` : l'import Michroma

> **RÉÉCRIT LE 15/08 AU SOIR.** L'ancre d'origine incluait Inter et Syncopate,
> sortis quelques heures plus tôt par le lot §C de la lecture du 14/08 (commit
> `d04024e`, 18 → 12 fichiers). Il ne reste que Michroma à retirer pour
> atteindre les 11 fichiers de la décision QCM. Reformuler l'ancre plutôt que
> forcer : une ancre qui ne correspond plus décrit un dépôt qui n'existe pas.

```
CHERCHER :
// Programme V2 (DA Instrument, 18/07/2026) : Michroma = display des écrans (app2).
import { Michroma_400Regular } from '@expo-google-fonts/michroma';

REMPLACER PAR :
// Michroma est SORTI le 15/08/2026 (décision fondateur, QCM — consolidation
// complète). Hanken Grotesk + JetBrains Mono seulement : 11 fichiers au splash.
```

### 1b — `src/theme/fonts.ts` : les entrées `useFonts`

```
CHERCHER :
    // Programme V2 (DA Instrument) : display Michroma des écrans (app2).
    Michroma_400Regular,

REMPLACER PAR :
    // (Syncopate, Inter, Michroma sortis — consolidation fondateur des 14 et 15/08.)
```

### 1b bis — `src/theme/fonts.ts` : l'en-tête doit suivre le compte

> **AJOUTÉ LE 15/08 AU SOIR.** Retirer la graisse sans reprendre l'en-tête
> laisserait le fichier AFFIRMER « douze » et « Michroma tient encore » alors
> qu'il en monte onze et que Michroma est parti. C'est le motif exact que ce
> dépôt corrige depuis trois jours : le document qui survit au code qu'il
> décrit.

```
CHERCHER :
 * ===========================================================================
 * DIX-HUIT FICHIERS DE POLICE, PUIS DOUZE — 14/08/2026
 * ===========================================================================
 *
 * Tout ce que cette fonction monte se charge DEVANT le splash : chaque graisse
 * inutile est du temps de démarrage à froid pris à tous les pilotes.
 *
 * Syncopate (2) et Inter (4) sont sortis. Ils ne servaient qu'à
 * `lotProfilTokens`, dont les seuls importateurs vivent dans `archive/
 * arbre-v1/` — l'arbre V1, hors application. Six fichiers chargés à chaque
 * démarrage pour une table que rien de vivant ne lisait.
 *
 * Restent douze : Hanken Grotesk (7) pour le texte, JetBrains Mono (4) pour la
 * donnée et le chiffre roi, Michroma (1) pour le display des écrans app2.
 * Michroma tient encore par un fil — `typo.display` de `src/ui/v2/tokens.ts`
 * est employé par 39 écrans, et on ne bascule pas une identité sans l'avoir
 * vue (le quota de builds iOS est épuisé jusqu'au 1er septembre).

REMPLACER PAR :
 * ===========================================================================
 * DIX-HUIT FICHIERS DE POLICE, PUIS ONZE — 14 ET 15/08/2026
 * ===========================================================================
 *
 * Tout ce que cette fonction monte se charge DEVANT le splash : chaque graisse
 * inutile est du temps de démarrage à froid pris à tous les pilotes.
 *
 * Le 14/08, Syncopate (2) et Inter (4) sont sortis : ils ne servaient qu'à
 * `lotProfilTokens`, dont les seuls importateurs vivent dans `archive/
 * arbre-v1/` — l'arbre V1, hors application.
 *
 * Le 15/08, Michroma (1) est sorti à son tour, sur DÉCISION DU FONDATEUR, qui
 * va plus loin que la recommandation d'alors — « regardez PROFIL et les cartes
 * avant de le figer ». Il reste onze graisses : Hanken Grotesk (7) et
 * JetBrains Mono (4).
 *
 * CE CHANGEMENT N'A PAS ÉTÉ VU. `typo.display` est employé par 39 écrans, dont
 * tout le flux REC et tout l'espace Club, et le quota de builds iOS est épuisé
 * jusqu'au 1er septembre. **Premier geste du premier build de septembre :
 * regarder PROFIL, les cartes et un écran du flux REC.** La réversion est
 * d'une ligne par fichier.
```

### 1c — `src/ui/v2/tokens.ts` : `type.display` bascule sur Hanken

```
CHERCHER :

 * **Michroma reste, pour l'instant.** Le même arbitrage sépare les deux cas :
 * « Michroma et Syncopate sont des langages de TITRE — les retirer change
 * l'allure de PROFIL et des cartes. Faites-le, mais regardez ces deux écrans
 * avant de le figer, pas après. »
 *
 * `typo.display` est employé par **39 écrans**, dont tout le flux REC et tout
 * l'espace Club. Le remplacer sans l'avoir vu changerait l'identité visuelle de
 * l'application pilote entière — et le quota de builds iOS est épuisé jusqu'au
 * 1er septembre. On ne bascule pas une identité à l'aveugle.
 *
 * La ligne est prête : `display: 'HankenGrotesk_600SemiBold'`, la valeur que
 * `src/theme/v2.ts` emploie déjà.
 */
export const type = {
  display: 'Michroma_400Regular',

REMPLACER PAR :
 * **Michroma est sorti le 15/08/2026** (décision fondateur, QCM — consolidation
 * complète, au-delà de la recommandation « regarder d'abord »). `typo.display`
 * est employé par 39 écrans : la bascule change l'identité visuelle de
 * l'application pilote entière, et elle N'A PAS ÉTÉ VUE — le quota de builds
 * iOS est épuisé jusqu'au 1er septembre. Premier geste du premier build :
 * regarder PROFIL, les cartes et un écran du flux REC. Réversion : une ligne.
 */
export const type = {
  display: 'HankenGrotesk_600SemiBold',
```

> **Bloc borné le 15/08 au soir.** Il réémettait `body:` après `display:`, ligne
> que l'ancre ne consommait pas — l'objet se retrouvait avec deux propriétés du
> même nom (TS1117). Un REMPLACER ne réécrit que ce que le CHERCHER a pris.

### 1d — `src/theme/v2.ts` : les polices du lot PROFIL_CARTES — **DÉJÀ FAIT**

> Appliqué le 14/08 (commit `d04024e`), avec le retrait d'Inter et Syncopate du
> chargeur : `lotProfilTokens.fonts` pointe déjà sur Hanken Grotesk
> (`display: 'HankenGrotesk_700Bold'`, corps en 400/500/600). Aucun
> remplacement à exécuter — le bloc est retiré pour que le script reste
> rejouable et que le compte annoncé soit vrai.
>
> Seul écart avec la proposition : `displayReg` vaut `HankenGrotesk_600SemiBold`
> et non `_500Medium`. Conservé — une déclinaison de titre garde du poids.

(`mono`, `monoMedium`, `monoBold` restent inchangés — JetBrains est conservé.)

---

## 2 · ANATOMIEVIZ — **DÉJÀ CORRIGÉ, ET AUTREMENT**

Le défaut est réel et le diagnostic exact : `Number.isFinite(0)` vaut `true`, la
garde laissait passer « Freinage sur 0 m avant la corde ». Il a été corrigé le
14/08 (commit `d04024e`) — mais par un autre geste, et le bloc proposé ici n'est
pas appliqué. Trois raisons, mesurées :

1. **Le correctif est allé à la SOURCE.** `AnatomyCorner` déclare désormais ses
   quatre scalaires `number | null`, et le producteur réel — l'edge function
   `compute-session-insights`, redéployée — écrit `null` au lieu de `0`. Le
   patch proposé ne touche que l'écran : il aurait masqué le zéro sans cesser
   de le fabriquer.

2. **`(x ?? 0) > 0` jette une mesure vraie.** Une distance de freinage de 0 m
   avec un G réel — entrée à la vitesse du point le plus lent — est une MESURE,
   pas un trou. La verrouiller à `> 0` recrée la confusion en sens inverse :
   absence ≠ zéro vaut dans les deux directions. Un test le tient désormais
   (`sessionInsightsEngine.test.ts`, « une mesure, pas un trou »).

3. **A1 § 3 de ce même paquet recommandait `!= null`**, « le correctif immédiat
   tient en une ligne ». C'est celui qui a été retenu. Les deux documents de
   l'archive divergeaient sur ce point.

Le producteur ne rendant plus de zéro, la prémisse du bloc — « le moteur amont
rend 0 quand l'apex n'est pas mesuré » — n'est plus vraie depuis le 14/08.
Garde associée : `absenceJamaisZero.guard.test.ts`, qui lit l'arbre de l'edge
function et refuse tout repli en zéro sur les quatre champs.

## 3 · INSIGHTS-V3 — la ligne qui alimente quatre visualisations

`GGViz`, `FlowViz`, `TransfertViz`, `DispersionViz` sont montés dans
`data/session/[id].tsx` et vides depuis leur écriture : l'app n'invoque que v1,
qui n'écrit ni `gg_envelope`, ni `throttle_brake`, ni `flow_coherence`.
`compute-session-insights-v3` est déployée et n'a aucun invocateur.

### 3a — `src/services/analyzeSessionService.ts`

```
CHERCHER :

  if (segmentsPersisted > 0) {
    try {
      const { error: insightsError } = await supabase.functions.invoke('compute-session-insights', {
        body: { sessionId: input.telemetrySessionId },
      });
      notes.push(
        insightsError ? `Insights KO : ${insightsError.message}` : 'Insights calculés (serveur).'
      );
    } catch (e) {
      notes.push(`Insights KO : ${errMsg(e)}`);
    }
  }

REMPLACER PAR :
  if (segmentsPersisted > 0) {
    try {
      const { error: insightsError } = await supabase.functions.invoke('compute-session-insights', {
        body: { sessionId: input.telemetrySessionId },
      });
      notes.push(
        insightsError ? `Insights KO : ${insightsError.message}` : 'Insights calculés (serveur).'
      );
    } catch (e) {
      notes.push(`Insights KO : ${errMsg(e)}`);
    }
    // v3 (modules rb-1 : gg_envelope, throttle_brake, flow_coherence,
    // load_transfer) — les quatre visualisations de data/session/[id] la
    // consomment et étaient VIDES depuis leur écriture faute d'invocateur
    // (mesuré le 14/08/2026). Même contrat best-effort que v1.
    try {
      const { error: v3Error } = await supabase.functions.invoke('compute-session-insights-v3', {
        body: { sessionId: input.telemetrySessionId },
      });
      notes.push(v3Error ? `Insights v3 KO : ${v3Error.message}` : 'Insights v3 calculés.');
    } catch (e) {
      notes.push(`Insights v3 KO : ${errMsg(e)}`);
    }
  }

```

---

## 4 · LES DEUX LOTS D'ÉCRAN — spécifiés, pas patchés

Ces deux-là changent ce que le pilote voit ; ils se construisent contre le
composant, pas par search/replace aveugle. Les cibles sont exactes.

### 4a — Chiffre roi : marge pilote seule (décision QCM)

- `src/services/analyzeSessionService.ts` : publier `margin_pilot` comme valeur
  d'affichage quand `margin_vehicle === null` ; `useBilan.ts:425` lit
  aujourd'hui `marginGlobalMeasured` seulement — ajouter `marginPilot`,
  `marginVehicle`, `breakdown` à la sélection.
- Écran bilan : héros = marge pilote ; sous-bloc = les deux barres pondérées
  (constance 0,6 · fluidité 0,4, `RAMPE_ORDRE[1]`/`[2]`) ; ligne véhicule =
  hachures + « non caractérisé » (`LIBELLE_ABSENT` une fois `Mesure<T>` migré).
  Maquette de référence : section 1 du banc d'essai.
- `focusCorner.ts` sort de ses mocks au même geste : son en-tête attend
  nommément `margin_breakdown`, désormais lu.

### 4b — Empreinte : barres en séance, radar en Saison (décision QCM)

- `data/session/[id].tsx` : remplacer le montage du radar par des barres
  ordonnées (spec section 3 du banc d'essai) — tri par valeur, état
  « non mesuré » hachuré DISTINCT du zéro mesuré, axe 0–100.
- L'écran Saison garde `QdiRadar` tel quel.
- Prérequis de propreté : les barres consomment `vizMath` (une seule
  implémentation de mise à l'échelle), pas une cinquième copie locale.

### 4c — Pointer le virage à creuser (décision QCM)

- `next_focus_corner_index` est persisté et jamais lu. Le brancher sur
  `CircuitMap` (marqueur sobre sur le virage, même registre que les marqueurs
  existants de `l30_marqueur_sans_texte_ni_virage`) à côté de
  `next_focus_phrase` déjà affichée côté coach — et l'exposer côté pilote au
  bilan, où la phrase sans le lieu est aujourd'hui un conseil sans carte.

---

## 5 · Vérification après application

`jest` : `policesChargees` passe (aucune graisse citée hors chargeur — les deux
tables de jetons basculent dans le même lot que le chargeur) et son
avertissement « chargée sans emploi » tombe à zéro. `tsc` : rien — aucun type ne
bouge. Visuel : RIEN avant le build de septembre ; premier geste du build,
PROFIL + cartes + un écran (app2), et la réversion tient en six blocs inverses.
