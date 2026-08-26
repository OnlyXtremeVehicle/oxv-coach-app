/**
 * Le registre des sources — et le défaut de qualité qu'il ferme.
 */

import { computeQuality } from '@/services/v2/biometryLogic';
import {
  SOURCES,
  SOURCE_CEINTURE,
  SOURCE_MONTRE,
  phraseCadence,
  phraseLatence,
  sourceParCleBase,
  sourceParId,
} from '../sourcesBiometrie';

describe('registre — chaque source dit ce qu’elle est', () => {
  it('les deux sources sont distinctes par leur voie, leur latence et leur cadence', () => {
    expect(SOURCE_CEINTURE.voie).toBe('ble_direct');
    expect(SOURCE_MONTRE.voie).toBe('sante_appareil');
    expect(SOURCE_CEINTURE.latence).toBe('temps_reel');
    expect(SOURCE_MONTRE.latence).toBe('differe_fin_de_run');
    expect(SOURCE_CEINTURE.cadenceNominaleHz).not.toBe(SOURCE_MONTRE.cadenceNominaleHz);
  });

  it('la latence commande le direct : seule une source temps réel l’alimente', () => {
    for (const s of SOURCES) {
      if (s.latence === 'differe_fin_de_run') expect(s.alimenteLeDirect).toBe(false);
    }
    expect(SOURCE_CEINTURE.alimenteLeDirect).toBe(true);
  });

  it('seule la ceinture porte la variabilité — la montre ne la prétend pas', () => {
    expect(SOURCE_CEINTURE.porteVariabilite).toBe(true);
    expect(SOURCE_MONTRE.porteVariabilite).toBe(false);
  });

  it('chaque clé de base est unique et vaut ce que le CHECK accepte', () => {
    const cles = SOURCES.map((s) => s.cleBase);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of cles) expect(['polar_h10', 'apple_watch']).toContain(c);
  });
});

describe('résolution — jamais une source inventée', () => {
  it('un identifiant ou une clé inconnus rendent null', () => {
    expect(sourceParId('lunettes_coach')).toBeNull();
    expect(sourceParId('')).toBeNull();
    expect(sourceParCleBase('garmin_hrm')).toBeNull();
  });

  it('les clés de base réelles résolvent bien', () => {
    expect(sourceParCleBase('polar_h10')).toBe(SOURCE_CEINTURE);
    expect(sourceParCleBase('apple_watch')).toBe(SOURCE_MONTRE);
  });
});

describe('LE DÉFAUT FERMÉ — la montre n’est plus jugée à l’aune de la ceinture', () => {
  /**
   * Un run de dix minutes, mesuré par une montre à sa cadence NOMINALE :
   * un point toutes les cinq secondes, sans aucun trou.
   */
  function runMontre(): { ts: number; hr: number }[] {
    const t0 = Date.parse('2026-08-26T10:00:00.000Z');
    const out: { ts: number; hr: number }[] = [];
    for (let i = 0; i < 120; i++) out.push({ ts: t0 + i * 5000, hr: 130 });
    return out;
  }

  it('à 1 Hz — l’attente de la ceinture — la montre est déclarée « basse »', () => {
    // C'est ce que le dépôt faisait : BIO1_EXPECTED_HZ valait 1 pour la montre.
    const qualite = computeQuality(runMontre(), 1);
    expect(qualite).toBeLessThan(40); // seuil BIOMETRY_QUALITY_MEDIUM du bilan
  });

  it('à sa PROPRE cadence, la même mesure est nominale', () => {
    const qualite = computeQuality(runMontre(), SOURCE_MONTRE.cadenceNominaleHz);
    expect(qualite).toBeGreaterThanOrEqual(70); // seuil BIOMETRY_QUALITY_HIGH
  });

  it('une montre réellement clairsemée reste basse — la cadence propre n’absout pas', () => {
    const t0 = Date.parse('2026-08-26T10:00:00.000Z');
    // Un point toutes les 60 s : cinq fois moins dense que ce qu'elle annonce.
    const clairseme = Array.from({ length: 10 }, (_, i) => ({ ts: t0 + i * 60000, hr: 130 }));
    const qualite = computeQuality(clairseme, SOURCE_MONTRE.cadenceNominaleHz);
    expect(qualite).toBeLessThan(40);
  });
});

describe('les phrases — des constats, jamais des consignes', () => {
  it('la latence se dit, et distingue les deux sources', () => {
    expect(phraseLatence(SOURCE_CEINTURE)).toBe('Lisible pendant le run.');
    expect(phraseLatence(SOURCE_MONTRE)).toContain('après le run');
  });

  it('la cadence se dit dans les mots du pilote', () => {
    expect(phraseCadence(SOURCE_CEINTURE)).toBe('Environ un point par seconde.');
    expect(phraseCadence(SOURCE_MONTRE)).toBe('Environ un point toutes les 5 secondes.');
  });

  it('une cadence non exploitable ne produit aucune phrase', () => {
    expect(phraseCadence({ ...SOURCE_MONTRE, cadenceNominaleHz: 0 })).toBeNull();
    expect(phraseCadence({ ...SOURCE_MONTRE, cadenceNominaleHz: Number.NaN })).toBeNull();
  });

  it('aucun verbe prescriptif, aucune « limite », dans les libellés du registre', () => {
    const interdits = /\b(freinez|accélérez|vous devriez|il faut|évitez|limite)\b/i;
    for (const s of SOURCES) {
      expect(s.libelle).not.toMatch(interdits);
      expect(s.natureMesure).not.toMatch(interdits);
      expect(phraseLatence(s)).not.toMatch(interdits);
      expect(phraseCadence(s) ?? '').not.toMatch(interdits);
    }
  });
});
