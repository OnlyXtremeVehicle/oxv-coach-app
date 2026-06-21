/**
 * Écran admin — gestion des médias par session (Média 3/3).
 *
 * Flow simple :
 *   1. Admin choisit une session récente (combobox)
 *   2. Voit la liste des médias déjà uploadés
 *   3. Ajoute photo / vidéo via expo-image-picker
 *   4. Peut soft-delete un média ou ajouter une caption
 *
 * Sécurité : RLS DB + Storage filtrent. Seuls les admins peuvent
 * INSERT/UPDATE/DELETE. Si un non-admin atterrit ici (impossible via
 * le routing mais filet de sécurité), tous les calls échouent.
 *
 * Note : on n'a pas d'écran « liste de toutes les sessions » dédié —
 * cet écran joue ce rôle pour la V1.
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin). Logique d'upload / suppression / caption inchangée.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

import { supabase } from '@/lib/supabase';
import {
  type SessionMediaItem,
  listSessionMedia,
  softDeleteSessionMedia,
  updateSessionMedia,
  uploadSessionMedia,
} from '@/services/sessionMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateLong } from '@/utils/format';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';

interface SessionOption {
  id: string;
  userId: string;
  userFirstName: string | null;
  userLastName: string | null;
  startedAt: string;
  circuitName: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string | null;
  circuit_name: string | null;
  users: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export default function AdminSessionsMediaScreen() {
  const profile = useAuthStore((s) => s.profile);

  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionOption | null>(null);
  const [media, setMedia] = useState<SessionMediaItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load sessions (50 dernières completed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, started_at, circuit_name, users(first_name, last_name)')
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error || !data) {
        console.warn('[admin/media] sessions load error:', error?.message);
        setLoadingSessions(false);
        return;
      }
      setSessions(
        (data as unknown as SessionRow[]).map((r) => ({
          id: r.id,
          userId: r.user_id,
          userFirstName: r.users?.first_name ?? null,
          userLastName: r.users?.last_name ?? null,
          startedAt: r.started_at ?? '',
          circuitName: r.circuit_name,
        }))
      );
      setLoadingSessions(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load media when session selected
  const reloadMedia = useCallback(async () => {
    if (!selectedSession) {
      setMedia([]);
      return;
    }
    setLoadingMedia(true);
    const items = await listSessionMedia(selectedSession.id);
    setMedia(items);
    setLoadingMedia(false);
  }, [selectedSession]);

  useEffect(() => {
    void reloadMedia();
  }, [reloadMedia]);

  async function handlePickAndUpload(mediaType: 'photo' | 'video') {
    if (!selectedSession || !profile?.id) return;

    // Permission + picker
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès aux médias pour uploader.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        mediaType === 'video'
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const uri = asset.uri;
        const fileExtension =
          uri.split('.').pop()?.toLowerCase() ?? (mediaType === 'video' ? 'mp4' : 'jpg');
        const mime =
          asset.mimeType ??
          (mediaType === 'video'
            ? 'video/mp4'
            : fileExtension === 'png'
              ? 'image/png'
              : 'image/jpeg');

        // Convertit l'URI local en Blob via base64 (compatible RN sans fetch URI)
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = Buffer.from(base64, 'base64');
        const blob = new Blob([bytes], { type: mime });

        const res = await uploadSessionMedia({
          telemetrySessionId: selectedSession.id,
          pilotUserId: selectedSession.userId,
          fileBlob: blob,
          mimeType: mime,
          fileNameSuggestedExtension: fileExtension,
          mediaType,
          caption: null,
          uploadedByUserId: profile.id,
          widthPx: asset.width ?? null,
          heightPx: asset.height ?? null,
          durationSeconds: 'duration' in asset && asset.duration ? asset.duration / 1000 : null,
        });
        if ('error' in res) {
          Alert.alert('Erreur upload', res.error);
          break;
        }
      }
      await reloadMedia();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mediaId: string) {
    Alert.alert('Supprimer ce média ?', 'Le pilote ne le verra plus.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const ok = await softDeleteSessionMedia(mediaId);
          if (ok) await reloadMedia();
        },
      },
    ]);
  }

  async function handleCaptionChange(mediaId: string, caption: string) {
    await updateSessionMedia(mediaId, { caption });
    await reloadMedia();
  }

  return (
    <Screen>
      <AppBar title="MÉDIAS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN OXV</Text>
        <Text style={s.title}>Médias par session</Text>

        {/* Sélecteur session */}
        <Text style={s.sectionLabel}>1. CHOISIR UNE SESSION</Text>
        {loadingSessions ? (
          <ActivityIndicator color={BRONZE} />
        ) : sessions.length === 0 ? (
          <Text style={s.empty}>Aucune session complétée trouvée.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.sm,
              }}
            >
              {sessions.map((session) => {
                const active = selectedSession?.id === session.id;
                const pilotName =
                  [session.userFirstName, session.userLastName].filter(Boolean).join(' ').trim() ||
                  `Pilote ${session.userId.slice(0, 6)}`;
                return (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedSession(session)}
                    style={({ pressed }) => ({
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: active ? BRONZE : theme.palette.line,
                      backgroundColor: active ? 'rgba(184,115,51,0.10)' : theme.palette.card2,
                      maxWidth: 220,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text numberOfLines={1} style={s.sessionName}>
                      {pilotName}
                    </Text>
                    <Text style={s.sessionDate}>
                      {session.startedAt ? formatDateLong(session.startedAt) : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Zone média */}
        {selectedSession ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <Text style={s.sectionLabel}>2. MÉDIAS ({media.length})</Text>

            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.lg,
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                onPress={() => handlePickAndUpload('photo')}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: BRONZE,
                  alignItems: 'center',
                  opacity: pressed || uploading ? 0.6 : 1,
                })}
              >
                <Text style={s.primaryBtnTxt}>{uploading ? 'Upload…' : 'Ajouter photo'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                onPress={() => handlePickAndUpload('video')}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.palette.edge,
                  alignItems: 'center',
                  opacity: pressed || uploading ? 0.6 : 1,
                })}
              >
                <Text style={s.ghostBtnTxt}>Ajouter vidéo</Text>
              </Pressable>
            </View>

            {loadingMedia ? (
              <ActivityIndicator color={BRONZE} />
            ) : media.length === 0 ? (
              <Text style={s.empty}>Aucun média pour cette session. Ajoutez-en ci-dessus.</Text>
            ) : (
              <View style={{ gap: theme.spacing.md }}>
                {media.map((m) => (
                  <AdminMediaRow
                    key={m.id}
                    item={m}
                    onDelete={() => handleDelete(m.id)}
                    onCaptionChange={(c) => handleCaptionChange(m.id, c)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={[s.empty, { marginTop: theme.spacing.xxl, fontStyle: 'italic' }]}>
            Sélectionnez une session ci-dessus pour gérer ses médias.
          </Text>
        )}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AdminMediaRow({
  item,
  onDelete,
  onCaptionChange,
}: {
  item: SessionMediaItem;
  onDelete: () => void;
  onCaptionChange: (c: string) => void;
}) {
  const [draftCaption, setDraftCaption] = useState(item.caption ?? '');

  return (
    <Card style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      {/* Thumbnail */}
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
          backgroundColor: theme.palette.night,
        }}
      >
        {item.mediaType === 'photo' && item.signedUrl ? (
          <Image
            source={{ uri: item.signedUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={s.thumbLabel}>{item.mediaType === 'video' ? 'VIDÉO' : '—'}</Text>
          </View>
        )}
      </View>

      {/* Info + actions */}
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Text style={s.mediaMeta}>
          {item.mediaType.toUpperCase()}
          {item.fileSizeBytes ? ` · ${Math.round(item.fileSizeBytes / 1024)} Ko` : ''}
        </Text>
        <TextInput
          value={draftCaption}
          onChangeText={setDraftCaption}
          onBlur={() => {
            if (draftCaption !== (item.caption ?? '')) onCaptionChange(draftCaption);
          }}
          placeholder="Caption optionnelle…"
          placeholderTextColor={theme.palette.creamMute}
          style={s.captionInput}
          accessibilityLabel="Caption du média"
        />
        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={s.deleteTxt}>SUPPRIMER</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginBottom: theme.spacing.sm,
  },
  sessionName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  sessionDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  primaryBtnTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#000',
  },
  ghostBtnTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  thumbLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  mediaMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  deleteTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: theme.palette.red,
  },
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    padding: theme.spacing.lg,
  },
};
