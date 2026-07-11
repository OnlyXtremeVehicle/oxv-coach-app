# Plan de réintégration V3 — écrans pilote

> Établi le 2026-07-11 par cartographie adversariale (workflow `v3-verify-and-map`).
> **68 écrans pilote** (`app/(app)/*.tsx`, hors `app/(coach)/`) rangés dans les
> 5 zones du handoff. La **fondation V3 est déjà posée partout** (chaque écran
> importe `theme/v2` : couleurs/typo Hanken+JetBrains, kit primitif, vouvoiement
> globalement appliqué). Le travail restant est **ciblé**, pas une refonte
> from-scratch.

## Les 4 gestes V3 récurrents

1. **Chiffre roi en mono** via `KingNumber` (`theme.fonts.king` = JetBrains Mono).
2. **Brancher `theme.dataColors`** par branche QDI : trajectoire **bleu** `#4F9DF7`
   · fluidité **jaune** `#F2CE3B` · freinage **rouge** `#F65B5B` · accélération
   **vert** `#4FC98A` · régularité **violet** `#A783F2`.
3. **Restreindre l'or** `#FFB703` au **chrono/record UNIQUEMENT** (jamais « neutre »).
4. **Eyebrows** en mono `theme.palette.creamMute` ; nettoyer le tutoiement résiduel.

### Les trois rouges (ne jamais confondre)

| Rouge | Token | Usage |
| --- | --- | --- |
| Donnée freinage | `dataColors.brake` `#F65B5B` | factuel, sur une donnée de perf |
| Marque / rôle coach | `#C8102E` / `#E23A4E` | identité coach + bandes prescriptives attribuées **seulement** |
| Doux destructeur | `#E2685A` | actions RGPD destructrices / retrait d'accès |

**Jamais** une donnée de perf en rouge de marque.

---

## État (2026-07-11)

**FAIT en V3** (commits `fac0f0f`→`94ada16`) : Paddock `index.tsx`, Signature
`signature.tsx`, Bilan `bilan.tsx`, Régularité `regularite.tsx`, Progression
`progression.tsx`. Kit : `KingNumber`, `QdiRadar`, `QdiBars`, `MeterBar` (+`color`),
`GaugeInstrument` (halo couleur de donnée).

**EN COURS** : zone Data Lab (workflow `v3-datalab-reskin`) — data-lab, carte,
virage, tours, comparateur, virage-comparer, heatmap, telemetry, insights.

---

## Zone Miroir

| Écran | Chemin | Prio | Action V3 clé |
| --- | --- | --- | --- |
| Paddock | `index.tsx` | — | **FAIT** |
| Bilan | `bilan.tsx` | — | **FAIT** |
| Signature | `signature.tsx` | — | **FAIT** |
| Régularité | `regularite.tsx` | — | **FAIT** |
| Progression | `progression.tsx` | — | **FAIT** |
| Trace (Le Sillage) | `trace.tsx` | moyenne | 1 fait dominant plein écran (chrono ref en `KingNumber` or) ; 3 portes neutres |
| Empreinte saison | `empreinte-saison.tsx` | moyenne | chaque mois en **mini-`QdiRadar`** juxtaposé (dernier mois violet) ; JAMAIS une courbe d'évolution |
| Passeport | `passeport.tsx` | basse | records/circuit en or mono ; stats cumul mono neutre ; nettoyer tutoiement |

## Zone Data Lab *(vague en cours)*

| Écran | Chemin | Prio | Action V3 clé |
| --- | --- | --- | --- |
| Data Lab index | `data-lab.tsx` | haute | état « Données fiables » vert ; tuiles icônes couleur=donnée |
| Data Lab Canvas | `data-lab-canvas.tsx` | basse | aligner langage V3 (dataColors par couche) |
| Carte du circuit | `carte.tsx` | haute | légende marge dégradé rouge→or→vert ; pastilles virage par marge |
| Zoom virage | `virage.tsx` | haute | frein rouge / sortie vert / traj bleu ; 3 tuiles vitesse colorées |
| Comparer virage | `virage-comparer.tsx` | moyenne | A or / B bleu ; aucun gagnant |
| Tour par tour | `tours.tsx` | haute | meilleur tour or ; deltas neutres/violet |
| Heatmap | `heatmap.tsx` | moyenne | froid→chaud, **jamais de rouge** ; vmax mono |
| Rejouer | `replay.tsx` | moyenne | chrono live mono ; scrubber manuel ; or=chrono |
| Télémétrie | `telemetry.tsx` | moyenne | G-G point extrême rouge **donnée** ; canaux vitesse/frein/gaz colorés ; tutoiement |
| Insights | `insights.tsx` | moyenne | 3 cartes liseré couleur QDI |
| Insight unitaire | `insight/[reading].tsx` | basse | liseré = couleur de la branche |
| Comparateur | `comparateur.tsx` | moyenne | A or / B bleu ; régularité violet ; aucun gagnant |
| Débrief | `debrief.tsx` | basse | vue calme, 1 fait dominant, mode présentation |

## Zone Carnet *(volontairement sans donnée/couleur QDI)*

| Écran | Chemin | Prio | Action V3 clé |
| --- | --- | --- | --- |
| Carnet | `carnet.tsx` | moyenne | aucune dataColor ; chips météo neutres ; nettoyer tutoiement |
| Conditions | `conditions.tsx` | basse | chips météo neutres |
| Prochaine fois | `prochaine-fois.tsx` | basse | intentions perso ; « vos mots » (vouvoiement) |
| Objectifs | `objectifs.tsx` | basse | qualitatif, aucune note qui monte ; tutoiement |
| Débrief présentiel | `debrief-presentiel.tsx` | moyenne | bulles attribuées : coach = liseré rouge marque, moi = gris |

## Zone Découverte

| Écran | Chemin | Prio | Action V3 clé |
| --- | --- | --- | --- |
| Coachs | `coachs.tsx` | moyenne | accent rôle coach `#E23A4E` ; prix or ; onglets pills |
| Fiche coach | `coach/[id].tsx` | basse | avatar rouge coach ; dispo verte |
| Partenaires | `partenaires.tsx` | moyenne | accent rôle partenaire `#5B8DEF` ; note confidentialité |
| Roulages | `roulages.tsx` | basse | invitation coach liseré rouge |
| Mon coach | `mon-coach.tsx` | haute | badge ACTIF vert ; 3 toggles verts ; retrait accès rouge doux ; auditer or |
| Consentements | `consentements.tsx` | moyenne | ON=vert, OFF=gris ; encarts RGPD verts |
| Mes demandes | `mes-demandes.tsx` | basse | EN COURS jaune `#B58F00` (pas l'or record) / RÉSOLU vert |
| Amis | `amis.tsx` | moyenne | par @handle ; **aucun score/classement** (self-only) |
| Côte-à-côte | `cote-a-cote/[friendId].tsx` | moyenne | moi or / ami cyan `#22D3EE` ; **aucun gagnant** |
| Carte OXV | `carte-oxv.tsx` | moyenne | ma position or / autres cyan (position ≠ rang) ; badge LIVE rouge marque |
| Galerie | `galerie.tsx` | basse | crédit partenaire bleu |
| Belles routes | `belle-route.tsx` | basse | HORS chrono ; auditer or (pas de record sur une route) |
| Mes routes | `mes-routes.tsx` | basse | hors chrono ; neutre |
| Créer un tracé | `creer-trace.tsx` | basse | sobre, aucune couleur QDI |

## Zone Compte

| Écran | Chemin | Prio | Action V3 clé |
| --- | --- | --- | --- |
| Compte hub | `compte/index.tsx` | haute | profil + carte boîtier badge vert CONNECTÉ + 3 tuiles état |
| Profil | `profil.tsx` | moyenne | avatar éditable ; seuls nom + @handle visibles des amis |
| Garage | `garage.tsx` | basse | véhicule principal + badge |
| Garage détail | `garage/[vehicleId].tsx` | basse | specs mono neutre |
| Mon équipement | `mon-equipement.tsx` | moyenne | badge vert CONNECTÉ + 3 tuiles état |
| Données & sécurité | `donnees-securite.tsx` | moyenne | supprimer compte rouge doux ; auditer or |
| Notifications | `notifications.tsx` | basse | 4 toggles ; auditer or (aucun chrono) |
| Settings | `settings.tsx` | basse | toggles ON vert ; auditer or |
| Support index | `support/index.tsx` | basse | statuts jaune/vert |
| Support détail | `support/[id].tsx` | basse | statut coloré |
| Circuits | `circuits.tsx` | basse | record/circuit or ; non-roulé pointillé neutre |
| Circuit détail | `circuit/[id].tsx` | basse | record or (chrono) |
| Carte licence | `carte-licence.tsx` | basse | badge VALIDE vert ; aucun or |
| Legal | `legal/[doc].tsx` | basse | **texte juridique — retouche copie à valider Gabin** |
| Programme | `programme.tsx` | basse | étapes franchies vert ; jamais une note qui monte ; auditer or |
| Stats | `stats.tsx` | basse | chiffre roi mono ; **doublon possible avec Passeport → valider Gabin** |

## Hors-zone (flux de capture — « Journée sur circuit », silence en piste)

| Écran | Chemin | Note |
| --- | --- | --- |
| Préparation | `preparation.tsx` | flux capture, barre masquée |
| Session index | `session/index.tsx` | entrée flux capture |
| Équipement | `equipement.tsx` | checklist |
| Placement | `placement.tsx` | tuile placement neutre |
| **Roulage** | `roulage.tsx` | **SILENCE EN PISTE — aucun HUD/chiffre, NE PAS ajouter de data** |
| Entre-runs | `entre-runs.tsx` | run précédent or (chrono) |
| Pilotage fini | `pilotage-fini.tsx` | meilleur tour or seul |
| Bilan prêt | `bilan-pret.tsx` | transition sobre |
| Pass OXV | `pass-oxv.tsx` | QR check-in ; nettoyer tutoiement |
| Carte trophée | `carte-trophee.tsx` | or **légitime** (record) |
| Partage | `partage.tsx` | sobre |
| Session media | `session-media/[sessionId].tsx` | crédit partenaire bleu |
| Share public | `share/[token].tsx` | lecture seule ; vérifier aucune fuite identité/télémétrie |
| Debug circuit/capture | `debug-*.tsx` | **outils dev — hors refonte, exclure des builds prod** |

## Audit « or » à faire (or ≠ chrono suspecté)

`progression` ✅corrigé · `carte` · `virage` · `tours` · `replay` · `heatmap` ·
`comparateur` · `virage-comparer` · `mon-coach` · `donnees-securite` ·
`notifications` · `settings` · `programme` · `entre-runs` · `pilotage-fini` ·
`carte-oxv` · `belle-route` · `stats`.

## Tutoiement résiduel à corriger

`carnet` · `telemetry` · `passeport` · `objectifs` · `pass-oxv`.
*(NB : `progression` et `regularite` annoncés mais **faux positifs** — vérifiés propres.)*

## À valider par Gabin

- `stats.tsx` recouvre partiellement Passeport/Progression → risque de doublon.
- `legal/[doc].tsx` = textes juridiques, toute retouche de copie à valider.
- `debug-circuit.tsx` & `debug-capture.tsx` = outils dev, à exclure des builds prod.
- `cote-a-cote` n'a pas d'`index.tsx` (seulement `_layout` + `[friendId]`) → vérifier
  le point d'entrée.
- Taxonomie : l'`appMap.ts` de prod utilise (paddock/session/bilan/progression/
  club/compte) ; ce plan suit les 5 zones du **handoff** (Miroir/Data Lab/Carnet/
  Découverte/Compte). Mapping principal : Miroir≈paddock+progression ; Data Lab≈
  sous-vues de bilan ; Découverte≈club.
