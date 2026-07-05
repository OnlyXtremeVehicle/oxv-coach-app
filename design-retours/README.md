# design-retours/ — dépôt des écrans refaits dans Claude Design

Dépose ici les écrans que tu as recréés (Gabin ↔ Claude Design). Je les
réintègre en React Native, un par un, sans toucher à la logique.

## Comment déposer
- **Un fichier par écran**, format **HTML** de préférence (export Claude Design),
  sinon PNG haute résolution + courte note d'intention.
- **Nommage : `zone__ecran.html`** — le chemin réel de l'écran est dans
  `docs/refonte-app/HANDOFF_CLAUDE_DESIGN.md` (colonne « Fichier »).
  Exemples : `app__bilan.html`, `app__data-lab-canvas.html`,
  `app__signature.html`, `coach__pilote.html`, `admin__tour-controle.html`.
- Priorité conseillée : commence par **1 écran vitrine** (Bilan ou Signature/QDI),
  je le réintègre, on cale le style, puis tu déroules par archétype.

## Ce que je fais de chaque dépôt
1. Je lis le HTML / la maquette.
2. Je traduis en RN avec le kit (`src/ui/*`, `src/components/*`) selon
   `docs/refonte-app/GUIDE_REINTEGRATION.md`.
3. Je **préserve** données, navigation, RLS, doctrine (je ne refais que le rendu).
4. Je passe les gates (tsc / eslint / doctrine / jest) + re-check couleur/typo.
5. Je commit + push, écran par écran, et je te dis ce qui a changé.

## Règles que je re-vérifie systématiquement (cf. REGLES_COULEUR.md)
- Or = donnée seule · rouge de marque `#C8102E` = REC/marque · freinage = rouge
  de donnée `#E63946` · marge = ambre `#F2792B` (jamais rouge).
- Un seul chiffre dominant · chiffres en Geist Mono · jamais de serif sur un chiffre.
- États vide / erreur / hors-ligne présents · cibles tactiles ≥ 44 px.
