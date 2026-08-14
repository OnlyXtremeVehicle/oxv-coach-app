import { raisonsResume, type SeanceMinimale } from '../raisonAbsence';

const PRESENTS = { chrono: true, tours: true, distance: true, vmax: true };
const ABSENTS = { chrono: false, tours: false, distance: false, vmax: false };

const seance = (p: Partial<SeanceMinimale> = {}): SeanceMinimale => ({
  total_frames: 27052,
  lap_count: 3,
  status: 'completed',
  ...p,
});

describe('raisonsResume', () => {
  it('un chiffre PRÉSENT n’a pas de raison — on n’explique que l’absence', () => {
    const r = raisonsResume(seance(), 3, PRESENTS);
    expect(r).toEqual({ chrono: null, tours: null, distance: null, vmax: null });
  });

  /**
   * LE CAS LE PLUS FRÉQUENT EN PRODUCTION AUJOURD'HUI. Dix-sept séances sur
   * dix-huit ne portaient aucune trame au 29/07 : c'est cette phrase que le
   * pilote aurait dû lire, au lieu de quatre tirets muets.
   */
  it('sans trame, la cause racine explique les quatre', () => {
    const r = raisonsResume(seance({ total_frames: 0, lap_count: 0 }), 0, ABSENTS);
    expect(r.chrono).toMatch(/aucune trame/i);
    expect(r.tours).toMatch(/aucune trame/i);
    expect(r.distance).toMatch(/aucune trame/i);
    expect(r.vmax).toMatch(/aucune trame/i);
  });

  it('séance en cours : c’est dit, et ce n’est pas une panne', () => {
    const r = raisonsResume(seance({ status: 'recording' }), 0, ABSENTS);
    expect(r.chrono).toMatch(/encore en cours/i);
  });

  it('séance interrompue : dit comme telle', () => {
    const r = raisonsResume(seance({ status: 'aborted' }), 0, ABSENTS);
    expect(r.tours).toMatch(/interrompue/i);
  });

  /**
   * Des trames, mais aucun franchissement — la sortie d'essai ordinaire. Ni
   * panne, ni séance vide : le chrono a sa propre raison, plus précise que la
   * cause racine.
   */
  it('des trames mais aucun tour : chaque nombre reçoit sa raison propre', () => {
    const r = raisonsResume(seance({ total_frames: 5000, lap_count: 0 }), 0, {
      ...ABSENTS,
      distance: true,
      vmax: true,
    });
    expect(r.tours).toMatch(/ligne d’arrivée/i);
    expect(r.chrono).toMatch(/ligne d’arrivée/i);
    // Distance et vitesse SONT présentes : elles ne réclament rien.
    expect(r.distance).toBeNull();
    expect(r.vmax).toBeNull();
  });

  /**
   * Le chrono a une raison PROPRE quand rien d'autre n'explique : une séance
   * complète, avec trames et tours comptés, mais aucun tour clos.
   */
  it('tours comptés mais chrono absent : la raison est celle du chrono', () => {
    const r = raisonsResume(seance({ lap_count: 2 }), 2, { ...PRESENTS, chrono: false });
    expect(r.chrono).toMatch(/tour complet/i);
    expect(r.tours).toBeNull();
  });

  it('aucune raison n’est inventée quand rien ne l’explique', () => {
    // Tout est mesuré sauf la distance, sur une séance par ailleurs saine :
    // la fonction a une phrase adossée aux trames, elle ne brode pas.
    const r = raisonsResume(seance(), 3, { ...PRESENTS, distance: false });
    expect(r.distance).toMatch(/trames de position/i);
    expect(r.chrono).toBeNull();
    expect(r.tours).toBeNull();
    expect(r.vmax).toBeNull();
  });

  it('les phrases vouvoient, sans emoji ni prescription', () => {
    const toutes = Object.values(raisonsResume(seance({ total_frames: 0 }), 0, ABSENTS));
    for (const p of toutes) {
      expect(p).not.toBeNull();
      expect(p as string).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(p as string).not.toMatch(/\btu\b|\bdois\b|\bfaut\b/i);
    }
  });
});
