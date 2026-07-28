/**
 * Espace Partenaire — Mes leads (§8, F4).
 *
 * Le partenaire suit les demandes de contact consenties par les pilotes. Il
 * ACTUALISE un statut commercial (nouveau → contacté → réservé / perdu / archivé)
 * mais ne voit JAMAIS la télémétrie ni l'identité du pilote : aucune donnée
 * personnelle ici. Le contact réel passe par OXV (séparation pilote/partenaire,
 * garantie par la RLS — règle cardinale §148). Lecture seule sur le lead, sauf
 * le statut. Doctrine : sobre, vouvoiement, pas d'emoji. Deux vues : liste + détail.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type LeadStatus,
  type PartnerLead,
  type PartnerOffer,
  listMyLeads,
  listMyOffers,
  loadMyPartnerAccount,
  setLeadStatus,
} from '@/services/partnerService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  booked: 'Réservé',
  lost: 'Perdu',
  archived: 'Archivé',
};

/** Ordre des actions de suivi proposées dans la vue détail. */
const STATUS_FLOW: LeadStatus[] = ['new', 'contacted', 'booked', 'lost', 'archived'];

/** Filtres de la liste : « Tous » + un par statut. */
const FILTERS: { v: LeadStatus | 'all'; label: string }[] = [
  { v: 'all', label: 'Tous' },
  { v: 'new', label: 'Nouveaux' },
  { v: 'contacted', label: 'Contactés' },
  { v: 'booked', label: 'Réservés' },
  { v: 'lost', label: 'Perdus' },
  { v: 'archived', label: 'Archivés' },
];

const CHANNEL_LABEL: Record<string, string> = {
  app: "Via l'app",
  web: 'Via le site',
  event: 'Sur un événement',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PartnerLeadsScreen() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [selected, setSelected] = useState<PartnerLead | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(false);
    loadMyPartnerAccount()
      .then(async (acc) => {
        if (!acc) {
          setPartnerId(null);
          setLeads([]);
          setOffers([]);
          return;
        }
        setPartnerId(acc.id);
        const [l, o] = await Promise.all([listMyLeads(acc.id), listMyOffers(acc.id)]);
        setLeads(l);
        setOffers(o);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const offerTitle = useMemo(() => {
    const map = new Map(offers.map((o) => [o.id, o.title]));
    return (offerId: string | null) => (offerId ? (map.get(offerId) ?? 'Offre retirée') : null);
  }, [offers]);

  const visible = useMemo(
    () => (filter === 'all' ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter]
  );

  // loading / error / nominal — les états « aucune donnée » restent distincts
  // (pas de compte partenaire vs aucune demande vs filtre vide), gérés dans le
  // contenu nominal, car chacun porte un message honnête différent.
  const state: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  async function onSetStatus(status: LeadStatus) {
    if (!selected || status === selected.status) return;
    setSaving(true);
    const res = await setLeadStatus(selected.id, status);
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'La mise à jour a échoué.' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Statut mis à jour.' });
    setSelected({ ...selected, status });
    setLeads((prev) => prev.map((l) => (l.id === selected.id ? { ...l, status } : l)));
  }

  // ── Vue détail ──
  if (selected) {
    const title = offerTitle(selected.offerId);
    return (
      <Screen>
        <AppBar title="DEMANDE" onBack={() => setSelected(null)} />
        <View style={s.body}>
          <Text style={s.eyebrow}>{channelLabel(selected.channel).toUpperCase()}</Text>
          <Text style={s.h1} accessibilityRole="header">
            {title ?? 'Demande de contact'}
          </Text>
          <Text style={s.meta}>Reçue le {formatDate(selected.createdAt)}</Text>

          <Card style={{ marginTop: theme.spacing.xl }}>
            <Text style={s.note}>
              {selected.consentContact
                ? 'Ce pilote a consenti à être recontacté au sujet de cette offre. La mise en relation passe par OXV : vous ne voyez pas ses données.'
                : 'Pas de consentement de contact pour cette demande. Aucune mise en relation possible.'}
            </Text>
          </Card>

          {selected.notes ? (
            <View style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>Note</SectionLabel>
              <Text style={s.bodyText}>{selected.notes}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: theme.spacing.xl }}>
            <SectionLabel>Suivi</SectionLabel>
            <View style={s.pills}>
              {STATUS_FLOW.map((v) => {
                const on = selected.status === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => onSetStatus(v)}
                    disabled={saving}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: saving }}
                    accessibilityLabel={STATUS_LABEL[v]}
                    hitSlop={6}
                    style={[s.pill, on ? s.pillOn : null]}
                  >
                    <Text style={[s.pillT, on ? s.pillTOn : null]}>{STATUS_LABEL[v]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>
              Le suivi est privé : il vous aide à organiser vos relances. Il n’est pas visible du
              pilote.
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  // ── Vue liste ──
  return (
    <Screen>
      <AppBar title="MES LEADS" onBack={() => router.back()} />
      <View style={s.body}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="partner" />
        </View>
        <Text style={s.h1} accessibilityRole="header">
          Vos demandes
        </Text>
        <Text style={s.intro}>
          Les demandes de contact consenties par les pilotes. Aucune donnée pilote : la mise en
          relation passe par OXV.
        </Text>

        {partnerId && leads.length > 0 ? (
          <View style={s.filters}>
            {FILTERS.map((f) => {
              const on = filter === f.v;
              return (
                <Pressable
                  key={f.v}
                  onPress={() => setFilter(f.v)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={f.label}
                  hitSlop={6}
                  style={[s.chip, on ? s.chipOn : null]}
                >
                  <Text style={[s.chipT, on ? s.chipTOn : null]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <StateWrapper
          state={state}
          skeletonLines={5}
          errorCause="La liste de vos demandes n’a pas pu être chargée."
          onRetry={reload}
        >
          {!partnerId ? (
            <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
              <Text style={s.emptyT}>Aucun compte partenaire.</Text>
              <Text style={s.emptyH}>Contactez l’équipe OXV pour activer votre compte.</Text>
            </Card>
          ) : leads.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
              <Text style={s.emptyT}>Aucune demande pour l’instant.</Text>
              <Text style={s.emptyH}>
                Les demandes des pilotes intéressés par vos offres apparaîtront ici.
              </Text>
            </Card>
          ) : visible.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
              <Text style={s.emptyT}>Aucune demande dans ce filtre.</Text>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {visible.map((l) => {
                const title = offerTitle(l.offerId);
                return (
                  <Card
                    key={l.id}
                    onPress={() => setSelected(l)}
                    accessibilityLabel={`${title ?? 'Demande de contact'}. ${STATUS_LABEL[l.status]}.`}
                  >
                    <View style={s.rowBetween}>
                      <Text style={s.cardTitle} numberOfLines={1}>
                        {title ?? 'Demande de contact'}
                      </Text>
                      <Text style={[s.status, l.status === 'new' ? s.statusOn : null]}>
                        {STATUS_LABEL[l.status].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={s.cardMeta}>
                      {channelLabel(l.channel)} · {formatDate(l.createdAt)}
                    </Text>
                  </Card>
                );
              })}
            </View>
          )}
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  body: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  h1: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.sm,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  filters: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 36,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  chipOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  chipT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  chipTOn: { color: theme.palette.cream },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
  bodyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
    marginTop: theme.spacing.sm,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  statusOn: { color: theme.palette.cream },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  emptyT: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyH: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
};
