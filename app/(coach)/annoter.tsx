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
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Chip/Button du kit. Accent
 * coach = theme.palette.coach (crème neutre). Logique inchangée.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getCorner } from '@/lib/circuitTopology';
import {
  type AnnotationVisibility,
  type CoachAnnotation,
  createAnnotation,
  deleteAnnotation,
  listMyAnnotationsForCorner,
  updateAnnotation,
} from '@/services/coachAnnotationsService';
import { type CoachAnnotationTemplate } from '@/services/coachCurationLogic';
import { listMyTemplates } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { SectionLabel } from '@/ui/SectionLabel';
import { Screen } from '@/ui/Screen';
import { formatDateShort } from '@/utils/format';

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
  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMyTemplates().then((rows) => {
      if (!cancelled) setTemplates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTemplate = (tpl: CoachAnnotationTemplate) => {
    setBody((prev) => (prev.trim().length > 0 ? `${prev}\n${tpl.body}` : tpl.body));
  };

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
    <Screen>
      <AppBar title="ANNOTER" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Text style={s.title}>{corner?.name ?? `Virage ${cornerIndex}`}</Text>
          <Text style={s.subtitle}>
            {params.sessionId ? 'Note attachée à cette session' : 'Note générique sur le virage'}
          </Text>

          {/* Notes existantes */}
          {loading ? (
            <Text style={s.caption}>Chargement…</Text>
          ) : annotations.length === 0 ? (
            <Text style={[s.caption, { marginBottom: theme.spacing.xl }]}>
              Aucune note pour l&apos;instant.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
              <SectionLabel>
                {`${annotations.length} NOTE${annotations.length > 1 ? 'S' : ''} EXISTANTE${
                  annotations.length > 1 ? 'S' : ''
                }`}
              </SectionLabel>
              {annotations.map((a) => (
                <Card
                  key={a.id}
                  style={
                    a.visibility === 'private'
                      ? { borderColor: theme.palette.line }
                      : { borderColor: theme.palette.coach }
                  }
                >
                  <View style={s.noteHead}>
                    <Text
                      style={[
                        s.noteFlag,
                        {
                          color:
                            a.visibility === 'private'
                              ? theme.palette.creamMute
                              : theme.palette.coach,
                        },
                      ]}
                    >
                      {a.visibility === 'private' ? 'BROUILLON' : 'PARTAGÉE'}
                    </Text>
                    <Text style={s.noteDate}>{formatDateShort(a.createdAt)}</Text>
                  </View>
                  <Text style={s.noteBody}>{a.body}</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: theme.spacing.lg,
                      marginTop: theme.spacing.md,
                    }}
                  >
                    <Pressable accessibilityRole="button" onPress={() => onEdit(a)}>
                      <Text style={s.actionEdit}>Modifier</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => onDelete(a.id)}>
                      <Text style={s.actionDelete}>Supprimer</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Formulaire */}
          <View style={{ marginTop: theme.spacing.xxl }} />

          {/* Gabarits réutilisables (§10.3c-C) — appui pour insérer. */}
          {templates.length > 0 ? (
            <View style={s.templateRow}>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Insérer le gabarit ${t.label}`}
                  onPress={() => applyTemplate(t)}
                  style={({ pressed }) => [s.templateChip, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={s.templateChipText}>+ {t.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Field
            label={editingId ? 'Modifier la note' : 'Nouvelle note'}
            value={body}
            onChangeText={setBody}
            placeholder="Ce que vous avez observé sur ce virage. Sobre, descriptif, ouvert."
            multiline
            numberOfLines={6}
            maxLength={1000}
            showCounter
          />

          {/* Toggle visibilité */}
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg }}
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
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xl }}
          >
            <View style={{ flex: 1 }}>
              <Button
                label={editingId ? 'Mettre à jour' : 'Enregistrer'}
                onPress={onSave}
                disabled={saving || !body.trim()}
              />
            </View>
            {editingId ? (
              <Button
                label="Annuler"
                variant="ghost"
                onPress={() => {
                  setEditingId(null);
                  setBody('');
                  setVisibility('shared');
                }}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
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
      style={({ pressed }) => [
        s.visChip,
        active ? s.visChipOn : null,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[s.visChipText, active ? s.visChipTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  noteHead: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing.xs,
  },
  noteFlag: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  noteDate: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  noteBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.body * 1.5,
  },
  actionEdit: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
  },
  actionDelete: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
  },
  templateRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  templateChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  templateChipText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.creamSoft,
  },
  visChip: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
  },
  visChipOn: {
    borderColor: theme.palette.coach,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  visChipText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  visChipTextOn: {
    color: theme.palette.cream,
  },
};
