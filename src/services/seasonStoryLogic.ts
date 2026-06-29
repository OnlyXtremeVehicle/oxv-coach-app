/**
 * OXV Trace — jalons de saison (V9 §6 « Temps long »).
 *
 * Transforme le résumé FACTUEL d'une saison en quelques jalons sobres — les
 * moments qui en marquent le fil (ouverture, terrains, montures, rythme,
 * dernière trace). Logique PURE (sans réseau, dates déjà formatées par
 * l'appelant) → testable unitairement.
 *
 * Doctrine : des FAITS situés (soi contre soi), jamais un palmarès ni un rang.
 * « Le mois le plus dense » est une mesure de SOI, pas une comparaison à autrui.
 * Si la matière manque, on rend moins de jalons plutôt que d'en inventer.
 */

export interface SeasonStoryInput {
  sessions: number;
  circuits: number;
  vehicles: number;
  /** Première séance de la saison (date déjà formatée pour l'affichage). */
  firstSession: { dateLabel: string; circuit: string | null } | null;
  /** Dernière séance (null ou identique à la première = un seul jalon). */
  lastSession: { dateLabel: string; circuit: string | null } | null;
  /** Mois le plus dense (libellé déjà formaté + nombre de séances). */
  busiestMonth: { monthLabel: string; count: number } | null;
}

export interface StoryMilestone {
  key: string;
  /** Repère court (« OUVERTURE », « RYTHME » …). */
  marker: string;
  /** Phrase factuelle. */
  title: string;
  /** Précision optionnelle (circuit, nombre …). */
  detail: string | null;
}

export function buildSeasonStory(input: SeasonStoryInput): StoryMilestone[] {
  const milestones: StoryMilestone[] = [];
  if (input.sessions <= 0) return milestones;

  if (input.firstSession) {
    milestones.push({
      key: 'opening',
      marker: 'OUVERTURE',
      title: `La saison s’est ouverte le ${input.firstSession.dateLabel}.`,
      detail: input.firstSession.circuit,
    });
  }

  if (input.circuits >= 2) {
    milestones.push({
      key: 'circuits',
      marker: 'TERRAINS',
      title: `${input.circuits} circuits parcourus cette saison.`,
      detail: null,
    });
  }

  if (input.vehicles >= 2) {
    milestones.push({
      key: 'vehicles',
      marker: 'MONTURES',
      title: `${input.vehicles} véhicules engagés.`,
      detail: null,
    });
  }

  if (input.busiestMonth && input.busiestMonth.count >= 2) {
    milestones.push({
      key: 'rhythm',
      marker: 'RYTHME',
      title: `${input.busiestMonth.monthLabel} : votre mois le plus dense.`,
      detail: `${input.busiestMonth.count} séances.`,
    });
  }

  // Dernière trace — seulement si elle diffère de l'ouverture (≥ 2 séances
  // distinctes), pour ne pas répéter le même jour.
  if (
    input.lastSession &&
    (!input.firstSession || input.lastSession.dateLabel !== input.firstSession.dateLabel)
  ) {
    milestones.push({
      key: 'latest',
      marker: 'DERNIÈRE',
      title: `Dernière trace le ${input.lastSession.dateLabel}.`,
      detail: input.lastSession.circuit,
    });
  }

  return milestones;
}
