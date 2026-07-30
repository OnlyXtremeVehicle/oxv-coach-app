import { DISTANCE_APEX_MAX_M, cadreCommun, projette, trancheVirage } from '../virage';

const p = (lat: number, lon: number, speedKmh: number | null = null) => ({ lat, lon, speedKmh });

describe('trancheVirage', () => {
  it('rend un vide honnête quand aucune trame ne porte de position', () => {
    const r = trancheVirage(
      [
        { lat: null, lon: null },
        { lat: 1, lon: null },
      ],
      null,
      null
    );
    expect(r.points).toEqual([]);
    expect(r.apex).toBeNull();
  });

  it('écarte les trames sans position sans décaler les autres', () => {
    const r = trancheVirage([p(1, 1), { lat: null, lon: 2 }, p(3, 3)], null, null);
    expect(r.points).toEqual([p(1, 1), p(3, 3)]);
  });

  it('découpe sur la fenêtre, bornes incluses', () => {
    // Cinq trames → progressions 0, 0.25, 0.5, 0.75, 1.
    const trames = [p(0, 0), p(1, 1), p(2, 2), p(3, 3), p(4, 4)];
    const r = trancheVirage(trames, { start: 0.25, end: 0.75 }, null);
    expect(r.points.map((q) => q.lat)).toEqual([1, 2, 3]);
  });

  it('rend le tour entier sans fenêtre — jamais un découpage au hasard', () => {
    const trames = [p(0, 0), p(1, 1), p(2, 2)];
    expect(trancheVirage(trames, null, null).points).toHaveLength(3);
  });

  it('rend un vide quand la fenêtre ne contient aucune trame', () => {
    // Deux trames : progressions 0 et 1. Rien entre 0.4 et 0.6.
    const r = trancheVirage([p(0, 0), p(1, 1)], { start: 0.4, end: 0.6 }, null);
    expect(r.points).toEqual([]);
    expect(r.apex).toBeNull();
  });

  it('retient comme apex une trame MESURÉE, jamais un point construit', () => {
    // Coordonnées à l'échelle d'un virage — quelques dizaines de mètres. Un
    // degré de latitude vaut ~111 km : les fixtures « 0, 1, 2 » d'un premier
    // jet plaçaient les trames à des centaines de kilomètres les unes des
    // autres, et le garde de distance les rejette à juste titre.
    const trames = [p(45.24, -0.094, 100), p(45.2402, -0.094, 80), p(45.2404, -0.094, 120)];
    const r = trancheVirage(trames, null, { lat: 45.2402, lon: -0.094 });
    expect(r.apex).toEqual(p(45.2402, -0.094, 80));
    // L'apex appartient bien à la tranche rendue.
    expect(r.points).toContainEqual(r.apex);
  });

  it('ne marque AUCUN apex quand le plus proche est loin de la corde', () => {
    // Le plus proche voisin existe toujours ; encore faut-il qu'il soit proche.
    // Ici la fenêtre a raté le virage : les trames sont à ~1,1 km de la corde.
    // Un point marqué désignerait un endroit où le pilote n'a pas tourné.
    const loin = [p(45.24, -0.094), p(45.25, -0.094)];
    const r = trancheVirage(loin, null, { lat: 45.26, lon: -0.094 });
    expect(r.points).toHaveLength(2);
    expect(r.apex).toBeNull();
  });

  it("marque l'apex quand la trame tombe bien près de la corde", () => {
    // ~11 m au nord de la corde : sous le seuil, l'apex est légitime.
    const proche = [p(45.2401, -0.094), p(45.2405, -0.094)];
    const r = trancheVirage(proche, null, { lat: 45.2401, lon: -0.094 });
    expect(r.apex).toEqual(p(45.2401, -0.094));
  });

  it('le seuil est une distance réelle, pas un écart de degrés', () => {
    expect(DISTANCE_APEX_MAX_M).toBeGreaterThan(0);
    expect(DISTANCE_APEX_MAX_M).toBeLessThan(200);
  });

  it("n'invente pas d'apex quand aucune corde de référence n'est connue", () => {
    const r = trancheVirage([p(0, 0), p(1, 1)], null, null);
    expect(r.points).toHaveLength(2);
    expect(r.apex).toBeNull();
  });

  it("conserve la vitesse absente en null plutôt qu'en zéro", () => {
    const r = trancheVirage([{ lat: 0, lon: 0 }], null, null);
    expect(r.points[0].speedKmh).toBeNull();
  });
});

describe('cadreCommun', () => {
  it("rend null quand rien n'est cadrable", () => {
    expect(cadreCommun([])).toBeNull();
    expect(cadreCommun([{ points: [], apex: null }])).toBeNull();
  });

  it('englobe DEUX tranches — sinon la superposition mentirait', () => {
    const a = { points: [p(0, 0), p(1, 1)], apex: null };
    const b = { points: [p(-1, 2), p(3, 0)], apex: null };
    const c = cadreCommun([a, b]);
    expect(c).toEqual({ minLat: -1, maxLat: 3, minLon: 0, maxLon: 2 });
  });

  it('ouvre un cadre fini sur un point unique — pas de division par zéro', () => {
    const c = cadreCommun([{ points: [p(45, -0.1)], apex: null }]);
    expect(c).not.toBeNull();
    expect(c!.maxLat).toBeGreaterThan(c!.minLat);
    expect(c!.maxLon).toBeGreaterThan(c!.minLon);
  });
});

describe('projette', () => {
  const cadre = { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };

  it('garde le tracé dans la boîte, marge comprise', () => {
    for (const q of [p(0, 0), p(1, 1), p(0.5, 0.5)]) {
      const { x, y } = projette(q, cadre, 200, 200, 10);
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(190 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(y).toBeLessThanOrEqual(190 + 1e-6);
    }
  });

  it('inverse la latitude : le nord est en haut', () => {
    const nord = projette(p(1, 0.5), cadre, 200, 200, 10);
    const sud = projette(p(0, 0.5), cadre, 200, 200, 10);
    expect(nord.y).toBeLessThan(sud.y);
  });

  it('garde une échelle COMMUNE aux deux axes : un carré reste carré', () => {
    // Cadre carré en distance réelle : la longitude est corrigée par cos(lat),
    // donc on prend un cadre dont l'étendue corrigée égale l'étendue de lat.
    const latMoy = ((cadre.minLat + cadre.maxLat) / 2) * (Math.PI / 180);
    const carre = { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 / Math.cos(latMoy) };
    const a = projette({ lat: 0, lon: 0 }, carre, 300, 300, 0);
    const b = projette({ lat: 1, lon: carre.maxLon }, carre, 300, 300, 0);
    expect(Math.abs(Math.abs(b.x - a.x) - Math.abs(b.y - a.y))).toBeLessThan(1e-6);
  });

  it("corrige la longitude : un virage ne s'étire pas en largeur", () => {
    // À 45° de latitude, un degré de longitude vaut ~0,707 degré de latitude.
    // Une boîte carrée doit donc rendre un tracé plus large que haut.
    const c = { minLat: 45, maxLat: 46, minLon: 0, maxLon: 1 };
    const gauche = projette({ lat: 45.5, lon: 0 }, c, 200, 200, 0);
    const droite = projette({ lat: 45.5, lon: 1 }, c, 200, 200, 0);
    const bas = projette({ lat: 45, lon: 0.5 }, c, 200, 200, 0);
    const haut = projette({ lat: 46, lon: 0.5 }, c, 200, 200, 0);
    expect(Math.abs(droite.x - gauche.x)).toBeLessThan(Math.abs(bas.y - haut.y));
  });
});
