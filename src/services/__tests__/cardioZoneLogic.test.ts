import {
  MIN_SPREAD_BPM,
  cardioZone,
  cardioZoneColor,
  cardioZoneLabel,
  updateObservedRange,
  type CardioZone,
  type ObservedRange,
} from '@/services/cardioZoneLogic';
import { dataColors, palette, speedHeat } from '@/theme/v2';

/** Toutes les sorties possibles de `cardioZone`, null compris — sert aux invariants. */
const TOUTES_ZONES: readonly (CardioZone | null)[] = ['bas', 'median', 'haut', null];

describe('cardioZone — plage trop étroite : null, JAMAIS un median de repli', () => {
  it('une plage de 3 bpm ne permet aucun placement honnête', () => {
    expect(cardioZone(151, { minBpm: 150, maxBpm: 153 })).toBeNull();
    expect(cardioZone(151, { minBpm: 150, maxBpm: 153 })).not.toBe('median');
  });

  it('une plage d’amplitude nulle (premier échantillon) reste non situable', () => {
    expect(cardioZone(150, { minBpm: 150, maxBpm: 150 })).toBeNull();
  });

  it('juste sous le seuil : null ; exactement au seuil : situable', () => {
    expect(MIN_SPREAD_BPM).toBe(10);
    expect(cardioZone(105, { minBpm: 100, maxBpm: 109.99 })).toBeNull();
    expect(cardioZone(105, { minBpm: 100, maxBpm: 110 })).not.toBeNull();
  });

  it('à l’amplitude seuil, les trois zones restent atteignables', () => {
    const observed: ObservedRange = { minBpm: 100, maxBpm: 110 };
    expect(cardioZone(103, observed)).toBe('bas');
    expect(cardioZone(105, observed)).toBe('median');
    expect(cardioZone(108, observed)).toBe('haut');
  });
});

describe('cardioZone — entrées non finies ou incohérentes : null', () => {
  const observed: ObservedRange = { minBpm: 60, maxBpm: 120 };

  it('FC non finie', () => {
    expect(cardioZone(Number.NaN, observed)).toBeNull();
    expect(cardioZone(Number.POSITIVE_INFINITY, observed)).toBeNull();
    expect(cardioZone(Number.NEGATIVE_INFINITY, observed)).toBeNull();
    expect(cardioZone('150' as unknown as number, observed)).toBeNull();
    expect(cardioZone(undefined as unknown as number, observed)).toBeNull();
  });

  it('bornes de plage non finies', () => {
    expect(cardioZone(90, { minBpm: Number.NaN, maxBpm: 120 })).toBeNull();
    expect(cardioZone(90, { minBpm: 60, maxBpm: Number.NaN })).toBeNull();
    expect(cardioZone(90, { minBpm: 60, maxBpm: Number.POSITIVE_INFINITY })).toBeNull();
    expect(cardioZone(90, { minBpm: null as unknown as number, maxBpm: 120 })).toBeNull();
  });

  it('plage absente (frontière non typée) : fail-closed', () => {
    expect(cardioZone(90, null as unknown as ObservedRange)).toBeNull();
    expect(cardioZone(90, undefined as unknown as ObservedRange)).toBeNull();
  });

  it('plage incohérente (max < min)', () => {
    expect(cardioZone(90, { minBpm: 120, maxBpm: 60 })).toBeNull();
  });
});

describe('cardioZone — terciles de la plage observée, bornes incluses', () => {
  // Plage 60→120 : spread 60, terciles à 80 et 100. Bornes internes fermées à gauche.
  const observed: ObservedRange = { minBpm: 60, maxBpm: 120 };

  it('premier tercile', () => {
    expect(cardioZone(60, observed)).toBe('bas');
    expect(cardioZone(70, observed)).toBe('bas');
    expect(cardioZone(79.9, observed)).toBe('bas');
  });

  it('deuxième tercile (bascule exactement à 80)', () => {
    expect(cardioZone(80, observed)).toBe('median');
    expect(cardioZone(90, observed)).toBe('median');
    expect(cardioZone(99.9, observed)).toBe('median');
  });

  it('troisième tercile (bascule exactement à 100)', () => {
    expect(cardioZone(100, observed)).toBe('haut');
    expect(cardioZone(110, observed)).toBe('haut');
    expect(cardioZone(120, observed)).toBe('haut');
  });

  it('borne basse incluse : FC ≤ min donne toujours bas', () => {
    expect(cardioZone(60, observed)).toBe('bas');
    expect(cardioZone(40, observed)).toBe('bas');
    expect(cardioZone(0, observed)).toBe('bas');
  });

  it('borne haute incluse : FC ≥ max donne toujours haut', () => {
    expect(cardioZone(120, observed)).toBe('haut');
    expect(cardioZone(200, observed)).toBe('haut');
  });

  it('aucune sortie hors de l’ensemble fermé des zones', () => {
    for (let hr = 0; hr <= 250; hr += 1) {
      expect(TOUTES_ZONES).toContain(cardioZone(hr, observed));
      expect(cardioZone(hr, observed)).not.toBeNull();
    }
  });
});

describe('INVARIANT COULEUR — ni or (chrono/record) ni rouge (verdict)', () => {
  const OR_CHRONO = '#FFB703';
  const ROUGE_MARQUE = '#C8102E';
  const ROUGE_DONNEE = '#F65B5B';

  it('aucune zone, null compris, ne sort en or', () => {
    for (const zone of TOUTES_ZONES) {
      expect(cardioZoneColor(zone).toUpperCase()).not.toBe(OR_CHRONO);
      expect(cardioZoneColor(zone)).not.toBe(palette.gold);
    }
  });

  it('aucune zone, null compris, ne sort en rouge sous aucune forme', () => {
    for (const zone of TOUTES_ZONES) {
      const couleur = cardioZoneColor(zone).toUpperCase();
      expect(couleur).not.toBe(ROUGE_MARQUE);
      expect(couleur).not.toBe(ROUGE_DONNEE);
      expect(cardioZoneColor(zone)).not.toBe(palette.red);
      expect(cardioZoneColor(zone)).not.toBe(dataColors.brake);
    }
  });

  it('rampe froid → chaud : bleu, vert, jaune', () => {
    expect(cardioZoneColor('bas')).toBe('#1E5178');
    expect(cardioZoneColor('median')).toBe('#4AA3D8');
    expect(cardioZoneColor('haut')).toBe('#7FC4EE');
  });

  it('les zones pointent sur la rampe partagée speedHeat (pas des littéraux isolés)', () => {
    expect(cardioZoneColor('bas')).toBe(speedHeat[0]);
    expect(cardioZoneColor('median')).toBe(speedHeat[2]);
    expect(cardioZoneColor('haut')).toBe(speedHeat[3]);
  });

  it('null donne une couleur neutre inerte, pas une quatrième zone', () => {
    // On assert le JETON, pas sa valeur littérale : le gris `faint` a été relevé
    // le 25/07 pour le contraste, et figer l'hexadécimal ici ferait échouer ce
    // test à chaque ajustement de palette sans qu'aucune règle ne soit violée.
    // Ce qui compte est l'invariant : la zone absente emprunte le neutre inerte.
    expect(cardioZoneColor(null)).toBe(palette.faint);
    expect(cardioZoneColor(null)).not.toBe(cardioZoneColor('bas'));
    expect(cardioZoneColor(null)).not.toBe(cardioZoneColor('median'));
    expect(cardioZoneColor(null)).not.toBe(cardioZoneColor('haut'));
  });

  it('chaque zone a une couleur distincte (la pastille reste lisible)', () => {
    const couleurs = TOUTES_ZONES.map(cardioZoneColor);
    expect(new Set(couleurs).size).toBe(TOUTES_ZONES.length);
  });
});

describe('INVARIANT VOCABULAIRE — le libellé décrit, il ne juge pas', () => {
  // Liste noire : mots d'évaluation, d'alerte ou de diagnostic. Leur apparition
  // signifierait que l'app s'est mise à juger l'état physiologique du pilote.
  const MOTS_INTERDITS = [
    'élevé',
    'critique',
    'danger',
    'anormal',
    'alerte',
    'mauvais',
    'risque',
    'rouge',
  ];

  it('aucun libellé ne contient un mot de jugement', () => {
    for (const zone of TOUTES_ZONES) {
      const libelle = cardioZoneLabel(zone).toLowerCase();
      for (const mot of MOTS_INTERDITS) {
        expect(libelle).not.toContain(mot);
      }
    }
  });

  it('vocabulaire FERMÉ : quatre libellés factuels, pas un de plus', () => {
    expect(cardioZoneLabel('bas')).toBe('cardio bas');
    expect(cardioZoneLabel('median')).toBe('cardio médian');
    expect(cardioZoneLabel('haut')).toBe('cardio haut');
    expect(cardioZoneLabel(null)).toBe('cardio partagé');
    expect(new Set(TOUTES_ZONES.map(cardioZoneLabel)).size).toBe(TOUTES_ZONES.length);
  });

  it('aucun libellé ne contient d’emoji ni de ponctuation d’exclamation', () => {
    for (const zone of TOUTES_ZONES) {
      expect(cardioZoneLabel(zone)).toMatch(/^[a-zà-ÿ ]+$/);
    }
  });
});

describe('updateObservedRange — plage MESURÉE, mise à jour immuable', () => {
  it('premier échantillon : min = max = FC', () => {
    expect(updateObservedRange(null, 142)).toEqual({ minBpm: 142, maxBpm: 142 });
  });

  it('extension du minimum', () => {
    expect(updateObservedRange({ minBpm: 120, maxBpm: 180 }, 95)).toEqual({
      minBpm: 95,
      maxBpm: 180,
    });
  });

  it('extension du maximum', () => {
    expect(updateObservedRange({ minBpm: 120, maxBpm: 180 }, 191)).toEqual({
      minBpm: 120,
      maxBpm: 191,
    });
  });

  it('valeur intérieure : plage inchangée (même référence, pas de re-rendu)', () => {
    const prev: ObservedRange = { minBpm: 120, maxBpm: 180 };
    expect(updateObservedRange(prev, 150)).toBe(prev);
    expect(updateObservedRange(prev, 120)).toBe(prev);
    expect(updateObservedRange(prev, 180)).toBe(prev);
  });

  it('valeur non finie : prev strictement inchangé (un décrochage n’élargit rien)', () => {
    const prev: ObservedRange = { minBpm: 120, maxBpm: 180 };
    expect(updateObservedRange(prev, Number.NaN)).toBe(prev);
    expect(updateObservedRange(prev, Number.POSITIVE_INFINITY)).toBe(prev);
    expect(updateObservedRange(prev, '150' as unknown as number)).toBe(prev);
  });

  it('prev null et FC non finie : null (aucune plage fabriquée)', () => {
    expect(updateObservedRange(null, Number.NaN)).toBeNull();
    expect(updateObservedRange(null, Number.POSITIVE_INFINITY)).toBeNull();
    expect(updateObservedRange(null, undefined as unknown as number)).toBeNull();
  });

  it('ne mute jamais la plage reçue', () => {
    const prev: ObservedRange = { minBpm: 120, maxBpm: 180 };
    updateObservedRange(prev, 95);
    updateObservedRange(prev, 200);
    expect(prev).toEqual({ minBpm: 120, maxBpm: 180 });
  });

  it('séquence réelle : la plage s’ouvre puis devient situable', () => {
    let plage: ObservedRange | null = null;
    for (const hr of [142, 138, 155, 171, 129]) {
      plage = updateObservedRange(plage, hr);
    }
    expect(plage).toEqual({ minBpm: 129, maxBpm: 171 });
    expect(cardioZone(171, plage as ObservedRange)).toBe('haut');
    expect(cardioZone(129, plage as ObservedRange)).toBe('bas');
  });

  it('tant que la plage n’est pas ouverte, aucune couleur de zone n’est affichée', () => {
    const plage = updateObservedRange(null, 142);
    expect(cardioZone(142, plage as ObservedRange)).toBeNull();
    expect(cardioZoneColor(cardioZone(142, plage as ObservedRange))).toBe(palette.faint);
  });
});
