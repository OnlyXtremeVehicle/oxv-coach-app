/**
 * Coach — Contexte de séance (§12 handoff · coach/13-contexte), RESKIN
 * refonte-v2 RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13).
 *
 * Le coach (professionnel agréé) renseigne le cadrage SPORTIF que le capteur ne
 * capte pas : niveau du pilote ce jour, objectif travaillé, matériel, météo
 * vécue. Ce contexte est destiné au pilote — il apparaît, attribué, sur son
 * bilan. Doctrine : cadrage sportif uniquement, JAMAIS de donnée personnelle
 * (santé, identité, coordonnées) ; ton sobre, vouvoiement, aucun jugement.
 *
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/13-contexte) : deux colonnes — à gauche le formulaire de cadrage
 *     (niveau, objectif, matériel, météo), à droite l'encart vert « Vie privée »
 *     (rappel « aucune donnée personnelle ») + enregistrer.
 *   - COMPAGNON téléphone : une colonne, les mêmes blocs empilés.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Données réelles : les 4 champs tracent 1:1 vers coach_session_context
 * (pilot_level / objective / equipment / weather_note) via
 * coachSessionContextService — aucune colonne nouvelle. Les libellés « pills /
 * chips » de la maquette sont un CONCEPT visuel : le modèle stocke du texte
 * libre, on garde donc des champs libres (ne pas énumérer un champ libre =
 * ne pas perdre la saisie existante d'un coach). Absent = champ vide, aucune
 * valeur inventée, aucun contrôle mort. Identité COACH rouge (#E23A4E) ; pas
 * d'or (aucun chrono ici) ; couleurs QDI non convoquées (aucune donnée QDI).
 * Logique, services, états et navigation inchangés.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { contextHasContent } from '@/services/coachContextLogic';
import { getSessionContext, upsertSessionContext } from '@/services/coachSessionContextService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, fonts, fontSize } = theme;

export default function CoachContexteScreen() {
  const params = useLocalSearchParams<{ pilotId?: string; sessionId?: string }>();
  const pilotId = params.pilotId;
  const sessionId = params.sessionId;

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilotLevel, setPilotLevel] = useState('');
  const [objective, setObjective] = useState('');
  const [equipment, setEquipment] = useState('');
  const [weatherNote, setWeatherNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getSessionContext(sessionId)
      .then((ctx) => {
        if (cancelled) return;
        if (ctx) {
          setPilotLevel(ctx.pilotLevel ?? '');
          setObjective(ctx.objective ?? '');
          setEquipment(ctx.equipment ?? '');
          setWeatherNote(ctx.weatherNote ?? '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  const input = { pilotLevel, objective, equipment, weatherNote };
  const hasContent = contextHasContent(input);
  const ready = !!pilotId && !!sessionId;

  const state: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  function onEdit(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setSaved(false);
    };
  }

  async function onSave() {
    if (!pilotId || !sessionId || saving) return;
    setSaving(true);
    setSaved(false);
    const result = await upsertSessionContext(pilotId, sessionId, input);
    setSaving(false);
    if (result) {
      setSaved(true);
    }
  }

  // — Fragments partagés par les deux formats (une seule source de vérité) —

  const formFields = (
    <View>
      <Field
        label="Niveau sur cette séance"
        value={pilotLevel}
        onChangeText={onEdit(setPilotLevel)}
        placeholder="Confortable, en progression, terrain serré…"
        maxLength={280}
      />
      <Field
        label="Objectif travaillé"
        value={objective}
        onChangeText={onEdit(setObjective)}
        placeholder="Constance, points de référence, courbe rapide…"
        maxLength={280}
        multiline
      />
      <Field
        label="Matériel"
        value={equipment}
        onChangeText={onEdit(setEquipment)}
        placeholder="Véhicule, pneus, réglages utilisés…"
        maxLength={280}
      />
      <Field
        label="Météo vécue"
        value={weatherNote}
        onChangeText={onEdit(setWeatherNote)}
        placeholder="Piste sèche, humide, vent, température…"
        multiline
        maxLength={280}
        containerStyle={{ marginBottom: 0 }}
      />
    </View>
  );

  const privacyPanel = (
    <Card
      style={s.privacy}
      accessibilityLabel="Vie privée : cadrage sportif, aucune donnée personnelle"
    >
      <Text style={s.privacyEyebrow}>VIE PRIVÉE</Text>
      <Text style={s.privacyBody}>
        Le contexte est un cadrage sportif. Il ne contient{' '}
        <Text style={s.privacyStrong}>aucune donnée personnelle</Text> : pas de santé, pas
        d'identité, pas de coordonnées.
      </Text>
    </Card>
  );

  const saveBlock = (
    <View>
      {saved ? (
        <Text style={[s.savedTxt, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">
          Contexte enregistré.
        </Text>
      ) : null}
      <Button
        label={
          saving
            ? 'Enregistrement…'
            : hasContent
              ? 'Enregistrer le contexte'
              : 'Effacer le contexte'
        }
        onPress={onSave}
        loading={saving}
        disabled={saving || !ready}
      />
      {!ready ? <Text style={s.hint}>Ouvrez le contexte depuis la séance d'un pilote.</Text> : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <AppBar title="CONTEXTE" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isConsole ? spacing.xl : spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>

          <Text style={s.eyebrow}>CONTEXTE DE SÉANCE</Text>
          <Text style={s.title} accessibilityRole="header">
            Cadrer avant de lire.
          </Text>
          <Text style={s.manifest}>
            Ce que le capteur ne capte pas. Visible par votre pilote sur son bilan.
          </Text>

          <StateWrapper
            state={state}
            skeletonLines={5}
            errorCause="Le contexte de séance n'a pas pu être chargé."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {isConsole ? (
              <View style={s.columns}>
                <View style={s.colLeft}>{formFields}</View>
                <View style={s.colRight}>
                  {privacyPanel}
                  <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.xl }}>
                {formFields}
                <View style={{ marginTop: spacing.xl }}>{privacyPanel}</View>
                <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
              </View>
            )}
          </StateWrapper>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  // — En-tête —
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },

  // — Colonnes console —
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  colLeft: { flex: 1.4 },
  colRight: { flex: 1, maxWidth: 340 },

  // — Encart « Vie privée » (rappel doctrinal, vert = état sûr/validé, cf. §7.11
  //   « encart vert » côté pilote). Liseré vert à gauche, teinte discrète. —
  privacy: {
    borderLeftWidth: 2,
    borderLeftColor: palette.green,
    backgroundColor: 'rgba(79,201,138,0.06)',
    padding: spacing.lg,
  },
  privacyEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.green,
    marginBottom: spacing.sm,
  },
  privacyBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.6,
    color: palette.creamMute,
  },
  privacyStrong: {
    fontFamily: fonts.bodySemi,
    color: palette.creamSoft,
  },

  // — Confirmation d'enregistrement (état, vert « validé ») —
  savedTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.green,
  },

  hint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
});
