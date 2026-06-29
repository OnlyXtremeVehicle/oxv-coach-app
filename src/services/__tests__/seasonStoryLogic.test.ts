import { buildSeasonStory, type SeasonStoryInput } from '../seasonStoryLogic';

function input(over: Partial<SeasonStoryInput> = {}): SeasonStoryInput {
  return {
    sessions: 6,
    circuits: 3,
    vehicles: 2,
    firstSession: { dateLabel: '4 mars', circuit: 'Haute Saintonge' },
    lastSession: { dateLabel: '21 juin', circuit: 'Charente' },
    busiestMonth: { monthLabel: 'Juin', count: 3 },
    ...over,
  };
}

describe('buildSeasonStory', () => {
  it('sans séance, aucun jalon (rien inventé)', () => {
    expect(buildSeasonStory(input({ sessions: 0 }))).toEqual([]);
  });

  it('ouvre la saison sur la première séance', () => {
    const story = buildSeasonStory(input());
    const opening = story.find((m) => m.key === 'opening');
    expect(opening?.title).toContain('4 mars');
    expect(opening?.detail).toBe('Haute Saintonge');
  });

  it('jalonne terrains et montures au pluriel seulement', () => {
    const many = buildSeasonStory(input());
    expect(many.some((m) => m.key === 'circuits')).toBe(true);
    expect(many.some((m) => m.key === 'vehicles')).toBe(true);

    const single = buildSeasonStory(input({ circuits: 1, vehicles: 1 }));
    expect(single.some((m) => m.key === 'circuits')).toBe(false);
    expect(single.some((m) => m.key === 'vehicles')).toBe(false);
  });

  it('rend le mois le plus dense (mesure de soi, pas un rang)', () => {
    const story = buildSeasonStory(input());
    const rhythm = story.find((m) => m.key === 'rhythm');
    expect(rhythm?.title).toContain('Juin');
    expect(rhythm?.detail).toBe('3 séances.');
  });

  it('ne répète pas la dernière trace si elle tombe le jour de l’ouverture', () => {
    const sameDay = buildSeasonStory(
      input({
        firstSession: { dateLabel: '4 mars', circuit: 'Haute Saintonge' },
        lastSession: { dateLabel: '4 mars', circuit: 'Haute Saintonge' },
      })
    );
    expect(sameDay.some((m) => m.key === 'latest')).toBe(false);
  });

  it('clôt sur la dernière trace quand elle diffère de l’ouverture', () => {
    const story = buildSeasonStory(input());
    const latest = story.find((m) => m.key === 'latest');
    expect(latest?.title).toContain('21 juin');
    expect(latest?.detail).toBe('Charente');
  });

  it('ne formule jamais de consigne ni de palmarès', () => {
    const story = buildSeasonStory(input());
    const forbidden = /classement|record|meilleur que|battez|vous devriez|il faut/i;
    for (const m of story) {
      expect(forbidden.test(`${m.title} ${m.detail ?? ''}`)).toBe(false);
    }
  });
});
