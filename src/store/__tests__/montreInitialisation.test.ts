/**
 * LA MONTRE DE GARDE DU DÉMARRAGE.
 *
 * ===========================================================================
 * CE QUI ÉTAIT EN PLACE
 * ===========================================================================
 *
 * `app/_layout.tsx` ne cache le splash que si `status` a quitté 'idle' et
 * 'loading'. Or `initialize()` posait 'loading' puis attendait
 * `supabase.auth.getSession()` — sans aucun délai.
 *
 * Ce n'est pas un cas limite. `getSession()` déclenche un rafraîchissement
 * réseau dès que le jeton entre dans la marge d'expiration de 90 secondes,
 * donc à presque chaque démarrage à froid. Et le `fetch` de React Native n'a
 * pas de délai par défaut : derrière un portail captif — le Wi-Fi d'un paddock,
 * exactement notre terrain — la requête ne répond ni ne tombe.
 *
 * La promesse ne se résolvait jamais, `status` restait 'loading', le splash
 * restait affiché. Le try/catch ne servait à rien : il n'y a pas d'erreur, il y
 * a une attente. Le pilote n'avait plus qu'à tuer l'application — et il aurait
 * dit, à juste titre, « elle ne s'ouvre pas ».
 *
 * ===========================================================================
 * CE QUE CES TESTS PROUVENT
 * ===========================================================================
 *
 * Que l'attente devient un état honnête, et que la sortie de secours n'ouvre
 * pas une porte pire : ni écrasement par un retour tardif, ni empilement
 * d'écouteurs à chaque « Réessayer ».
 *
 * Ils ne remplacent pas l'essai sur appareil derrière un vrai portail captif.
 * Ils garantissent que le comportement ne peut pas se perdre en silence.
 */

const getSession = jest.fn();
const onAuthStateChange = jest.fn();
const from = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      get getSession() {
        return getSession;
      },
      get onAuthStateChange() {
        return onAuthStateChange;
      },
    },
    get from() {
      return from;
    },
  },
}));

jest.mock('@/services/analyticsService', () => ({
  setAnalyticsConsent: jest.fn(),
}));

/** Une promesse qu'on résout à la main — le portail captif du test. */
function differee<T>(): { promesse: Promise<T>; resoudre: (v: T) => void } {
  let resoudre!: (v: T) => void;
  const promesse = new Promise<T>((r) => {
    resoudre = r;
  });
  return { promesse, resoudre };
}

type Store = typeof import('../useAuthStore').useAuthStore;

/**
 * Recharge le module : le compteur de génération et le drapeau d'écouteur y
 * vivent au niveau module, et doivent repartir de zéro à chaque cas.
 *
 * `require` est ici obligatoire — `import` est hissé, et rechargerait donc le
 * module AVANT que `jest.isolateModules` n'ait vidé le cache.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
function magasinNeuf(): Store {
  let s!: Store;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    s = (require('../useAuthStore') as typeof import('../useAuthStore')).useAuthStore;
  });
  return s;
}

beforeEach(() => {
  jest.useFakeTimers();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  from.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('montre de garde', () => {
  it('rend la main en erreur quand le réseau ne répond jamais', async () => {
    // LE CAS QUI A MOTIVÉ TOUT CECI : la promesse ne se résout pas, et ne
    // rejette pas non plus.
    getSession.mockReturnValue(differee().promesse);
    const magasin = magasinNeuf();

    void magasin.getState().initialize();
    await Promise.resolve();
    expect(magasin.getState().status).toBe('loading');

    jest.advanceTimersByTime(20_000);

    expect(magasin.getState().status).toBe('error');
    // L'écran honnête de app/index.tsx se déclenche sur ce seul état.
    expect(magasin.getState().error).toMatch(/réseau/i);
  });

  it('ne se déclenche pas quand la session arrive à temps', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const magasin = magasinNeuf();

    await magasin.getState().initialize();
    expect(magasin.getState().status).toBe('unauthenticated');

    // La montre ne doit pas transformer après coup un état légitime en erreur.
    jest.advanceTimersByTime(60_000);
    expect(magasin.getState().status).toBe('unauthenticated');
  });

  it('n’attend pas si le réseau tombe franchement', async () => {
    getSession.mockRejectedValue(new Error('Network request failed'));
    const magasin = magasinNeuf();

    await magasin.getState().initialize();
    expect(magasin.getState().status).toBe('error');
  });
});

describe('retour périmé', () => {
  it('une réponse arrivée après la montre n’écrase pas l’état plus récent', async () => {
    // Sans le compteur de génération, la première requête — enfin revenue —
    // renverrait le pilote vers un état qui n'est plus le sien.
    const lente = differee<{ data: { session: null }; error: null }>();
    getSession.mockReturnValueOnce(lente.promesse);
    const magasin = magasinNeuf();

    void magasin.getState().initialize();
    await Promise.resolve();
    jest.advanceTimersByTime(20_000);
    expect(magasin.getState().status).toBe('error');

    // Le pilote tape « Réessayer », et cette fois ça répond.
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await magasin.getState().initialize();
    expect(magasin.getState().status).toBe('unauthenticated');

    // La toute première requête revient enfin. Elle doit être ignorée.
    lente.resoudre({ data: { session: null }, error: null });
    await Promise.resolve();
    await Promise.resolve();

    expect(magasin.getState().status).toBe('unauthenticated');
  });
});

describe('écouteur d’authentification', () => {
  it('n’est posé qu’une fois, même après plusieurs « Réessayer »', async () => {
    // Chaque écouteur en trop relit le profil à chaque rafraîchissement de
    // jeton — toutes les heures, pour rien.
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    const magasin = magasinNeuf();

    await magasin.getState().initialize();
    await magasin.getState().initialize();
    await magasin.getState().initialize();

    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
  });
});
