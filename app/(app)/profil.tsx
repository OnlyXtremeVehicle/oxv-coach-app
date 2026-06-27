/**
 * Écran Pilote — Mon profil (niveau, expérience, licence, véhicule, réseaux).
 *
 * Le pilote édite sa propre ligne `users` (RLS self-update). C'est ce que son
 * coach affilié verra (affichage côté coach = incrément suivant). Média
 * photo/vidéo : upload à venir. Doctrine : sobre, vouvoiement, factuel ; le
 * vocabulaire de niveau est figé (« Apprivoisé » pour intermédiaire).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  PILOT_LEVELS,
  getMyPilotProfile,
  updateMyPilotProfile,
} from '@/services/pilotProfileService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function PilotProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [level, setLevel] = useState<string | null>(null);
  const [experience, setExperience] = useState('');
  const [ffsa, setFfsa] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getMyPilotProfile()
        .then((p) => {
          if (cancelled) return;
          setLevel(p.pilotLevel);
          setExperience(p.experienceYears ?? '');
          setFfsa(p.ffsaLicense ?? '');
          setVehicle(p.vehicle ?? '');
          setWebsite(p.socials.website ?? '');
          setInstagram(p.socials.instagram ?? '');
          setYoutube(p.socials.youtube ?? '');
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function onSave() {
    setSaving(true);
    const res = await updateMyPilotProfile({
      pilotLevel: level,
      experienceYears: experience,
      ffsaLicense: ffsa,
      vehicle,
      socials: { website, instagram, youtube },
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Profil enregistré.' });
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="MON PROFIL" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="MON PROFIL" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          Votre profil pilote.
        </Text>
        <Text style={s.intro}>
          Ce que votre coach voit de vous : vos repères, votre véhicule, vos réseaux.
        </Text>

        <View style={s.block}>
          <SectionLabel>Niveau</SectionLabel>
          <View style={s.row}>
            {PILOT_LEVELS.map((l) => {
              const on = level === l.value;
              return (
                <Pressable
                  key={l.value}
                  onPress={() => setLevel(l.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={l.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillT, on ? s.pillTOn : null]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Field
            label="Années d'expérience"
            optional
            value={experience}
            onChangeText={setExperience}
            placeholder="ex. 5 ans, débuts en 2019…"
          />
          <Field
            label="Licence FFSA"
            optional
            value={ffsa}
            onChangeText={setFfsa}
            placeholder="Numéro de licence"
          />
          <Field
            label="Véhicule"
            optional
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="Marque, modèle, préparation…"
            multiline
            maxLength={200}
          />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Réseaux</SectionLabel>
          <View style={{ marginTop: theme.spacing.md }}>
            <Field
              label="Site web"
              optional
              value={website}
              onChangeText={setWebsite}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="Instagram"
              optional
              value={instagram}
              onChangeText={setInstagram}
              placeholder="https://instagram.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="YouTube"
              optional
              value={youtube}
              onChangeText={setYoutube}
              placeholder="https://youtube.com/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </View>

        <View style={s.mediaNote}>
          <Text style={s.mediaNoteT}>Photos et vidéos : bientôt disponibles ici.</Text>
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Button label="Enregistrer mon profil" loading={saving} onPress={onSave} />
        </View>
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  block: { gap: theme.spacing.md },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.gold, backgroundColor: 'rgba(255,183,3,0.10)' },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  mediaNote: {
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  mediaNoteT: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
};
