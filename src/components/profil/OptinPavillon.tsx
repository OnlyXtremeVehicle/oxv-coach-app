/**
 * Réglage Pavillon — opt-in d'affichage nominatif sur les écrans publics
 * (référence profil.html, bloc .optin). Désactivé par défaut (RGPD).
 *
 * Écriture : le SEUL champ users.pavilion_name_optin (le trigger de la
 * migration horodate le consentement). Le composant n'est monté que si la
 * migration profil/pavillon est appliquée (§5.4).
 */

import { Pressable, Text, View } from 'react-native';

import { lotProfilTokens as t } from '@/theme/v2';

export interface OptinPavillonProps {
  actif: boolean;
  /** Grise le toggle pendant l'écriture. */
  enCours?: boolean;
  onBasculer: () => void;
}

export function OptinPavillon({ actif, enCours, onBasculer }: OptinPavillonProps) {
  return (
    <View style={s.optin}>
      <View style={s.txt}>
        <Text style={s.titre}>Afficher mon nom sur les écrans du Pavillon</Text>
        <Text style={s.desc}>
          Par défaut, seuls votre numéro et votre pseudonyme apparaissent sur les écrans publics
          pendant les sessions.
        </Text>
        <Text style={s.etat}>{actif ? 'Activé' : 'Désactivé'}</Text>
      </View>
      <Pressable
        onPress={onBasculer}
        disabled={enCours}
        accessibilityRole="switch"
        accessibilityState={{ checked: actif, disabled: enCours }}
        accessibilityLabel="Afficher mon nom sur les écrans du Pavillon"
        hitSlop={8}
        style={({ pressed }) => [
          s.toggle,
          pressed && { opacity: 0.7 },
          enCours && { opacity: 0.5 },
        ]}
      >
        <View style={[s.dot, actif ? s.dotActif : null]} />
      </Pressable>
    </View>
  );
}

const s = {
  optin: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    padding: 16,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  txt: { flex: 1 },
  titre: {
    fontFamily: t.fonts.corpsSemi,
    fontSize: 13,
    color: t.blanc,
    marginBottom: 4,
  },
  desc: {
    fontFamily: t.fonts.corps,
    fontSize: 11,
    lineHeight: 16.5,
    color: t.gris,
  },
  etat: {
    fontFamily: t.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    color: t.grisSombre,
    textTransform: 'uppercase' as const,
    marginTop: 6,
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: t.surface2,
    borderWidth: 1,
    borderColor: t.ligne,
    flexShrink: 0,
  },
  dot: {
    position: 'absolute' as const,
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: t.grisSombre,
  },
  dotActif: {
    left: undefined,
    right: 3,
    backgroundColor: t.rouge,
  },
};
