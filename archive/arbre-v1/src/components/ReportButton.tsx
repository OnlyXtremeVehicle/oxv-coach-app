/**
 * ReportButton — signaler un contenu UGC (modération, M3).
 *
 * Action DISCRÈTE (jamais primaire) : un petit lien « Signaler » qui ouvre une
 * modale sobre (motif + précision si « autre »). Doctrine : ton sec, vouvoiement,
 * pas d'emoji, aucune mise au pilori. Le signaleur reste confidentiel.
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import {
  type ModerationReason,
  type ModerationTargetType,
  reasonLabel,
  reportContent,
} from '@/services/moderationService';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { SectionLabel } from '@/ui/SectionLabel';

const REASONS: ModerationReason[] = [
  'contenu_illicite',
  'spam',
  'usurpation',
  'inapproprie',
  'autre',
];

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ModerationTargetType;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ModerationReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setReason(null);
    setDetails('');
    setError(null);
    setDone(false);
  }

  async function onSubmit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const res = await reportContent({
      targetType,
      targetId,
      reason,
      details: details || undefined,
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
    } else {
      setError(res.error ?? 'Signalement impossible.');
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Signaler ce contenu"
        hitSlop={theme.hitSlop}
        onPress={() => {
          reset();
          setOpen(true);
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: theme.spacing.xs })}
      >
        <Text style={s.trigger}>Signaler</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            {done ? (
              <>
                <Text style={s.title}>Signalement reçu</Text>
                <Text style={s.body}>
                  Merci. Notre équipe examinera ce contenu. Vous restez confidentiel.
                </Text>
                <Button label="Fermer" onPress={() => setOpen(false)} />
              </>
            ) : (
              <>
                <Text style={s.title}>Signaler ce contenu</Text>
                <SectionLabel>Motif</SectionLabel>
                <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
                  {REASONS.map((r) => (
                    <Pressable
                      key={r}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: reason === r }}
                      accessibilityLabel={reasonLabel(r)}
                      onPress={() => setReason(r)}
                      style={({ pressed }) => [
                        s.reasonRow,
                        reason === r ? s.reasonRowActive : null,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={s.reasonText}>{reasonLabel(r)}</Text>
                    </Pressable>
                  ))}
                </View>

                {reason === 'autre' ? (
                  <Field
                    label="Précisez"
                    value={details}
                    onChangeText={setDetails}
                    multiline
                    maxLength={2000}
                  />
                ) : null}

                {error ? (
                  <Text style={s.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}

                <Button
                  label="Envoyer le signalement"
                  onPress={onSubmit}
                  loading={busy}
                  disabled={!reason || (reason === 'autre' && !details.trim())}
                />
                <Button label="Annuler" variant="ghost" onPress={() => setOpen(false)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = {
  trigger: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    textDecorationLine: 'underline' as const,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: theme.palette.card2,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.line,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.body * 1.5,
    marginBottom: theme.spacing.md,
  },
  reasonRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  reasonRowActive: {
    borderColor: theme.palette.cream,
    backgroundColor: theme.palette.card,
  },
  reasonText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
  },
};
