# Rapport — PR-05b · Opt-in IA explicite à l'onboarding

> Décision Gabin : consentement IA à l'onboarding. Ferme le trou RGPD relevé par
> la revue (transfert débrief → OpenAI US avant consentement). Zéro schéma.

## Ce que j'ai fait
- **`app/(onboarding)/cgu.tsx`** — 4e case **OPTIONNELLE** : « J'autorise le débrief
  enrichi par une IA (transfert de données non nominatives hors UE). Sans cela, votre
  débrief reste rédigé localement. Modifiable à tout moment. » Non requise pour continuer.
- **`src/services/onboardingService.ts`** — `acceptCguAndPrivacy(aiDebriefConsent=false)`
  écrit `ai_debrief_enabled` selon la case. **Défaut `false` = opt-in explicite** : aucun
  transfert vers OpenAI tant que le pilote n'a pas coché, et l'onboarding s'achève AVANT
  toute session/débrief → pas de transfert prématuré.

## Boucle complète
Onboarding (opt-in éclairé) → `ai_debrief_enabled` → l'edge `generate-debrief-ai` bloque
(403, fallback local) si false → réglages permettent de changer plus tard. Divulgation
présente partout (onboarding + settings).

## Portée
Concerne les NOUVEAUX comptes. Les comptes existants gardent leur réglage (modifiable
dans les réglages). Pas de changement du défaut de colonne (l'onboarding écrit la valeur).

## Gates
- `tsc 0` · `eslint 0` · `jest` vert · scan doctrinal vert (130 .tsx).
