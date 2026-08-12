/**
 * Le Pass d'une journée de circuit — ce que l'ancien Pass ne pouvait pas dire.
 *
 * `event_registrations` est VIDE en production : le Pass affichait « aucune
 * inscription » à tous les pilotes, y compris à ceux qui avaient réservé et
 * payé sur le site. Ces tests tiennent la lecture des vraies tables — bornes
 * de journée, journée privée illisible, QR fail-closed, vocabulaire réel.
 */

import {
  LIBELLES_OFFRE,
  LIBELLES_STATUT,
  debutJourneeMs,
  finJourneeMs,
  libelleCreneau,
  libelleOffre,
  libelleStatut,
  ligneHoraire,
  ligneJournee,
  partagerJournees,
  prochaineJourneeAvecQr,
  qrAffichable,
  raisonSansQr,
  statutActif,
  type InscriptionLike,
  type JourneeLike,
} from '../passJourneeLogic';

const j = (over: Partial<JourneeLike> = {}): JourneeLike => ({
  date: '2026-08-20',
  startTime: '09:00:00',
  endTime: '18:00:00',
  circuitName: 'Haute Saintonge',
  format: null,
  ...over,
});

const insc = (over: Partial<InscriptionLike> = {}): InscriptionLike => ({
  registrationId: 'r1',
  status: 'confirmed',
  offerType: 'signature',
  slot: null,
  journee: j(),
  ...over,
});

const LE_19 = new Date(2026, 7, 19, 12, 0, 0).getTime();
const LE_21 = new Date(2026, 7, 21, 12, 0, 0).getTime();

describe('les bornes de la journée', () => {
  it('l’heure de fin fait la borne quand elle existe', () => {
    const fin = finJourneeMs(j({ endTime: '18:00:00' }));
    expect(new Date(fin as number).getHours()).toBe(18);
  });

  /**
   * LE DÉFAUT ÉVITÉ. Sans heure de fin, prendre minuit UTC ferait disparaître
   * la journée de l'écran pendant que le pilote roule — deux heures avant le
   * coucher du soleil, en été.
   */
  it('sans heure de fin, la borne est la fin du jour LOCAL', () => {
    const fin = finJourneeMs(j({ endTime: null })) as number;
    const d = new Date(fin);
    expect(d.getHours()).toBe(23);
    expect(d.getDate()).toBe(20);
  });

  it('une date illisible ne produit pas une borne inventée', () => {
    expect(finJourneeMs(j({ date: 'bientôt' }))).toBeNull();
    expect(debutJourneeMs(j({ date: '' }))).toBeNull();
  });

  it('sans heure de début, la journée commence au début du jour', () => {
    const d = new Date(debutJourneeMs(j({ startTime: null })) as number);
    expect(d.getHours()).toBe(0);
  });
});

describe('le partage — à venir, historique, et ce qu’on ne peut pas lire', () => {
  it('une journée confirmée à demain est à venir', () => {
    const p = partagerJournees([insc()], LE_19);
    expect(p.aVenir).toHaveLength(1);
    expect(p.historique).toHaveLength(0);
  });

  it('la même journée, le lendemain, est passée', () => {
    const p = partagerJournees([insc()], LE_21);
    expect(p.aVenir).toHaveLength(0);
    expect(p.historique).toHaveLength(1);
  });

  it('une annulation ne reste pas « à venir » même dans le futur', () => {
    const p = partagerJournees([insc({ status: 'cancelled' })], LE_19);
    expect(p.aVenir).toHaveLength(0);
    expect(p.historique).toHaveLength(1);
  });

  /**
   * Le règlement en attente est PRÉCISÉMENT le moment où l'information sert :
   * la journée est réservée, elle n'est pas réglée, et le pilote doit la voir
   * venir pour agir.
   */
  it('un règlement en attente reste à venir', () => {
    const p = partagerJournees([insc({ status: 'pending_payment' })], LE_19);
    expect(p.aVenir).toHaveLength(1);
  });

  /**
   * LE SILENCE CORRIGÉ. L'ancien partage écartait des DEUX listes toute
   * inscription dont l'événement n'était pas lisible. Un pilote inscrit à une
   * journée privée — que la RLS `sessions` ne lui ouvre pas — payait et ne
   * voyait rien.
   */
  it('une journée illisible n’est pas jetée : elle forme son propre groupe', () => {
    const p = partagerJournees([insc({ journee: null })], LE_19);
    expect(p.aVenir).toHaveLength(0);
    expect(p.historique).toHaveLength(0);
    expect(p.illisibles).toHaveLength(1);
  });

  it('une date illisible tombe dans l’historique, jamais dans « à venir »', () => {
    // Annoncer « à venir » sans pouvoir situer la journée serait une
    // affirmation sans fondement.
    const p = partagerJournees([insc({ journee: j({ date: 'x' }) })], LE_19);
    expect(p.aVenir).toHaveLength(0);
    expect(p.historique).toHaveLength(1);
  });

  it('à venir : la plus proche d’abord ; historique : la plus récente d’abord', () => {
    const a = insc({ registrationId: 'a', journee: j({ date: '2026-09-01' }) });
    const b = insc({ registrationId: 'b', journee: j({ date: '2026-08-25' }) });
    const vieux1 = insc({ registrationId: 'v1', journee: j({ date: '2026-01-10' }) });
    const vieux2 = insc({ registrationId: 'v2', journee: j({ date: '2026-03-10' }) });

    const p = partagerJournees([a, b, vieux1, vieux2], LE_19);
    expect(p.aVenir.map((x) => x.registrationId)).toEqual(['b', 'a']);
    expect(p.historique.map((x) => x.registrationId)).toEqual(['v2', 'v1']);
  });

  it('aucune inscription, trois listes vides — rien d’inventé', () => {
    const p = partagerJournees([], LE_19);
    expect(p).toEqual({ aVenir: [], historique: [], illisibles: [] });
  });
});

describe('le QR de pointage — fail-closed', () => {
  /**
   * Un QR présenté au portail pour une journée non réglée fait vivre au pilote
   * un refus devant les autres. Mieux vaut qu'il voie ce qui manque la veille,
   * dans l'application.
   */
  it('seules une journée confirmée et une présence donnent un QR', () => {
    expect(qrAffichable('confirmed')).toBe(true);
    expect(qrAffichable('attended')).toBe(true);
    for (const s of ['pending', 'pending_payment', 'cancelled', 'no_show', 'inconnu']) {
      expect(qrAffichable(s)).toBe(false);
    }
  });

  it('l’absence de QR se dit, et sans reproche', () => {
    expect(raisonSansQr('confirmed')).toBeNull();
    const raisons = [
      raisonSansQr('pending_payment'),
      raisonSansQr('pending'),
      raisonSansQr('cancelled'),
    ];
    for (const r of raisons) {
      expect(r).not.toBeNull();
      // L'application ne sait pas POURQUOI le règlement n'est pas passé.
      expect(r).not.toMatch(/vous n’avez pas|vous devez|oubli|impayé|relance/i);
      expect(r).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('statutActif et qrAffichable ne disent pas la même chose', () => {
    // Une journée réservée non réglée se voit venir, sans donner de QR.
    expect(statutActif('pending_payment')).toBe(true);
    expect(qrAffichable('pending_payment')).toBe(false);
  });
});

describe('la journée à présenter au paddock', () => {
  it('la plus proche dont le QR est valable', () => {
    const proche = insc({ registrationId: 'proche', journee: j({ date: '2026-08-25' }) });
    const loin = insc({ registrationId: 'loin', journee: j({ date: '2026-09-30' }) });
    expect(prochaineJourneeAvecQr([loin, proche], LE_19)?.registrationId).toBe('proche');
  });

  /**
   * Le paddock est le pire endroit pour découvrir qu'un code ne passe pas :
   * il y a la file, et les autres. Une journée non réglée est visible dans
   * le Pass — elle ne produit pas de QR ici.
   */
  it('une journée réservée non réglée ne produit pas de QR au paddock', () => {
    const impaye = insc({ status: 'pending_payment', journee: j({ date: '2026-08-25' }) });
    expect(prochaineJourneeAvecQr([impaye], LE_19)).toBeNull();
  });

  it('elle saute l’inéligible pour prendre la suivante', () => {
    const impaye = insc({
      registrationId: 'impaye',
      status: 'pending_payment',
      journee: j({ date: '2026-08-25' }),
    });
    const ok = insc({ registrationId: 'ok', journee: j({ date: '2026-09-01' }) });
    expect(prochaineJourneeAvecQr([ok, impaye], LE_19)?.registrationId).toBe('ok');
  });

  it('aucune journée à venir, aucun QR', () => {
    expect(prochaineJourneeAvecQr([], LE_19)).toBeNull();
    expect(prochaineJourneeAvecQr([insc()], LE_21)).toBeNull();
  });
});

describe('les libellés — l’énumération réelle', () => {
  it('les quatre offres de `offer_type_enum`', () => {
    expect(libelleOffre('access')).toBe('Accès');
    expect(libelleOffre('signature')).toBe('Signature');
    expect(libelleOffre('promotion')).toBe('Promotion');
    expect(libelleOffre('heritage')).toBe('Héritage');
  });

  it('les six statuts de `registration_status_enum`', () => {
    for (const s of [
      'pending',
      'confirmed',
      'cancelled',
      'attended',
      'no_show',
      'pending_payment',
    ]) {
      expect(libelleStatut(s)).not.toBe(s);
    }
  });

  it('une valeur inconnue se rend telle quelle, jamais masquée', () => {
    // Un libellé manquant est un fait à voir, pas une case à cacher.
    expect(libelleOffre('nouveau_type')).toBe('nouveau_type');
    expect(libelleStatut('nouveau_statut')).toBe('nouveau_statut');
  });

  it('le créneau se dit, et son absence ne fabrique rien', () => {
    expect(libelleCreneau('morning')).toBe('Matin');
    expect(libelleCreneau('afternoon')).toBe('Après-midi');
    expect(libelleCreneau('full')).toBe('Journée complète');
    expect(libelleCreneau(null)).toBeNull();
    expect(libelleCreneau('   ')).toBeNull();
    // Une valeur non prévue s'affiche plutôt que de disparaître.
    expect(libelleCreneau('soirée')).toBe('soirée');
  });
});

describe('l’horaire seul — la carte porte déjà le circuit en titre', () => {
  /**
   * LE DOUBLON TROUVÉ SUR LA DONNÉE RÉELLE, pas en test. La carte affichait
   * « HAUTE SAINTONGE » en titre, puis « Haute Saintonge · 09h00 – 17h30 »
   * juste dessous. Chaque fonction était juste ; c'est leur composition qui ne
   * l'était pas, et aucun test unitaire ne pouvait le voir.
   */
  it('l’horaire ne répète pas le circuit', () => {
    expect(ligneHoraire(j())).toBe('09h00 – 18h00');
    expect(ligneHoraire(j())).not.toContain('Saintonge');
  });

  it('sans heure de fin, on ne fabrique pas la fin', () => {
    expect(ligneHoraire(j({ endTime: null }))).toBe('à partir de 09h00');
  });

  it('sans heure du tout, la chaîne est vide — l’appelant n’affiche rien', () => {
    expect(ligneHoraire(j({ startTime: null, endTime: null }))).toBe('');
  });
});

describe('la ligne de journée — rien de plus que ce qu’on sait', () => {
  it('circuit et horaire quand les deux existent', () => {
    expect(ligneJournee(j())).toBe('Haute Saintonge · 09h00 – 18h00');
  });

  it('sans circuit, l’horaire porte seul la ligne', () => {
    // On n'écrit PAS « Circuit » : ce serait un mot pour cacher une absence.
    expect(ligneJournee(j({ circuitName: null }))).toBe('09h00 – 18h00');
  });

  it('sans heure de fin, on ne fabrique pas la fin', () => {
    expect(ligneJournee(j({ endTime: null }))).toBe('Haute Saintonge · à partir de 09h00');
  });

  it('sans rien, la ligne est vide plutôt que fausse', () => {
    expect(ligneJournee(j({ circuitName: null, startTime: null, endTime: null }))).toBe('');
  });
});

describe('ton OXV', () => {
  const textes = [
    ...Object.values(LIBELLES_OFFRE),
    ...Object.values(LIBELLES_STATUT),
    raisonSansQr('pending_payment') ?? '',
    raisonSansQr('pending') ?? '',
    raisonSansQr('cancelled') ?? '',
  ];

  it('aucun mot proscrit, aucun emoji, aucun tutoiement', () => {
    for (const t of textes) {
      expect(t).not.toMatch(/\blimite/i);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });
});
