/**
 * Le suivi d'incident dit ce qu'il sait, et signale ce qu'il ignore.
 *
 * `incident_followups.state` n'a AUCUNE contrainte en base — vérifié le
 * 05/08/2026. N'importe quelle chaîne peut y entrer. Ces tests garantissent
 * qu'aucune ne casse l'écran, qu'aucune ne se voit inventer un sens, et
 * qu'aucune ne disparaît en silence.
 */

import {
  dateCourte,
  etatCourant,
  libelleEtat,
  suivisAffichables,
  type SuiviBrut,
} from '../incidentSuiviLogic';

describe('libelleEtat — traduire ce qu’on connaît, signaler le reste', () => {
  it('traduit les trois états connus', () => {
    expect(libelleEtat('recu')).toEqual({ texte: 'Reçue', inconnu: false });
    // « traite », et non « en_examen » : c'est le vocabulaire du CHECK de
    // `incident_followups`. L'application nommait un état que la contrainte
    // refuse — corrigé le 14/08.
    expect(libelleEtat('traite').texte).toBe('En cours de traitement');
    expect(libelleEtat('clos').texte).toBe('Clôturée');
  });

  /**
   * LE VOCABULAIRE VIENT DE LA BASE, PAS DE L'APPLICATION.
   *
   * `en_examen` était le mot de ce module ; le CHECK ne connaît que
   * `('recu','traite','clos')`. Une ligne n'a donc jamais pu le porter, et une
   * écriture applicative l'aurait vu rejeter.
   */
  it('« en_examen » n’est PAS un état connu — le CHECK ne l’accepte pas', () => {
    expect(libelleEtat('en_examen').inconnu).toBe(true);
  });

  it('tolère la casse et les espaces — la base ne les garantit pas', () => {
    expect(libelleEtat('  RECU ').texte).toBe('Reçue');
  });

  /**
   * LE CAS QUI COMPTE. Sans contrainte en base, un administrateur peut écrire
   * « en cours de traitement ». L'application ne doit ni casser, ni prétendre
   * comprendre, ni masquer la ligne.
   */
  it('un état inconnu se rend tel quel, marqué inconnu', () => {
    const l = libelleEtat('en cours de traitement');
    expect(l.inconnu).toBe(true);
    expect(l.texte).toBe('en cours de traitement');
  });

  it('un état vide ou absent se dit, il ne s’invente pas', () => {
    for (const v of [null, undefined, '', '   ']) {
      const l = libelleEtat(v);
      expect(l.inconnu).toBe(true);
      expect(l.texte).toBe('État non communiqué');
    }
  });
});

describe('suivisAffichables — du plus récent au plus ancien', () => {
  const brut = (id: string, state: string, created_at: string | null): SuiviBrut => ({
    id,
    state,
    note: null,
    created_at,
  });

  it('ordonne par récence', () => {
    const r = suivisAffichables([
      brut('a', 'recu', '2026-08-01T10:00:00Z'),
      brut('c', 'clos', '2026-08-03T10:00:00Z'),
      brut('b', 'traite', '2026-08-02T10:00:00Z'),
    ]);
    expect(r.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('une ligne sans horodatage lisible EXISTE quand même, en fin', () => {
    // L'écarter la ferait disparaître de l'historique du pilote sans que rien
    // ne le dise. Elle passe en fin, elle se voit.
    const r = suivisAffichables([
      brut('sansDate', 'recu', null),
      brut('avecDate', 'clos', '2026-08-03T10:00:00Z'),
    ]);
    expect(r.map((s) => s.id)).toEqual(['avecDate', 'sansDate']);
    expect(r).toHaveLength(2);
  });

  it('une note vide devient absente, jamais une chaîne vide affichée', () => {
    const r = suivisAffichables([
      { id: 'x', state: 'recu', note: '   ', created_at: '2026-08-01T10:00:00Z' },
    ]);
    expect(r[0].note).toBeNull();
  });

  it('n’altère pas la liste reçue', () => {
    const entree = [brut('a', 'recu', '2026-08-01T10:00:00Z')];
    const copie = [...entree];
    suivisAffichables(entree);
    expect(entree).toEqual(copie);
  });
});

describe('etatCourant — l’absence de suivi est un fait, pas un vide', () => {
  /**
   * Aucun suivi ne veut pas dire « rien ne se passe ». Laisser un blanc ferait
   * lire un oubli là où il y a une déclaration reçue et pas encore examinée.
   */
  it('sans suivi, la déclaration est reçue et pas encore examinée', () => {
    const e = etatCourant([]);
    expect(e.texte).toBe('Reçue, pas encore examinée');
    expect(e.inconnu).toBe(false);
  });

  it('avec suivis, c’est le plus récent qui fait foi', () => {
    const s = suivisAffichables([
      { id: 'a', state: 'recu', note: null, created_at: '2026-08-01T10:00:00Z' },
      { id: 'b', state: 'clos', note: null, created_at: '2026-08-03T10:00:00Z' },
    ]);
    expect(etatCourant(s).texte).toBe('Clôturée');
  });
});

describe('dateCourte — jamais « Invalid Date »', () => {
  it('rend null sur un horodatage illisible', () => {
    expect(dateCourte('pas une date')).toBeNull();
    expect(dateCourte('')).toBeNull();
  });

  it('rend une date française sur un horodatage valide', () => {
    const d = dateCourte('2026-08-03T14:30:00Z');
    expect(d).not.toBeNull();
    expect(d).not.toContain('Invalid');
  });
});
