#!/usr/bin/env python3
# =============================================================================
# Applique les corrections du Programme V4 (15/08/2026) — les 20 remplacements
# exacts des trois livraisons A1 (grammaire), A2 (arbitrages QCM), A3 (marge
# pilote + focus), lus depuis docs/corrections-v4/*.md.
#
# PRINCIPES
#   - Chaque bloc CHERCHER doit exister MOT POUR MOT et UNE SEULE FOIS dans sa
#     cible, sinon le bloc est signalé et RIEN n'est écrit pour ce fichier.
#   - Un bloc dont le REMPLACER est déjà en place est compté « déjà appliqué »
#     — le script est rejouable sans danger.
#   - Mode par défaut : SIMULATION (aucune écriture). Passer `--appliquer`
#     pour écrire. C'est la même discipline que les PROPOSITION_ SQL.
#
# USAGE, depuis la racine du dépôt :
#   python3 scripts/appliquer_corrections_v4.py              # simulation
#   python3 scripts/appliquer_corrections_v4.py --appliquer  # écrit
#
# APRÈS APPLICATION : jest (la garde rampeMagnitude passe, policesChargees
# passe, margeLogic 7 cas), tsc, puis build de septembre pour le visuel.
# =============================================================================
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOCS = RACINE / 'docs' / 'corrections-v4'

# Les intitulés de section n'écrivent pas toujours le chemin complet —
# résolution des noms courts vers leur fichier unique.
CHEMINS = {
    'v2.ts': None,  # ambigu (theme/v2.ts vs ui/v2) — toujours écrit en entier dans les docs
    'useBilan.ts': 'src/features/miroir/useBilan.ts',
    'bilanLogic.ts': 'src/features/miroir/bilanLogic.ts',
    '[sessionId].tsx': 'app/(app2)/bilan/[sessionId].tsx',
    'fonts.ts': 'src/theme/fonts.ts',
    'tokens.ts': 'src/ui/v2/tokens.ts',
    'AnatomieViz.tsx': 'src/components/insights/AnatomieViz.tsx',
    'analyzeSessionService.ts': 'src/services/analyzeSessionService.ts',
    'cardioZoneLogic.test.ts': 'src/services/__tests__/cardioZoneLogic.test.ts',
    'cardioZoneLogic.ts': 'src/services/cardioZoneLogic.ts',
    'TrajectoryLayer.tsx': 'src/components/CircuitMap/layers/TrajectoryLayer.tsx',
    'TrackStage.tsx': 'src/components/CircuitMap/TrackStage.tsx',
}


def resoudre(chemin: str) -> Path:
    if '/' in chemin:
        return RACINE / chemin
    cible = CHEMINS.get(chemin)
    if cible is None:
        raise SystemExit(f'chemin ambigu ou inconnu dans un intitulé : {chemin!r}')
    return RACINE / cible


def blocs_du_doc(doc: Path):
    """Rend [(chemin, cherche, remplace)] — le chemin vient du dernier
    intitulé `###` portant un `code` de fichier avant le bloc."""
    texte = doc.read_text(encoding='utf-8')
    sortie, chemin = [], None
    motif_sec = re.compile(r'^###[^\n]*?`([^`]+\.(?:ts|tsx|md|sql))`', re.M)
    motif_bloc = re.compile(r'```\nCHERCHER :\n(.*?)\n\nREMPLACER PAR :\n(.*?)\n```', re.S)
    events = [(m.start(), 'sec', m.group(1)) for m in motif_sec.finditer(texte)]
    events += [(m.start(), 'bloc', (m.group(1), m.group(2))) for m in motif_bloc.finditer(texte)]
    for _, genre, val in sorted(events):
        if genre == 'sec':
            chemin = val
        else:
            if chemin is None:
                raise SystemExit(f'{doc.name} : bloc sans intitulé de fichier')
            # LE SAUT DE LIGNE DE TÊTE EST RETIRÉ — corrigé le 15/08 au soir.
            #
            # Plusieurs blocs écrivent `CHERCHER :` suivi d'une ligne vide avant
            # le code. Cette ligne vide entrait dans l'ancre, et le REMPLACER —
            # qui, lui, commence directement par du code — la consommait :
            #
            #   ...miroir de l'edge).  if (segmentsPersisted > 0) {
            #
            # Le `if` se retrouvait COLLÉ à la fin d'un commentaire de ligne,
            # donc commenté, et son accolade fermante orpheline. Deux erreurs de
            # compilation sur dix-neuf blocs, invisibles en simulation puisque
            # le script ne compile rien.
            sortie.append((chemin, val[0].lstrip(chr(10)), val[1]))
    return sortie


# Les cinq modules NEUFS livrés par l'archive elle-même (src/ du zip, à
# extraire À LA RACINE du dépôt). Les remplacements les supposent présents :
# la garde rampeMagnitude importe grammaireViz, useBilan importe margeLogic —
# sans eux, tsc casse APRÈS application. Donc on refuse de continuer.
NOUVEAUX = [
    'src/ui/v2/grammaireViz.ts',
    'src/ui/v2/__tests__/grammaireViz.test.ts',
    'src/__tests__/rampeMagnitude.guard.test.ts',
    'src/features/miroir/margeLogic.ts',
    'src/features/miroir/__tests__/margeLogic.test.ts',
]


def principal():
    appliquer = '--appliquer' in sys.argv

    manquants = [n for n in NOUVEAUX if not (RACINE / n).exists()]
    if manquants:
        print('Fichiers neufs ABSENTS — l’archive n’a pas été extraite à la '
              'racine du dépôt :')
        for n in manquants:
            print(f'  {n}')
        sys.exit(1)
    total = {'appliqué': 0, 'déjà': 0, 'échec': 0}
    tampons: dict[Path, str] = {}

    for doc in sorted(DOCS.glob('A*.md')):
        print(f'\n── {doc.name}')
        for chemin, cherche, remplace in blocs_du_doc(doc):
            cible = resoudre(chemin)
            if cible not in tampons:
                if not cible.exists():
                    print(f'  ÉCHEC   {chemin} — fichier absent')
                    total['échec'] += 1
                    continue
                tampons[cible] = cible.read_text(encoding='utf-8')
            s = tampons[cible]
            # « déjà en place » se teste sur le REMPLACER seul : pour six des
            # vingt blocs l'ancre CHERCHER survit à l'intérieur du remplacement
            # (ex. `pillars:`, `debriefCard:`) — exiger son absence rendrait le
            # script non rejouable et dupliquerait ces blocs au second passage.
            if remplace in s:
                print(f'  déjà    {chemin}')
                total['déjà'] += 1
            elif s.count(cherche) == 1:
                tampons[cible] = s.replace(cherche, remplace)
                print(f'  ok      {chemin}')
                total['appliqué'] += 1
            else:
                n = s.count(cherche)
                print(f'  ÉCHEC   {chemin} — ancre trouvée {n} fois (attendu : 1). '
                      f'Le fichier a bougé depuis le 15/08 : REMESURER avant d’appliquer.')
                total['échec'] += 1

    print(f"\n{total['appliqué']} à appliquer · {total['déjà']} déjà en place · "
          f"{total['échec']} en échec")
    if total['échec']:
        print('AUCUNE écriture tant qu’un bloc échoue — corriger les ancres d’abord.')
        sys.exit(1)
    if appliquer:
        for cible, contenu in tampons.items():
            cible.write_text(contenu, encoding='utf-8')
        print('ÉCRIT. Vérifier : jest, tsc, puis git diff.')
    else:
        print('SIMULATION — rien n’a été écrit. Relancer avec --appliquer.')


if __name__ == '__main__':
    principal()
