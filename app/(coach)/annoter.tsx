/**
 * Écran Coach — Annoter un virage d'un pilote suivi.
 *
 * Le coach arrive avec params {pilotId, cornerIndex, sessionId?} et
 * peut :
 *   - Voir ses notes existantes sur ce virage
 *   - Ajouter une nouvelle note (visibilité shared par défaut)
 *   - Éditer / supprimer ses propres notes
 *   - Basculer la visibilité (private = brouillon, shared = visible pilote)
 *
 * Doctrine : ton sobre rappelé en placeholder du textarea. Le coach
 * peut bien sûr écrire ce qu'il veut — la doctrine est là pour le
 * cadrer, pas pour censurer.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { getCorner } from '@/lib/circuitTopology';
import {
  type CoachAnnotation,
  type AnnotationVisibility,
  createAnnotation,
  deleteAnnotation,
  listMyAnnotationsForCorner,
  updateAnnotation,
} from '@/services/coachAnnotationsService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachAnnoterScreen() {
  const params = useLocalSearchParams<{
    pilotId?: string;
    cornerIndex?: string;
    sessionId?: string;
  }>();
  const cornerIndex = Number(params.cornerIndex ?? '1');
  const corner = getCorner(cornerIndex);

  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<AnnotationVisibility>('shared');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = async () => {
    if (!params.pilotId) return;
    const rows = await listMyAnnotationsForCorner(
      params.pilotId,
      cornerIndex,
      params.sessionId ?? undefined
    );
    setAnnotations(rows);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.pilotId, cornerIndex, params.sessionId]);

  const onSave = async () => {
    if (!params.pilotId || !body.trim()) return;
    setSaving(true);
    if (editingId) {
      await updateAnnotation(editingId, { body, visibility });
    } else {
      await createAnnotation({
        pilotId: params.pilotId,
        cornerIndex,
        telemetrySessionId: params.sessionId ?? null,
        body,
        visibility,
      });
    }
    setBody('');
    setVisibility('shared');
    setEditingId(null);
    await reload();
    setSaving(false);
  };

  const onEdit = (a: CoachAnnotation) => {
    setEditingId(a.id);
    setBody(a.body);
    setVisibility(a.visibility);
  };

  const onDelete = async (id: string) => {
    await deleteAnnotation(id);
    if (editingId === id) {
      setEditingId(null);
      setBody('');
    }
    await reload();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>ANNOTER</Text>
          <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>
            {corner?.name ?? `Virage ${cornerIndex}`}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
          >
            {params.sessionId ? 'Note attachée à cette session' : 'Note générique sur le virage'}
          </Text>

          {/* Notes existantes */}
          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : annotations.length === 0 ? (
            <Text
              style={[
                typography.caption,
                { color: colors.text.tertiary, marginBottom: spacing.xl },
              ]}
            >
              Aucune note pour l'instant.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm, marginBottom: spacing.xxl }}>
              <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
                {annotations.length} NOTE{annotations.length > 1 ? 'S' : ''} EXISTANTE
                {annotations.length > 1 ? 'S' : ''}
              </Text>
              {annotations.map((a) => (
                <View
                  key={a.id}
                  style={{
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor:
                      a.visibility === 'private' ? colors.border.medium : colors.accent.coach,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: spacing.xs,
                    }}
                  >
                    <Text
                      style={[
                        typography.eyebrow,
                        {
                          color:
                            a.visibility === 'private' ? colors.text.tertiary : colors.accent.coach,
                        },
                      ]}
                    >
                      {a.visibility === 'private' ? 'BROUILLON' : 'PARTAGÉE'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                      {dateShort(a.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.body,
                      lineHeight: fontSize.body * 1.5,
                    }}
                  >
                    {a.body}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.lg,
                      marginTop: spacing.md,
                    }}
                  >
                    <Pressable accessibilityRole="button" onPress={() => onEdit(a)}>
                      <Text
                        style={{
                          color: colors.accent.coach,
                          fontSize: fontSize.caption,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        Modifier
                      </Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onDelete(a.id)}>
                      <Text style={{ color: colors.accent.red, fontSize: fontSize.caption }}>
                        Supprimer
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Formulaire */}
          <Text
            style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
          >
            {editingId ? 'MODIFIER LA NOTE' : 'NOUVELLE NOTE'}
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Ce que vous avez observé sur ce virage. Sobre, descriptif, ouvert."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={6}
            maxLength={1000}
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              padding: spacing.md,
              color: colors.text.primary,
              fontSize: fontSize.body,
              minHeight: 120,
              textAlignVertical: 'top',
            }}
          />
          <Text
            style={[
              typography.caption,
              { color: colors.text.tertiary, textAlign: 'right', marginTop: spacing.xs },
            ]}
          >
            {body.length} / 1000
          </Text>

          {/* Toggle visibilité */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              marginTop: spacing.lg,
            }}
          >
            <VisibilityChip
              label="Partagée avec le pilote"
              active={visibility === 'shared'}
              onPress={() => setVisibility('shared')}
            />
            <VisibilityChip
              label="Brouillon"
              active={visibility === 'private'}
              onPress={() => setVisibility('private')}
            />
          </View>

          {/* Boutons */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Pressable
              accessibilityRole="button"
              onPress={onSave}
              disabled={saving || !body.trim()}
              style={({ pressed }) => ({
                flex: 1,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                backgroundColor: !body.trim() ? colors.background.secondary : colors.accent.coach,
                borderWidth: 0.5,
                borderColor: !body.trim() ? colors.border.subtle : colors.accent.coach,
                alignItems: 'center',
                opacity: pressed ? 0.85 : !body.trim() ? 0.5 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </Text>
            </Pressable>
            {editingId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setEditingId(null);
                  setBody('');
                  setVisibility('shared');
                }}
                style={({ pressed }) => ({
                  padding: spacing.lg,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.border.subtle,
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>
                  Annuler
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                Retour
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function VisibilityChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: active ? 1 : 0.5,
        borderColor: active ? colors.accent.coach : colors.border.subtle,
        backgroundColor: active ? colors.background.elevated : colors.background.secondary,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: active ? colors.text.primary : colors.text.secondary,
          fontSize: fontSize.caption,
          fontWeight: active ? fontWeight.medium : fontWeight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function dateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
