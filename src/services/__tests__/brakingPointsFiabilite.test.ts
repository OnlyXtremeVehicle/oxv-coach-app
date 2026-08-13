/**
 * UN LEVER DE PIED N'EST PAS UN FREINAGE.
 *
 * ===========================================================================
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `detectBrakingPoints` ne retenait une zone que sur la CHUTE TOTALE de
 * vitesse — quinze km/h par défaut — **sans aucune notion de distance**. Une
 * voiture qui décélère de 120 à 100 en levant le pied sur quatre cents mètres
 * produisait donc exactement le même signal qu'un freinage de 120 à 100 sur
 * quarante.
 *
 * Tant que le layer était éteint, cela ne coûtait rien. La décision du 13/08 de
 * l'ARMER change tout : sur l'écran de triage du coach, chaque marqueur est une
 * affirmation sur la conduite du pilote, et elle alimente un débrief. En poser
 * un là où il a seulement levé, c'est fabriquer un fait.
 *
 * Un layer allumé sur une détection fragile est pire qu'un layer éteint, parce
 * qu'il affirme.
 *
 * ===========================================================================
 * LE CRITÈRE, ET POURQUOI CELUI-LÀ
 * ===========================================================================
 *
 *     a = (v₂² − v₁²) / (2 · d)
 *
 * La décélération se dérive des seules vitesses et de la distance, sans
 * horodatage — et se compare au seuil PARTAGÉ `SEUIL_FREINAGE_G` (−0,3 g),
 * celui qu'emploie déjà `detectBrakingZones`. Le frein moteur d'une voiture de
 * route tourne autour de −0,1 à −0,2 g : il ne franchit pas cette barre.
 *
 * `DETTE.md` relevait « trois seuils de freinage sans constante partagée ».
 * Il n'y en a plus qu'un.
 */

import { detectBrakingPoints, type TrajPoint } from '../brakingPointsService';
import { SEUIL_FREINAGE_G } from '@/telemetry/braking';

/**
 * Construit une trajectoire rectiligne de `distanceM` mètres, décélérant
 * linéairement en vitesse de `v0` à `v1`, échantillonnée tous les mètres.
 *
 * Un degré de latitude vaut ~111 320 m : on avance en latitude pure, ce qui
 * rend la distance exacte et le test lisible.
 */
function ligne(v0: number, v1: number, distanceM: number, lat0 = 45.6): TrajPoint[] {
  const n = Math.max(3, Math.round(distanceM));
  const pas = 1 / 111_320;
  return Array.from({ length: n + 1 }, (_, k) => ({
    lat: lat0 + k * pas,
    lon: -0.13,
    speed: v0 + ((v1 - v0) * k) / n,
  }));
}

describe('le seuil est PHYSIQUE, et il est partagé', () => {
  it('la constante vient de `braking.ts`, elle n’est pas recopiée', () => {
    expect(SEUIL_FREINAGE_G).toBe(-0.3);
  });

  /**
   * LE CAS QUI PASSAIT ET NE DOIT PLUS PASSER.
   *
   * 120 → 100 km/h sur 400 m : chute de 20 km/h, largement au-dessus des 15 de
   * l'ancien critère. Décélération réelle ≈ −0,043 g — du frein moteur.
   */
  it('un lever de pied sur 400 m ne produit AUCUN marqueur', () => {
    const pts = detectBrakingPoints(ligne(120, 100, 400));
    expect(pts).toEqual([]);
  });

  /**
   * LE MÊME ÉCART DE VITESSE, SUR QUARANTE MÈTRES. Décélération ≈ −0,43 g :
   * un appui franc. C'est le contre-test, et il décide — un critère qui
   * refuserait tout passerait le cas précédent sans rien protéger.
   */
  it('le même écart sur 40 m produit un marqueur', () => {
    const pts = detectBrakingPoints(ligne(120, 100, 40));
    expect(pts.length).toBeGreaterThan(0);
    expect(pts[0].entrySpeed).toBeCloseTo(120, 0);
    expect(pts[0].exitSpeed).toBeCloseTo(100, 0);
  });

  /** Un freinage d'urgence, très au-delà du seuil : retenu sans discussion. */
  it('un freinage appuyé est retenu', () => {
    const pts = detectBrakingPoints(ligne(160, 60, 60));
    expect(pts.length).toBeGreaterThan(0);
  });
});

describe('ce que la détection refuse de conclure', () => {
  /**
   * NE PAS SAVOIR N'EST PAS « PAS DE FREINAGE ». Sur une zone trop courte,
   * `2·d` tend vers zéro et l'accélération vers l'infini : le quotient ne veut
   * plus rien dire. La zone est écartée — le bon défaut pour une donnée qu'on
   * affirmerait à un coach.
   */
  it('une zone de moins de cinq mètres est écartée, pas extrapolée', () => {
    const pts = detectBrakingPoints(ligne(120, 90, 3));
    expect(pts).toEqual([]);
  });

  it('une trajectoire sans vitesse ne produit rien', () => {
    const sansVitesse: TrajPoint[] = ligne(120, 60, 80).map((p) => ({ ...p, speed: null }));
    expect(detectBrakingPoints(sansVitesse)).toEqual([]);
  });

  it('une trajectoire trop courte ne produit rien', () => {
    expect(detectBrakingPoints([{ lat: 45.6, lon: -0.13, speed: 100 }])).toEqual([]);
  });

  /** Une vitesse constante n'est pas un freinage, quelle que soit la distance. */
  it('une vitesse stable ne produit rien', () => {
    expect(detectBrakingPoints(ligne(100, 100, 500))).toEqual([]);
  });
});

describe('la frontière, approchée des deux côtés', () => {
  /**
   * On encadre la décision au lieu de l'effleurer. À 120 → 100 km/h, la
   * distance qui donne exactement −0,3 g vaut :
   *
   *     d = (v₁² − v₀²) / (2 · a) = (27,78² − 33,33²) / (2 · −2,942) ≈ 57,6 m
   *
   * Un test qui n'éprouve la garde qu'à vingt fois le seuil ne verrait pas
   * celui-ci dériver.
   */
  const D_SEUIL = 57.6;

  it('nettement en deçà de la distance seuil : retenu', () => {
    expect(detectBrakingPoints(ligne(120, 100, D_SEUIL * 0.8)).length).toBeGreaterThan(0);
  });

  it('nettement au-delà : écarté', () => {
    expect(detectBrakingPoints(ligne(120, 100, D_SEUIL * 1.25))).toEqual([]);
  });
});
