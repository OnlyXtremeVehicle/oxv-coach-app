# Catalogue « expérience pilote » × état réel de l'app — 29/08/2026

> Source : `OXV_Mirror_Experience_Pilote_Catalogue_Presentations_2026.docx` (v1.0,
> 25/08/2026), copie dans `docs/produit/CATALOGUE_EXPERIENCE_PILOTE_2026-08-25.md`.
>
> **Pourquoi ce document existe.** Le cahier de veille a le sien
> (`21_MAPPING_CAHIER_VEILLE_2026-08-25.md`). Le catalogue n'en avait aucun : son
> état ne vivait que dans deux commentaires — la liste des modules orphelins et
> l'en-tête d'une migration non appliquée. Un chantier dont l'état n'est écrit
> nulle part est un chantier qu'on redécouvre.
>
> Établi contre le code de `migration/sdk-55`, par audit en éventail suivi d'une
> passe de réfutation. **Sur les manques annoncés par les auditeurs, plus de la
> moitié ont été détruits par les sceptiques** : le dépôt nomme les choses en
> français, et un chercheur pressé conclut à l'absence. Ne rien inscrire ici qui
> n'ait survécu à une contre-recherche.

---

## 1. Ce qui est fait, et qui est considérable

Les **65 fiches sont transcrites** dans `src/features/presentations/registrePresentations.ts`
(P01 à P65, aucune manquante), avec pour chacune les six lignes du §05 et trois
champs déduits de règles nommées. Répartition mesurée :

| Dimension | Répartition |
|---|---|
| Niveau de lecture | 18 en flash · 35 en preuve · 12 en lab |
| Surfaces | pilote 49 · coach 35 · lab 9 · opérateur 3 · client 1 · système 1 |
| Rôle §00 | 5 réussite · 5 opportunité · 55 autre |
| Choix du catalogue | 34 CRÉER · 18 ADAPTER · 13 REPRENDRE |

`compositionLogic.ts` (617 lignes) décide ce qu'une séance permet d'ouvrir : il
tient « force d'abord », le verrou P55–P65 et le plafond de niveau.
`sourcesCompositionService.ts` établit les faits depuis la base.
**64 tests, tous verts.**

## 2. Ce qui n'est pas fait, et qui commande tout le reste

### Aucune surface n'appelle le moteur

Les trois modules ne sont importés **par rien** hors de leur propre dossier — ni
écran, ni service, ni hook. Ce n'est pas un oubli : la garde des modules
orphelins les inscrit nommément, avec le motif (« registre et moteur, écrans au
lot suivant […] Ils sortiront de cette liste au lot des écrans »).

**Le lot des écrans n'a pas eu lieu.** Tant qu'il n'a pas lieu, aucune des 65
présentations n'est rendue par le moteur — ce que l'application affiche
aujourd'hui vient des écrans antérieurs, qui recouvrent une partie du catalogue
sans jamais passer par lui.

### Trois tables manquent en production — vérifié le 29/08

`PROPOSITION_lot10c_presentations_vues_travail_actif_repere_memoire.sql` est
écrite, argumentée, **non appliquée**. `pilot_presentation_views`,
`pilot_presentation_work` et `pilot_corner_landmarks` sont **absentes** de la
base (`to_regclass` sur les trois : nul).

Conséquence, écrite dans l'en-tête de la migration et vérifiée dans le code :

- sans `pilot_presentation_work`, `choisirOpportunite` reçoit toujours `null` et
  rouvre un chantier différent à chaque run. **La règle du §00 — « une seule
  opportunité : les autres restent cachées jusqu'à ce que le travail actif soit
  terminé » — ne peut pas être tenue.** C'est le principe central du catalogue.
- sans `pilot_presentation_views`, `plafondNiveau` perd « l'usage vaut le
  compteur » : un pilote redescend au flash à chaque séance.
- sans `pilot_corner_landmarks`, P38 « Repère mémoire » n'a pas de source. Le
  service refuse explicitement de le servir depuis `coach_corner_reference`, qui
  porte des mètres et des km/h, pas un panneau ou un vibreur.

**Appliquer cette migration est une décision du fondateur** (DDL en production).
C'est le premier verrou : les écrans du lot suivant en dépendent.

## 3. Manques de fiches ayant survécu à la réfutation

Cherchés par un auditeur, puis re-cherchés par un sceptique chargé de les
détruire. Ils ont tenu.

| Fiche | Ce qui manque | Portée |
|---|---|---|
| **P04** Note vocale 15 s | Aucun enregistreur sur surface pilote. La brique existe et fonctionne — `src/features/coach/MemoVocal.tsx`, montée dans deux écrans coach. Le pilote **écoute** seulement. À ne pas confondre avec M32 (audio coach vers pilote **en roulage**), retiré le 25/08 : P04 est l'inverse — pilote vers app, au stand, après le run. | Perd les mots naturels du pilote |
| **P06** Confiance du pilote | Aucun curseur subi → maîtrisé. Rien dans la chaîne ne distingue « j'étais rapide » de « je savais ce que je faisais ». | Le coach devine le niveau d'explication |
| **P19** Ruban des quatre phases | `AnatomieViz` en porte **trois** (Freinage / Corde / Réaccél.), sans delta par phase. Le cahier en veut quatre, avec l'endroit où le temps change. | Écart de forme, pas de vérité |
| **P30** Grip simplifié | `GGViz` rend le vrai nuage G-G ; aucune découpe en quatre zones compréhensibles. La fiche demande le sens du G-G **sans nuage ingénieur**. | Le niveau 2 emprunte une vue de niveau 3 |
| **P36** Voix coach sur le passage | La voix est enregistrée et rattachée au virage ; elle est **perdue en chemin** vers le bilan pilote (le modèle d'annotation de `bilanLogic` ne porte pas `audioUrl`). | Une donnée qui existe n'atteint pas l'écran |
| **P50** Album des forces | Aucune surface. Les données requises (`repetition`, `trace-position`, `plusieurs-runs`) sont pourtant disponibles. | La moitié « réussite » du catalogue |
| **P32 / P53** Vidéo, clip | Aucun lecteur vidéo ; le drapeau `video_overlay` est **fermé** et `video_overlays` est vide en production. Le chemin est construit et testé, simplement éteint. | Décision, pas manque |

## 4. Les décisions déjà prises, rappelées pour qu'on ne les recompte pas

Retirés par arbitrage du fondateur le 25/08 : **M26 / P46–P48** (passeport de
compétences — trop proche du score global que la doctrine bannit) et
**M31 / M32 / P41** (consignes au tour suivant, audio en roulage — le silence en
piste est la signature). **M04 garde une seule zone à explorer**, contre les
trois cartes du cahier. Le **live** (P62–P64, M29/M30/M33) n'est pas commencé,
délibérément, et doit venir après le terrain.

## 5. Ce que les sceptiques ont détruit — à ne pas rouvrir

Signalés comme absents, puis retrouvés :

- **P08 verdict, P09 réussite, P10 opportunité** — annoncés « bloquants ». Le
  verdict d'une phrase est rendu (`app/(app2)/data/session/[id].tsx`, via
  `tendance.libelle`), la réussite l'est sous le nom **MOMENTS-CLÉS** au bilan,
  et l'opportunité est nommée et chiffrée dans `SectionDelta` (« OÙ LE TEMPS SE
  JOUE »).
- **P48** existe sous le nom **ÉVOLUTION D'UN VIRAGE**.
- **P59** existe sous le nom **REPÈRES**, sur deux écrans coach.
- **P16** : la clé `repetition` a bien un producteur, dans `compositionLogic`.
- **P20** : la superposition de deux passages du même pilote est rendue à deux
  endroits côté pilote.
- **La grammaire visuelle du §01** n'est pas absente : le dépôt en a une,
  antérieure de onze jours, mesurée et testée, et il **refuse explicitement**
  deux des cinq correspondances du catalogue. C'est un arbitrage, pas un trou.

**Leçon de méthode.** Le vocabulaire du dépôt est français et fuit le jargon.
Chercher « opportunité » sans chercher « zone à explorer », ou « compétence »
sans chercher « acquis / axe / étape », produit des manques imaginaires. Un
audit sans passe de réfutation aurait rendu ici une liste dont la moitié était
fausse.

## 6. Ordre d'exécution proposé

1. **Décider de la migration lot 10c.** Rien du catalogue ne peut tenir sa règle
   centrale sans `pilot_presentation_work`.
2. **Le lot des écrans**, qui sort les trois modules de la liste des orphelins.
3. **Les deux entrées pilote manquantes** (P04 voix, P06 confiance) : elles
   alimentent P23 « Ressenti contre réalité », qui n'a rien à contraster sans
   elles.
4. **P36** : rebrancher `audioUrl` jusqu'au bilan — la donnée existe déjà.
