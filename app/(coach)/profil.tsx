/**
 * Écran Coach — Mon profil (édition de la fiche vue par les pilotes).
 *
 * Le coach édite SA fiche `coach_profiles` (RLS owner). Champs texte + liens +
 * spécialités/circuits (saisie virgules) + tarif indicatif + publication.
 * Média photo/vidéo : incrément suivant (upload). Doctrine : sobre, vouvoiement,
 * accent coach ; le tarif est indicatif (règlement de gré à gré, hors app).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  getMyCoachProfile,
  parseTagList,
  updateMyCoachProfile,
} from '@/services/coachProfileService';
import {
  addMyCoachMedia,
  type CoachMediaType,
  type CoachMediaView,
  listMyCoachMedia,
  removeMyCoachMedia,
} from '@/services/coachMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function CoachProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [palmares, setPalmares] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [circuits, setCircuits] = useState('');
  const [price, setPrice] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [published, setPublished] = useState(false);
  const [media, setMedia] = useState<CoachMediaView[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyCoachMedia().then((m) => {
        if (!cancelled) setMedia(m);
      });
      getMyCoachProfile()
        .then((p) => {
          if (cancelled) return;
          setHeadline(p.headline ?? '');
          setBio(p.bio ?? '');
          setPalmares(p.palmares ?? '');
          setSpecialties(p.specialties.join(', '));
          setCircuits(p.circuits.join(', '));
          setPrice(p.seasonPriceEur != null ? String(p.seasonPriceEur) : '');
          setWebsite(p.websiteUrl ?? '');
          setInstagram(p.instagramUrl ?? '');
          setYoutube(p.youtubeUrl ?? '');
          setPublished(p.isPublished);
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
    const raw = price.trim() ? Number(price.replace(',', '.')) : null;
    const priceNum = raw != null && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : null;
    const res = await updateMyCoachProfile({
      headline,
      bio,
      palmares,
      specialties: parseTagList(specialties),
      circuits: parseTagList(circuits),
      seasonPriceEur: priceNum,
      websiteUrl: website,
      instagramUrl: instagram,
      youtubeUrl: youtube,
      isPublished: published,
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Fiche enregistrée.' });
  }

  async function onAddMedia(type: CoachMediaType) {
    setMediaBusy(true);
    const res = await addMyCoachMedia(type);
    setMediaBusy(false);
    if (res.ok) {
      setMedia(res.items);
      Toast.show({
        type: 'success',
        text1: type === 'video' ? 'Vidéo ajoutée.' : 'Photo ajoutée.',
      });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  async function onRemoveMedia(id: string) {
    const res = await removeMyCoachMedia(id);
    if (res.ok) {
      setMedia(res.items);
    } else {
      Toast.show({ type: 'error', text1: res.error });
    }
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
          Votre fiche coach.
        </Text>
        <Text style={s.intro}>
          Ce que les pilotes voient de vous. Publiez-la pour apparaître dans la découverte.
        </Text>

        <View style={s.pubBlock}>
          <SectionLabel>Publication</SectionLabel>
          <View style={s.pubRow}>
            {[
              { v: true, label: 'Publiée' },
              { v: false, label: 'Masquée' },
            ].map((o) => {
              const on = published === o.v;
              return (
                <Pressable
                  key={o.label}
                  onPress={() => setPublished(o.v)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={o.label}
                  hitSlop={6}
                  style={[s.pubPill, on ? s.pubPillOn : null]}
                >
                  <Text style={[s.pubPillT, on ? s.pubPillTOn : null]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.pubHint}>Une fiche publiée apparaît dans la découverte des pilotes.</Text>
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Field
            label="Accroche"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Coach pilotage, circuit & data"
            maxLength={80}
          />
          <Field
            label="Présentation"
            value={bio}
            onChangeText={setBio}
            placeholder="Votre approche, votre parcours…"
            multiline
            maxLength={1000}
            showCounter
          />
          <Field
            label="Palmarès"
            optional
            value={palmares}
            onChangeText={setPalmares}
            placeholder="Titres, podiums, références…"
            multiline
            maxLength={500}
          />
          <Field
            label="Spécialités"
            value={specialties}
            onChangeText={setSpecialties}
            placeholder="Trajectoire, freinage, data"
            helper="Séparées par des virgules."
          />
          <Field
            label="Circuits"
            value={circuits}
            onChangeText={setCircuits}
            placeholder="Haute Saintonge, Charente"
            helper="Séparés par des virgules."
          />
          <Field
            label="Tarif de saison"
            optional
            value={price}
            onChangeText={setPrice}
            placeholder="1500"
            keyboardType="number-pad"
            unit="€"
            helper="Indicatif. Le règlement se fait de gré à gré, hors application."
          />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Liens</SectionLabel>
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

        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Médias</SectionLabel>
          <Text style={s.mediaHint}>
            Photos et vidéos de votre fiche, visibles par les pilotes.
          </Text>

          {media.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: theme.spacing.md }}
              contentContainerStyle={{ gap: theme.spacing.sm }}
            >
              {media.map((m) => (
                <View key={m.id} style={s.mediaTile}>
                  {m.type === 'photo' ? (
                    <Image
                      source={{ uri: m.url }}
                      style={s.mediaThumb}
                      resizeMode="cover"
                      accessibilityLabel="Photo de la fiche"
                    />
                  ) : (
                    <View style={[s.mediaThumb, s.mediaVideo]}>
                      <Text style={s.mediaVideoT}>Vidéo</Text>
                    </View>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retirer ce média"
                    hitSlop={6}
                    onPress={() => onRemoveMedia(m.id)}
                    style={s.mediaRemove}
                  >
                    <Text style={s.mediaRemoveT}>Retirer</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={s.mediaEmpty}>Aucun média pour l&apos;instant.</Text>
          )}

          <View style={s.mediaActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une photo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('photo')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une vidéo"
              disabled={mediaBusy}
              onPress={() => onAddMedia('video')}
              style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={s.mediaBtnT}>Ajouter une vidéo</Text>
            </Pressable>
          </View>

          {mediaBusy ? (
            <ActivityIndicator
              color={theme.palette.creamMute}
              style={{ marginTop: theme.spacing.md }}
              accessibilityLabel="Envoi du média en cours"
            />
          ) : null}
        </View>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Button label="Enregistrer ma fiche" loading={saving} onPress={onSave} />
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
  pubBlock: { gap: theme.spacing.md },
  pubRow: { flexDirection: 'row' as const, gap: theme.spacing.sm },
  pubPill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pubPillOn: { borderColor: theme.palette.coach, backgroundColor: 'rgba(229,229,229,0.08)' },
  pubPillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  pubPillTOn: { color: theme.palette.cream },
  pubHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  mediaHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xs,
  },
  mediaEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    marginTop: theme.spacing.md,
  },
  mediaTile: { width: 120 },
  mediaThumb: {
    width: 120,
    height: 120,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  mediaVideo: { alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaVideoT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  mediaRemove: {
    minHeight: 36,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  mediaRemoveT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  mediaActions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  mediaBtn: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.coach,
  },
  mediaBtnT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.coach,
  },
};
