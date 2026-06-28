/**
 * Carte de licence OXV — profil partageable (PR-65).
 *
 * Charge le passeport du pilote (identité cumulée) et rend une LicenseCard
 * capturable en image (react-native-view-shot) → feuille de partage OS. Un
 * insigne factuel, jamais un rang. Aucune exposition de données : c'est une image.
 */

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { LicenseCard } from '@/components/LicenseCard';
import { FadeInSection } from '@/components/motion';
import { type Passport, loadPassport } from '@/services/passportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

function prettyLevel(level: string | null | undefined): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return 'Pilote OXV';
  }
}

function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function CarteLicenceScreen() {
  const profile = useAuthStore((s) => s.profile);
  const cardRef = useRef<View>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const reload = useCallback(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPassport(profile.id).then((p) => {
      if (!cancelled) {
        setPassport(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useFocusEffect(reload);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma licence OXV',
          UTI: 'public.png',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter.
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="CARTE DE LICENCE" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasData = (passport?.stats.totalSessions ?? 0) > 0;
  if (!passport || !hasData) {
    return (
      <Screen scroll={false}>
        <AppBar title="CARTE DE LICENCE" onBack={() => router.back()} />
        <View style={s.center}>
          <Text style={s.emptyTitle} accessibilityRole="header">
            Licence à composer.
          </Text>
          <Text style={s.emptyBody}>Votre carte se compose au fil de vos séances analysées.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="CARTE DE LICENCE" subtitle="VERS L'EXTÉRIEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <FadeInSection>
          <SectionLabel>VOTRE IDENTITÉ, EN UNE CARTE</SectionLabel>
        </FadeInSection>

        <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xxl }}>
          <LicenseCard
            ref={cardRef}
            name={profile?.first_name?.trim() || 'Pilote'}
            level={prettyLevel(profile?.pilot_level)}
            since={sinceLabel(passport.memberSince)}
            axes={passport.signature.axes}
            sessions={passport.stats.totalSessions}
            circuits={passport.circuitCount}
            laps={passport.stats.totalLaps}
          />
        </View>

        <FadeInSection delay={80}>
          <Button label="Partager" onPress={onShare} loading={sharing} />
        </FadeInSection>

        <FadeInSection delay={160}>
          <Text style={s.note}>
            {Platform.OS === 'ios'
              ? 'La feuille de partage couvre Story et Enregistrer.'
              : 'Partagez l’image ou enregistrez-la depuis la feuille système.'}
          </Text>
        </FadeInSection>
      </View>
    </Screen>
  );
}

const s = {
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    color: theme.palette.cream,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.md,
  },
  emptyBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.body * 1.5,
  },
  note: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.lg,
  },
};
