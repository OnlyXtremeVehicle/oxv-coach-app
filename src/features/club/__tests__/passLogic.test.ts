/**
 * Tests purs — logique de l'écran PASS OXV (V2-L5, mission C, 7/7).
 *
 * Points verrouillés : partage à venir / historique (tri, frontière endsAt,
 * annulé → historique, sans événement → écarté), éligibilité QR, charge utile
 * QR identique au flux v1, libellés. Verrou DOCTRINAL : un pass est un fait
 * d'inscription — aucun classement, aucun chrono d'autrui.
 */

import {
  canShowQr,
  isActiveStatus,
  offerLabel,
  passEmptyCta,
  qrCheckinPayload,
  splitPasses,
  statusLabel,
  type PassLike,
} from '../passLogic';

function pass(
  id: string,
  status: string,
  startsAt: string | null,
  endsAt: string | null
): PassLike {
  return {
    registrationId: id,
    status,
    event:
      startsAt === null || endsAt === null
        ? null
        : {
            name: `Journée ${id}`,
            eventType: 'session',
            locationName: 'Circuit de Haute Saintonge',
            startsAt,
            endsAt,
          },
  };
}

const NOW = Date.parse('2026-07-19T12:00:00Z');

describe('splitPasses', () => {
  it('à venir : événement lisible, actif, fin >= maintenant — trié du plus proche', () => {
    const regs = [
      pass('b', 'registered', '2026-08-10T09:00:00Z', '2026-08-10T18:00:00Z'),
      pass('a', 'checked_in', '2026-07-25T09:00:00Z', '2026-07-25T18:00:00Z'),
    ];
    const { upcoming } = splitPasses(regs, NOW);
    expect(upcoming.map((r) => r.registrationId)).toEqual(['a', 'b']);
  });

  it('journée passée → historique (trié du plus récent)', () => {
    const regs = [
      pass('old1', 'checked_in', '2026-05-01T09:00:00Z', '2026-05-01T18:00:00Z'),
      pass('old2', 'checked_in', '2026-06-01T09:00:00Z', '2026-06-01T18:00:00Z'),
    ];
    const { upcoming, history } = splitPasses(regs, NOW);
    expect(upcoming).toEqual([]);
    expect(history.map((r) => r.registrationId)).toEqual(['old2', 'old1']);
  });

  it('annulée / absente → historique même si la journée est future', () => {
    const regs = [
      pass('canc', 'cancelled', '2026-08-01T09:00:00Z', '2026-08-01T18:00:00Z'),
      pass('noshow', 'no_show', '2026-08-02T09:00:00Z', '2026-08-02T18:00:00Z'),
    ];
    const { upcoming, history } = splitPasses(regs, NOW);
    expect(upcoming).toEqual([]);
    expect(history.map((r) => r.registrationId).sort()).toEqual(['canc', 'noshow']);
  });

  it('frontière endsAt : fin exactement = maintenant reste à venir', () => {
    const iso = new Date(NOW).toISOString();
    const regs = [pass('edge', 'registered', '2026-07-19T09:00:00Z', iso)];
    const { upcoming } = splitPasses(regs, NOW);
    expect(upcoming.map((r) => r.registrationId)).toEqual(['edge']);
  });

  it('sans événement lisible (RLS) → écarté des deux listes', () => {
    const regs = [pass('hidden', 'registered', null, null)];
    const { upcoming, history } = splitPasses(regs, NOW);
    expect(upcoming).toEqual([]);
    expect(history).toEqual([]);
  });
});

describe('QR & statuts', () => {
  it('isActiveStatus / canShowQr — inscrit & présent seulement', () => {
    expect(isActiveStatus('registered')).toBe(true);
    expect(isActiveStatus('checked_in')).toBe(true);
    expect(isActiveStatus('cancelled')).toBe(false);
    expect(canShowQr('registered')).toBe(true);
    expect(canShowQr('no_show')).toBe(false);
  });

  it('qrCheckinPayload — charge utile identique au flux pass-oxv v1', () => {
    expect(qrCheckinPayload('reg-123')).toBe('oxv:checkin:reg-123');
  });

  it('offerLabel / statusLabel — connus et repli', () => {
    expect(offerLabel('session')).toBe('Session circuit');
    expect(offerLabel('inconnu')).toBe('inconnu');
    expect(statusLabel('checked_in')).toBe('Présent');
    expect(statusLabel('???')).toBe('???');
  });
});

describe('passEmptyCta — fail-closed sur le drapeau paiement', () => {
  it('paiements armés → réserver ; sinon → club', () => {
    expect(passEmptyCta(true)).toBe('reserve');
    expect(passEmptyCta(false)).toBe('club');
  });
});

describe('doctrine — un pass est un fait, jamais un classement', () => {
  it('les entrées à venir ne portent aucun champ de rang / chrono', () => {
    const regs = [pass('a', 'registered', '2026-07-25T09:00:00Z', '2026-07-25T18:00:00Z')];
    const { upcoming } = splitPasses(regs, NOW);
    const forbidden = ['rank', 'score', 'lapTime', 'chrono', 'position', 'ranking', 'winner'];
    for (const key of Object.keys(upcoming[0])) expect(forbidden).not.toContain(key);
    for (const key of Object.keys(upcoming[0].event ?? {})) expect(forbidden).not.toContain(key);
  });
});
