import {
  FUSEAU_PAR_DEFAUT,
  HEURE_DEBUT_SILENCE,
  HEURE_FIN_SILENCE,
  dansLaNuit,
  delaiApresReport,
  heureLocale,
  instantDeLivraison,
} from '../reportNocturne';

/**
 * Un instant, écrit en heure de Paris, rendu en UTC.
 *
 * Un premier jet formait la chaîne `${heure - 2}` : à minuit et à 1 h, cela
 * donnait « T-2 » et « T-1 » — une date invalide, et deux tests rouges qui
 * accusaient la logique alors que le fixture était en cause. On construit donc
 * l'instant, on ne l'écrit pas.
 */
function paris(jour: string, heure: number, minutes = 0): Date {
  const [a, m, j] = jour.split('-').map(Number);
  // Juillet : Paris est à UTC+2. Le décalage peut faire reculer d'un jour ;
  // `Date.UTC` s'en charge, contrairement à une chaîne.
  return new Date(Date.UTC(a, m - 1, j, heure - 2, minutes, 0));
}

describe('heureLocale', () => {
  it('rend bien l’heure du fuseau demandé, pas celle de la machine', () => {
    const midiUtc = new Date('2026-07-15T12:00:00Z');
    expect(heureLocale(midiUtc, 'Europe/Paris')).toBe(14); // UTC+2 en été
    expect(heureLocale(midiUtc, 'UTC')).toBe(12);
  });

  it('rend 0 à minuit, jamais 24', () => {
    // Minuit à Paris en juillet = 22h UTC la veille.
    expect(heureLocale(new Date('2026-07-14T22:00:00Z'), 'Europe/Paris')).toBe(0);
  });

  it('rend null sur un fuseau que le moteur ne connaît pas', () => {
    expect(heureLocale(new Date(), 'Mars/Olympus_Mons')).toBeNull();
  });
});

describe('dansLaNuit', () => {
  it('reconnaît la fenêtre qui enjambe minuit', () => {
    for (const h of [22, 23, 0, 1, 4, 7]) {
      expect(dansLaNuit(paris('2026-07-15', h), 'Europe/Paris')).toBe(true);
    }
  });

  it('laisse le jour tranquille', () => {
    for (const h of [8, 9, 12, 18, 21]) {
      expect(dansLaNuit(paris('2026-07-15', h), 'Europe/Paris')).toBe(false);
    }
  });

  it('les bornes appartiennent au bon camp', () => {
    // 22 h 00 : silence. 8 h 00 : plus silence.
    expect(dansLaNuit(paris('2026-07-15', HEURE_DEBUT_SILENCE), 'Europe/Paris')).toBe(true);
    expect(dansLaNuit(paris('2026-07-15', HEURE_FIN_SILENCE), 'Europe/Paris')).toBe(false);
  });

  it('ne diffère pas quand le fuseau est illisible — mieux vaut à l’heure que faux', () => {
    expect(dansLaNuit(paris('2026-07-15', 23), 'Mars/Olympus_Mons')).toBe(false);
  });
});

describe('instantDeLivraison', () => {
  it('le cas nommé par le plan : un bilan prêt à 23h40 part le lendemain matin', () => {
    const prevu = paris('2026-07-15', 23, 40);
    const livre = instantDeLivraison(prevu, 'Europe/Paris');
    expect(heureLocale(livre, 'Europe/Paris')).toBe(8);
    // Le lendemain, pas le surlendemain.
    expect(livre.getTime() - prevu.getTime()).toBeLessThan(9 * 60 * 60 * 1000);
    expect(livre.getTime()).toBeGreaterThan(prevu.getTime());
  });

  it('depuis le petit matin, il attend 8 h du MÊME jour', () => {
    const prevu = paris('2026-07-15', 3, 20);
    const livre = instantDeLivraison(prevu, 'Europe/Paris');
    expect(heureLocale(livre, 'Europe/Paris')).toBe(8);
    expect(livre.getTime() - prevu.getTime()).toBeLessThan(5 * 60 * 60 * 1000);
  });

  it('IL DIFFÈRE, IL N’ANNULE PAS — la livraison existe toujours', () => {
    for (const h of [22, 23, 0, 3, 7]) {
      const livre = instantDeLivraison(paris('2026-07-15', h), 'Europe/Paris');
      expect(livre).toBeInstanceOf(Date);
      expect(Number.isFinite(livre.getTime())).toBe(true);
    }
  });

  it("il n'AVANCE jamais rien", () => {
    for (const h of [8, 12, 18, 21]) {
      const prevu = paris('2026-07-15', h, 37);
      expect(instantDeLivraison(prevu, 'Europe/Paris').getTime()).toBe(prevu.getTime());
    }
  });

  it('livre à l’heure ronde, pas à 8 h 37', () => {
    const livre = instantDeLivraison(paris('2026-07-15', 23, 37), 'Europe/Paris');
    expect(livre.getUTCMinutes()).toBe(0);
    expect(livre.getUTCSeconds()).toBe(0);
  });

  it('respecte le fuseau du PILOTE, pas celui du serveur', () => {
    // 23 h à Paris, c'est 17 h à Montréal : rien à différer là-bas.
    const prevu = paris('2026-07-15', 23);
    expect(instantDeLivraison(prevu, 'America/Montreal').getTime()).toBe(prevu.getTime());
    expect(instantDeLivraison(prevu, 'Europe/Paris').getTime()).toBeGreaterThan(prevu.getTime());
  });

  it('sans fuseau connu, il retombe sur celui du circuit', () => {
    const prevu = paris('2026-07-15', 23, 40);
    expect(instantDeLivraison(prevu).getTime()).toBe(
      instantDeLivraison(prevu, FUSEAU_PAR_DEFAUT).getTime()
    );
  });
});

describe('delaiApresReport', () => {
  it('allonge le délai quand la cible tombe dans la nuit', () => {
    // Il est 23 h 40 ; la notification est prévue dans 24 h, donc à 23 h 40.
    const maintenant = paris('2026-07-15', 23, 40);
    const vingtQuatreH = 24 * 60 * 60 * 1000;
    const delai = delaiApresReport(vingtQuatreH, 'Europe/Paris', maintenant);
    expect(delai).toBeGreaterThan(vingtQuatreH);
    const livraison = new Date(maintenant.getTime() + delai);
    expect(heureLocale(livraison, 'Europe/Paris')).toBe(8);
  });

  it('ne touche à rien quand la cible tombe en journée', () => {
    const maintenant = paris('2026-07-15', 14);
    const vingtQuatreH = 24 * 60 * 60 * 1000;
    expect(delaiApresReport(vingtQuatreH, 'Europe/Paris', maintenant)).toBe(vingtQuatreH);
  });

  it('ne rend jamais un délai négatif', () => {
    const maintenant = paris('2026-07-15', 14);
    expect(delaiApresReport(-1000, 'Europe/Paris', maintenant)).toBe(0);
  });
});
