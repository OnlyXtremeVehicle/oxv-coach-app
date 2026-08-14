/**
 * Vue Admin — hub avec 3 entrées Préparation / En cours / Analytique.
 * Reskin V2 : Screen + AppBar (Logo), Card/SectionLabel du kit. Accent
 * bronze conservé (couleur de rôle admin). Logique inchangée.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  ORDRE_FAMILLES,
  TITRE_FAMILLE,
  type FamilleAdmin,
  compteLisible,
  familleVisible,
  modeAdmin,
  phraseMode,
} from '@/features/admin/hubAdminLogic';
import { type SignauxHubAdmin, chargerSignauxHubAdmin } from '@/services/adminHubSignalsService';
import { type ControlTower, loadControlTower } from '@/services/adminControlTowerService';
import { SectionLabel } from '@/ui/SectionLabel';
import { Logo } from '@/brand/Logo';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine). Liserés et accents.
// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

/**
 * LES VINGT-DEUX DESTINATIONS, CLASSÉES.
 *
 * Elles formaient une liste plate, sans une seule section. Le cahier impose la
 * séparation verticale : surveillance en haut, gestes du jour au milieu sous
 * « À faire », plateau en bas — et la structure, qu'on règle au calme, ranger
 * plus bas le jour J.
 */
const VIEWS: { href: string; label: string; description: string; famille: FamilleAdmin }[] = [
  {
    href: '/(admin)/tour-controle',
    famille: 'surveillance' as FamilleAdmin,
    label: 'Tour de contrôle',
    description: 'La journée en cours : événements, présences, sessions, à surveiller.',
  },
  {
    href: '/(admin)/preparation',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Préparation',
    description: 'Affectations équipement, vérifications avant session.',
  },
  {
    href: '/(admin)/en-cours',
    famille: 'surveillance' as FamilleAdmin,
    label: 'En cours',
    // AUCUN CANAL TEMPS RÉEL N'EXISTE dans tout `app/(admin)/` — vérifié :
    // zéro `.channel(`, zéro `postgres_changes`, zéro `.subscribe(` sur les
    // 31 fichiers. L'écran visé le dit lui-même dans son pied de page. Une
    // promesse que le code dément fait chercher une panne là où il n'y a
    // qu'une absence. Relevé le 02/08/2026 ; le temps réel reste à faire.
    description: 'Pilotes en roulage, lus à l’ouverture de l’écran.',
  },
  {
    href: '/(admin)/devices',
    famille: 'plateau' as FamilleAdmin,
    label: 'Boîtiers',
    description: 'Parc de boîtiers OXV, état de santé, affectations.',
  },
  {
    href: '/(admin)/evenements',
    famille: 'plateau' as FamilleAdmin,
    label: 'Événements',
    description: 'Créer et gérer les événements (balade, test, partenaire) + inscriptions.',
  },
  {
    href: '/(admin)/scan-checkin',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Scan présence',
    description: 'Pointer les arrivées en scannant le code de présence du Pass OXV.',
  },
  {
    href: '/(admin)/presences',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Présences jour J',
    description: 'Pointer les inscrits des sessions du jour (indicateurs site, avis J+1, médias).',
  },
  {
    /**
     * LES SIGNALEMENTS — famille « à faire », et c'est le point.
     *
     * `incident_followups` existe depuis le 02/08 et le pilote LIT déjà son
     * suivi. Mesuré le 14/08 : zéro occurrence du mot « incident » dans les
     * 31 fichiers de cet espace. Une déclaration entrait et n'en ressortait
     * jamais — le pilote voyait un signalement sans suite, indéfiniment.
     */
    href: '/(admin)/incidents',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Signalements',
    description:
      'Les incidents déclarés par les pilotes : reçu, traité, clos — chaque acte porte son auteur.',
  },
  {
    href: '/(admin)/qualite-data',
    famille: 'surveillance' as FamilleAdmin,
    label: 'Qualité data',
    description: 'Sessions à surveiller : frames manquantes, analyse absente, débrief non généré.',
  },
  {
    href: '/(admin)/support',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Support',
    description: 'Demandes des pilotes : P0 en tête, statut, priorité, réponse.',
  },
  {
    href: '/(admin)/moderation',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Modération',
    description: 'Signalements communautaires : prendre en charge, résoudre, rejeter.',
  },
  {
    href: '/(admin)/analytique',
    famille: 'structure' as FamilleAdmin,
    label: 'Analytique',
    description: 'Métriques globales post-session, export.',
  },
  {
    href: '/(admin)/maintenance',
    famille: 'structure' as FamilleAdmin,
    label: 'Maintenance',
    description: 'Kill-switch distant et version minimale de l’application.',
  },
  {
    href: '/(admin)/feature-flags',
    famille: 'structure' as FamilleAdmin,
    label: 'Feature flags',
    description: 'Activer / désactiver des fonctionnalités, versions d’algos.',
  },
  {
    href: '/(admin)/securite',
    famille: 'structure' as FamilleAdmin,
    label: 'Sécurité du compte',
    description: 'Second facteur (TOTP) de votre compte administrateur.',
  },
  {
    href: '/(admin)/circuit',
    famille: 'plateau' as FamilleAdmin,
    label: 'Inspecteur circuit',
    description: 'Topologie du circuit, virages, heatmap historique des marges.',
  },
  {
    href: '/(admin)/utilisateurs',
    famille: 'plateau' as FamilleAdmin,
    label: 'Utilisateurs',
    description: 'Annuaire, rôle (audité), suspension, consentements.',
  },
  {
    href: '/(admin)/coachs',
    famille: 'plateau' as FamilleAdmin,
    label: 'Coachs',
    description: 'Assignations coach ↔ pilote, gestion des consentements.',
  },
  {
    href: '/(admin)/creneaux-a-valider',
    famille: 'a-faire' as FamilleAdmin,
    label: 'Créneaux à valider',
    description: 'Les disponibilités proposées par les coachs, en attente d’ouverture.',
  },
  {
    href: '/(admin)/partenaires',
    famille: 'structure' as FamilleAdmin,
    label: 'Partenaires',
    description: 'Valider les comptes partenaires, superviser les leads.',
  },
  {
    href: '/(admin)/ambassadeurs',
    famille: 'structure' as FamilleAdmin,
    label: 'Ambassadeurs',
    description: 'Candidatures ambassadeur : activer, révoquer.',
  },
  {
    href: '/(admin)/sessions-media',
    famille: 'structure' as FamilleAdmin,
    label: 'Médias',
    description: 'Dépôt des photos / vidéos prises sur piste par session.',
  },
  {
    href: '/(admin)/routes-certification',
    famille: 'structure' as FamilleAdmin,
    label: 'Belles routes',
    description: 'Demandes de certification de routes à examiner.',
  },
  {
    href: '/(admin)/points-carte',
    famille: 'structure' as FamilleAdmin,
    label: 'Points de la carte',
    description: 'Lieux, partenaires et événements de La carte OXV.',
  },
];

/** Un fait compté, ou « — ». Jamais un zéro fabriqué. */
function Compteur({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.compteurNum}>{valeur}</Text>
      <Text style={s.compteurLib}>{libelle}</Text>
    </View>
  );
}

export default function AdminHubScreen() {
  const signOut = useAuthStore((st) => st.signOut);

  /**
   * LES DEUX SIGNAUX, ET LE MODE QU'ILS COMMANDENT.
   *
   * Tant qu'ils ne sont pas arrivés, le hub reste en mode COMPLET et ne se
   * replie pas : afficher un arrangement qu'on défait une seconde plus tard
   * fait manquer sa cible à l'administrateur. La leçon du hub coach.
   */
  const [signaux, setSignaux] = useState<SignauxHubAdmin | null>(null);
  const [tour, setTour] = useState<ControlTower | null>(null);

  useEffect(() => {
    let annule = false;
    const maintenant = new Date();
    chargerSignauxHubAdmin(maintenant)
      .then((s2) => {
        if (!annule) setSignaux(s2);
      })
      .catch(() => undefined);
    // Les compteurs de surveillance viennent du tour de contrôle : une seule
    // source, déjà écrite, qui distingue déjà « inconnu » de « zéro ».
    loadControlTower(maintenant)
      .then((t) => {
        if (!annule) setTour(t);
      })
      .catch(() => undefined);
    return () => {
      annule = true;
    };
  }, []);

  const mode = modeAdmin({
    pilotesEnPiste: signaux?.pilotesEnPiste ?? 0,
    seancesDuJour: signaux?.seancesDuJour ?? 0,
  });
  const noteMode = phraseMode(mode);

  const [rangeOuvert, setRangeOuvert] = useState(false);

  return (
    <Screen>
      <AppBar title="ADMIN OXV" leading={<Logo size={26} />} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>COORDINATION</Text>
        <Text style={s.title} accessibilityRole="header">
          Coordination de la session
        </Text>

        {/* LES COMPTEURS. Trois faits, lus sur la journée en cours. Chacun
            s'écrit « — » tant qu'il n'a pas été mesuré : sur un écran de régie,
            « 0 pilote attendu » et « je n'ai pas pu compter » ne commandent pas
            le même geste. */}
        <View style={s.compteurs}>
          <Compteur valeur={compteLisible(tour?.expectedPilots)} libelle="attendus" />
          <Compteur valeur={compteLisible(tour?.checkedInPilots)} libelle="pointés" />
          <Compteur valeur={compteLisible(signaux?.pilotesEnPiste)} libelle="en piste" />
        </View>

        {noteMode !== null ? <Text style={s.modeNote}>{noteMode}</Text> : null}

        {/* LA SÉPARATION VERTICALE. Vingt-deux cartes en liste plate, c'était un
            menu. Chaque famille porte son titre, dans l'ordre du cahier. */}
        {ORDRE_FAMILLES.filter((f) => familleVisible(f, mode)).map((famille) => (
          <View key={famille} style={{ marginTop: theme.spacing.xl }}>
            <SectionLabel>{TITRE_FAMILLE[famille]}</SectionLabel>
            <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
              {VIEWS.filter((v) => v.famille === famille).map((v) => (
                <Card
                  key={v.href}
                  onPress={() => router.push(v.href as never)}
                  accessibilityLabel={`${v.label}. ${v.description}`}
                  style={{ borderColor: ADMIN }}
                >
                  <View style={s.cardHead}>
                    <Text style={s.cardTitle}>{v.label}</Text>
                    <Text style={s.cardChevron}>›</Text>
                  </View>
                  <Text style={s.cardMeta}>{v.description}</Text>
                </Card>
              ))}
            </View>
          </View>
        ))}

        {/* CE QUI EST RANGÉ RESTE ATTEIGNABLE.
            Le jour J replie la structure, il ne la supprime pas. Côté coach,
            filtrer avait rendu deux écrans littéralement inatteignables faute
            d'autre porte d'entrée — on ne recommence pas. */}
        {ORDRE_FAMILLES.some((f) => !familleVisible(f, mode)) ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: rangeOuvert }}
              accessibilityLabel={rangeOuvert ? 'Replier la structure' : 'Afficher la structure'}
              onPress={() => setRangeOuvert((v) => !v)}
              hitSlop={{ left: 12, right: 12 }}
              style={({ pressed }) => [s.repli, pressed && { opacity: 0.7 }]}
            >
              <Text style={s.repliTxt}>{rangeOuvert ? 'Replier' : 'Structure'}</Text>
            </Pressable>
            {rangeOuvert
              ? ORDRE_FAMILLES.filter((f) => !familleVisible(f, mode)).map((famille) => (
                  <View key={famille} style={{ marginTop: theme.spacing.lg }}>
                    <SectionLabel>{TITRE_FAMILLE[famille]}</SectionLabel>
                    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
                      {VIEWS.filter((v) => v.famille === famille).map((v) => (
                        <Card
                          key={v.href}
                          onPress={() => router.push(v.href as never)}
                          accessibilityLabel={`${v.label}. ${v.description}`}
                          style={{ borderColor: ADMIN }}
                        >
                          <View style={s.cardHead}>
                            <Text style={s.cardTitle}>{v.label}</Text>
                            <Text style={s.cardChevron}>›</Text>
                          </View>
                          <Text style={s.cardMeta}>{v.description}</Text>
                        </Card>
                      ))}
                    </View>
                  </View>
                ))
              : null}
          </View>
        ) : null}

        <SpaceSwitcher current="admin" />

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sortir de l'admin"
            onPress={() => router.replace('/(app2)' as never)}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Sortir de l&apos;admin</Text>
          </Pressable>

          {/* SORTIR DE L'ADMIN N'EST PAS SE DÉCONNECTER.
              Le contrôle au-dessus ne fait que NAVIGUER vers l'espace pilote :
              la session reste ouverte. Aucun `signOut` n'existait dans tout
              `app/(admin)/` — un administrateur qui prête son téléphone au bord
              de la piste, ou qui le pose, n'avait aucun moyen de fermer sa
              session depuis là où il travaille.
              Jalon 7, Phase 6 — deuxième des trois corrections structurelles. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            onPress={signOut}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              marginTop: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Se déconnecter</Text>
          </Pressable>
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
    color: ADMIN,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  compteurs: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  compteurNum: {
    fontFamily: theme.fonts.mono,
    fontSize: 28,
    color: ADMIN,
  },
  compteurLib: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  modeNote: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  repli: {
    alignSelf: 'flex-start' as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.cardBorderProminent,
  },
  repliTxt: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.palette.creamMute,
  },

  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardChevron: {
    color: theme.palette.faint,
    fontSize: 17,
  },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.5,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
