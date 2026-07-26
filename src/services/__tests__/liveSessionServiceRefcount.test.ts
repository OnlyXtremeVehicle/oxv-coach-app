/* eslint-disable @typescript-eslint/no-explicit-any, import/first */
/**
 * Transport live — REFCOMPTAGE DES TOPICS.
 *
 * POURQUOI ce test existe. `supabase-js` DÉDOUBLONNE les canaux PAR TOPIC :
 * `channel(topic)` renvoie l'instance déjà ouverte si elle existe. Tant qu'un
 * topic n'avait qu'un consommateur, cela ne se voyait pas. Depuis BIO-2 et
 * LIVE-B, `live:session:<id>` en a deux (le cardio du roster et la fiche direct)
 * — et sans comptage, le premier `removeChannel` arrachait le canal à l'autre.
 *
 * Deux conséquences avaient été mesurées avant correction :
 *   - fermer la fiche direct TUAIT le cardio du roster ;
 *   - le second abonné, branché sur un canal DÉJÀ souscrit, ne recevait jamais
 *     son SUBSCRIBED et affichait « hors ligne » sur un flux pourtant vivant.
 *
 * Un troisième piège s'y ajoute : un désabonnement appelé DEUX FOIS décrémentait
 * deux fois et arrachait le canal aux autres. D'où l'idempotence.
 *
 * Le faux client ci-dessous REPRODUIT la déduplication par topic — c'est la
 * cause racine, pas un détail d'implémentation. Un mock qui rendrait une
 * instance neuve à chaque appel ne testerait rien.
 */

interface FakeChannel {
  topic: string;
  handlers: { event: string; cb: (msg: any) => void }[];
  statusCb: ((status: string) => void) | null;
  sent: { event: string; payload: any }[];
  state: string;
  on(kind: string, filter: any, cb: (msg: any) => void): FakeChannel;
  subscribe(cb?: (status: string) => void): FakeChannel;
  send(msg: any): void;
  track(meta: any): void;
  untrack(): void;
  presenceState(): Record<string, unknown>;
}

interface Ctrl {
  /** Canaux VIVANTS, indexés par topic — reproduit la dédup de supabase-js. */
  channels: Map<string, FakeChannel>;
  /** Topics passés à removeChannel, dans l'ordre. */
  removed: string[];
}

function ctrl(): Ctrl {
  const g = globalThis as any;
  if (!g.__OXV_LSS__) {
    g.__OXV_LSS__ = { channels: new Map(), removed: [] } as Ctrl;
  }
  return g.__OXV_LSS__;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel(topic: string) {
      const c = ctrl();
      const existing = c.channels.get(topic);
      // LA dédup : même topic → MÊME instance. C'est ce comportement qui rend
      // le refcomptage obligatoire.
      if (existing) return existing;
      const ch: FakeChannel = {
        topic,
        handlers: [],
        statusCb: null,
        sent: [],
        state: 'joined',
        on(_kind: string, filter: any, cb: (msg: any) => void) {
          ch.handlers.push({ event: filter?.event ?? '', cb });
          return ch;
        },
        subscribe(cb?: (status: string) => void) {
          ch.statusCb = cb ?? null;
          cb?.('SUBSCRIBED');
          return ch;
        },
        send(msg: any) {
          ch.sent.push({ event: msg.event, payload: msg.payload });
        },
        track() {},
        untrack() {},
        presenceState: () => ({}),
      };
      c.channels.set(topic, ch);
      return ch;
    },
    removeChannel(ch: FakeChannel) {
      const c = ctrl();
      c.removed.push(ch.topic);
      c.channels.delete(ch.topic);
    },
  },
}));

import {
  openBoardBroadcast,
  openPilotBroadcast,
  subscribeBoard,
  subscribePilotStream,
} from '@/services/liveSessionService';

/** Diffuse un événement sur un topic, comme le ferait le serveur. */
function emit(topic: string, event: string, payload: unknown): void {
  const ch = ctrl().channels.get(topic);
  if (!ch) throw new Error(`topic absent : ${topic}`);
  for (const h of ch.handlers) if (h.event === event) h.cb({ payload });
}

const vivant = (topic: string) => ctrl().channels.has(topic);

/**
 * La fermeture d'un topic est DIFFÉRÉE de 2 s (cf. liveSessionService) : sans ce
 * délai, un abonné qui revient pendant la fermeture récupérait l'instance
 * mourante — `channel()` dédoublonne par topic — et restait « hors ligne ». Les
 * tests avancent donc l'horloge quand ils veulent constater la fermeture réelle.
 */
const laisserFermer = () => jest.advanceTimersByTime(2500);

beforeEach(() => {
  jest.useFakeTimers();
  const c = ctrl();
  c.channels.clear();
  c.removed.length = 0;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('topic live:session — refcompté', () => {
  it('deux consommateurs partagent UNE instance, et le premier départ ne ferme rien', () => {
    const topic = 'live:session:S1';
    const framesA: unknown[] = [];
    const biosB: unknown[] = [];

    const unsubA = subscribePilotStream('S1', { onFrame: (f) => framesA.push(f) });
    const unsubB = subscribePilotStream('S1', {
      onFrame: () => {},
      onBiometry: (e) => biosB.push(e),
    });

    // Une seule instance ouverte pour les deux.
    expect(ctrl().channels.size).toBe(1);

    unsubA();
    // Le canal DOIT survivre : B le tient encore. C'est le défaut historique.
    expect(vivant(topic)).toBe(true);

    emit(topic, 'biometry', { hrBpm: 150, rrTrend: 'stable', contact: 'ok', atMs: 1 });
    expect(biosB).toHaveLength(1);

    unsubB();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
    expect(ctrl().removed).toContain(topic);
  });

  it('un abonné RETARDATAIRE reçoit le statut courant (sinon : « hors ligne » sur flux vivant)', () => {
    const statuts: boolean[] = [];
    const unsubA = subscribePilotStream('S2', { onFrame: () => {} });
    // B arrive APRÈS le SUBSCRIBED : le canal partagé ne le rejouera pas de
    // lui-même, c'est le service qui doit le lui redonner.
    const unsubB = subscribePilotStream('S2', {
      onFrame: () => {},
      onStatus: (s) => statuts.push(s),
    });
    expect(statuts).toContain(true);
    unsubA();
    unsubB();
  });

  it('le désabonnement est IDEMPOTENT : appelé deux fois, il n’arrache rien aux autres', () => {
    const topic = 'live:session:S3';
    const unsubA = subscribePilotStream('S3', { onFrame: () => {} });
    const unsubB = subscribePilotStream('S3', { onFrame: () => {} });

    unsubA();
    unsubA(); // second appel : ne doit PAS décrémenter une seconde fois
    expect(vivant(topic)).toBe(true);

    unsubB();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
  });

  it('un événement est diffusé à TOUS les inscrits, pas au seul premier', () => {
    const topic = 'live:session:S4';
    const a: unknown[] = [];
    const b: unknown[] = [];
    const unsubA = subscribePilotStream('S4', { onFrame: (f) => a.push(f) });
    const unsubB = subscribePilotStream('S4', { onFrame: (f) => b.push(f) });

    emit(topic, 'frame', { lap: 1 });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    unsubA();
    unsubB();
  });

  it('émetteur et lecteur cohabitent sur le même topic (cas du simulateur)', () => {
    const topic = 'live:session:S5';
    const recu: unknown[] = [];
    const unsub = subscribePilotStream('S5', { onFrame: (f) => recu.push(f) });
    const emetteur = openPilotBroadcast('S5');

    emetteur.close();
    // Fermer l'émetteur ne doit pas couper le lecteur.
    expect(vivant(topic)).toBe(true);

    emit(topic, 'frame', { lap: 2 });
    expect(recu).toHaveLength(1);

    unsub();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
  });

  it('close() de l’émetteur est idempotent', () => {
    const topic = 'live:session:S6';
    const unsub = subscribePilotStream('S6', { onFrame: () => {} });
    const emetteur = openPilotBroadcast('S6');
    emetteur.close();
    emetteur.close(); // ne doit pas libérer une seconde référence
    expect(vivant(topic)).toBe(true);
    unsub();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
  });
});

it('rouvrir PENDANT la fermeture reprend le canal chaud, et ne fige pas sur « hors ligne »', () => {
  const topic = 'live:session:S9';
  let statutA: boolean | null = null;
  let statutB: boolean | null = null;

  // Le coach ouvre la fiche direct, puis la ferme.
  const unsubA = subscribePilotStream('S9', {
    onFrame: () => {},
    onStatus: (v) => (statutA = v),
  });
  expect(statutA).toBe(true);
  unsubA();

  // Le canal n'est PAS encore fermé : le délai n'est pas écoulé.
  expect(vivant(topic)).toBe(true);

  // Il rouvre aussitôt — le geste le plus banal qui soit.
  const unsubB = subscribePilotStream('S9', {
    onFrame: () => {},
    onStatus: (v) => (statutB = v),
  });

  // Avant correction : `channel()` dédoublonnant par topic, B recevait
  // l'instance mourante, son SUBSCRIBED n'arrivait jamais, et l'écran restait
  // « Hors ligne » sur un flux pourtant vivant.
  expect(statutB).toBe(true);
  expect(ctrl().channels.size).toBe(1);

  // Et la fermeture programmée a bien été annulée : le canal survit au délai.
  laisserFermer();
  expect(vivant(topic)).toBe(true);

  unsubB();
  laisserFermer();
  expect(vivant(topic)).toBe(false);
});

describe('topic live:board — refcompté aussi', () => {
  it('deux lecteurs du tableau de marche partagent une instance et la libèrent au dernier', () => {
    const topic = 'live:board:S7';
    const unsubA = subscribeBoard('S7', { onBoard: () => {} });
    const unsubB = subscribeBoard('S7', { onBoard: () => {} });
    expect(ctrl().channels.size).toBe(1);

    unsubA();
    expect(vivant(topic)).toBe(true);
    unsubB();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
  });

  it('le canal board est INDÉPENDANT du canal coach de la même séance', () => {
    // Deux audiences, deux niveaux de contenu : fermer l'un ne doit jamais
    // fermer l'autre, sans quoi couper le paddock couperait le coach.
    const unsubCoach = subscribePilotStream('S8', { onFrame: () => {} });
    const unsubBoard = subscribeBoard('S8', { onBoard: () => {} });
    expect(ctrl().channels.size).toBe(2);

    unsubBoard();
    laisserFermer();
    expect(vivant('live:session:S8')).toBe(true);
    expect(vivant('live:board:S8')).toBe(false);

    unsubCoach();
    laisserFermer();
    expect(vivant('live:session:S8')).toBe(false);
  });

  it('l’émetteur board n’expédie QUE des charges filtrées (le type l’impose déjà)', () => {
    const topic = 'live:board:S9';
    const emetteur = openBoardBroadcast('S9');
    emetteur.send({ pilotHandle: 'gabin', carNo: 7, lastLapMs: 91000, bestLapMs: 90500, ts: 1 });
    const ch = ctrl().channels.get(topic);
    expect(ch?.sent).toHaveLength(1);
    expect(ch?.sent[0].event).toBe('board');
    // Aucune clé de santé ne peut se trouver là : la signature de `send`
    // n'accepte que la sortie de stripHealth.
    expect(Object.keys(ch?.sent[0].payload as object)).not.toContain('hrBpm');
    emetteur.close();
    laisserFermer();
    expect(vivant(topic)).toBe(false);
  });
});
