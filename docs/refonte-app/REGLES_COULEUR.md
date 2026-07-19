# Règles couleur OXV Mirror — emploi exact (passation Claude Design)

> Référence normative. Valeurs = `src/theme/v2.ts`. Compagnon de
> `HANDOFF_CLAUDE_DESIGN.md`. En cas de doute, les 4 lois priment.

## Les 4 lois (priment sur tout)

1. **L'or ne colore QUE de la donnée** (chiffre, jauge, courbe, barre, point de mesure). Jamais bouton, onglet, voyant, halo décoratif, titre.
2. **Le rouge de MARQUE `#C8102E` ne colore QUE la marque et l'enregistrement** (insigne, bande coach, point REC). Jamais un statut, un bouton, une marge. **Exception donnée (2026-07-04)** : un **rouge de DONNÉE `#E63946`, distinct**, est autorisé pour le **freinage** (convention télémétrie : freinage rouge / accélération verte). La marge serrée reste en **ambre**, jamais en rouge.
3. **Un seul grand chiffre dominant par écran.**
4. **Fond toujours sombre** (base Noir Abysse `#050505`).

## Fonds & surfaces

| Couleur   | Hex       | Pour                                        | Jamais       |
| --------- | --------- | ------------------------------------------- | ------------ |
| night     | `#050505` | fond écrans · texte sur bouton crème        | —            |
| card      | `#0B0B0D` | cartes standard                             | fond d'écran |
| card2     | `#121214` | cartes secondaires, pills, boîtiers cockpit | —            |
| nightCard | `#121214` | surfaces surélevées                         | —            |

## Texte (fort → faible)

| Couleur   | Hex       | Pour                                       | Jamais            |
| --------- | --------- | ------------------------------------------ | ----------------- |
| cream     | `#F8F9FA` | texte primaire · **fond boutons d'action** | —                 |
| creamSoft | `#E5E5E5` | texte secondaire fort, titres de viz       | —                 |
| secondary | `#C9C9CE` | texte secondaire                           | —                 |
| creamMute | `#9A9AA3` | muted, légendes, **pastilles neutres**     | chiffre dominant  |
| eyebrow   | `#6E6E76` | sur-titres (variante)                      | —                 |
| faint     | `#54545C` | tertiaire/inactif, **eyebrows**, désactivé | chiffre de donnée |
| legend    | `#B4B4BC` | légendes de graphes                        | —                 |

## Filets & bordures

| Couleur             | Hex                      | Pour                            |
| ------------------- | ------------------------ | ------------------------------- |
| line                | `#1C1C20`                | filets, bordures carte, grilles |
| separator           | `#161618`                | séparateur de liste             |
| cardBorderProminent | `#232326`                | bordure carte hero              |
| edge                | `rgba(255,255,255,0.20)` | **bordure d'état sélectionné**  |

## Couleurs à sens fort (surveillées)

| Couleur          | Hex       | UNIQUEMENT pour                                                                                | INTERDIT                                                                    |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **gold**         | `#FFB703` | la DONNÉE : valeur de jauge, chiffre central, courbe, barre, point, halo _sur la valeur seule_ | boutons, onglets, voyants, halos de conteneur, titres, sélections, switches |
| **red (marque)** | `#C8102E` | insigne/logo, bande coach, point REC                                                           | données de perf, statuts, boutons, pins, marges, CTA                        |
| **heritageGold** | `#C4A459` | offre Heritage + numéros de virage                                                             | reste du branding, données courantes                                        |
| **green**        | `#97C459` | tendance positive, état connecté, **switch ON**, auto-éval « atteint »                         | verdict de performance, donnée neutre                                       |
| **pilotAmber**   | `#F2792B` | marge serrée (rouge de perf neutralisé), trajectoire pilote, phase corde                       | la marque, fond d'écran                                                     |
| **coach**        | `#E6E6E8` | citation coach (bande séparée)                                                                 | —                                                                           |
| **bronze**       | `#B87333` | rôle ADMIN uniquement                                                                          | hors espace admin                                                           |

## Couleurs de donnée (5 piliers — toujours + libellé)

| Pilier       | Token      | Hex           | Emploi                                            |
| ------------ | ---------- | ------------- | ------------------------------------------------- |
| Trajectoire  | trajectory | `#F2792B`     | = **ambre pilote** (jamais un rouge)              |
| Fluidité     | flow       | `#FFB703`     | courbe fluidité (= l'or)                          |
| **Freinage** | brake      | **`#E63946`** | **rouge de donnée** (≠ rouge de marque `#C8102E`) |
| Accélération | accel      | `#4ADE80`     | phase réaccél. (vert vif)                         |
| Régularité   | regularity | `#C084FC`     | donnée régularité (violet)                        |

> Le **bleu `#60A5FA`** n'est plus un pilier ; il reste une couleur locale pour
> l'**eau** (POI Belle Route) et la **vitesse basse** (échelle du scrubber).

## Table de décision (« j'ai X → »)

| J'ai…                                              | Couleur                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| grand chiffre / jauge / courbe de mesure           | **gold** `#FFB703`                                                  |
| bouton d'action principal                          | fond **cream**, texte **night**                                     |
| bouton secondaire                                  | transparent, bordure **edge**, texte cream                          |
| onglet / nav                                       | cream (actif) / creamMute (inactif) — jamais d'or                   |
| état sélectionné (pill/carte/radio)                | bordure **edge** + fond **card**                                    |
| case cochée                                        | fond **cream**, coche **night**                                     |
| switch ON                                          | piste **green**                                                     |
| voyant / point de statut                           | **creamMute** neutre · **green** connecté · **red** REC             |
| point d'enregistrement en piste                    | **red (marque)** `#C8102E`                                          |
| **phase de freinage** (données, vizs, branche QDI) | **`#E63946`** (rouge de donnée)                                     |
| phase d'accélération                               | **accel** `#4ADE80` (vert)                                          |
| marge serrée / zone engagée                        | **pilotAmber** `#F2792B` (jamais rouge)                             |
| numéro de virage                                   | **heritageGold**                                                    |
| offre Heritage                                     | **heritageGold**                                                    |
| sur-titre / eyebrow                                | **faint** (mono, majuscule)                                         |
| écran admin (accents)                              | **bronze**                                                          |
| erreur                                             | **creamMute** _(pas de token rouge d'alerte — décision en attente)_ |
| citation coach                                     | **coach**, bande séparée                                            |

## Deux pièges

- **Or-donnée ≠ or-décor** : si l'or ne pose pas un chiffre/une mesure → faux.
- **Le rouge n'est jamais une perf** : marge dangereuse = **ambre** `#F2792B`.

## Décisions couleur en attente (fondateur)

- **Token « erreur »** dédié (rouge d'alerte assumé, comme le site) ou rester au neutre creamMute ?
- **Bilan** : lequel du duo régularité / meilleur tour est le chiffre dominant ?
