/**
 * RIEN NE PART AVANT L'ACCORD.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `app/_layout.tsx` émettait `trackEvent('app_ouverte')` dans l'effet de montage
 * de la racine, sans condition. La mesure d'audience était en OPT-OUT — active
 * par défaut — et le seul interrupteur vivait dans Réglages, un écran situé
 * derrière la connexion.
 *
 * Le premier évènement d'un pilote partait donc au tout premier lancement :
 * avant l'écran de connexion, donc avant les cases « J'accepte les CGU » et
 * « J'ai lu la Politique de confidentialité ». Quelqu'un qui installait,
 * ouvrait, puis désinstallait sans jamais créer de compte avait déjà été compté.
 *
 * Et la Politique de confidentialité embarquée dans l'application (§8.3) dit au
 * présent que l'outil est seulement « prévu », et **promet** que « lorsque cet
 * outil sera activé, la présente politique sera mise à jour ». Plausible est
 * pourtant câblé dans `eas.json` pour les profils preview ET production.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT
 *
 * Que l'absence d'accord ferme l'émission. Pas qu'elle la « déconseille » : la
 * garde doit se déclencher, et ces tests échouent si elle disparaît.
 *
 * Ils ne disent RIEN de la question juridique — quel texte doit figurer en
 * §8.3, et si la mesure d'audience doit être active. Cet arbitrage appartient au
 * fondateur ; le code, lui, ne doit pas trancher à sa place en émettant.
 */

const envoyes: string[] = [];

// MMKV n'existe pas sous Jest : on simule un stockage en mémoire, avec le même
// comportement de lecture (`getBoolean` rend `undefined` si la clé est absente).
const memoire = new Map<string, boolean>();
/** Simule un stockage en panne, sans `jest.doMock` — voir plus bas pourquoi. */
const panne = { active: false };
jest.mock('@/lib/mmkv', () => ({
  storage: {
    getBoolean: (k: string) => {
      if (panne.active) throw new Error('stockage indisponible');
      return memoire.get(k);
    },
    set: (k: string, v: boolean) => {
      if (panne.active) throw new Error('stockage indisponible');
      memoire.set(k, v);
    },
  },
}));

describe('mesure d’audience — le consentement commande', () => {
  beforeEach(() => {
    memoire.clear();
    panne.active = false;
    envoyes.length = 0;
    jest.resetModules();
    process.env.EXPO_PUBLIC_PLAUSIBLE_DOMAIN = 'exemple.test';
    // On observe l'émission réseau elle-même : c'est le seul fait qui compte.
    global.fetch = jest.fn((url: unknown) => {
      envoyes.push(String(url));
      return Promise.resolve({ ok: true } as Response);
    }) as unknown as typeof fetch;
  });

  it('sans accord, RIEN ne part — même domaine configuré', async () => {
    const { trackEvent } = await import('@/services/analyticsService');
    trackEvent('app_ouverte');
    expect(envoyes).toEqual([]);
  });

  it('un stockage illisible vaut refus, jamais accord', async () => {
    // Fail-closed : si l'on ne SAIT pas, on n'émet pas. Une garde qui laisse
    // passer en cas de doute ne protège que les jours où tout va bien.
    //
    // La panne se déclenche par un INTERRUPTEUR, pas par `jest.doMock`. Première
    // version : un `jest.doMock` local — or il reste enregistré pour TOUT le
    // reste du fichier, `jest.resetModules()` ne le retire pas. Les trois tests
    // suivants recevaient donc un stockage en panne et échouaient ; j'ai
    // d'abord cru que la garde bloquait tout.
    panne.active = true;
    const { trackEvent } = await import('@/services/analyticsService');
    trackEvent('app_ouverte');
    expect(envoyes).toEqual([]);
  });

  it('après l’accord, la mesure part', async () => {
    const { trackEvent, setAnalyticsConsent } = await import('@/services/analyticsService');
    setAnalyticsConsent(true);
    trackEvent('app_ouverte');
    expect(envoyes.length).toBe(1);
  });

  it('l’accord retiré referme immédiatement', async () => {
    const { trackEvent, setAnalyticsConsent } = await import('@/services/analyticsService');
    setAnalyticsConsent(true);
    trackEvent('app_ouverte');
    setAnalyticsConsent(false);
    trackEvent('bilan_ouvert');
    expect(envoyes.length).toBe(1);
  });

  it('l’accord ne contourne pas le refus explicite du pilote', async () => {
    // Les deux interrupteurs sont indépendants : consentir à l'inscription ne
    // rouvre pas ce que le pilote a fermé dans ses Réglages.
    const { trackEvent, setAnalyticsConsent, setAnalyticsOptOut } =
      await import('@/services/analyticsService');
    setAnalyticsConsent(true);
    setAnalyticsOptOut(true);
    trackEvent('app_ouverte');
    expect(envoyes).toEqual([]);
  });

  it('isAnalyticsEnabled dit la vérité sur les trois conditions', async () => {
    const { isAnalyticsEnabled, setAnalyticsConsent } = await import('@/services/analyticsService');
    expect(isAnalyticsEnabled()).toBe(false);
    setAnalyticsConsent(true);
    expect(isAnalyticsEnabled()).toBe(true);
  });
});
