/**
 * La réservation groupée d'une écurie — logique d'annonce.
 *
 * Ce module n'DÉCIDE de rien : la base porte la colonne `formule`, GÉNÉRÉE
 * depuis l'effectif. Ces tests vérifient donc que l'ANNONCE dit la même chose
 * que la décision — pas qu'elle la remplace.
 */

import {
  PLACES_PAR_JOURNEE,
  REMISE_ECURIE_PCT,
  SEUIL_PRIVATISATION,
  annonceFormule,
  bandeauDemande,
  formuleDepuisEffectif,
  grouperParJour,
  peutDeposer,
  phraseAvancement,
  verifierDates,
} from '../filEcurieLogic';

describe('la formule se déduit de l’effectif', () => {
  it('en dessous du seuil, l’écurie s’insère', () => {
    expect(formuleDepuisEffectif(1)).toBe('insertion');
    expect(formuleDepuisEffectif(SEUIL_PRIVATISATION - 1)).toBe('insertion');
  });

  /**
   * LE POINT QUE LE FONDATEUR N'AVAIT PAS TRANCHÉ. « Moins de 17 » couvre 1 à
   * 16, « plus de 17 » couvre 18 et au-delà : dix-sept n'était dans aucune des
   * deux phrases. Il est rangé en privatisation — à 17 sur 20 places, la
   * journée est de fait celle de l'écurie.
   */
  it('au seuil exact, le circuit est privatisé', () => {
    expect(SEUIL_PRIVATISATION).toBe(17);
    expect(formuleDepuisEffectif(SEUIL_PRIVATISATION)).toBe('privatisation');
    expect(formuleDepuisEffectif(SEUIL_PRIVATISATION + 1)).toBe('privatisation');
  });

  /**
   * Zéro pilote n'est pas « une insertion à zéro » : c'est une absence de
   * demande. Rendre une formule par défaut afficherait une annonce sur du vide.
   */
  it('un effectif absent ou absurde ne donne aucune formule', () => {
    expect(formuleDepuisEffectif(0)).toBeNull();
    expect(formuleDepuisEffectif(-3)).toBeNull();
    expect(formuleDepuisEffectif(Number.NaN)).toBeNull();
  });
});

describe('l’annonce dit ce qui va se passer', () => {
  it('l’insertion annonce les places qui restent ouvertes aux autres', () => {
    const texte = annonceFormule(12);
    expect(texte).toContain('12 pilotes');
    expect(texte).toContain('Access');
    expect(texte).toContain(String(PLACES_PAR_JOURNEE - 12));
  });

  it('la privatisation annonce les trois dates', () => {
    const texte = annonceFormule(20);
    expect(texte).toContain('privatisé');
    expect(texte).toContain('trois dates');
  });

  it('aucune annonce sans effectif', () => {
    expect(annonceFormule(0)).toBeNull();
  });

  /** Le fil est un miroir comme le reste : il décrit, il ne prescrit pas. */
  it('aucun impératif dans les annonces', () => {
    const prescriptif = /vous devez|il faut|choisissez|indiquez|renseignez/i;
    for (const n of [1, 12, 16, 17, 30]) {
      expect(annonceFormule(n) ?? '').not.toMatch(prescriptif);
    }
  });
});

describe('les trois dates', () => {
  const AUJ = '2026-08-27';

  it('trois dates distinctes et futures conviennent', () => {
    expect(verifierDates(['2026-09-04', '2026-09-11', '2026-09-18'], AUJ).valides).toBe(true);
  });

  it('deux dates ne suffisent pas', () => {
    expect(verifierDates(['2026-09-04', '2026-09-11'], AUJ).motif).toBe('nombre');
  });

  /** Proposer trois fois le même jour n'offre aucun choix : la demande est vide. */
  it('trois fois la même date n’est pas un choix', () => {
    expect(verifierDates(['2026-09-04', '2026-09-04', '2026-09-04'], AUJ).motif).toBe('doublon');
  });

  it('une date passée est refusée, et le jour même aussi', () => {
    expect(verifierDates(['2026-08-01', '2026-09-11', '2026-09-18'], AUJ).motif).toBe('passee');
    expect(verifierDates([AUJ, '2026-09-11', '2026-09-18'], AUJ).motif).toBe('passee');
  });

  it('un champ vide compte comme une date manquante', () => {
    expect(verifierDates(['2026-09-04', '', '2026-09-18'], AUJ).motif).toBe('nombre');
  });
});

describe('le fil se groupe par jour', () => {
  const msg = (id: string, creeLe: string, nature: 'membre' | 'systeme' = 'membre') => ({
    id,
    auteurId: nature === 'systeme' ? null : 'u1',
    nature,
    texte: 'x',
    creeLe,
  });

  it('les messages sortent du plus ancien au plus récent', () => {
    const j = grouperParJour(
      [msg('b', '2026-08-27T15:00:00Z'), msg('a', '2026-08-27T09:00:00Z')],
      new Date('2026-08-27T18:00:00Z')
    );
    expect(j).toHaveLength(1);
    expect(j[0].messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  /**
   * Sans séparateur, on ne sait plus si « 14:20 » était hier ou il y a trois
   * semaines. Les deux jours les plus récents se nomment.
   */
  it('aujourd’hui et hier se nomment', () => {
    const j = grouperParJour(
      [msg('a', '2026-08-26T09:00:00Z'), msg('b', '2026-08-27T09:00:00Z')],
      new Date('2026-08-27T18:00:00Z')
    );
    expect(j.map((x) => x.libelle)).toEqual(['Hier', 'Aujourd’hui']);
  });

  it('un jour plus ancien porte sa date en clair', () => {
    const j = grouperParJour([msg('a', '2026-07-14T09:00:00Z')], new Date('2026-08-27T18:00:00Z'));
    expect(j[0].libelle).toContain('juillet');
  });

  it('un fil vide ne fabrique aucune journée', () => {
    expect(grouperParJour([], new Date('2026-08-27T18:00:00Z'))).toEqual([]);
  });
});

describe('le bandeau de demande', () => {
  it('une demande close n’affiche rien — une bannière permanente occupe sans rien dire', () => {
    expect(bandeauDemande('close', 'insertion')).toBeNull();
    expect(bandeauDemande(null, null)).toBeNull();
  });

  it('la confirmation annonce la remise', () => {
    expect(bandeauDemande('confirmee', 'insertion')).toContain(`${REMISE_ECURIE_PCT} %`);
    expect(bandeauDemande('confirmee', 'privatisation')).toContain('privatisée');
  });

  it('le délai de CGV est rappelé au dépôt', () => {
    expect(bandeauDemande('deposee', 'insertion')).toContain('soixante-douze heures ouvrées');
  });
});

describe('l’avancement — là où la conversion se joue', () => {
  /**
   * Le capitaine a organisé, OXV a confirmé, puis chacun s'inscrit seul. Une
   * sortie annoncée à vingt-deux qui finit à huit est une journée louée pour
   * rien — et personne ne l'apprend avant le jour même.
   */
  it('dit combien il en manque, et jusqu’à quand', () => {
    const p = phraseAvancement(22, 8, 14, '2026-09-11T12:00:00Z');
    expect(p).toContain('8 pilotes inscrits sur 22');
    expect(p).toContain('il en manque 14');
    expect(p).toContain('11/09/2026');
  });

  it('quand le compte y est, il le dit sans relancer', () => {
    const p = phraseAvancement(12, 12, 0, '2026-09-11T12:00:00Z');
    expect(p).toContain('Le compte y est');
    expect(p).not.toContain('manque');
  });

  it('le singulier est respecté', () => {
    expect(phraseAvancement(2, 1, 1, null)).toContain('1 pilote inscrit sur 2');
  });

  /** Une bannière qui répète « 0 sur 0 » occupe la place sans rien apporter. */
  it('rien à dire sur une sortie sans effectif', () => {
    expect(phraseAvancement(0, 0, 0, null)).toBeNull();
  });

  it('sans échéance, la phrase reste juste', () => {
    const p = phraseAvancement(22, 8, 14, null);
    expect(p).toContain('il en manque 14');
    expect(p).not.toContain('jusqu');
  });

  /**
   * LE COMPTE, JAMAIS LES NOMS. Afficher qui n'est pas encore inscrit ferait du
   * fil un tableau de retardataires — l'inverse de ce qu'une écurie est.
   */
  it('la phrase ne nomme personne', () => {
    const p = phraseAvancement(22, 8, 14, '2026-09-11T12:00:00Z') ?? '';
    expect(p).not.toMatch(/[A-Z][a-zé]+ [A-Z]/); // aucun prénom-nom
    expect(p).not.toMatch(/retard|oubli|relanc/i);
  });
});

describe('qui peut déposer', () => {
  it('un membre ordinaire ne peut pas engager le groupe', () => {
    expect(peutDeposer(false, null)).toBe(false);
  });

  /**
   * Une écurie ne porte qu'une demande ouverte à la fois — la base l'impose par
   * une contrainte d'exclusion. Proposer le geste alors qu'il échouera serait
   * le défaut que ce dépôt corrige partout ailleurs.
   */
  it('le capitaine ne redépose pas tant qu’une demande vit', () => {
    expect(peutDeposer(true, 'deposee')).toBe(false);
    expect(peutDeposer(true, 'dates_proposees')).toBe(false);
    expect(peutDeposer(true, 'confirmee')).toBe(false);
  });

  it('une fois close, le capitaine peut redéposer', () => {
    expect(peutDeposer(true, 'close')).toBe(true);
    expect(peutDeposer(true, null)).toBe(true);
  });
});
