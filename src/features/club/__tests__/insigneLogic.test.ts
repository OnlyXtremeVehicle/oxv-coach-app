/**
 * L'insigne : deux voies, un seul insigne, et une image qui n'est pas publique
 * tant qu'elle n'a pas été vue.
 *
 * Le test qui compte est le FAIL-CLOSED — une image en attente ne doit pas
 * s'afficher aux autres écuries. Le serveur l'applique déjà
 * (`crew_insignes_lecture`) ; si ce module divergeait, l'app peindrait un cadre
 * cassé au lieu de rien, et une panne se lirait comme une image.
 */

import {
  cheminInsigne,
  estCleCatalogue,
  extensionDe,
  insigneAffichable,
  INSIGNES_CATALOGUE,
  messageAbsence,
  OCTETS_MAX,
  validerTeleversement,
  type EcurieInsigne,
} from '../insigneLogic';

const VIDE: EcurieInsigne = {
  insigneCatalogueKey: null,
  insigneImagePath: null,
  insigneStatus: null,
};

describe('catalogue', () => {
  it('les clés sont uniques — deux insignes ne partagent pas un identifiant', () => {
    const keys = INSIGNES_CATALOGUE.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reconnaît une clé du catalogue et rejette le reste', () => {
    expect(estCleCatalogue('ecusson')).toBe(true);
    expect(estCleCatalogue('dragon')).toBe(false);
    expect(estCleCatalogue(null)).toBe(false);
    expect(estCleCatalogue('')).toBe(false);
  });
});

describe('validerTeleversement', () => {
  it('accepte PNG, JPEG et WebP', () => {
    for (const mimeType of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validerTeleversement({ mimeType, octets: 50_000 })).toBeNull();
    }
  });

  /**
   * Le SVG est exclu DÉLIBÉRÉMENT : c'est un document exécutable, et il serait
   * affiché à d'autres pilotes. Ce test épingle l'intention — sans lui,
   * quelqu'un l'ajouterait à la liste en croyant combler un oubli.
   */
  it('refuse le SVG, qui est un document exécutable', () => {
    expect(validerTeleversement({ mimeType: 'image/svg+xml', octets: 4_000 })).not.toBeNull();
  });

  it('refuse un type absent ou non-image', () => {
    expect(validerTeleversement({ mimeType: null, octets: 4_000 })).not.toBeNull();
    expect(validerTeleversement({ mimeType: 'application/pdf', octets: 4_000 })).not.toBeNull();
  });

  it('refuse un fichier vide ou de taille illisible', () => {
    for (const octets of [0, -1, Number.NaN, null]) {
      expect(validerTeleversement({ mimeType: 'image/png', octets })).not.toBeNull();
    }
  });

  it('accepte pile la borne, refuse un octet de plus', () => {
    expect(validerTeleversement({ mimeType: 'image/png', octets: OCTETS_MAX })).toBeNull();
    expect(validerTeleversement({ mimeType: 'image/png', octets: OCTETS_MAX + 1 })).not.toBeNull();
  });
});

describe('cheminInsigne — le premier segment est lu par la politique Storage', () => {
  it('place l’identifiant d’écurie en tête', () => {
    expect(cheminInsigne('abc-123', 'insigne.png')).toBe('abc-123/insigne.png');
    expect(cheminInsigne('abc-123', 'insigne.png').split('/')[0]).toBe('abc-123');
  });

  it('tire l’extension du type MIME, pas du nom d’origine qui ment', () => {
    expect(extensionDe('image/png')).toBe('png');
    expect(extensionDe('image/webp')).toBe('webp');
    expect(extensionDe('image/jpeg')).toBe('jpg');
  });
});

describe('insigneAffichable — fail-closed sur l’image non validée', () => {
  it('rend l’insigne de catalogue, à tous', () => {
    const e = { ...VIDE, insigneCatalogueKey: 'chevron' };
    expect(insigneAffichable(e, false)).toEqual({ type: 'catalogue', key: 'chevron' });
    expect(insigneAffichable(e, true)).toEqual({ type: 'catalogue', key: 'chevron' });
  });

  it('rend une image VALIDÉE à tout le monde', () => {
    const e = {
      insigneCatalogueKey: null,
      insigneImagePath: 'c1/i.png',
      insigneStatus: 'valide' as const,
    };
    expect(insigneAffichable(e, false)).toEqual({ type: 'image', chemin: 'c1/i.png' });
  });

  /** LE TEST QUI COMPTE. */
  it('cache une image EN ATTENTE aux autres écuries', () => {
    const e = {
      insigneCatalogueKey: null,
      insigneImagePath: 'c1/i.png',
      insigneStatus: 'en_attente' as const,
    };
    expect(insigneAffichable(e, false)).toEqual({ type: 'aucun', raison: 'en_attente' });
  });

  /** Mais le capitaine voit la sienne, sinon son geste paraît perdu. */
  it('montre l’image en attente aux membres de l’écurie', () => {
    const e = {
      insigneCatalogueKey: null,
      insigneImagePath: 'c1/i.png',
      insigneStatus: 'en_attente' as const,
    };
    expect(insigneAffichable(e, true)).toEqual({ type: 'image', chemin: 'c1/i.png' });
  });

  it('cache une image REFUSÉE aux autres, et dit pourquoi aux siens', () => {
    const e = {
      insigneCatalogueKey: null,
      insigneImagePath: 'c1/i.png',
      insigneStatus: 'refuse' as const,
    };
    expect(insigneAffichable(e, false)).toEqual({ type: 'aucun', raison: 'refuse' });
    expect(insigneAffichable(e, true)).toEqual({ type: 'image', chemin: 'c1/i.png' });
  });

  it('une écurie sans insigne rend l’absence vide', () => {
    expect(insigneAffichable(VIDE, true)).toEqual({ type: 'aucun', raison: 'vide' });
  });

  /** Une clé écrite par une version plus récente ne se dessine pas au hasard. */
  it('une clé inconnue ne devient pas un insigne', () => {
    const e = { ...VIDE, insigneCatalogueKey: 'dragon' };
    expect(insigneAffichable(e, true)).toEqual({ type: 'aucun', raison: 'cle_inconnue' });
  });

  /**
   * La base interdit les deux voies (`num_nonnulls <= 1`). Si une ligne les
   * portait quand même, le catalogue gagne — il n'a rien à modérer, donc il ne
   * peut pas exposer une image non vue.
   */
  it('si les deux voies étaient remplies, le catalogue l’emporte', () => {
    const e = {
      insigneCatalogueKey: 'losange',
      insigneImagePath: 'c1/i.png',
      insigneStatus: 'en_attente' as const,
    };
    expect(insigneAffichable(e, false)).toEqual({ type: 'catalogue', key: 'losange' });
  });
});

describe('messageAbsence — une absence se dit, jamais un blanc muet', () => {
  it('donne un texte pour chaque raison, et distingue le délai de l’invitation', () => {
    const vide = messageAbsence('vide');
    const attente = messageAbsence('en_attente');
    for (const r of ['vide', 'en_attente', 'refuse', 'cle_inconnue'] as const) {
      expect(messageAbsence(r).length).toBeGreaterThan(0);
    }
    expect(attente).not.toBe(vide);
  });
});
