/**
 * Support pilote — liste de mes demandes + création (PR-10), langage refonte-v2.
 *
 * Le pilote signale un problème (équipement, bilan, données, question coach) ou
 * dépose une demande RGPD, sans quitter l'app. Suit le statut, ouvre le fil.
 *
 * Reskin v2 (maquette 43-support) : AppBar détail (pastille + titre centré), deux
 * tuiles d'action (Nous écrire → composer existant · Aide & FAQ → oxvehicle.fr),
 * puis « Vos demandes » réelles avec chip de statut. Le flux de création est
 * conservé tel quel (mêmes services, mêmes états, même RLS).
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, descriptif jamais prescriptif.
 * Or = chrono/record UNIQUEMENT (jamais un chip ni la nav). EN COURS = jaune
 * fluidité, RÉSOLU = vert accélération, autres statuts = neutre.
 */

import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { EmptyState } from '@/components/instruments';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
  createTicket,
  listMyTickets,
} from '@/services/supportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

// Site public OXV — destination réelle de la tuile « Aide & FAQ » (aligné sur
// carte-trophee.tsx qui pointe le même domaine). Aucune page /faq garantie : on
// ouvre le site, la sous-étiquette nomme honnêtement la destination.
const SITE_URL = 'https://oxvehicle.fr';

const STATUS_LABELS: Record<SupportStatus, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

/**
 * Ton du chip de statut. EN COURS = jaune fluidité, RÉSOLU = vert accélération
 * (maquette). Les autres statuts restent neutres : aucun jugement, aucune
 * couleur de rôle ni d'or détournée.
 */
function statusColor(status: SupportStatus): string {
  if (status === 'en_cours') return dataColors.flow;
  if (status === 'resolu') return palette.green;
  return palette.creamMute;
}

function categoryLabel(c: SupportCategory): string {
  return SUPPORT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

function ChatGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5 h16 a1 1 0 0 1 1 1 v9 a1 1 0 0 1 -1 1 H9 l-4 3 v-3 H4 a1 1 0 0 1 -1 -1 V6 a1 1 0 0 1 1 -1 Z"
        stroke={palette.cream}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HelpGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21 a9 9 0 1 0 0 -18 a9 9 0 0 0 0 18 Z"
        stroke={palette.cream}
        strokeWidth={1.6}
      />
      <Path
        d="M9.4 9.2 a2.6 2.6 0 0 1 5 0.9 c0 1.7 -2.4 2 -2.4 3.5"
        stroke={palette.cream}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path d="M12 17 h0.01" stroke={palette.cream} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type ActionTileProps = {
  glyph: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  accessibilityLabel: string;
};

function ActionTile({ glyph, title, sub, onPress, accessibilityLabel }: ActionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [s.tile, pressed && s.tilePressed]}
    >
      <View style={s.tileIcon}>{glyph}</View>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSub}>{sub}</Text>
    </Pressable>
  );
}

export default function SupportIndexScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<SupportCategory>('equipement');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyTickets().then((rows) => {
      if (!cancelled) {
        setTickets(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function onSend() {
    if (sending) return;
    setSending(true);
    setError(null);
    const res = await createTicket({ category, subject, message: message || undefined });
    setSending(false);
    if (res.ok) {
      setComposing(false);
      setSubject('');
      setMessage('');
      setCategory('equipement');
      reload();
    } else {
      setError(res.error ?? "L'envoi n'a pas pu aboutir.");
    }
  }

  return (
    <Screen>
      <AppBar title="Support" onBack={() => router.back()} />
      <View style={s.body}>
        {/* Deux tuiles d'action — cibles réelles : composer existant + site OXV. */}
        <View style={s.tiles}>
          <ActionTile
            glyph={<ChatGlyph />}
            title="Nous écrire"
            sub="Ouvrir une demande"
            accessibilityLabel="Nous écrire, ouvrir une demande"
            onPress={() => {
              setError(null);
              setComposing(true);
            }}
          />
          <ActionTile
            glyph={<HelpGlyph />}
            title="Aide & FAQ"
            sub="Sur oxvehicle.fr"
            accessibilityLabel="Aide et FAQ, ouvrir oxvehicle point fr"
            onPress={() => {
              Linking.openURL(SITE_URL).catch(() => undefined);
            }}
          />
        </View>

        {/* Composer — flux de création conservé (services, états, validation). */}
        {composing ? (
          <Card style={s.composer}>
            <SectionLabel>Catégorie</SectionLabel>
            <View style={s.pills}>
              {SUPPORT_CATEGORIES.map((c) => {
                const on = c.value === category;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={c.label}
                    hitSlop={6}
                    style={[s.pill, on ? s.pillOn : null]}
                  >
                    <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Objet"
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
              placeholder="En quelques mots"
            />
            <Field
              label="Votre message"
              optional
              value={message}
              onChangeText={setMessage}
              maxLength={4000}
              multiline
              placeholder="Décrivez la situation."
            />

            {error ? (
              <Text style={s.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Button label="Envoyer" onPress={onSend} loading={sending} disabled={!subject.trim()} />
            <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
          </Card>
        ) : null}

        {/* Vos demandes réelles (support_tickets, RLS own-row). */}
        <View style={s.listHead}>
          <SectionLabel>Vos demandes</SectionLabel>
        </View>
        <View style={s.list}>
          {!loading && tickets.length === 0 ? (
            <EmptyState
              label="Aucune demande"
              message="Vous n'avez pas encore de demande en cours."
              source="support_tickets"
            />
          ) : (
            tickets.map((t) => {
              const tone = statusColor(t.status);
              return (
                <Card
                  key={t.id}
                  onPress={() => router.push(`/(app)/support/${t.id}` as never)}
                  accessibilityLabel={`${t.subject}, ${categoryLabel(t.category)}, ${STATUS_LABELS[t.status]}`}
                >
                  <View style={s.ticketRow}>
                    <View style={s.ticketMain}>
                      <Text style={s.ticketSubject} numberOfLines={1}>
                        {t.subject}
                      </Text>
                      <Text style={s.ticketMeta} numberOfLines={1}>
                        {categoryLabel(t.category)} · {formatDateShort(t.createdAt)}
                      </Text>
                    </View>
                    <View style={[s.chip, { borderColor: tone }]}>
                      <Text style={[s.chipTxt, { color: tone }]}>
                        {STATUS_LABELS[t.status].toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  // Rangée de deux tuiles d'action égales.
  tiles: {
    flexDirection: 'row' as const,
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    minHeight: 108,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between' as const,
  },
  tilePressed: {
    opacity: 0.92,
    borderColor: palette.edge,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: palette.card2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.md,
  },
  tileTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    letterSpacing: 0.2,
  },
  tileSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  composer: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  pillOn: {
    borderColor: palette.cream,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillTxt: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  pillTxtOn: {
    color: palette.cream,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.red,
  },
  listHead: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  ticketRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  ticketMain: {
    flex: 1,
  },
  ticketSubject: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
    letterSpacing: 0.2,
  },
  ticketMeta: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: palette.eyebrow,
    marginTop: 3,
  },
  // Chip de statut : bordure d'accent 2px couleur du contexte (v2), texte assorti.
  chip: {
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
  },
};
