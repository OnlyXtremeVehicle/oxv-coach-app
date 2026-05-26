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
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateLong } from '@/utils/format';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>ADMIN OXV</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Médias par session
        </Text>

        {/* Sélecteur session */}
        <Text
          style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.sm }]}
        >
          1. CHOISIR UNE SESSION
        </Text>
        {loadingSessions ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : sessions.length === 0 ? (
          <Text style={emptyStyle}>Aucune session complétée trouvée.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm }}>
              {sessions.map((s) => {
                const active = selectedSession?.id === s.id;
                const pilotName =
                  [s.userFirstName, s.userLastName].filter(Boolean).join(' ').trim() ||
                  `Pilote ${s.userId.slice(0, 6)}`;
                return (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedSession(s)}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: borderRadius.md,
                      borderWidth: 0.5,
                      borderColor: active ? colors.accent.red : colors.border.subtle,
                      backgroundColor: active
                        ? 'rgba(200, 16, 46, 0.10)'
                        : colors.background.secondary,
                      maxWidth: 220,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text.primary,
                        fontSize: fontSize.caption,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {pilotName}
                    </Text>
                    <Text
                      style={{
                        color: colors.text.tertiary,
                        fontSize: fontSize.eyebrow,
                        marginTop: 2,
                      }}
                    >
                      {s.startedAt ? formatDateLong(s.startedAt) : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Zone média */}
        {selectedSession ? (
          <View style={{ marginTop: spacing.xxl }}>
            <Text
              style={[
                typography.eyebrow,
                { color: colors.text.tertiary, marginBottom: spacing.sm },
              ]}
            >
              2. MÉDIAS ({media.length})
            </Text>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                onPress={() => handlePickAndUpload('photo')}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.accent.red,
                  alignItems: 'center',
                  opacity: pressed || uploading ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.background.primary,
                    fontSize: fontSize.caption,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {uploading ? 'Upload…' : 'Ajouter photo'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={uploading}
                onPress={() => handlePickAndUpload('video')}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.border.medium,
                  alignItems: 'center',
                  opacity: pressed || uploading ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.caption,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Ajouter vidéo
                </Text>
              </Pressable>
            </View>

            {loadingMedia ? (
              <ActivityIndicator color={colors.text.secondary} />
            ) : media.length === 0 ? (
              <Text style={emptyStyle}>Aucun média pour cette session. Ajoutez-en ci-dessus.</Text>
            ) : (
              <View style={{ gap: spacing.md }}>
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
          <Text style={[emptyStyle, { marginTop: spacing.xxl, fontStyle: 'italic' as const }]}>
            Sélectionnez une session ci-dessus pour gérer ses médias.
          </Text>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      {/* Thumbnail */}
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: borderRadius.sm,
          overflow: 'hidden',
          backgroundColor: colors.background.primary,
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
            <Text
              style={{
                color: colors.text.tertiary,
                fontSize: fontSize.eyebrow,
                letterSpacing: 1,
              }}
            >
              {item.mediaType === 'video' ? 'VIDÉO' : '—'}
            </Text>
          </View>
        )}
      </View>

      {/* Info + actions */}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text
          style={{
            color: colors.text.tertiary,
            fontSize: fontSize.eyebrow,
            letterSpacing: 1,
          }}
        >
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
          placeholderTextColor={colors.text.tertiary}
          style={{
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
            fontSize: fontSize.caption,
            color: colors.text.primary,
          }}
          accessibilityLabel="Caption du média"
        />
        <Pressable
          accessibilityRole="button"
          onPress={onDelete}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: colors.accent.red,
              fontSize: fontSize.eyebrow,
              letterSpacing: 1,
            }}
          >
            SUPPRIMER
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const emptyStyle = {
  color: colors.text.tertiary,
  fontSize: fontSize.caption,
  textAlign: 'center' as const,
  padding: spacing.lg,
};
