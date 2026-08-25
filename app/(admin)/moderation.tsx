/**
 * Admin — file de modération (signalements communautaires, M3).
 *
 * L'admin traite les signalements : prend en charge, résout ou rejette. La note
 * de résolution est admin-only (jamais exposée au signaleur). L'action sur le
 * contenu (retrait, suspension) se fait via les outils admin existants — cette
 * file ne masque rien automatiquement. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type InsigneAModerer,
  type ModerationReport,
  type ModerationStatus,
  listInsignesAModerer,
  listReports,
  reasonLabel,
  resolveReport,
  reviewInsigne,
  takeReport,
} from '@/services/moderationService';
import { urlInsigne } from '@/features/club/insigneService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const STATUS_LABEL: Record<ModerationStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
  rejete: 'Rejeté',
};
const TARGET_LABEL: Record<string, string> = {
  coach_review: 'Avis coach',
  partner_offer: 'Offre partenaire',
};

function statusColor(s: ModerationStatus): string {
  if (s === 'nouveau') return theme.palette.red; // P0 admin priority = rouge admin
  if (s === 'en_cours') return theme.palette.gold;
  return theme.palette.faint;
}

export default function AdminModerationScreen() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  /**
   * Les insignes en attente. Une file DISTINCTE des signalements : un
   * signalement est une plainte, un insigne est une demande. Les mélanger
   * ferait lire un capitaine comme un fautif.
   */
  const [insignes, setInsignes] = useState<InsigneAModerer[]>([]);
  const [apercus, setApercus] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listReports()
      .then((rows) => {
        if (!cancelled) {
          // Non-traités d'abord (nouveau, en_cours), puis le reste.
          const open = rows.filter((r) => r.status === 'nouveau' || r.status === 'en_cours');
          const closed = rows.filter((r) => r.status === 'resolu' || r.status === 'rejete');
          setReports([...open, ...closed]);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    // La file des insignes se charge en parallèle et ne peut PAS faire échouer
    // l'écran : un signalement non traité coûte plus qu'un insigne non vu.
    listInsignesAModerer()
      .then(async (rows) => {
        if (cancelled) return;
        setInsignes(rows);
        // Le bucket n'est pas public : chaque aperçu demande une URL signée.
        const urls: Record<string, string> = {};
        for (const i of rows) {
          const u = await urlInsigne(i.chemin);
          if (u) urls[i.crewId] = u;
        }
        if (!cancelled) setApercus(urls);
      })
      .catch(() => {
        if (!cancelled) setInsignes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  /**
   * Trancher sur un insigne. Un refus n'efface PAS le fichier : le capitaine
   * doit pouvoir lire « votre insigne a été refusé » en voyant lequel, sans quoi
   * il retéléversera la même image.
   */
  async function onInsigne(crewId: string, valide: boolean) {
    setBusy(true);
    const res = await reviewInsigne(crewId, valide);
    setBusy(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? "La décision n'a pas été enregistrée." });
      return;
    }
    reload();
  }

  /**
   * Prendre en charge un signalement : l'échec se disait par le silence.
   * `if (res.ok) reload()` sans branche `else` laissait le bouton sans effet
   * apparent, et le modérateur recommençait.
   */
  async function onTake(r: ModerationReport) {
    setBusy(true);
    const res = await takeReport(r.id);
    setBusy(false);
    if (res.ok) {
      reload();
      return;
    }
    Toast.show({ type: 'error', text1: res.error ?? "La prise en charge n'a pas abouti." });
  }

  async function onResolve(r: ModerationReport, status: 'resolu' | 'rejete') {
    setBusy(true);
    const res = await resolveReport(r.id, status, resolution || undefined);
    setBusy(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? "La décision n'a pas été enregistrée." });
      return;
    }
    if (res.ok) {
      setSelectedId(null);
      setResolution('');
      reload();
    }
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : reports.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="MODÉRATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        {/* ── LES INSIGNES ────────────────────────────────────────────────
            Cette file n'existait pas, et c'est ce qui rendait la voie
            « téléversement » morte : le fail-closed marchait, mais rien ne
            pouvait publier une image. Aucun capitaine n'aurait vu la sienne.

            Le bloc DISPARAÎT quand la file est vide — un « aucun insigne en
            attente » permanent ferait du bruit sur l'écran des signalements,
            qui est le travail quotidien du modérateur. */}
        {insignes.length > 0 ? (
          <View style={{ marginBottom: theme.spacing.xl }}>
            <Text style={s.eyebrow}>INSIGNES EN ATTENTE</Text>
            <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
              {insignes.map((i) => (
                <Card
                  key={i.crewId}
                  accessibilityLabel={`Insigne de ${i.nom ?? 'une écurie sans nom'}`}
                >
                  <View style={s.head}>
                    <Text style={s.reason}>{i.nom ?? 'Écurie sans nom'}</Text>
                  </View>
                  {apercus[i.crewId] ? (
                    <Image
                      source={{ uri: apercus[i.crewId] }}
                      style={{ width: 96, height: 96, marginTop: theme.spacing.sm }}
                      contentFit="contain"
                      accessibilityLabel="Aperçu de l’insigne proposé"
                    />
                  ) : (
                    // Une URL signée peut ne pas revenir. On le DIT : trancher
                    // sur une image qu'on n'a pas vue est exactement ce que
                    // cette file existe pour empêcher.
                    <Text style={s.meta}>L’aperçu n’a pas pu être chargé.</Text>
                  )}
                  <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                    <Button
                      label="Valider"
                      onPress={() => onInsigne(i.crewId, true)}
                      loading={busy}
                      disabled={!apercus[i.crewId]}
                    />
                    <Button
                      label="Refuser"
                      variant="ghost"
                      onPress={() => onInsigne(i.crewId, false)}
                      loading={busy}
                    />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={s.eyebrow}>FILE DES SIGNALEMENTS</Text>
        <Text style={s.title} accessibilityRole="header">
          Signalements.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucun signalement"
            emptyMessage="Aucun signalement pour le moment."
            errorCause="La file des signalements n'a pas pu être chargée."
            onRetry={reload}
          >
            {reports.map((r) => {
              const open = selectedId === r.id;
              return (
                <Card
                  key={r.id}
                  onPress={() => {
                    setSelectedId(open ? null : r.id);
                    setResolution('');
                  }}
                  accessibilityLabel={`${reasonLabel(r.reason)}, ${STATUS_LABEL[r.status]}`}
                >
                  <View style={s.head}>
                    <Text style={s.reason}>{reasonLabel(r.reason)}</Text>
                    <Text style={[s.status, { color: statusColor(r.status) }]}>
                      {STATUS_LABEL[r.status]}
                    </Text>
                  </View>
                  <Text style={s.meta}>
                    {TARGET_LABEL[r.targetType] ?? r.targetType} · {r.targetId.slice(0, 8)}…
                  </Text>
                  {r.details ? <Text style={s.details}>{r.details}</Text> : null}

                  {open ? (
                    <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                      {r.status === 'nouveau' ? (
                        <Button
                          label="Prendre en charge"
                          onPress={() => onTake(r)}
                          loading={busy}
                        />
                      ) : null}
                      {r.status === 'nouveau' || r.status === 'en_cours' ? (
                        <>
                          <SectionLabel>Note de résolution (interne)</SectionLabel>
                          <Field
                            label="Résolution"
                            optional
                            value={resolution}
                            onChangeText={setResolution}
                            multiline
                            maxLength={2000}
                          />
                          <Button
                            label="Marquer résolu"
                            onPress={() => onResolve(r, 'resolu')}
                            loading={busy}
                          />
                          <Button
                            label="Rejeter le signalement"
                            variant="ghost"
                            onPress={() => onResolve(r, 'rejete')}
                          />
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  reason: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  details: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.45,
  },
};
