/**
 * LES AMIS — porte CLUB, écran 3/7 du lot V2-L5 (Mission B).
 * Route `club/roulages`.
 *
 * Titré « ROULAGES & AMIS » jusqu'au 12/08/2026. Le plan V3 le nomme « Les
 * amis » : le roulage est ce qu'on fait ENSEMBLE, l'amitié est ce qui le rend
 * possible. Mettre le roulage en tête faisait de l'écran une boîte de
 * réception, ce qu'il était d'ailleurs en pratique — il n'était atteignable
 * que par une invitation reçue. Le hub Club lui donne désormais une porte
 * permanente.
 *
 * Deux onglets Chip :
 *   - Roulages : invitations à venir (Accepter / Décliner, `roulagesService`)
 *     + « roulé ensemble ×{n} » par coach + historique factuel. Un roulage
 *     est un fait de présence PARTAGÉ, jamais une performance comparée.
 *   - Amis : recherche @handle live (`friendshipsService`), liste des amis
 *     avec leur DERNIER CIRCUIT FACTUEL (jamais un chrono d'autrui —
 *     doctrine, verrouillée par `amisLogic`), badge « groupe » pour l'écurie
 *     (`referralService.getMyCrew`), et « Comparer côte à côte » → porte Data.
 *
 * Données RÉELLES câblées (useClubRoulages / useClubAmis) : absent = section
 * masquée / StateView, jamais un placeholder. FR vouvoyé, zéro emoji, jamais
 * prescriptif, zéro couleur hors tokens v2, un seul accent rouge par carte.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useAuthStore } from '@/store/useAuthStore';
import { Photo } from '@/components/media';
import {
  Chip,
  colors,
  haptic,
  OxvIcon,
  PressScale,
  radius,
  SectionHeader,
  space,
  staggerEntering,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import { formatDateTime, formatPriceCents } from '@/utils/format';

import type { PilotRoulageCard, RolledTogether } from '@/features/club/roulagesLogic';
import { useClubRoulages, type ClubRoulages } from '@/features/club/useClubRoulages';
import {
  useClubAmis,
  type ClubAmis,
  type FriendVM,
  type PendingVM,
} from '@/features/club/useClubAmis';

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/** « 26 juil. 2026, 09:00 – 17:00 » : fin ajoutée seulement si elle se parse. */
function dateRangeLabel(startsAt: string, endsAt: string | null): string {
  const start = formatDateTime(startsAt);
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) return start;
  try {
    const end = new Date(endsAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${start} – ${end}`;
  } catch {
    return start;
  }
}

function placeLabel(card: PilotRoulageCard): string {
  return [card.circuitName, card.location].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function ClubRoulagesScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const roulages = useClubRoulages();
  const amis = useClubAmis(profile?.id ?? null);
  // L'onglet est adressable : une notification « X souhaite vous comparer »
  // doit ouvrir Amis, pas Roulages. Seule la valeur 'amis' est reconnue, toute
  // autre valeur — ou son absence — laisse l'onglet par défaut.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(params.tab === 'amis' ? 1 : 0);

  const goTo = (index: number) => {
    if (index === tab) return;
    setTab(index);
    haptic('tap');
  };

  const bottomInset = tabBarSpace(insets.bottom);

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe de 20 pt : hitSlop 12 pour atteindre la cible de 44 pt.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          LES AMIS
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.chipRow}>
        <Chip label="Roulages" active={tab === 0} onPress={() => goTo(0)} />
        <Chip label="Amis" active={tab === 1} onPress={() => goTo(1)} />
      </View>

      {tab === 0 ? (
        <RoulagesTab roulages={roulages} bottomInset={bottomInset} />
      ) : (
        <AmisTab amis={amis} bottomInset={bottomInset} />
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Onglet ROULAGES
// ---------------------------------------------------------------------------

function RoulagesTab({ roulages, bottomInset }: { roulages: ClubRoulages; bottomInset: number }) {
  const { status, view, busyId, respond, reload } = roulages;

  if (status === 'loading') {
    return (
      <View style={styles.tabPad}>
        <StateView state="loading" shape="list" />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.tabCentered}>
        <StateView
          state="error"
          errorMessage="Vos roulages n'ont pas pu se charger."
          onRetry={reload}
        />
      </View>
    );
  }

  const { pending, history, rolledTogether } = view;
  const isEmpty = pending.length === 0 && history.length === 0 && rolledTogether.length === 0;
  if (isEmpty) {
    return (
      <View style={styles.tabCentered}>
        <StateView state="empty" emptyMessage="Vos invitations aux roulages apparaîtront ici." />
      </View>
    );
  }

  return (
    <FlashList
      data={history}
      keyExtractor={(item) => item.invitationId}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: bottomInset + space.xl,
      }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {pending.length > 0 ? (
            <View>
              <SectionHeader
                eyebrow={pending.length > 1 ? 'Invitations reçues' : 'Invitation reçue'}
                count={pending.length}
              />
              <View style={styles.cardStack}>
                {pending.map((card, i) => (
                  <Animated.View key={card.invitationId} entering={staggerEntering(i)}>
                    <InvitationCard
                      card={card}
                      busy={busyId === card.invitationId}
                      disabled={busyId !== null}
                      onRespond={respond}
                    />
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {rolledTogether.length > 0 ? (
            <View>
              <SectionHeader eyebrow="Roulé ensemble" />
              <View style={styles.rolledCard}>
                {rolledTogether.map((row, i) => (
                  <RolledRow key={row.coachId} row={row} divider={i < rolledTogether.length - 1} />
                ))}
              </View>
            </View>
          ) : null}

          {history.length > 0 ? (
            <SectionHeader
              eyebrow="Historique"
              count={history.length}
              style={styles.historyHeader}
            />
          ) : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={staggerEntering(index)} style={styles.historyItem}>
          <HistoryRow card={item} />
        </Animated.View>
      )}
    />
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    // Regroupé : l'étiquette et sa valeur sont UN fait, pas deux arrêts.
    <View style={styles.metaRow} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function InvitationCard({
  card,
  busy,
  disabled,
  onRespond,
}: {
  card: PilotRoulageCard;
  busy: boolean;
  disabled: boolean;
  onRespond: (invitationId: string, accepted: boolean) => void;
}) {
  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHead}>
        {card.coach ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{card.coach.initials}</Text>
          </View>
        ) : (
          <View style={styles.avatar}>
            <OxvIcon name="casque" size={18} color={colors.text.mid} />
          </View>
        )}
        <View style={styles.flex1}>
          <Text style={styles.inviteTitle} numberOfLines={1}>
            {card.coach ? `${card.coach.name} vous invite` : card.title}
          </Text>
          <Text style={styles.inviteSub}>{card.coach ? 'votre coach' : 'invitation reçue'}</Text>
        </View>
      </View>

      <View style={styles.metaBlock}>
        {card.coach ? <Text style={styles.roulageTitle}>{card.title}</Text> : null}
        <MetaRow label="date" value={dateRangeLabel(card.startsAt, card.endsAt)} />
        <MetaRow label="lieu" value={placeLabel(card)} />
        {card.maxPilots != null ? (
          <MetaRow
            label="places"
            value={`${card.maxPilots} place${card.maxPilots > 1 ? 's' : ''}`}
          />
        ) : null}
        {card.pricePerPilot != null ? (
          <MetaRow label="tarif" value={`${formatPriceCents(card.pricePerPilot)} par place`} />
        ) : null}
      </View>

      <View style={styles.actions}>
        <PressScale
          onPress={() => onRespond(card.invitationId, true)}
          disabled={disabled}
          accessibilityLabel={`Accepter l'invitation — ${card.title}`}
          accessibilityState={{ busy }}
          containerStyle={styles.flex1}
          style={[styles.btnAccept, disabled && styles.btnDim]}
        >
          <Text style={styles.btnAcceptTxt}>Accepter</Text>
        </PressScale>
        <PressScale
          onPress={() => onRespond(card.invitationId, false)}
          disabled={disabled}
          accessibilityLabel={`Décliner l'invitation — ${card.title}`}
          containerStyle={styles.flex1}
          style={[styles.btnDecline, disabled && styles.btnDim]}
        >
          <Text style={styles.btnDeclineTxt}>Décliner</Text>
        </PressScale>
      </View>
    </View>
  );
}

function RolledRow({ row, divider }: { row: RolledTogether; divider: boolean }) {
  return (
    <View
      style={[styles.rolledRow, divider && styles.rolledDivider]}
      accessible
      accessibilityLabel={`${row.name}, roulé ensemble ${row.count} fois`}
    >
      <View style={styles.avatarSm}>
        <Text style={styles.avatarSmTxt}>{row.initials}</Text>
      </View>
      <Text style={styles.rolledName} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={styles.rolledCount}>roulé ensemble ×{row.count}</Text>
    </View>
  );
}

function HistoryRow({ card }: { card: PilotRoulageCard }) {
  return (
    <View
      style={styles.historyCard}
      accessible
      accessibilityLabel={`${card.title}, ${formatDateTime(card.startsAt)}, ${card.circuitName}, ${
        card.statusLabel
      }`}
    >
      <View style={styles.flex1}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={styles.historyMeta} numberOfLines={1}>
          {formatDateTime(card.startsAt)} · {card.circuitName}
        </Text>
      </View>
      <View style={styles.statusPill}>
        <Text style={[styles.statusPillTxt, card.positive && styles.statusPillTxtHi]}>
          {card.statusLabel}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onglet AMIS
// ---------------------------------------------------------------------------

function AmisTab({ amis, bottomInset }: { amis: ClubAmis; bottomInset: number }) {
  const { status, accepted, received, sent, reload } = amis;

  return (
    <View style={styles.tabFill}>
      <View style={styles.searchWrap}>
        <SearchBlock amis={amis} />
      </View>

      {status === 'loading' ? (
        <View style={styles.tabPad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : status === 'error' ? (
        <View style={styles.tabCentered}>
          <StateView
            state="error"
            errorMessage="Vos amis n'ont pas pu se charger."
            onRetry={reload}
          />
        </View>
      ) : (
        <FlashList
          data={accepted}
          keyExtractor={(f) => f.friendshipId}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: bottomInset + space.xl,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {received.length > 0 ? (
                <View>
                  <SectionHeader eyebrow="Demandes reçues" count={received.length} />
                  <View style={styles.cardStack}>
                    {received.map((p) => (
                      <PendingRow
                        key={p.friendshipId}
                        row={p}
                        primary={{
                          label: 'Accepter',
                          onPress: () => void amis.accept(p.friendshipId),
                        }}
                        secondary={{
                          label: 'Décliner',
                          onPress: () => void amis.decline(p.friendshipId),
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {sent.length > 0 ? (
                <View>
                  <SectionHeader eyebrow="Demandes envoyées" count={sent.length} />
                  <View style={styles.cardStack}>
                    {sent.map((p) => (
                      <PendingRow
                        key={p.friendshipId}
                        row={p}
                        secondary={{
                          label: 'Annuler',
                          onPress: () => void amis.revoke(p.friendshipId),
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {accepted.length > 0 ? (
                <SectionHeader
                  eyebrow="Vos amis"
                  count={accepted.length}
                  style={styles.historyHeader}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            received.length === 0 && sent.length === 0 ? (
              <StateView
                state="empty"
                emptyMessage="Ajoutez un pilote par son @handle pour partager vos repères."
                style={styles.emptyBlock}
              />
            ) : null
          }
          ListFooterComponent={
            accepted.length > 0 ? (
              <Text style={styles.caption}>
                Aucun classement entre vous. Juste des repères communs.
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={staggerEntering(index)} style={styles.historyItem}>
              <FriendRow friend={item} onRevoke={() => void amis.revoke(item.friendshipId)} />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

function SearchBlock({ amis }: { amis: ClubAmis }) {
  const { query, setQuery, search, addFriend } = amis;
  return (
    <View>
      <Text style={styles.searchLabel}>AJOUTER PAR @HANDLE</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="@handle"
        placeholderTextColor={colors.text.dim}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
        accessibilityLabel="Rechercher un pilote par son handle"
      />

      {search.kind === 'searching' ? (
        <Text style={styles.searchHint}>Recherche…</Text>
      ) : search.kind === 'none' ? (
        <Text style={styles.searchHint}>Aucun pilote à ce @handle.</Text>
      ) : search.kind === 'self' ? (
        <Text style={styles.searchHint}>C'est vous.</Text>
      ) : search.kind === 'found' ? (
        <View style={styles.resultRow}>
          <View style={styles.avatarSm}>
            <Text style={styles.avatarSmTxt}>{search.user.initials}</Text>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.resultName} numberOfLines={1}>
              {search.user.name}
            </Text>
            {search.user.handle ? (
              <Text style={styles.resultHandle} numberOfLines={1}>
                @{search.user.handle}
              </Text>
            ) : null}
          </View>
          <PressScale
            onPress={() => void addFriend(search.user.id)}
            accessibilityLabel={`Ajouter ${search.user.name}`}
            style={styles.addPill}
          >
            <Text style={styles.addPillTxt}>Ajouter</Text>
          </PressScale>
        </View>
      ) : null}
    </View>
  );
}

function PendingRow({
  row,
  primary,
  secondary,
}: {
  row: PendingVM;
  primary?: { label: string; onPress: () => void };
  secondary: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingHead}>
        <View style={styles.avatarSm}>
          <Text style={styles.avatarSmTxt}>{row.initials}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.friendName} numberOfLines={1}>
            {row.name}
          </Text>
          {row.handle ? (
            <Text style={styles.friendMeta} numberOfLines={1}>
              @{row.handle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {primary ? (
          <PressScale
            onPress={primary.onPress}
            accessibilityLabel={`${primary.label} — ${row.name}`}
            containerStyle={styles.flex1}
            style={styles.btnAccept}
          >
            <Text style={styles.btnAcceptTxt}>{primary.label}</Text>
          </PressScale>
        ) : null}
        <PressScale
          onPress={secondary.onPress}
          accessibilityLabel={`${secondary.label} — ${row.name}`}
          containerStyle={styles.flex1}
          style={styles.btnDecline}
        >
          <Text style={styles.btnDeclineTxt}>{secondary.label}</Text>
        </PressScale>
      </View>
    </View>
  );
}

function FriendRow({ friend, onRevoke }: { friend: FriendVM; onRevoke: () => void }) {
  // TODO_L3 : comparateur ami — route dédiée `/(app2)/data/comparer?friend=<id>`
  // (lot L3). D'ici là, on ouvre la porte Data ; jamais un chrono d'autrui ici.
  const openCompare = () => router.navigate('/(app2)/data' as never);

  return (
    <View style={styles.friendCard}>
      <View style={styles.friendHead}>
        {friend.avatarUrl ? (
          <Photo uri={friend.avatarUrl} style={styles.avatarPhoto} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{friend.initials}</Text>
          </View>
        )}
        <View style={styles.flex1}>
          <View style={styles.friendNameRow}>
            <Text style={styles.friendName} numberOfLines={1}>
              {friend.name}
            </Text>
            {friend.inCrew ? (
              // Sans `accessible`, iOS n'expose jamais ce libellé : l'appartenance
              // au groupe resterait une information purement visuelle.
              <View style={styles.crewBadge} accessible accessibilityLabel="Membre de votre écurie">
                <OxvIcon name="groupe" size={13} color={colors.text.mid} />
              </View>
            ) : null}
          </View>
          {friend.metaLine ? (
            <Text style={styles.friendMeta} numberOfLines={1}>
              {friend.metaLine}
            </Text>
          ) : (
            <Text style={styles.friendMeta} numberOfLines={1}>
              —
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <PressScale
          onPress={openCompare}
          accessibilityLabel={`Comparer côte à côte avec ${friend.name}`}
          containerStyle={styles.flex1}
          style={styles.btnCompare}
        >
          <Text style={styles.btnCompareTxt}>Comparer côte à côte</Text>
        </PressScale>
        <PressScale
          onPress={onRevoke}
          accessibilityLabel={`Retirer ${friend.name}`}
          style={styles.btnGhost}
        >
          <Text style={styles.btnGhostTxt}>Retirer</Text>
        </PressScale>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glyphes
// ---------------------------------------------------------------------------

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 15,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.sm,
  },

  // Conteneurs d'onglet
  tabFill: { flex: 1 },
  tabPad: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  tabCentered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  headerBlock: { gap: space.xl },
  cardStack: { gap: space.md, marginTop: space.md },
  historyHeader: { marginBottom: space.sm },
  historyItem: { marginBottom: space.sm },
  emptyBlock: { marginTop: space.xxl },

  // Avatars
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhoto: { width: 40, height: 40, borderRadius: 20 },
  avatarTxt: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.text.mid,
  },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text.mid,
  },

  // Carte invitation
  inviteCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  inviteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  inviteTitle: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  inviteSub: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginTop: 2,
  },
  metaBlock: { marginTop: space.md, gap: space.sm },
  roulageTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  metaLabel: {
    width: 52,
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    paddingTop: 2,
  },
  metaValue: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },

  // Actions (boutons)
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, alignItems: 'stretch' },
  btnDim: { opacity: 0.5 },
  btnAccept: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: space.lg,
  },
  btnAcceptTxt: {
    fontFamily: typo.bodySemi,
    fontSize: 13,
    color: colors.text.hi,
  },
  btnDecline: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
    paddingHorizontal: space.lg,
  },
  btnDeclineTxt: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.mid,
  },
  btnCompare: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
    paddingHorizontal: space.lg,
  },
  btnCompareTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text.hi,
  },
  btnGhost: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  btnGhostTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.text.low,
  },

  // Roulé ensemble
  rolledCard: {
    marginTop: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  rolledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rolledDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  rolledName: {
    flex: 1,
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
  },
  rolledCount: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.text.mid,
  },

  // Historique
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.md,
  },
  historyTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
  historyMeta: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.low,
    marginTop: 3,
  },
  statusPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  statusPillTxt: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  statusPillTxtHi: { color: colors.text.hi },

  // Recherche @handle
  searchWrap: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  searchLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.sm,
  },
  searchInput: {
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.hi,
  },
  searchHint: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.md,
  },
  resultName: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  resultHandle: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: 2,
  },
  addPill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  addPillTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },

  // Demandes en attente
  pendingCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  // Cartes amis
  friendCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  friendHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  friendNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  friendName: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
    flexShrink: 1,
  },
  friendMeta: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.text.mid,
    marginTop: 3,
  },
  crewBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    backgroundColor: colors.bg.card2,
  },

  caption: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.low,
    textAlign: 'center',
    marginTop: space.lg,
    paddingHorizontal: space.md,
  },
});
