/**
 * Écran #09 — Placement. Design V2 (charte oxv-mirror-app).
 *
 * Dernière étape paddock avant le silence en piste. Instructions de
 * placement physique du boîtier. À l'action "C'est fait", l'app entre
 * dans S6 (roulage) — aucun écran ne sera affiché jusqu'à la fin de
 * session.
 *
 * Doctrine : sous-titre rassurant *"Vous le verrez peu. Il s'occupera
 * du reste."* — pose la promesse du silence.
 *
 * Reskin V2 : Screen + AppBar, titres Syncopate, illustration en Card.
 * Écran d'état de flux sans retour manuel. Le CTA passe par le Button du kit
 * (état `loading` : libellé conservé + `busy` lecteurs d'écran) pendant le
 * démarrage de la capture. Logique de capture inchangée.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { startCaptureSession } from '@/services/captureSessionService';
import { captureFinishLineFor } from '@/services/captureFinishLineLogic';
import { fetchCircuits, getDefaultCircuit, type Circuit } from '@/services/circuitsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function PlacementScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Circuits disponibles (multi-circuit) : le pilote choisit avant de lancer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await fetchCircuits();
      if (cancelled) return;
      const official = all.filter((c) => c.isOfficial);
      const list = official.length > 0 ? official : all;
      setCircuits(list);
      const def = await getDefaultCircuit();
      if (!cancelled) setSelectedId(def?.id ?? list[0]?.id ?? null);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = circuits.find((c) => c.id === selectedId) ?? null;

  async function onStart() {
    if (starting) return;
    if (!profile?.id) {
      setError('Profil non chargé. Reconnectez-vous.');
      return;
    }
    setStarting(true);
    setError(null);
    // Rattache la session au circuit CHOISI par le pilote (multi-circuit). Repli
    // sur le circuit par défaut si la sélection n'a pas encore chargé.
    const circuit = selected ?? (await getDefaultCircuit());
    // Démarre l'enregistrement réel (création session + écriture des trames).
    // On passe la ligne d'arrivée DU CIRCUIT CHOISI → sinon la détection de tours
    // retombe sur un défaut codé en dur (aucun tour compté sur Haute Saintonge /
    // Charente). `captureFinishLineFor` renvoie undefined si la ligne n'est pas
    // renseignée (jamais une fausse ligne).
    const res = await startCaptureSession({
      userId: profile.id,
      circuitId: circuit?.id ?? null,
      circuitName: circuit?.name ?? null,
      finishLine: captureFinishLineFor(circuit),
    });
    if (res.ok) {
      hapticSuccess();
      router.replace('/(app)/roulage');
    } else {
      setStarting(false);
      setError(res.error ?? "L'enregistrement n'a pas pu démarrer.");
    }
  }

  return (
    <Screen scroll={false}>
      <AppBar title="PLACEMENT" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={s.eyebrow}>PLACEMENT</Text>

          {circuits.length > 1 ? (
            <View style={s.circuitBlock}>
              <SectionLabel>Votre circuit</SectionLabel>
              <View style={s.circuitRow}>
                {circuits.map((c) => {
                  const on = c.id === selectedId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedId(c.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={c.name}
                      hitSlop={6}
                      style={[s.circuitPill, on ? s.circuitPillOn : null]}
                    >
                      <Text style={[s.circuitName, on ? s.circuitNameOn : null]}>{c.name}</Text>
                      {c.lengthKm ? (
                        <Text style={s.circuitMeta}>
                          {c.lengthKm.toFixed(1).replace('.', ',')} km
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text style={s.headline} accessibilityRole="header">
            Posez le boîtier sur le support magnétique côté passager.
          </Text>

          {/* Illustration schématique simple : un bloc qui évoque le tableau de bord */}
          <Card
            style={{
              height: 160,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: theme.spacing.xxl,
            }}
          >
            <View style={s.badge}>
              <Text style={s.badgeTxt}>OXV</Text>
            </View>
            <View style={{ marginTop: theme.spacing.md }}>
              <SectionLabel>Support magnétique</SectionLabel>
            </View>
          </Card>

          <Text style={s.manifest}>Vous le verrez peu. Il s'occupera du reste.</Text>

          {error ? (
            <Text style={s.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </View>

        <Button label="C'est fait" onPress={onStart} loading={starting} />
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginBottom: theme.spacing.lg,
  },
  headline: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginBottom: theme.spacing.xxl,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.red,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeTxt: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.small,
    letterSpacing: 1,
    color: theme.palette.cream,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    lineHeight: theme.fontSize.body * 1.5,
    color: theme.palette.red,
    marginTop: theme.spacing.lg,
  },
  circuitBlock: {
    marginBottom: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  circuitRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  circuitPill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  circuitPillOn: {
    borderColor: theme.palette.gold,
    backgroundColor: 'rgba(255,183,3,0.10)',
  },
  circuitName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  circuitNameOn: {
    color: theme.palette.cream,
  },
  circuitMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: theme.palette.faint,
    marginTop: 2,
  },
};
