/**
 * Les surfaces d'affichage — et la frontière que les lunettes ne franchissent pas.
 *
 * Deux gardes vivent ici, et elles sont l'essentiel du fichier :
 *   - aucune surface n'est déclarée source de mesure (les identifiants des deux
 *     registres restent disjoints) ;
 *   - aucune surface n'est visible d'un pilote EN ROULAGE (Principe 3).
 */

import { SOURCES } from '../sourcesBiometrie';
import {
  SURFACES,
  SURFACE_ECRAN_PADDOCK,
  SURFACE_LUNETTES_COACH,
  SURFACE_TELEPHONE_COACH,
  SURFACE_TELEPHONE_PILOTE,
  estUneSourceDeMesure,
  peutAfficherSante,
  surfaceParId,
} from '../surfacesAffichage';

describe('GARDE — mesurer et montrer sont deux registres', () => {
  it('aucun identifiant n’appartient aux deux', () => {
    const idsSources = new Set<string>(SOURCES.map((s) => s.id));
    for (const surface of SURFACES) {
      expect(idsSources.has(surface.id)).toBe(false);
    }
  });

  it('les lunettes ne se résolvent pas comme une source, ni l’inverse', () => {
    // Le registre des sources ignore les surfaces (vérifié dans sourcesBiometrie),
    // et le registre des surfaces ignore les sources.
    for (const s of SOURCES) expect(surfaceParId(s.id)).toBeNull();
    expect(surfaceParId('lunettes_coach')).toBe(SURFACE_LUNETTES_COACH);
  });

  it('aucune surface ne mesure quoi que ce soit', () => {
    for (const surface of SURFACES) expect(estUneSourceDeMesure(surface)).toBe(false);
  });
});

describe('GARDE — Principe 3 : rien sous les yeux du pilote qui roule', () => {
  it('aucune surface déclarée n’est visible en roulage', () => {
    const fautives = SURFACES.filter((s) => s.visibleEnRoulage === true).map((s) => s.id);
    expect(fautives).toEqual([]);
  });

  it('une surface qui le serait est refusée par l’affichage, même santé admise', () => {
    const hud = { ...SURFACE_TELEPHONE_PILOTE, visibleEnRoulage: true };
    expect(peutAfficherSante(hud, { partageCoachConsenti: true })).toBe(false);
  });
});

describe('les lunettes du coach — admises, et bornées', () => {
  it('elles appartiennent au coach, jamais au pilote', () => {
    expect(SURFACE_LUNETTES_COACH.porteur).toBe('coach');
  });

  it('elles restent marquées expérimentales', () => {
    expect(SURFACE_LUNETTES_COACH.experimentale).toBe(true);
  });

  it('elles n’affichent la santé que si le partage est consenti', () => {
    expect(peutAfficherSante(SURFACE_LUNETTES_COACH, { partageCoachConsenti: false })).toBe(false);
    expect(peutAfficherSante(SURFACE_LUNETTES_COACH, { partageCoachConsenti: true })).toBe(true);
  });
});

describe('l’écran du paddock — aucun consentement ne le retourne', () => {
  it('il n’admet pas la santé, partage consenti ou non', () => {
    expect(peutAfficherSante(SURFACE_ECRAN_PADDOCK, { partageCoachConsenti: true })).toBe(false);
    expect(peutAfficherSante(SURFACE_ECRAN_PADDOCK, { partageCoachConsenti: false })).toBe(false);
  });
});

describe('le téléphone du pilote — ses données, aucun partage à demander', () => {
  it('affiche sa santé sans dépendre du partage au coach', () => {
    expect(peutAfficherSante(SURFACE_TELEPHONE_PILOTE, { partageCoachConsenti: false })).toBe(true);
  });

  it('le téléphone du coach, lui, dépend bien du partage', () => {
    expect(peutAfficherSante(SURFACE_TELEPHONE_COACH, { partageCoachConsenti: false })).toBe(false);
  });
});

describe('fail-closed', () => {
  it('surface absente ou inconnue → refus', () => {
    expect(peutAfficherSante(null, { partageCoachConsenti: true })).toBe(false);
    expect(peutAfficherSante(surfaceParId('casque_pilote'), { partageCoachConsenti: true })).toBe(
      false
    );
  });

  it('contexte absent → refus côté coach', () => {
    expect(
      peutAfficherSante(
        SURFACE_LUNETTES_COACH,
        null as unknown as { partageCoachConsenti: boolean }
      )
    ).toBe(false);
  });
});
