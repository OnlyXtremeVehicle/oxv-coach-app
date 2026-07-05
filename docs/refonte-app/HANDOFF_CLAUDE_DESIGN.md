# Passation Claude Design — refonte visuelle de tous les écrans OXV Mirror

> But : te donner **tout** ce qu'il faut pour recréer chaque écran dans Claude
> Design, puis me les rendre pour que je les réintègre en React Native. Généré
> après l'audit visuel M8 (`AUDIT_VISUEL_M8.md`). État réel du repo :
> **150 écrans** répartis en 8 espaces.

---

## 0. MODE D'EMPLOI (lis ça en premier)

### Comment recréer
1. Repère un écran dans l'**inventaire** (§5) → note son **archétype** (§4).
2. Ouvre l'archétype : il donne la structure, l'espacement, les états.
3. Applique les **tokens** (§1) et la **doctrine** (§2) — ce sont des LOIS, pas
   des préférences. L'app est sombre, l'or ne colore QUE la donnée.
4. Pour les écrans data (Bilan, Data Lab, virage, heatmap…) → §6 (détaillé).

### Comment me les rendre
- **Format idéal : un fichier HTML par écran** (export Claude Design). Je lis le
  HTML, je le traduis en RN avec le kit. À défaut : capture PNG haute résolution
  + une courte note des intentions.
- **Nommage : `zone__ecran.html`** — exemple `app__bilan.html`,
  `app__data-lab-canvas.html`, `coach__pilote.html`, `admin__tour-controle.html`.
  (Le chemin réel est dans l'inventaire, colonne « Fichier ».)
- Dépose-les dans un dossier `design-retours/` à la racine, ou envoie-les-moi ;
  je m'occupe de la réintégration écran par écran, en préservant la logique
  (données, navigation, RLS) — **tu ne refais QUE le visuel**.

### Cadre de recréation (à passer à Claude Design en préambule)
> « App mobile iOS, mode sombre. Fond Noir Abysse #050505. Police Geist (sans)
> pour le texte, **Geist Mono pour TOUS les chiffres**, Instrument Serif pour de
> rares titres éditoriaux (jamais un chiffre). Ton Ferrari sec, vouvoiement,
> aucun emoji. Un seul grand chiffre dominant par écran. L'or #FFB703 ne colore
> QUE de la donnée (jauge, chiffre, courbe) — jamais un bouton, un onglet, un
> voyant. Le rouge #C8102E = marque/enregistrement uniquement. »

---

## 1. DESIGN TOKENS (valeurs exactes — `src/theme/v2.ts`)

### Couleurs — palette
| Token | Hex | Usage STRICT |
|-------|-----|--------------|
| night | `#050505` | fond de base (Noir Abysse) |
| nightCard | `#121214` | — |
| card | `#0B0B0D` | cartes |
| card2 | `#121214` | cartes secondaires / pills |
| cream | `#F8F9FA` | texte primaire · **fond des boutons d'action** |
| creamSoft | `#E5E5E5` | texte secondaire fort |
| secondary | `#C9C9CE` | texte secondaire |
| creamMute | `#9A9AA3` | texte muted · pastilles/états neutres |
| eyebrow | `#6E6E76` | sur-titres |
| faint | `#54545C` | texte tertiaire / inactif |
| legend | `#B4B4BC` | légendes |
| line | `#1C1C20` | filets / bordures |
| cardBorderProminent | `#232326` | bordure carte hero |
| separator | `#161618` | séparateur de liste |
| edge | `rgba(255,255,255,0.20)` | **bordure d'état sélectionné** |
| **gold** | `#FFB703` | **DONNÉE uniquement** (jauge, chiffre, points, barres, courbe) |
| **red** | `#C8102E` | **marque / REC / bande coach** uniquement |
| **heritageGold** | `#C4A459` | offre Heritage + **numéros de virage** strictement |
| **green** | `#97C459` | tendance positive / connecté / **switch actif** |
| **pilotAmber** | `#F2792B` | marge serrée / trajectoire pilote (rouge de perf neutralisé) |
| coach | `#E6E6E8` | citation coach |
| *(bronze)* | `#B87333` | **couleur de rôle ADMIN** uniquement (local aux écrans admin) |

### Couleurs — données (dataColors, doublées d'un libellé)
| Token | Hex | Sens |
|-------|-----|------|
| trajectory | `#F2792B` | = ambre pilote (trajectoire, jamais un rouge) |
| flow | `#FFB703` | fluidité |
| **brake** | **`#E63946`** | **freinage = rouge de donnée** (≠ rouge de marque `#C8102E`) |
| accel | `#4ADE80` | accélération (vert vif) |
| regularity | `#C084FC` | régularité (violet) |

### Typographie
- **Geist** : `Geist_300Light / 400Regular / 500Medium / 600SemiBold` — texte.
- **Geist Mono** : `GeistMono_400Regular / 500Medium` — **tous les chiffres, codes, eyebrows, statuts techniques**.
- **Instrument Serif** : `InstrumentSerif_400Regular (+ Italic)` — titres hero éditoriaux, dates, mot qualitatif du bilan, citation coach. **JAMAIS un chiffre.**

Tailles (px) : eyebrow 11 · small 12 · body 14 · bodyLg 15 · h3 17 · h2 21 ·
value 25 · display 28 · **serifTitle 44** (titre hero serif) · **hud 62** (grand chiffre).

### Espacement / rayons / mouvement
- spacing : xs 4 · sm 8 · md 12 · lg 16 · xl 22 · xxl 28
- radius : sm 10 · md 12 · lg 14 · xl 18 · pill 999
- motion (ms) : fast 160 · base 240 · slow 420 · reveal 640 · easing `cubic-bezier(.22,1,.36,1)`
- Cibles tactiles : **≥ 44 px**.

---

## 2. DOCTRINE VISUELLE (les lois — ne pas déroger)

1. **Un seul chiffre dominant par écran.** Le reste est qualitatif (couleurs, étiquettes).
2. **L'or = la donnée, rien d'autre.** Pas d'or sur boutons, onglets, voyants, halos décoratifs.
3. **Le rouge = la marque et l'enregistrement.** Jamais une donnée de perf, jamais un statut.
4. **Miroir, pas coach.** Aucune prescription (« freinez », « il faut »). On décrit, on pose des questions ouvertes.
5. **Silence en piste.** Pendant le roulage : écran noir, rien.
6. **Ton** : vouvoiement, phrases courtes, zéro emoji, zéro marketing.
7. **États obligatoires** pour tout écran de données : **vide** (EmptyState digne), **erreur**, **chargement** (squelette calme, jamais de spinner infini), **hors-ligne**.
8. **Honnêteté** : jamais de fausse donnée. Une valeur absente = « — » + explication, pas une valeur inventée.

---

## 3. KIT DE COMPOSANTS (les briques récurrentes)

| Composant | Rôle | Specs visuelles |
|-----------|------|-----------------|
| **AppBar** | barre de titre | titre mono majuscule + lettrage espacé ; flèche retour à gauche ; sur les hubs, logo lettres blanches à gauche |
| **Screen** | conteneur | fond night, padding horizontal `lg`, scroll |
| **Card** | carte | fond `card2`, bordure `line` 1px, radius `xl`, padding `lg` ; ombre NEUTRE (jamais or) |
| **Button (primaire)** | action | **fond `cream`, texte `night`**, minHeight 52, radius `lg` |
| **Button (ghost)** | action secondaire | fond transparent, bordure `edge` 1px, texte cream |
| **Field** | saisie | label mono `eyebrow` faint au-dessus, fond `card`, bordure `line` (focus = bordure claire), erreur sous le champ |
| **GaugeInstrument** | LE chiffre central | jauge circulaire, aiguille + graduations mono ; la valeur en OR ; halo or **sur la valeur seulement** |
| **MeterBar** | barre de donnée | remplissage or, fond `line` |
| **EmptyState** | état vide | titre + message doux, jamais culpabilisant |
| **CoachBand** | note du coach | bande visuellement SÉPARÉE du miroir, liseré/rouge coach, texte serif italic |
| **SectionLabel / eyebrow** | sur-titre | mono, 11px, lettrage +2, couleur `faint` (jamais or) |
| **Pastille de statut** | point d'état | 6px, `creamMute` (neutre) ou `green` (connecté) ou `red` (REC) — **jamais or** |
| **Cockpit panel** (viz insight) | boîtier d'instrument | fond `card2`, filet `line`, ombre neutre ; barre de statut en haut (dot + nom mono + méta droite) |
| **QdiRadar** | radar 5 branches | polygone OR (donnée) sur grille `line` ; référence en pointillé `creamMute` |
| **State sélectionné** | pill/carte/radio actif | bordure `edge` + fond `card` ; **checkbox cochée** = fond `cream`, coche `night` |
| **Switch actif** | interrupteur ON | piste `green` |

---

## 4. LES 12 ARCHÉTYPES (chaque écran suit l'un d'eux)

> Recréer les **archétypes** d'abord, puis décliner. C'est ainsi que l'app est
> construite. Chaque entrée d'inventaire (§5) renvoie à un archétype.

- **A1 — Hub / Accueil** : sur-titre zone, salutation, **1 carte hero** (dernier bilan / état), action principale contextuelle (crème), 2 raccourcis ghost, cartes d'info sous la ligne de flottaison. *(index pilote, coach, partenaire, pro, admin)*
- **A2 — Analyse / Bilan** : grand chiffre central (jauge or), récit qualitatif, blocs source/méthode + angles morts (transparence). *(bilan, debrief, trace)*
- **A3 — Data Lab (assemblage)** : index neutre de vues d'analyse, bannière de confiance de lecture, export CSV. *(data-lab)*
- **A4 — Carte / trajectoire** : tracé du circuit plein écran, couches activables (Tracé/Vitesse/Marges), sélection de virage → feuille basse. *(carte, data-lab-canvas, heatmap, replay)*
- **A5 — Détail par élément** : en-tête + une donnée dominante + détail chiffré (virage, tour). *(virage, tours, telemetry, conditions)*
- **A6 — Comparaison A/B** : deux colonnes symétriques, delta neutre au centre. *(virage-comparer, comparateur, cote-a-cote, coach/comparer)*
- **A7 — Galerie de lectures** : grille de cartes « insight », bannière DÉMO si données non réelles. *(insights, galerie, insight/[reading])*
- **A8 — Formulaire / réglages** : sections, Field, switches (actif = vert), bouton primaire crème. *(settings, profil, consentements, objectifs, onboarding, création)*
- **A9 — Liste + statut** : lignes avec pastille d'état, filtres, EmptyState. *(coachs, amis, roulages, support, admin listes)*
- **A10 — Carte de partage / trophée** : visuel exportable, watermark méthode, bloc limites. *(carte-trophee, partage, carte-licence, passeport)*
- **A11 — Espace coach (annotation)** : lecture session pilote → annotation humaine, bande coach séparée. *(coach/pilote, annoter, contexte, priorites)*
- **A12 — Live / silence** : pendant le roulage, écran quasi noir, aucun HUD. *(roulage, entre-runs, pilotage-fini)*

---

## 5. INVENTAIRE EXHAUSTIF (150 écrans)

> Colonnes : Écran · Fichier (chemin réel) · Archétype · Chiffre/élément dominant · Note.

### Espace PILOTE `app/(app)/` — 73 écrans
| Écran | Fichier | Arch. | Dominant | Note |
|-------|---------|-------|----------|------|
| Paddock (accueil) | index.tsx | A1 | dernier bilan / action | hub 3 actions max |
| Pass OXV | pass-oxv.tsx | A10 | — | vitrine pass |
| Session (flux) | session/index.tsx | A1 | — | amorce capture |
| Préparation | preparation.tsx | A8 | météo | conditions réelles |
| Équipement (scan BLE) | equipement.tsx | A9 | — | alias flotte, « Votre boîtier » |
| Placement | placement.tsx | A8 | — | choix circuit |
| Roulage | roulage.tsx | A12 | — | **silence, écran noir** |
| Entre-runs | entre-runs.tsx | A12 | meilleur tour | sobre |
| Pilotage fini | pilotage-fini.tsx | A12 | — | transition |
| Données en sécurité | donnees-securite.tsx | A2 | — | analyse en cours |
| Bilan prêt | bilan-pret.tsx | A2 | — | 2 CTA équivalents |
| **Trace du jour** | trace.tsx | A2 | meilleur tour | récit J+1 |
| Débrief (J+1) | debrief.tsx | A2 | marge | texte descriptif + transparence |
| Débrief présentiel | debrief-presentiel.tsx | A2 | — | 3 actes |
| **Bilan** | bilan.tsx | A2 | **jauge régularité** | ⚠ 2 chiffres héros (à trancher) |
| **Data Lab** | data-lab.tsx | A3 | — | index des vues §6 |
| **Vue unifiée (Skia)** | data-lab-canvas.tsx | A4 | tracé | §6 — nouveau |
| Carte circuit | carte.tsx | A4 | tracé | 3 couches |
| Détail virage | virage.tsx | A5 | vitesse corde | §6 |
| Comparer virage | virage-comparer.tsx | A6 | delta | §6 |
| Tour par tour | tours.tsx | A5 | temps | §6 |
| Carte de chaleur | heatmap.tsx | A4 | — | §6 |
| Rejouer un tour | replay.tsx | A4 | — | §6 |
| Télémétrie | telemetry.tsx | A5 | vitesse | §6 données brutes |
| Conditions | conditions.tsx | A5 | météo | §6 |
| Lectures (galerie) | insights.tsx | A7 | — | §6 · DÉMO |
| Lecture détail | insight/[reading].tsx | A7 | héros de la viz | §6 · 6 vizs |
| Partage | partage.tsx | A10 | — | liens contrôlés |
| Carte trophée | carte-trophee.tsx | A10 | — | export + watermark |
| Circuits | circuits.tsx | A9 | — | annuaire |
| Fiche circuit | circuit/[id].tsx | A5 | — | + écosystème |
| Progression | progression.tsx | A1 | — | hub 5 sous-vues |
| **Signature / QDI** | signature.tsx | A2 | **radar QDI** | §6 — maison du QDI |
| Régularité | regularite.tsx | A2 | écart-type | |
| Comparateur | comparateur.tsx | A6 | delta | sessions |
| Stats | stats.tsx | A2 | — | agrégats (⚠ 3 chiffres) |
| Objectifs | objectifs.tsx | A8 | — | auto-éval |
| Carnet | carnet.tsx | A8 | — | notes perso |
| Programme | programme.tsx | A9 | — | calendrier |
| Passeport | passeport.tsx | A10 | — | agrégat saison |
| Empreinte saison | empreinte-saison.tsx | A2 | nb séances | mono |
| Carte licence | carte-licence.tsx | A10 | — | visuel |
| Roulages | roulages.tsx | A9 | — | historique |
| Prochaine fois | prochaine-fois.tsx | A8 | — | intentions |
| Mon coach | mon-coach.tsx | A11 | — | consentement |
| Coachs | coachs.tsx | A9 | — | marketplace |
| Fiche coach | coach/[id].tsx | A5 | tarif | |
| Mes demandes | mes-demandes.tsx | A9 | — | coaching |
| Amis | amis.tsx | A9 | — | amitiés |
| Côte à côte | cote-a-cote/[friendId].tsx | A6 | delta | ami (RGPD) |
| Carte OXV | carte-oxv.tsx | A4 | — | lieux + liste |
| Partenaires | partenaires.tsx | A9 | — | marketplace |
| Belle route | belle-route.tsx | A9 | — | carrousel |
| Mes routes | mes-routes.tsx | A9 | — | routes créées |
| Créer trace | creer-trace.tsx | A8 | — | collaboratif |
| Galerie | galerie.tsx | A7 | — | médias pilote |
| Club (hub) | club/index.tsx | A1 | — | |
| Compte (hub) | compte/index.tsx | A1 | — | |
| Profil | profil.tsx | A8 | — | + médias |
| Réglages | settings.tsx | A8 | — | switches verts |
| Mon boîtier | mon-equipement.tsx | A5 | batterie | état device |
| Consentements | consentements.tsx | A8 | — | RGPD |
| Garage | garage.tsx | A9 | — | véhicules |
| Détail véhicule | garage/[vehicleId].tsx | A5 | — | entretien |
| Données & sécurité | donnees-securite.tsx | A8 | — | export/suppr. |
| Notifications | notifications.tsx | A9 | — | V1 vide |
| Légal | legal/[doc].tsx | A8 | — | statique |
| Support | support/index.tsx | A9 | — | tickets |
| Détail ticket | support/[id].tsx | A5 | — | |
| Média de séance | session-media/[sessionId].tsx | A7 | — | photos |
| Partage externe | share/[token].tsx | A10 | — | lien public |
| Debug capture | debug-capture.tsx | — | — | `__DEV__` |
| Debug circuit | debug-circuit.tsx | — | — | `__DEV__` |

### Espace COACH `app/(coach)/` — 23 écrans
| Écran | Fichier | Arch. | Note |
|-------|---------|-------|------|
| Hub coach | index.tsx | A1 | pilotes du jour, notes en attente |
| File de lecture | file-lecture.tsx | A9 | statut persistant |
| Détail pilote | pilote/[id].tsx | A11 | sessions + notes |
| Annoter virage | annoter.tsx | A11 | texte + audio |
| Contexte séance | contexte.tsx | A8 | niveau/objectif |
| Priorités | priorites.tsx | A11 | virages à mettre en avant |
| Mes repères | reperes.tsx | A9 | virages |
| Éditeur repère | repere/[index].tsx | A8 | |
| Ma lecture | lecture.tsx | A8 | pondérations |
| Gabarits | gabarits.tsx | A9 | templates |
| Programmes | cycles.tsx | A9 | cycles |
| Détail programme | cycles/[id].tsx | A8 | switch vert |
| Comparer sessions | comparer.tsx | A6 | |
| Comparer pilotes | comparer-pilotes.tsx | A6 | |
| Assistant (IA) | assistant.tsx | A11 | brouillon IA validé humain |
| Disponibilités | disponibilites.tsx | A8 | créneaux |
| Demandes | demandes.tsx | A9 | bookings |
| Mon profil | profil.tsx | A8 | fiche coach |
| Business | business.tsx | A2 | revenu (gaté) |
| Mes roulages | roulages/index.tsx | A9 | |
| Nouveau roulage | roulages/nouveau.tsx | A8 | |
| Détail roulage | roulages/[id].tsx | A5 | invitations |
| Vue AR | ar.tsx | A4 | prototype WebView |

### Onboardings — 9 écrans
- **Pilote** `app/(onboarding)/` : index · doctrine · methode · niveau · cgu · pacte (A8, CTA **crème**).
- **Coach** `app/(coach-onboarding)/` : index · mission · pacte (A8, CTA **crème**).

### Auth `app/(auth)/` — 2 écrans
- login.tsx (A8) · lier.tsx (A8, appairage par code du site).

### Espace PARTENAIRE `app/(partner)/` — 7 écrans
- index (A1) · offres (A8, CRUD) · leads (A9) · performance (A2, 1 chiffre) · rapports (A9) · profil (A8) · facturation (placeholder). **Jamais de donnée pilote individuelle.**

### Espace PRO `app/(pro)/` — 7 écrans
- index (A1) · bibliotheque (A9) · performance (A2) · partage (A10, whitelist 5 métriques) · media (A7) · equipe (A9) · ambassadeur (A8).

### Espace ADMIN `app/(admin)/` — 29 écrans (couleur de rôle **bronze #B87333**)
- index (A1) · tour-controle (A1) · preparation (A9) · en-cours (A9) · devices (A9, alias flotte) · circuit (A4) · analytique (A2) · coachs + coachs/[id] (A9/A5) · utilisateurs + [id] (A9/A5) · evenements + [id] + nouveau (A9/A5/A8) · partenaires (A9) · support + [id] (A9/A5) · moderation (A9) · maintenance (A8) · feature-flags (A8) · scan-checkin (A4 caméra) · presences (A9) · qualite-data (A9) · analyse-session/[id] (A5) · sessions-media (A7) · ambassadeurs (A9) · points-carte (A4) · routes-certification (A9) · b2b-rapport (A8).

---

## 6. LES PAGES DATA (le cœur — à soigner en priorité)

> Le tracé du circuit est le **support central** de la data. Chaque insight
> s'ancre spatialement sur le circuit, jamais dans un tableau abstrait. L'or
> porte la donnée ; l'ambre pilote `#F2792B` = la trajectoire/marge serrée.

### 6.1 Bilan (`bilan.tsx`) — A2
- **Dominant** : jauge **RÉGULARITÉ** (écart-type s/tour), instrument circulaire 264px, valeur en or.
- Puis : « VOTRE MEILLEUR TOUR » (chrono mono) + comparaison à la séance précédente.
- ⚠ **À trancher (toi)** : deux gros chiffres cohabitent → décider lequel domine.
- Transparence obligatoire en bas : bloc source/méthode + angles morts.

### 6.2 Data Lab (`data-lab.tsx`) — A3 (index)
- Bannière **confiance de lecture** (solidité de la donnée) EN HAUT.
- Liste neutre de cartes ouvrant chaque vue ci-dessous (chacune annotée « pas de données » si vide).
- Bouton **Exporter CSV** (souveraineté data).

### 6.3 Vue unifiée Skia (`data-lab-canvas.tsx`) — A4 — **le morceau NG**
- **Un seul canvas** : ruban du circuit + trajectoire du pilote colorée par couche.
- Sélecteur **Tracé / Vitesse** en pills (actif = bordure edge).
- Dessous : **profil de vitesse** (courbe OR = donnée) sur la durée de séance.
- À venir : couches G/constance par segment, scrubber timeline, pan/zoom.

### 6.4 Carte circuit (`carte.tsx`) — A4
- Tracé plein cadre. **3 couches** activables (LayerToggle) : Tracé · Vitesse (heatmap) · Marges.
- Tap un virage → **feuille basse** (CornerPanel) avec l'aperçu du virage.
- Marge serrée = ambre `#F2792B` (jamais rouge). Numéros de virage = heritageGold.

### 6.5 Détail virage (`virage.tsx`) — A5
- Zoom sur un virage : **3 phases** — Freinage (**rouge de donnée `#E63946`**) / Corde (ambre) / Réaccél. (vert `#4ADE80`).
- Chiffre héros : **vitesse à la corde** (le minimum, signature du virage).
- Courbe de vitesse OR à halo + point de corde ambre.

### 6.6 Comparer virage (`virage-comparer.tsx`) — A6
- Deux tracés du même virage superposés/côte à côte, delta neutre au centre.

### 6.7 Tour par tour (`tours.tsx`) — A5 · Télémétrie (`telemetry.tsx`) — A5
- Liste des tours (chrono mono) ; télémétrie = données brutes vitesse/distance/G.

### 6.8 Heatmap (`heatmap.tsx`) — A4 · Replay (`replay.tsx`) — A4
- Heatmap : tracé coloré par vitesse (froid→chaud, or translucide au chaud, **pas de heritageGold**).
- Replay : le tracé rejoué en mouvement, chrono qui défile.

### 6.9 Conditions (`conditions.tsx`) — A5
- Météo de la séance (température, vent, piste) — factuel.

### 6.10 Signature / QDI (`signature.tsx`) — A2 — **maison du QDI**
- **Radar 5 branches** : Trajectoire · Fluidité · Freinage · Accélération · Régularité (0–100).
- Polygone OR = cette session ; **pointillé creamMute = médiane de TES sessions** (self-only, jamais un autre pilote).
- Branche sans donnée = tirée au centre + « — ». Bloc méthode : proxy GPS+IMU assumé.
- Access = forme seule ; Signature/Heritage = valeurs par branche.

### 6.11 Lectures / Insights (`insights.tsx` + `insight/[reading].tsx`) — A7
- Galerie de 6 **lectures** (bannière DÉMO jusqu'aux vraies données de Valence). Chaque lecture = un « cockpit panel » :
  1. **Anatomie de virage** — freinage/corde/réaccél., héros = vitesse corde.
  2. **Enveloppe d'adhérence (G-G)** — nuage de points G latéral × G long.
  3. **Dispersion de trajectoire** — faisceau des tours superposés, héros = écart max (m).
  4. **Tour idéal composé** — meilleurs secteurs assemblés, héros = temps théorique.
  5. **Cohérence du flow** — régularité des inputs, héros = tour le plus fluide.
  6. **Transfert de charge** — mise en appui, héros = G de transition.
- Chaque cockpit : barre de statut (dot creamMute + nom mono + méta droite), 1 nombre héros, 1 graphe SVG, cartouches. Titres en creamSoft (**pas or**), données en or/ambre.

---

## 7. PROTOCOLE DE RETOUR (quand tu as fini)

1. Un fichier par écran, nommé `zone__ecran.html` (cf. §0). Écrans data en priorité (§6).
2. Regroupe-les (dossier `design-retours/` ou envoi direct).
3. Je réintègre écran par écran : je traduis ton visuel en RN avec le kit (§3),
   je **garde intacte** la logique (données, navigation, RLS, doctrine), je passe
   les gates (tsc/eslint/doctrine/jest) et je commit.
4. Points de vigilance que je re-checkerai à la réintégration : or = donnée seule,
   un seul chiffre dominant, chiffres en mono, états vide/erreur/hors-ligne, tactile ≥ 44px.

> Tu ne refais que le **rendu**. Toute la mécanique est déjà en place et testée.
> Commence par un écran pilote « vitrine » (ex. Bilan ou Signature/QDI) : je le
> réintègre, on cale le style ensemble, puis tu déroules le reste par archétype.
