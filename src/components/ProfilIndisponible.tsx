/**
 * QUAND ON N'A PAS PU LIRE QUI VOUS ÊTES.
 *
 * ---
 *
 * CE QUE CET ÉCRAN REMPLACE
 *
 * Trois seuils tiraient la même conclusion d'un profil illisible :
 *
 *   • `app/index.tsx` renvoyait vers l'onboarding — un administrateur de dix
 *     ans d'ancienneté se voyait proposer de créer son compte ;
 *   • `app/(admin)/_layout.tsx` redirigeait vers l'espace pilote, en plein
 *     pointage du jour J, sans un mot ;
 *   • `app/(coach)/_layout.tsx` rendait `null` — un écran noir, sans rien.
 *
 * Aucun ne distinguait « ce compte n'a pas de fiche » de « je n'ai pas pu lire
 * sa fiche ». Et comme la seule porte de retour vers l'espace admin dépend elle
 * aussi du profil, elle disparaissait au même instant : il ne restait qu'à
 * tuer l'application et la relancer.
 *
 * ---
 *
 * CE QU'IL FAIT
 *
 * Il dit ce qui s'est passé, sans accuser personne, et propose de réessayer.
 * Rien d'autre : il ne déconnecte pas, il ne redirige pas. Une lecture ratée
 * sur le réseau d'un circuit n'est pas un problème de compte, et l'application
 * n'a pas à trancher à la place de quelqu'un qui a seulement un mauvais signal.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Screen } from '@/ui/Screen';

export function ProfilIndisponible() {
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [enCours, setEnCours] = useState(false);

  const reessayer = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      await refreshProfile();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.screen,
          gap: theme.spacing.lg,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: theme.fonts.display,
            fontSize: theme.fontSize.h2,
            color: theme.palette.cream,
          }}
        >
          Votre compte n&apos;a pas pu être lu.
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSize.body,
            lineHeight: 22,
            color: theme.palette.creamMute,
          }}
        >
          Votre session est ouverte. C&apos;est la lecture de votre fiche qui n&apos;a pas abouti —
          le plus souvent une question de réseau.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réessayer la lecture du compte"
          accessibilityState={{ busy: enCours }}
          onPress={reessayer}
          hitSlop={theme.hitSlop}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.palette.cardBorderProminent,
            opacity: pressed || enCours ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              fontSize: theme.fontSize.body,
              color: theme.palette.cream,
            }}
          >
            {enCours ? 'Lecture…' : 'Réessayer'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
