/**
 * LE COMPOSANT QUI A TUÉ L'APPLICATION — MONTÉ, POUR DE VRAI.
 *
 * ===========================================================================
 * CE QUI S'EST PASSÉ, ET POURQUOI RIEN NE L'A VU
 * ===========================================================================
 *
 * La nuit du 13/08/2026, l'écran Data se peignait puis l'application mourait
 * environ 120 ms plus tard, à chaque ouverture. `SectionBande` armait
 * `useFirstViewport` INCONDITIONNELLEMENT, puis sortait par `return null` tant
 * que la séance portait moins de vingt-cinq tours — c'est-à-dire toujours. Le
 * `useAnimatedRef` n'était donc jamais attaché ; `measure()` recevait un tag
 * nul, descendait en natif, et levait une `JSIException` sur le fil UI que
 * personne ne rattrape.
 *
 * Le build avait passé toutes les portes : tsc 0, lint 0, 3 078 tests verts.
 *
 * Aucun de ces tests ne montait un composant. `jest.config.js` cherchait
 * `**\/__tests__/**\/*.test.ts` — et un fichier `.test.tsx` ne finit pas par
 * `.test.ts`. 148 fichiers `.tsx` dans `app/`, jamais cherchés, et jest
 * n'annonce pas les fichiers qu'il n'a pas cherchés.
 *
 * ===========================================================================
 * CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS
 * ===========================================================================
 *
 * Il MONTE le composant dans les conditions exactes du terrain : une séance de
 * trois tours, sous le seuil de bascule. C'est le premier test de ce dépôt qui
 * exécute du rendu React Native.
 *
 * Il ne reproduit PAS la `JSIException`, et ce n'est pas une réserve de
 * principe : c'est mesuré. J'ai rétabli l'état d'avant le correctif —
 * `useFirstViewport(!reduce)`, armé inconditionnellement — et les sept tests de
 * ce projet sont restés VERTS. Le faux Reanimated n'a pas de fil UI et
 * n'appelle jamais le callback de frame ; aucun harnais de test n'en a.
 *
 * Il faut donc dire ce qui protège vraiment de CE défaut-là, et ce n'est pas ce
 * fichier :
 *
 *   - `refMesurable.test.ts` EXÉCUTE la décision (`tagMesurable`) avec les
 *     valeurs que Reanimated rend réellement — `null`, `-1`, `NaN` ;
 *   - `firstViewportRefAttache.guard.test.ts` fige la condition d'armement de
 *     ce composant, et exige que chaque appelant du hook attache un `ref`.
 *
 * Ce que CE fichier attrape est la classe juste au-dessus — un composant qui
 * lève, boucle ou déréférence au montage — et qu'aucune porte de ce dépôt ne
 * voyait passer, faute de monter quoi que ce soit.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { SectionBande } from '@/components/telemetry/SectionBande';
import type { Lap } from '@/types/telemetry';

/**
 * `loadBandeSeance` rapatrie la séance entière. Un test de montage n'a rien à
 * faire du réseau : on neutralise le service, pas le composant.
 */
jest.mock('@/services/bandeService', () => ({
  loadBandeSeance: jest.fn(async () => null),
  TEXTE_BANDE: {
    titre: 'La bande',
    vide: 'Rien à montrer.',
    chargement: 'Lecture…',
  },
}));

const DEBUT = '2026-08-12T23:35:54.362Z';

/** Les trois tours réels du 13/08 à Bouteville, dans leur forme de base. */
function toursReels(): Lap[] {
  return [360.485, 327.542, 339.483].map(
    (duree, i) =>
      ({
        id: `l${i + 1}`,
        session_id: 'ff384ace',
        lap_number: i + 1,
        duration_seconds: duree,
        is_best_lap: i === 1,
        is_outlap: false,
        is_inlap: false,
        started_at: DEBUT,
        ended_at: DEBUT,
        max_speed_kmh: 106.26,
        avg_speed_kmh: 64.55,
        max_g_lateral: 0.62,
        max_g_braking: 0.36,
        max_g_accel: 0.46,
        distance_meters: 5873.7,
        start_lat: 45.5971,
        start_lon: -0.1334,
        end_lat: 45.5971,
        end_lon: -0.1334,
        created_at: DEBUT,
      }) as unknown as Lap
  );
}

describe('SectionBande — les conditions exactes du 13/08', () => {
  /**
   * LE CAS DU TERRAIN. Trois tours : très en dessous du seuil de bascule, donc
   * le composant sort par `return null`. C'est CE chemin qui laissait la
   * référence animée non attachée.
   */
  it('trois tours : le montage ne lève pas, et rien ne s’affiche', () => {
    const { toJSON } = render(
      <SectionBande sessionId="ff384ace" debutSeanceIso={DEBUT} laps={toursReels()} />
    );
    expect(toJSON()).toBeNull();
  });

  /** Zéro tour — l'autre bout du même chemin, et le plus fréquent au démarrage. */
  it('aucun tour : le montage ne lève pas non plus', () => {
    const { toJSON } = render(
      <SectionBande sessionId="ff384ace" debutSeanceIso={DEBUT} laps={[]} />
    );
    expect(toJSON()).toBeNull();
  });

  /**
   * ET LE DÉMONTAGE IMMÉDIAT. C'est le chemin qu'emprunte un pilote qui ouvre
   * l'écran puis revient aussitôt en arrière — celui qui laisse partir des
   * effets sur un composant qui n'existe plus.
   */
  it('un montage-démontage immédiat ne laisse rien lever', () => {
    const vue = render(
      <SectionBande sessionId="ff384ace" debutSeanceIso={DEBUT} laps={toursReels()} />
    );
    expect(() => vue.unmount()).not.toThrow();
  });
});
