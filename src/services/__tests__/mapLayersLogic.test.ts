import { buildMapLayers, defaultActiveLayer, type MapLayerInputs } from '../mapLayersLogic';

function inputs(over: Partial<MapLayerInputs> = {}): MapLayerInputs {
  return { hasTrajectory: true, hasSpeed: true, hasMargins: true, ...over };
}

describe('buildMapLayers', () => {
  it('le tracé est toujours disponible (géométrie du circuit)', () => {
    const layers = buildMapLayers(inputs({ hasTrajectory: false, hasSpeed: false }));
    expect(layers.find((l) => l.key === 'trace')?.available).toBe(true);
  });

  it('la vitesse exige trajectoire ET vitesse, sinon raison honnête', () => {
    expect(buildMapLayers(inputs()).find((l) => l.key === 'vitesse')?.available).toBe(true);
    const noFrames = buildMapLayers(inputs({ hasTrajectory: false, hasSpeed: false }));
    const vitesse = noFrames.find((l) => l.key === 'vitesse');
    expect(vitesse?.available).toBe(false);
    expect(vitesse?.unavailableReason).toMatch(/trames/i);
  });

  it('les marges exigent une analyse, sinon raison honnête', () => {
    const noMargins = buildMapLayers(inputs({ hasMargins: false }));
    const marges = noMargins.find((l) => l.key === 'marges');
    expect(marges?.available).toBe(false);
    expect(marges?.unavailableReason).toMatch(/analys/i);
  });

  it('une couche disponible n’expose aucune raison d’indisponibilité', () => {
    for (const l of buildMapLayers(inputs())) {
      if (l.available) expect(l.unavailableReason).toBeNull();
    }
  });
});

describe('defaultActiveLayer', () => {
  it('préfère les marges quand elles existent', () => {
    expect(defaultActiveLayer(buildMapLayers(inputs()))).toBe('marges');
  });

  it('retombe sur la vitesse sans marges', () => {
    expect(defaultActiveLayer(buildMapLayers(inputs({ hasMargins: false })))).toBe('vitesse');
  });

  it('retombe sur le tracé quand rien d’autre n’est exploitable', () => {
    const layers = buildMapLayers({ hasTrajectory: false, hasSpeed: false, hasMargins: false });
    expect(defaultActiveLayer(layers)).toBe('trace');
  });
});
