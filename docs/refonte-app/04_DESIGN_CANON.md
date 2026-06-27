# Canon design — sombre premium cockpit

> **Loi.** Valeurs exactes à respecter au token près. Transposition React Native (StyleSheet / thème).
> La doctrine prime : un seul chiffre dominant/écran · **or = donnée** · **rouge = coach/REC**.
> Application : `src/theme/v2.ts` est réaligné sur ces valeurs ; Instrument Serif ajouté ; gaming tempéré en PR 7.

## 1. Palette (exacte — ne rien inventer)

```
Fonds      #050505 (base) · #0A0A0A · #141414 (haut de halo) · #161616
Surfaces   rgba(255,255,255,0.025) (carte) · #0B0B0B (lignes de liste)
Bordures   #1C1C20 (ligne) · #232326 (carte proéminente) · #161618 (séparateur interne)
Texte      #F8F9FA (primaire) · #C9C9CE (secondaire) · #9A9AA3 (muted) · #6E6E76 (eyebrow) · #54545C (faint/inactif)
Or         #FFB703 — DONNÉE uniquement (jauge, chiffre, points, barres)
Rouge      #C8102E — coach / REC ; bordure bande coach #5A1A22, fond rgba(200,16,46,0.08)
Vert       #97C459 — tendance positive / état connecté
Heritage   #C4A459 — tier Heritage UNIQUEMENT (badge, virage signature). Jamais ailleurs.
```

**Deltas vs `v2.ts` actuel à corriger (PR 7)** : ligne `#1E1E22`→`#1C1C20` · faint `#5A5A62`→`#54545C` · ajouter eyebrow `#6E6E76`, secondaire `#C9C9CE`, carte proéminente `#232326`, séparateur `#161618`.

## 2. Typographie

- **Geist** : titres (600), corps (400), accents (500).
- **Geist Mono** : TOUS les chiffres + labels HUD (heure, eyebrows, valeurs). Jamais un libellé en mono.
- **Instrument Serif** (regular + italic) — *à ajouter* : touches éditoriales — grands titres d'écran (« Bonsoir. », « Prêt à rouler. »), le mot qualitatif du bilan en italique (« Terrain apprivoisé »), citations du coach, dates hero (« 05 »). **Jamais** pour les chiffres d'instrument.

Échelle (px) : eyebrow 10–11 (letter-spacing 0.18–0.22em, UPPERCASE, `#6E6E76`) · corps 13–15 · titre écran serif 44 (line-height 1) · chiffre d'instrument 72–74 (Geist Mono 500) · mini-instrument 28 · valeurs secondaires Mono 30.

## 3. L'instrument (gauge marge globale) — motif central

- Arc 270°, SVG viewBox `0 0 200 200`, cx/cy 100, r 80, `transform rotate(135 100 100)`.
- Piste : stroke `#1C1C20`, `stroke-dasharray "377 503"`, linecap round.
- Valeur : stroke `#FFB703`, dasharray `"{valeur/100*377} 503"`, linecap round, glow `rgba(255,183,3,0.5)`.
- Chiffre centre : Geist Mono 72–74, `#fff`, halo `rgba(255,183,3,0.28)` ; label « MARGE GLOBALE » Mono 10, letter-spacing 0.24em, `#54545C` dessous.
- Tailles : Bilan ≈ 226–230 · mini (Paddock / Bilan prêt) ≈ 80–120.

**RN** : `react-native-svg` (`Circle` + `strokeDasharray`). Le glow CSS `filter` n'existe pas → `Circle` floutée ou `shadowColor`/`elevation` léger. Sobriété d'abord.

## 4. Composants (specs)

| Composant | Spec |
|---|---|
| Carte | fond `rgba(255,255,255,0.025)`, border 1px `#1C1C20`, radius 16–22, padding 15–20 |
| Carte hero | border `#232326`, radius 22, fond gradient 150° `rgba(255,183,3,0.06)`→`rgba(255,255,255,0.012)` |
| Bouton primaire | fond `#F8F9FA`, texte `#050505` (600), radius 16, hauteur 54, pleine largeur, en zone du pouce (bottom ~104 au-dessus de la tab bar) |
| Bouton ghost | bordure 1px `#1C1C20`, texte Mono UPPERCASE `#6E6E76` ls 0.18em, hauteur 50 |
| Bande coach | bordure `#5A1A22`, fond `rgba(200,16,46,0.08)`, radius 16, eyebrow « DE VOTRE COACH » Mono 10 `#C8102E`, citation Instrument Serif 17 `#E6E6E8`. **SEUL espace prescriptif.** |
| Fact (constat) | puce 9px à gauche (or = à observer, vert = à conserver) + titre 14.5/500 + sous-ligne 13 `#9A9AA3` + chevron › `#54545C` |
| MeterBar | piste h 5–6 radius 3 fond `#1C1C20` ; remplissage `#FFB703` + glow `rgba(255,183,3,0.6)` ; label gauche + valeur Mono droite |
| Ligne de liste | h ~50 (≥44 tactile), icône stroke 1.6 `#9A9AA3`, libellé 15, chevron › `#54545C`, séparateur `#161618` |
| Tab bar | h 88 (padding-top 12 + safe-area), fond `rgba(5,5,5,0.9)` flouté, border-top `#1C1C20` ; 5 items icône 21 stroke 1.65 + label Mono 8.5 ls 0.05em ; **actif `#F8F9FA`, inactif `#54545C`. JAMAIS d'or sur la nav.** |
| Status bar | heure Geist Mono 14/500 à gauche ; jamais d'emoji |

Espacements : grille 4/8 ; gaps de cartes 11–13 ; padding écran horizontal 24. Rayons : carte 16, hero 22, pill 999, bouton 16.

## 5. Mouvement (sobre, jamais arcade)

- Entrées discrètes : fade/opacity, easing `[0.22, 1, 0.36, 1]`. Pas de ressort, pas de rebond, pas de boucle.
- L'arc d'instrument peut se remplir une fois à l'ouverture (dashoffset → valeur), ~1s.
- **Aucune** animation pendant la conduite. Seul toléré en piste : voyant REC rouge qui pulse lentement (opacity/scale) + anneau qui s'évase.

## 6. État « en piste » (doctrine du silence)

Fond `#020202` quasi pur, centré : voyant rouge 16px (`#C8102E`, glow) qui pulse · « EN PISTE » Mono ls 0.4em `#C8102E` · « L'app s'efface. » Instrument Serif `#9A9AA3` · « Aucun écran. Aucun son. Conduisez. » `#54545C`. **Pas de tab bar, pas de données, pas de chrono.**

## 7. À éviter absolument

Or hors donnée (ni nav, ni décor) · rouge « performance » ou décoratif · plusieurs chiffres dominants / dashboards surchargés · grille HUD dense, halos partout · verbes prescriptifs côté pilote (freinez, corrigez, vous devez, erreur, mauvais) · emojis · tutoiement · couleurs/typos hors de cette liste.
