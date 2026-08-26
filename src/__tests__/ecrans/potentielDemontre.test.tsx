/**
 * LE POTENTIEL DÉMONTRÉ, ET CE QU'IL PROMET AU PILOTE.
 *
 * ===========================================================================
 * CE QUE L'AUDIT M10 A TROUVÉ, LE 26/08/2026
 * ===========================================================================
 *
 * Cette vue annonçait « Tour idéal composé » et, en capitales à droite de la
 * barre de statut, « MICRO-SECTEURS ». Elle décrivait une méthode que personne
 * n'exécute :
 *
 *   • `supabase/functions/compute-session-insights-v3` écrit le meilleur tour
 *     RÉEL de la journée, avec `gap_s: 0` et `sector_sources: []` ;
 *   • `src/services/sessionInsightsEngine.ts` fait de même, et le dit ;
 *   • `idealLapTime` (src/telemetry/delta.ts), la seule fonction du dépôt qui
 *     assemble vraiment des micro-secteurs, n'a aucun appelant de production.
 *
 * Conséquence à l'écran, sur le chrono le plus lu de la lecture N3.2 :
 *
 *     TOUR IDÉAL · −0,0 s SOUS VOTRE MEILLEUR RÉEL
 *
 * — un gain fabriqué à partir d'un zéro, sous une étiquette [I] qui présentait
 * un tour réellement bouclé comme une hypothèse.
 *
 * ===========================================================================
 * CE QUE CES TESTS DÉFENDENT
 * ===========================================================================
 *
 * Trois choses, qu'aucun test pur ne pouvait voir puisqu'elles vivent dans le
 * rendu : le MOT (charte anti-jargon, « Optimal lap → Potentiel démontré,
 * jamais tour garanti »), l'ABSENCE de gain quand il n'y en a pas, et la
 * PRÉSENCE du gain quand il y en a un — sans quoi une vue muette passerait
 * les deux premiers.
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { TourIdealViz } from '@/components/insights/TourIdealViz';
import type { IdealLap } from '@/circuit/sessionInsights';

/** Ce que les deux moteurs en service écrivent vraiment : le meilleur tour réel. */
const SANS_GAIN: IdealLap = {
  ideal_time_s: 94.3,
  real_best_s: 94.3,
  gap_s: 0,
  best_lap: 3,
  loss_by_sector_pct: [],
  worst_sector: 0,
};

/** Ce qu'un moteur composerait le jour où il compose. */
const AVEC_GAIN: IdealLap = {
  ideal_time_s: 94.3,
  real_best_s: 95.8,
  gap_s: 1.5,
  best_lap: 6,
  loss_by_sector_pct: [40, 35, 25],
  worst_sector: 1,
};

describe('le mot montré au pilote', () => {
  it('la lecture s’annonce « Potentiel démontré »', () => {
    render(<TourIdealViz ideal={SANS_GAIN} />);
    expect(screen.getByText('Potentiel démontré')).toBeTruthy();
  });

  /**
   * « Jamais tour garanti » (fiche M10). Et « tour idéal » était le mot que la
   * charte anti-jargon remplace : ni l'un ni l'autre ne doit revenir.
   */
  it.each([SANS_GAIN, AVEC_GAIN])('ni « tour idéal » ni « tour garanti »', (bloc) => {
    render(<TourIdealViz ideal={bloc} />);
    expect(screen.queryByText(/tour idéal/i)).toBeNull();
    expect(screen.queryByText(/tour garanti/i)).toBeNull();
  });

  /**
   * « MICRO-SECTEURS » décrivait une méthode absente de la chaîne. Elle n'est
   * pas remplacée par une autre mention : le bloc `ideal_lap` ne dit pas
   * comment il a été composé.
   */
  it.each([SANS_GAIN, AVEC_GAIN])('aucune méthode de composition n’est annoncée', (bloc) => {
    render(<TourIdealViz ideal={bloc} />);
    expect(screen.queryByText(/micro-secteur/i)).toBeNull();
  });
});

describe('sans gain composé, aucun gain annoncé', () => {
  it('pas de « −0,0 s sous votre meilleur réel »', () => {
    render(<TourIdealViz ideal={SANS_GAIN} />);
    expect(screen.queryByText(/SOUS VOTRE MEILLEUR RÉEL/)).toBeNull();
    expect(screen.getByText(/VOTRE MEILLEUR TOUR RÉEL DE LA SÉANCE/)).toBeTruthy();
  });

  /**
   * Le chrono montré EST alors un tour réellement bouclé. L'étiqueter [I]
   * ferait passer une mesure pour une hypothèse — l'erreur symétrique de celle
   * que ce lot corrige.
   */
  it('aucune étiquette d’inférence sur un tour réellement bouclé', () => {
    render(<TourIdealViz ideal={SANS_GAIN} />);
    expect(screen.queryByText('[I]')).toBeNull();
  });

  /** Une répartition de zéro serait une rangée de zéros fabriqués. */
  it('aucune répartition de l’écart', () => {
    render(
      <TourIdealViz ideal={{ ...SANS_GAIN, loss_by_sector_pct: [50, 50], worst_sector: 1 }} />
    );
    expect(screen.queryByText(/Où se loge l’écart/)).toBeNull();
  });
});

/**
 * LE CONTRE-TEST, ET IL DÉCIDE. Une vue devenue muette passerait tout ce qui
 * précède. Le jour où un moteur compose vraiment, le gain doit s'afficher — et
 * s'annoncer comme une inférence.
 */
describe('avec un gain composé, le gain est dit — et annoncé comme hypothèse', () => {
  it('l’écart au meilleur tour réel s’affiche', () => {
    render(<TourIdealViz ideal={AVEC_GAIN} />);
    expect(screen.getByText(/SOUS VOTRE MEILLEUR RÉEL/)).toBeTruthy();
  });

  it('l’étiquette d’inférence accompagne le chrono', () => {
    render(<TourIdealViz ideal={AVEC_GAIN} />);
    expect(screen.getByText('[I]')).toBeTruthy();
  });

  it('la répartition de l’écart revient', () => {
    render(<TourIdealViz ideal={AVEC_GAIN} />);
    expect(screen.getByText(/Où se loge l’écart/)).toBeTruthy();
  });
});

describe('rien à montrer se dit', () => {
  it('un bloc absent affiche l’état vide, pas un zéro', () => {
    render(<TourIdealViz ideal={null} />);
    expect(screen.getByText('Données insuffisantes sur cette séance')).toBeTruthy();
    expect(screen.queryByText(/0:00/)).toBeNull();
  });
});
