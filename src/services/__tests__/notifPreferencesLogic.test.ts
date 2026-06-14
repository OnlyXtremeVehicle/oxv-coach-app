import { readNotifPref, writeNotifPref } from '../notifPreferencesLogic';

describe('notifPreferencesLogic (D5)', () => {
  describe('readNotifPref — défaut-ON', () => {
    it('renvoie true quand la préférence est absente', () => {
      expect(readNotifPref(null, 'debrief')).toBe(true);
      expect(readNotifPref(undefined, 'reminder')).toBe(true);
      expect(readNotifPref({}, 'debrief')).toBe(true);
    });

    it('renvoie false uniquement si explicitement false', () => {
      expect(readNotifPref({ debrief: false }, 'debrief')).toBe(false);
      expect(readNotifPref({ reminder: false }, 'reminder')).toBe(false);
    });

    it('renvoie true pour les autres valeurs (true, non-bool)', () => {
      expect(readNotifPref({ debrief: true }, 'debrief')).toBe(true);
      expect(readNotifPref({ debrief: 'x' }, 'debrief')).toBe(true);
    });
  });

  describe('writeNotifPref — préserve les autres clés', () => {
    it('positionne le canal sans écraser le reste', () => {
      const next = writeNotifPref({ autreCleSite: 42, reminder: true }, 'debrief', false);
      expect(next).toEqual({ autreCleSite: 42, reminder: true, debrief: false });
    });

    it('part d’un objet vide si le JSONB est absent', () => {
      expect(writeNotifPref(null, 'reminder', false)).toEqual({ reminder: false });
    });

    it('ne mute pas l’entrée d’origine', () => {
      const src = { debrief: true };
      writeNotifPref(src, 'debrief', false);
      expect(src).toEqual({ debrief: true });
    });
  });
});
