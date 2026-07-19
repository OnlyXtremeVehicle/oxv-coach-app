/**
 * Tests de miroirHomeLogic — logique pure de l'accueil Miroir (V2-L1, 1/3).
 *
 * Points verrouillés : frontière EXACTE des 7 jours du mode d'accueil,
 * fait de saison jamais inventé, fallbacks photo honnêtes (null), gating
 * du CTA RÉSERVER (flag fail-closed), tier Heritage, chrono record.
 */

import {
  activeHeritagePack,
  APRES_SEANCE_WINDOW_DAYS,
  bestLapMs,
  daysUntil,
  decideHomeMode,
  decideReserve,
  DIAL_COUNTDOWN_MAX_DAYS,
  heritageOf,
  isPersonalRecord,
  pickSessionPhotoUrl,
  pickVehicleCover,
  qdiToRadarValues,
  RITUAL_BANNER_WINDOW_DAYS,
  ritualBannerKey,
  ritualBannerText,
  seasonFact,
  shouldShowRitualBanner,
  weatherEligible,
  zeroLike,
  type HeritagePackRef,
} from '../miroirHomeLogic';

const DAY_MS = 86_400_000;
// Construit en heure LOCALE : les tests calendaires (daysUntil) restent vrais
// quel que soit le fuseau de la machine de CI.
const NOW = new Date(2026, 6, 18, 12, 0, 0);

describe('decideHomeMode — deux visages, frontière 7 jours', () => {
  it('séance d’hier → apres_seance', () => {
    expect(decideHomeMode(new Date(NOW.getTime() - DAY_MS), NOW)).toBe('apres_seance');
  });

  it('frontière exacte : 7 jours MOINS 1 ms → apres_seance', () => {
    const justInside = new Date(NOW.getTime() - (APRES_SEANCE_WINDOW_DAYS * DAY_MS - 1));
    expect(decideHomeMode(justInside, NOW)).toBe('apres_seance');
  });

  it('frontière exacte : 7 jours PILE → entre_journees', () => {
    const boundary = new Date(NOW.getTime() - APRES_SEANCE_WINDOW_DAYS * DAY_MS);
    expect(decideHomeMode(boundary, NOW)).toBe('entre_journees');
  });

  it('accepte une date ISO string', () => {
    const iso = new Date(NOW.getTime() - 2 * DAY_MS).toISOString();
    expect(decideHomeMode(iso, NOW)).toBe('apres_seance');
  });

  it('aucune séance → entre_journees', () => {
    expect(decideHomeMode(null, NOW)).toBe('entre_journees');
  });

  it('date invalide ou future (donnée suspecte) → entre_journees', () => {
    expect(decideHomeMode('pas-une-date', NOW)).toBe('entre_journees');
    expect(decideHomeMode(new Date(NOW.getTime() + DAY_MS), NOW)).toBe('entre_journees');
  });
});

describe('seasonFact — un fait factuel, jamais inventé', () => {
  it('compose séances · km · circuits depuis les stats réelles', () => {
    expect(
      seasonFact({
        totalSessions: 8,
        totalDistanceKm: 412.4,
        byCircuit: { 'Haute Saintonge': {}, Valencia: {}, 'Le Vigeant': {} },
      })
    ).toBe('8 séances · 412 km de piste · 3 circuits.');
  });

  it('singulier propre pour 1 séance / 1 circuit', () => {
    expect(
      seasonFact({ totalSessions: 1, totalDistanceKm: 42, byCircuit: { 'Haute Saintonge': {} } })
    ).toBe('1 séance · 42 km de piste · 1 circuit.');
  });

  it('omet les km à zéro et le bucket « Inconnu »', () => {
    expect(seasonFact({ totalSessions: 2, totalDistanceKm: 0, byCircuit: { Inconnu: {} } })).toBe(
      '2 séances.'
    );
  });

  it('aucune stat → null (jamais un fait inventé)', () => {
    expect(seasonFact(null)).toBeNull();
    expect(seasonFact({ totalSessions: 0, totalDistanceKm: 0, byCircuit: {} })).toBeNull();
  });
});

describe('pickVehicleCover — photo du véhicule principal', () => {
  const covers = { v1: 'https://signed/v1.jpg', v2: 'https://signed/v2.jpg' };

  it('rend la cover du PREMIER véhicule du garage', () => {
    expect(pickVehicleCover([{ id: 'v1' }, { id: 'v2' }], covers)).toBe('https://signed/v1.jpg');
  });

  it('pas de véhicule → null', () => {
    expect(pickVehicleCover([], covers)).toBeNull();
  });

  it('véhicule principal sans photo → null (pas de repli sur un autre véhicule)', () => {
    expect(pickVehicleCover([{ id: 'v3' }, { id: 'v1' }], covers)).toBeNull();
  });
});

describe('pickSessionPhotoUrl — premier média affichable de la séance', () => {
  it('prend la première PHOTO signée, ignore les vidéos', () => {
    expect(
      pickSessionPhotoUrl([
        { mediaType: 'video', signedUrl: 'https://signed/clip.mp4' },
        { mediaType: 'photo', signedUrl: undefined },
        { mediaType: 'photo', signedUrl: 'https://signed/photo.jpg' },
      ])
    ).toBe('https://signed/photo.jpg');
  });

  it('aucun média affichable → null', () => {
    expect(pickSessionPhotoUrl([])).toBeNull();
    expect(pickSessionPhotoUrl([{ mediaType: 'video', signedUrl: 'x' }])).toBeNull();
  });
});

describe('bestLapMs — meilleur tour en millisecondes', () => {
  it('minimum des tours lancés, sortie/rentrée des stands exclues', () => {
    expect(
      bestLapMs(
        [
          { duration_seconds: 60.2, is_outlap: true, is_inlap: false },
          { duration_seconds: 84.318, is_outlap: false, is_inlap: false },
          { duration_seconds: 85.1, is_outlap: false, is_inlap: false },
          { duration_seconds: 50.0, is_outlap: false, is_inlap: true },
        ],
        90
      )
    ).toBe(84_318);
  });

  it('repli sur l’agrégat de séance si les lignes laps manquent', () => {
    expect(bestLapMs([], 84.318)).toBe(84_318);
  });

  it('rien de mesurable → null (jamais un zéro d’apparence mesurée)', () => {
    expect(bestLapMs([], null)).toBeNull();
    expect(
      bestLapMs([{ duration_seconds: null, is_outlap: false, is_inlap: false }], 0)
    ).toBeNull();
  });
});

describe('isPersonalRecord — la séance porte-t-elle le record all-time', () => {
  it('égalité (le all-time inclut la séance) → record', () => {
    expect(isPersonalRecord(84.318, 84.318)).toBe(true);
  });

  it('séance plus lente que le all-time → pas un record', () => {
    expect(isPersonalRecord(85.0, 84.318)).toBe(false);
  });

  it('donnée absente → jamais un record', () => {
    expect(isPersonalRecord(null, 84.318)).toBe(false);
    expect(isPersonalRecord(84.318, null)).toBe(false);
  });
});

describe('daysUntil / weatherEligible — compte à rebours et fenêtre météo', () => {
  it('jour J → 0, demain → 1', () => {
    expect(daysUntil('2026-07-18', NOW)).toBe(0);
    expect(daysUntil('2026-07-19', NOW)).toBe(1);
  });

  it('journée passée ou date invalide → null', () => {
    expect(daysUntil('2026-07-17', NOW)).toBeNull();
    expect(daysUntil('bientot', NOW)).toBeNull();
  });

  it('météo affichée à 7 jours ou moins, silence au-delà', () => {
    expect(weatherEligible('2026-07-25', NOW)).toBe(true); // J+7
    expect(weatherEligible('2026-07-26', NOW)).toBe(false); // J+8
  });

  it('l’horizon du cadran countdown est figé à 30 jours', () => {
    expect(DIAL_COUNTDOWN_MAX_DAYS).toBe(30);
  });
});

describe('qdiToRadarValues — branches nulles MASQUÉES, jamais tirées à zéro', () => {
  it('omet les branches nulles et garde les mesurées', () => {
    expect(
      qdiToRadarValues({
        trajectoire: 62,
        fluidite: null,
        freinage: 48,
        acceleration: undefined,
        regularite: 71,
      })
    ).toEqual({ trajectoire: 62, freinage: 48, regularite: 71 });
  });

  it('aucun QDI → objet vide', () => {
    expect(qdiToRadarValues(null)).toEqual({});
    expect(qdiToRadarValues(undefined)).toEqual({});
  });
});

describe('decideReserve — gating flag app_payments (fail-closed)', () => {
  it('flag OFF → porte Club + intention mesurée (reserve_intent)', () => {
    expect(decideReserve(false)).toEqual({
      href: '/(app2)/club',
      analyticsEvent: 'reserve_intent',
    });
  });

  it('flag ON → même porte tant que le flux A1 (lot L4) n’existe pas', () => {
    expect(decideReserve(true)).toEqual({ href: '/(app2)/club', analyticsEvent: 'reserve_intent' });
  });
});

describe('heritageOf — tier Heritage depuis les inscriptions', () => {
  it('inscription effective la plus récente Heritage → tier', () => {
    expect(
      heritageOf([
        { offer_type: 'heritage', status: 'confirmed' },
        { offer_type: 'signature', status: 'attended' },
      ])
    ).toEqual({ isHeritage: true });
  });

  it('inscription effective la plus récente NON Heritage → pas de tier', () => {
    expect(
      heritageOf([
        { offer_type: 'signature', status: 'confirmed' },
        { offer_type: 'heritage', status: 'attended' },
      ])
    ).toEqual({ isHeritage: false });
  });

  it('une Heritage annulée ne donne pas le tier ; aucune inscription → rien', () => {
    expect(heritageOf([{ offer_type: 'heritage', status: 'cancelled' }]).isHeritage).toBe(false);
    expect(heritageOf([])).toEqual({ isHeritage: false });
  });
});

describe('activeHeritagePack — compteur x/y depuis les VRAIES colonnes heritage_packs', () => {
  const row = (over: Partial<HeritagePackRef> = {}): HeritagePackRef => ({
    sessions_used: 2,
    sessions_total: 4,
    status: 'active',
    valid_until: '2026-12-31',
    ...over,
  });

  it('pack actif → used/total lus tels quels (jamais un /4 codé en dur)', () => {
    expect(activeHeritagePack(row(), NOW)).toEqual({ used: 2, total: 4 });
    expect(activeHeritagePack(row({ sessions_used: 0, sessions_total: 6 }), NOW)).toEqual({
      used: 0,
      total: 6,
    });
  });

  it('aucun pack, pack completed/expired → null (cellule SÉANCES à la place)', () => {
    expect(activeHeritagePack(null, NOW)).toBeNull();
    expect(activeHeritagePack(row({ status: 'completed' }), NOW)).toBeNull();
    expect(activeHeritagePack(row({ status: 'expired' }), NOW)).toBeNull();
  });

  it('valid_until passé → null (ceinture-bretelles), jour même encore valide', () => {
    expect(activeHeritagePack(row({ valid_until: '2026-07-17' }), NOW)).toBeNull();
    expect(activeHeritagePack(row({ valid_until: '2026-07-18' }), NOW)).toEqual({
      used: 2,
      total: 4,
    });
  });

  it('total non mesurable (0, null) → null — jamais un dénominateur inventé', () => {
    expect(activeHeritagePack(row({ sessions_total: 0 }), NOW)).toBeNull();
    expect(activeHeritagePack(row({ sessions_total: null }), NOW)).toBeNull();
    expect(activeHeritagePack(row({ sessions_used: null }), NOW)).toBeNull();
  });
});

describe('bandeau rituel J-3 — B3 minimal, données réelles', () => {
  it('fenêtre J-3..J-0 uniquement (journée réelle)', () => {
    expect(RITUAL_BANNER_WINDOW_DAYS).toBe(3);
    expect(shouldShowRitualBanner(0)).toBe(true);
    expect(shouldShowRitualBanner(3)).toBe(true);
    expect(shouldShowRitualBanner(4)).toBe(false);
    expect(shouldShowRitualBanner(null)).toBe(false);
  });

  it('clé de dismiss par JOURNÉE — une nouvelle journée ré-affiche', () => {
    expect(ritualBannerKey('2026-07-21')).toBe('miroir:rituelJ3:2026-07-21');
  });

  it('texte factuel : compte à rebours réel + circuit réel, jamais inventé', () => {
    expect(ritualBannerText(3, 'Circuit de Haute Saintonge')).toBe(
      'J-3 · Circuit de Haute Saintonge. Votre préparation vous attend.'
    );
    expect(ritualBannerText(0, 'Circuit de Haute Saintonge')).toBe(
      'Jour J · Circuit de Haute Saintonge. Votre préparation vous attend.'
    );
    expect(ritualBannerText(2, null)).toBe('J-2. Votre préparation vous attend.');
  });
});

describe('zeroLike — gabarit de départ du RollingCounter', () => {
  it('remet tous les digits à 0, séparateurs intacts', () => {
    expect(zeroLike('1:24.318')).toBe('0:00.000');
    expect(zeroLike('412')).toBe('000');
    expect(zeroLike('2/4')).toBe('0/0');
  });

  it('label sans digit inchangé', () => {
    expect(zeroLike('—')).toBe('—');
  });
});
