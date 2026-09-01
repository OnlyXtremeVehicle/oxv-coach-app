/**
 * Le consentement par source — fail-closed, révocable, et qui DIT ce qui le porte.
 */

import {
  type EtatConsentements,
  decisionCapture,
  decisionPartageCoach,
  etatDeLaSource,
  phraseDecision,
  variabilitePartageableAuCoach,
} from '../consentementSource';
import { SOURCE_CEINTURE, SOURCE_MONTRE } from '../sourcesBiometrie';

function etat(p: Partial<EtatConsentements> = {}): EtatConsentements {
  return {
    drapeauActif: true,
    socleCapture: true,
    partageCoach: false,
    coachAffilieActif: true,
    parSource: {},
    ...p,
  };
}

describe('les marches, dans l’ordre — chacune avec son motif', () => {
  it('drapeau retiré → refus, quoi qu’ait consenti le pilote', () => {
    const d = decisionCapture(
      etat({ drapeauActif: false, parSource: { ceinture_ble: 'accorde' } }),
      SOURCE_CEINTURE
    );
    expect(d).toEqual({ autorisee: false, motif: 'drapeau_absent' });
  });

  it('socle absent → refus, même si la source est accordée', () => {
    const d = decisionCapture(
      etat({ socleCapture: false, parSource: { ceinture_ble: 'accorde' } }),
      SOURCE_CEINTURE
    );
    expect(d).toEqual({ autorisee: false, motif: 'socle_absent' });
  });

  it('LE POINT DU LOT — un retrait PAR SOURCE prime sur le socle', () => {
    const e = etat({ parSource: { ceinture_ble: 'retire', montre_apple: 'accorde' } });
    expect(decisionCapture(e, SOURCE_CEINTURE)).toEqual({
      autorisee: false,
      motif: 'source_retiree',
    });
    // …et l'autre source n'en souffre pas : la révocation est bien PAR source.
    expect(decisionCapture(e, SOURCE_MONTRE)).toEqual({
      autorisee: true,
      motif: 'socle_et_source',
    });
  });

  it('source accordée → autorisée, portée par les deux consentements', () => {
    const d = decisionCapture(etat({ parSource: { montre_apple: 'accorde' } }), SOURCE_MONTRE);
    expect(d).toEqual({ autorisee: true, motif: 'socle_et_source' });
  });

  it('source jamais recueillie → autorisée par le SOCLE, et la décision le NOMME', () => {
    const d = decisionCapture(etat(), SOURCE_MONTRE);
    expect(d).toEqual({ autorisee: true, motif: 'socle_seul' });
  });

  it('une source hors registre est refusée', () => {
    expect(decisionCapture(etat(), null)).toEqual({
      autorisee: false,
      motif: 'source_inconnue',
    });
  });
});

describe('fail-closed sur l’entrée', () => {
  it('un état absent refuse', () => {
    expect(decisionCapture(null as unknown as EtatConsentements, SOURCE_CEINTURE).autorisee).toBe(
      false
    );
  });

  it('une valeur hors vocabulaire vaut « jamais recueilli », jamais « accordé »', () => {
    const e = etat({
      parSource: { ceinture_ble: 'peut-etre' as unknown as 'accorde' },
    });
    expect(etatDeLaSource(e, 'ceinture_ble')).toBe('jamais_recueilli');
  });

  it('les drapeaux non stricts (undefined, 1, "true") ne passent pas', () => {
    for (const faux of [undefined, 1, 'true', null]) {
      const e = etat({ drapeauActif: faux as unknown as boolean });
      expect(decisionCapture(e, SOURCE_CEINTURE).autorisee).toBe(false);
    }
  });
});

describe('le partage coach est DISTINCT de la capture', () => {
  it('capture autorisée mais partage absent → refus de partage', () => {
    const e = etat({ parSource: { ceinture_ble: 'accorde' } });
    expect(decisionCapture(e, SOURCE_CEINTURE).autorisee).toBe(true);
    expect(decisionPartageCoach(e, SOURCE_CEINTURE).autorisee).toBe(false);
  });

  it('partage accordé mais source retirée → refus (le partage ne ressuscite rien)', () => {
    const e = etat({
      partageCoach: true,
      coachAffilieActif: true,
      parSource: { ceinture_ble: 'retire' },
    });
    expect(decisionPartageCoach(e, SOURCE_CEINTURE)).toEqual({
      autorisee: false,
      motif: 'source_retiree',
    });
  });

  it('les deux réunis → partage autorisé', () => {
    const e = etat({ partageCoach: true, parSource: { ceinture_ble: 'accorde' } });
    expect(decisionPartageCoach(e, SOURCE_CEINTURE).autorisee).toBe(true);
  });
});

describe('la variabilité est réservée au coach — et la montre n’en a pas', () => {
  it('la montre ne partage aucune variabilité, même partage consenti', () => {
    const e = etat({ partageCoach: true, parSource: { montre_apple: 'accorde' } });
    expect(variabilitePartageableAuCoach(e, SOURCE_MONTRE)).toBe(false);
  });

  it('la ceinture la partage seulement si le partage coach est consenti', () => {
    expect(variabilitePartageableAuCoach(etat({ partageCoach: false }), SOURCE_CEINTURE)).toBe(
      false
    );
    expect(variabilitePartageableAuCoach(etat({ partageCoach: true }), SOURCE_CEINTURE)).toBe(true);
  });
});

describe('les phrases rendues', () => {
  it('« socle seul » ne prétend jamais un accord par source', () => {
    const phrase = phraseDecision(SOURCE_MONTRE, { autorisee: true, motif: 'socle_seul' });
    expect(phrase).toBe('Montre Apple : mesure autorisée par votre accord de capture.');
    expect(phrase).not.toContain('pour cette source');
  });

  it('un refus se dit sans jugement ni verbe prescriptif', () => {
    const interdits = /\b(freinez|accélérez|vous devriez|il faut|évitez|limite)\b/i;
    for (const motif of ['socle_absent', 'source_retiree'] as const) {
      const p = phraseDecision(SOURCE_CEINTURE, { autorisee: false, motif });
      expect(p).not.toBeNull();
      expect(p as string).not.toMatch(interdits);
    }
  });

  it('rien à dire quand il n’y a rien d’honnête à dire', () => {
    expect(
      phraseDecision(SOURCE_CEINTURE, { autorisee: false, motif: 'drapeau_absent' })
    ).toBeNull();
    expect(
      phraseDecision(SOURCE_CEINTURE, { autorisee: false, motif: 'source_inconnue' })
    ).toBeNull();
  });
});

/**
 * ARBITRAGE FONDATEUR DU 26/08/2026
 * « deux acceptations différentes et la ceinture seulement si coach affilié
 *   durant sessions »
 *
 * La ceinture thoracique mesure en continu et porte la variabilité : elle
 * n'existe pas comme équipement de confort, mais parce qu'un professionnel
 * accompagne. La montre, au poignet du pilote, ne dépend de personne.
 */
describe('la ceinture demande un coach affilié — arbitrage du 26/08/2026', () => {
  it('sans coach affilié, la ceinture ne mesure pas — et le motif le dit', () => {
    const d = decisionCapture(
      etat({ coachAffilieActif: false, parSource: { ceinture_ble: 'accorde' } }),
      SOURCE_CEINTURE
    );
    expect(d.autorisee).toBe(false);
    expect(d.motif).toBe('coach_affilie_absent');
  });

  it('avec un coach affilié, l’accord ceinture porte', () => {
    const d = decisionCapture(
      etat({ coachAffilieActif: true, parSource: { ceinture_ble: 'accorde' } }),
      SOURCE_CEINTURE
    );
    expect(d.autorisee).toBe(true);
    expect(d.motif).toBe('socle_et_source');
  });

  it('la montre ne dépend de personne : sans coach, elle mesure quand même', () => {
    const d = decisionCapture(
      etat({ coachAffilieActif: false, parSource: { montre_apple: 'accorde' } }),
      SOURCE_MONTRE
    );
    expect(d.autorisee).toBe(true);
  });

  it('deux acceptations DIFFÉRENTES : retirer la ceinture ne touche pas la montre', () => {
    const e = etat({
      coachAffilieActif: true,
      parSource: { ceinture_ble: 'retire', montre_apple: 'accorde' },
    });
    expect(decisionCapture(e, SOURCE_CEINTURE).autorisee).toBe(false);
    expect(decisionCapture(e, SOURCE_MONTRE).autorisee).toBe(true);
  });

  /**
   * L'ordre des marches compte : un retrait est le geste du pilote, et c'est
   * lui qu'on lui rend — pas une absence de coach qu'il n'a pas décidée.
   */
  it('un retrait prime sur l’absence de coach : c’est son geste qu’on lui rend', () => {
    const d = decisionCapture(
      etat({ coachAffilieActif: false, parSource: { ceinture_ble: 'retire' } }),
      SOURCE_CEINTURE
    );
    expect(d.motif).toBe('source_retiree');
  });

  it('l’affiliation qui cesse ferme la source sans révoquer l’accord', () => {
    const accorde = { ceinture_ble: 'accorde' } as const;
    expect(
      etatDeLaSource(etat({ coachAffilieActif: false, parSource: accorde }), 'ceinture_ble')
    ).toBe('accorde');
    expect(
      decisionCapture(etat({ coachAffilieActif: false, parSource: accorde }), SOURCE_CEINTURE)
        .autorisee
    ).toBe(false);
  });
});
