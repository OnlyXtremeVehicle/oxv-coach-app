/**
 * Prochaine fois (zone Carnet) — reskin FIDÈLE à la maquette Claude Design
 * refonte-v2 §7bis #7a (screens/25-prochaine-fois.png), règle fondateur
 * 2026-07-12 : le graphique v2 fait loi, l'héritage utile est retravaillé.
 *
 * Maquette : retour pastille + titre centré · intro muted « Ce que vous voulez
 * garder en tête pour votre prochaine séance. Vos mots, pas ceux de l'app. » ·
 * intentions NUMÉROTÉES (badge mono) · carte pointillée « + Ajouter une
 * intention ». Zéro suggestion pré-remplie : chaque carte est un texte écrit
 * PAR le pilote (session_intentions, own-row RLS).
 *
 * Saisie RÉELLE (nouveau) : composer câblé sur intentionsService, patron
 * IntentionCard de preparation.tsx (savePendingIntention + partage coach
 * opt-in). Le service ne porte qu'UNE intention « en attente » à la fois
 * (savePendingIntention met à jour la même ligne) : la carte d'ajout se masque
 * donc quand une intention en attente existe — on la MODIFIE au lieu d'en
 * empiler une fausse deuxième. La liste rend au plus : l'intention portée sur
 * la séance (param `sessionId`, sinon la dernière séance) + celle en attente.
 *
 * DROP net (héritage contraire à la maquette) : la « zone à creuser » générée
 * par l'app (selectFocusCorner) — c'étaient les mots de l'app, pas ceux du
 * pilote ; ce constat vit déjà sur la Carte (carte.tsx). Boutons
 * « Compris / Plus tard » sans effet réel : supprimés aussi.
 *
 * Doctrine : vouvoiement, pas d'emoji, descriptif jamais prescriptif ; l'app
 * ne pré-remplit ni ne suggère JAMAIS le contenu (V5 P-E).
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ConsentSwitchRow } from '@/components/ConsentSwitchRow';
import * as haptics from '@/lib/haptics';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { INTENTION_MAX } from '@/services/intentionLogic';
import {
  type SessionIntention,
  getIntentionForSession,
  getPendingIntention,
  savePendingIntention,
} from '@/services/intentionsService';
import { fetchAllSessions } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Composer fermé, ouvert vide (ajout) ou ouvert sur l'intention en attente. */
type ComposerMode = 'closed' | 'new' | 'edit';

export default function ProchaineFoisScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const profile = useAuthStore((st) => st.profile);

  // Les DEUX intentions réelles que le service expose : celle rattachée à la
  // séance de contexte (portée en piste) et celle en attente (fraîche, 24 h).
  const [carried, setCarried] = useState<SessionIntention | null>(null);
  const [pending, setPending] = useState<SessionIntention | null>(null);
  const [loading, setLoading] = useState(true);

  // Contexte circuit pour le stockage d'une intention neuve (même patron que
  // preparation.tsx : circuit par défaut ; le rattachement suit le pilote).
  const [circuit, setCircuit] = useState<Circuit | null>(null);

  const [mode, setMode] = useState<ComposerMode>('closed');
  const [draft, setDraft] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultCircuit()
      .then((c) => {
        if (!cancelled) setCircuit(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Séance de contexte : param explicite, sinon la dernière du pilote
      // (même convention que le Carnet, section « Vos repères »).
      let sid: string | null = params.sessionId ?? null;
      if (!sid && profile) {
        const latest = await fetchAllSessions(profile.id, { limit: 1 });
        sid = latest[0]?.id ?? null;
      }
      const [linked, pend] = await Promise.all([
        sid ? getIntentionForSession(sid) : Promise.resolve(null),
        getPendingIntention(),
      ]);
      if (cancelled) return;
      setCarried(linked);
      setPending(pend && pend.id !== linked?.id ? pend : null);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, profile]);

  useFocusEffect(reload);

  function openNew() {
    setDraft('');
    setShared(false);
    setSaveError(null);
    setMode('new');
  }

  function openEdit() {
    if (!pending) return;
    // On rouvre le texte du PILOTE (jamais une proposition de l'app).
    setDraft(pending.body);
    setShared(pending.sharedWithCoach);
    setSaveError(null);
    setMode('edit');
  }

  function closeComposer() {
    setMode('closed');
    setDraft('');
    setSaveError(null);
  }

  async function onSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    const res = await savePendingIntention({
      // Modification : on préserve le circuit d'origine de l'intention.
      circuitId:
        mode === 'edit' ? (pending?.circuitId ?? circuit?.id ?? null) : (circuit?.id ?? null),
      body: draft,
      sharedWithCoach: shared,
    });
    setSaving(false);
    if (res.ok) {
      haptics.confirm();
      closeComposer();
      reload();
    } else {
      setSaveError('L’enregistrement n’a pas abouti. Votre texte reste ici.');
    }
  }

  // Liste numérotée : portée d'abord, en attente ensuite (ordre du temps).
  // Pendant la modification, l'intention en attente vit dans le composer.
  const items: { intention: SessionIntention; kind: 'carried' | 'pending' }[] = [
    ...(carried ? [{ intention: carried, kind: 'carried' as const }] : []),
    ...(pending && mode !== 'edit' ? [{ intention: pending, kind: 'pending' as const }] : []),
  ];

  return (
    <Screen>
      <AppBar title="Prochaine fois" onBack={() => router.back()} />
      <View style={s.body}>
        {/* Intro — transposée en vouvoiement depuis la maquette. */}
        <Text style={s.intro}>
          Ce que vous voulez garder en tête pour votre prochaine séance. Vos mots, pas ceux de
          l’app.
        </Text>

        {loading ? (
          <ActivityIndicator
            color={palette.creamMute}
            style={{ marginTop: spacing.xxl }}
            accessibilityLabel="Chargement de vos intentions"
          />
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {items.map(({ intention, kind }, i) =>
              kind === 'pending' ? (
                <Pressable
                  key={intention.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Intention ${i + 1} : ${intention.body}. Pour la prochaine séance. Modifier.`}
                  onPress={openEdit}
                  style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
                >
                  <IntentionRow index={i + 1} body={intention.body}>
                    <View style={s.captionRow}>
                      <Text style={s.caption}>Pour la prochaine séance</Text>
                      <Text style={s.captionAction}>MODIFIER</Text>
                    </View>
                  </IntentionRow>
                </Pressable>
              ) : (
                <View
                  key={intention.id}
                  style={s.card}
                  accessible
                  accessibilityLabel={`Intention ${i + 1} : ${intention.body}. Portée en séance.`}
                >
                  <IntentionRow index={i + 1} body={intention.body}>
                    <Text style={s.caption}>Portée en séance</Text>
                  </IntentionRow>
                </View>
              )
            )}

            {/* Composer réel (patron IntentionCard) — savePendingIntention. */}
            {mode !== 'closed' ? (
              <View style={s.card}>
                <Text style={s.composerEyebrow}>
                  {mode === 'edit' ? 'VOTRE INTENTION' : 'NOUVELLE INTENTION'}
                </Text>
                <TextInput
                  value={draft}
                  onChangeText={(t) => {
                    setDraft(t);
                    if (saveError) setSaveError(null);
                  }}
                  multiline
                  autoFocus
                  maxLength={INTENTION_MAX}
                  placeholder="Écrivez ici, si vous le souhaitez."
                  placeholderTextColor={palette.faint}
                  selectionColor={palette.green}
                  cursorColor={palette.green}
                  accessibilityLabel="Votre intention"
                  style={s.input}
                />
                <ConsentSwitchRow
                  label="Partager avec mon coach"
                  hint="Lecture seule. Révocable à tout moment."
                  value={shared}
                  onValueChange={(v) => {
                    setShared(v);
                    if (saveError) setSaveError(null);
                  }}
                  accessibilityLabel="Partager cette intention avec mon coach"
                  style={{ marginTop: spacing.lg }}
                />
                {saveError ? <Text style={s.saveError}>{saveError}</Text> : null}
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  <Button
                    label={mode === 'edit' ? 'Mettre à jour' : 'Garder cette intention'}
                    onPress={onSave}
                    loading={saving}
                    disabled={!draft.trim()}
                  />
                  <Button label="Annuler" variant="ghost" onPress={closeComposer} />
                </View>
              </View>
            ) : !pending ? (
              /* Carte pointillée « + Ajouter une intention » (maquette). Masquée
                 quand une intention en attente existe : le service n'en porte
                 qu'une — on la modifie, on n'en empile pas une fausse. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ajouter une intention"
                onPress={openNew}
                style={({ pressed }) => [s.addCard, pressed && { opacity: 0.7 }]}
              >
                <View style={s.badgeSlot}>
                  <Text style={s.addGlyph}>+</Text>
                </View>
                <Text style={s.addLabel}>Ajouter une intention</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

/** Rangée numérotée : badge mono + texte du pilote + légende factuelle. */
function IntentionRow({
  index,
  body,
  children,
}: {
  index: number;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={s.badge}>
        <Text style={s.badgeTxt}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.bodyTxt}>{body}</Text>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Intro muted sous la barre (maquette : gris, deux lignes).
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
    lineHeight: fontSize.body * 1.55,
    marginTop: spacing.sm,
  },

  // Carte d'intention — surface card, hairline, rayon v2 (maquette).
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },

  // Badge numéro — pastille carrée arrondie surface-2, chiffre mono muted.
  badge: {
    width: 24,
    height: 24,
    borderRadius: radius.hud,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: palette.creamMute,
  },
  bodyTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.body,
    color: palette.cream,
    lineHeight: fontSize.body * 1.45,
  },

  // Légende factuelle sous le texte (statut réel de l'intention).
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginTop: spacing.sm,
  },
  captionAction: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: palette.creamSoft,
    marginTop: spacing.sm,
  },

  // Carte pointillée d'ajout (maquette : bordure dashed, texte éteint).
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 56,
  },
  badgeSlot: { width: 24, alignItems: 'center' },
  addGlyph: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: palette.faint,
  },
  addLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
  },

  // Composer — patron IntentionCard, retravaillé aux surfaces v2.
  composerEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  input: {
    marginTop: spacing.md,
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    color: palette.cream,
    textAlignVertical: 'top',
  },
  saveError: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
  },
});
