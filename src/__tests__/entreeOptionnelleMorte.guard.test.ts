/**
 * GARDE — aucune entrée optionnelle NOUVELLE que personne ne renseigne.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CETTE GARDE EXISTE POUR ATTRAPER
 * ===========================================================================
 *
 * Trente-cinq gardes veillaient sur ce dépôt le 14/08/2026. Trente-quatre
 * lisaient le fichier comme du TEXTE. Aucune ne lisait un arbre syntaxique.
 *
 * Et le défaut trouvé ce jour-là n'avait aucune forme textuelle : une entrée
 * déclarée optionnelle, qu'aucun appelant ne fournissait, et dont l'absence
 * appelait une constante inventée —
 *
 *     export const DEFAULT_VEHICLE: VehicleParameters = { maxGLateral: 1.0 };
 *     const vehicle = input.vehicle ?? DEFAULT_VEHICLE;
 *
 * — soit 40 % du chiffre roi, 7,7 points de marge sur la seule séance mesurée
 * de la base. Nommée, typée, documentée, et introuvable par `grep`.
 *
 * Ce qui la trahissait n'était pas une chaîne : c'était une RELATION entre une
 * déclaration et l'ensemble de ses appels. Il faut lire l'arbre pour la voir.
 *
 * ===========================================================================
 * COMMENT CETTE GARDE SE LIT
 * ===========================================================================
 *
 * L'inventaire ci-dessous n'est PAS une liste de défauts. C'est le recensement
 * des endroits où une valeur par défaut décide en silence. La plupart sont
 * anodins — un pas de calcul, une limite de page, un `now` injectable. Certains
 * ne le sont pas.
 *
 * La garde échoue quand l'inventaire CHANGE. Un ajout demande une décision :
 *
 *   • soit l'entrée sert vraiment — alors un appelant la renseigne, et elle
 *     sort de la liste ;
 *   • soit elle ne sert pas — alors on la retire du contrat ;
 *   • soit elle est un réglage assumé — alors on l'inscrit ici, sciemment.
 *
 * Ce qu'il ne faut jamais faire, c'est l'inscrire sans la lire. Le seul cas
 * grave de cette liste — `computeMargin(vehicle?)` — a vécu des mois parce que
 * personne ne s'était posé la question. Il y figure encore : l'option existe
 * toujours, et rien en production ne la renseigne. Ce qui a changé, c'est que
 * son absence est désormais DITE au pilote (« votre véhicule n'est pas
 * caractérisé ») au lieu d'être comblée par une constante.
 */

import { entreesOptionnellesJamaisRenseignees } from '@/test-utils/entreesOptionnelles';

/**
 * L'inventaire au 15/08/2026 — 78 entrées (83 la veille).
 *
 * Cinq de moins : la consolidation des générateurs de tracé a donné de vrais
 * appelants à `polylineToPathD` et `polylineLength`, et supprimé les deux
 * relais d'`uiLogic`. C'est le sens de sortie qu'on veut — une entrée quitte
 * la liste parce que quelqu'un la renseigne, pas parce qu'on l'a rayée.
 *
 * Trié par `fichier::signature`. Les `limit?`, `max?`, `now?`, `intervalMs?`
 * sont des réglages : leur défaut ne devient jamais un chiffre montré au
 * pilote. Les entrées de `flowService`, `liveRelayLogic` et `segment` sont des
 * jeux d'options complets restés au réglage d'usine — à regarder le jour où
 * l'une d'elles influencera un affichage.
 */
const INVENTAIRE = [
  '/src/ble/captureMode.ts::shareCapture(uri?)',
  '/src/circuit/circuitCorners.ts::cordesForCircuit(fetchCenterline?)',
  '/src/circuit/circuitCorners.ts::cornersForCircuit(fetchCenterline?)',
  '/src/circuit/circuitGenerator.ts::fetchOsmWay(fetchImpl?)',
  '/src/features/club/clubHubLogic.ts::messagePreview(max?)',
  '/src/features/data/horsLigneLogic.ts::messageHorsLigne(maintenantMs?)',
  '/src/features/data/saison/petitsMultiplesLogic.ts::dernieresSeances(max?)',
  '/src/features/rec/biometryCaptureBuffer.ts::toBiometryInput(windowMs?)',
  '/src/features/rec/preparationLogic.ts::checklistProgress(total?)',
  '/src/features/vous/vousHubLogic.ts::foundersGauge(max?)',
  '/src/lib/queries/attente.ts::avecDelaiGarde(delaiMs?)',
  '/src/perf/frameTimes.ts::detectThrottling(seuilRatio?)',
  '/src/services/adminQualityService.ts::detectSessionAnomalies(limit?)',
  '/src/services/adminQualityService.ts::listQualityReports(status?)',
  '/src/services/bandeService.ts::loadBandeSeance(pas?)',
  '/src/services/biometryCaptureRunner.ts::startBiometryCapture(injected?)',
  '/src/services/boardLogic.ts::shouldEmitBoard(minIntervalMs?)',
  '/src/services/bookingCatalogLogic.ts::foundersProgressLabel(total?)',
  '/src/services/brakingPointsService.ts::detectBrakingPoints(minDropKmh?)',
  '/src/services/brakingPointsService.ts::detectBrakingPoints(minSeparationM?)',
  '/src/services/captureSyncQueue.ts::gcOldCaptures(now?)',
  '/src/services/captureSyncQueue.ts::recupererTramesManquantes(now?)',
  '/src/services/coachBillingService.ts::listMyInvoices(limit?)',
  '/src/services/coachConsoleLogic.ts::computeSelfTrend(epsilon?)',
  '/src/services/coachMarketplaceService.ts::createAvailability(CreateAvailabilityInput.endsAt?)',
  '/src/services/coachObjectivesService.ts::createObjective(CreateObjectiveInput.detail?)',
  '/src/services/coachObjectivesService.ts::createObjective(CreateObjectiveInput.priority?)',
  '/src/services/coachTriageService.ts::getSessionTriage(limit?)',
  '/src/services/cornerEvolutionService.ts::loadCornerEvolution(opts?)',
  '/src/services/deltaService.ts::loadDeltaEntreTours(pasM?)',
  '/src/services/flowLogic.ts::jerkDistribution(binWidth?)',
  '/src/services/flowLogic.ts::jerkDistribution(channel?)',
  '/src/services/flowService.ts::loadSessionFlow(FlowOptions.maxGapMs?)',
  '/src/services/flowService.ts::loadSessionFlow(FlowOptions.minGapMs?)',
  '/src/services/flowService.ts::loadSessionFlow(FlowOptions.severityWeights?)',
  '/src/services/flowService.ts::loadSessionFlow(FlowOptions.severityWindowMs?)',
  '/src/services/flowService.ts::loadSessionFlow(FlowOptions.smoothingWindowMs?)',
  '/src/services/flowService.ts::loadSessionFlow(opts?)',
  '/src/services/intentionsService.ts::peekPendingIntentionId(now?)',
  '/src/services/journeeDuJourService.ts::circuitDeMaJournee(maintenantMs?)',
  '/src/services/liveRelayLogic.ts::buildBiometryEvent(BiometryEventOpts.baselineMs?)',
  '/src/services/liveRelayLogic.ts::buildBiometryEvent(BiometryEventOpts.windowMs?)',
  '/src/services/liveRelayLogic.ts::buildBiometryEvent(opts?)',
  '/src/services/liveRelayLogic.ts::raceBoxToLiveFrame(RelayContext.cornerIndex?)',
  '/src/services/liveRelayLogic.ts::raceBoxToLiveFrame(RelayContext.cornerWatch?)',
  '/src/services/liveRelayLogic.ts::raceBoxToLiveFrame(RelayContext.sector?)',
  '/src/services/liveSessionLogic.ts::shouldEmitBiometry(minIntervalMs?)',
  '/src/services/liveSessionLogic.ts::shouldEmitFrame(minIntervalMs?)',
  '/src/services/liveSessionService.ts::startSimulatedStream(intervalMs?)',
  // LE CAS QUI A FAIT NAÎTRE CETTE GARDE. Toujours là, et c'est voulu :
  // l'option reste ouverte pour le jour où une grandeur d'adhérence entrera en
  // base. Ce qui a changé, c'est que son absence ne fabrique plus rien.
  '/src/services/marginCalculator.ts::computeMargin(ComputeMarginInput.vehicle?)',
  '/src/services/mfaService.ts::commencerEnrolement(nom?)',
  '/src/services/moderationService.ts::listReports(status?)',
  '/src/services/pilotCoachBillingService.ts::listMyCoachInvoices(limit?)',
  '/src/services/pilotGoalsService.ts::listMyGoals(limit?)',
  '/src/services/pushNotificationsService.ts::scheduleDebriefNotification(ScheduleDebriefInput.delayMs?)',
  '/src/services/reportNocturne.ts::delaiApresReport(maintenant?)',
  '/src/services/routing/scenicPoiService.ts::findScenicPois(kinds?)',
  '/src/services/routing/scenicRouteService.ts::planScenicRoute(ScenicRouteRequest.distanceKm?)',
  '/src/services/routing/scenicRoutesService.ts::rejectRoute(notes?)',
  '/src/services/sessionTelemetryService.ts::loadSessionFrames(maxFrames?)',
  '/src/services/sessionTelemetryService.ts::loadSessionTrajectory(limit?)',
  '/src/services/supportAdminService.ts::listAllTickets(AdminTicketFilter.status?)',
  '/src/services/supportService.ts::createTicket(CreateTicketInput.deviceId?)',
  '/src/services/supportService.ts::createTicket(CreateTicketInput.sessionId?)',
  '/src/services/v2/founderService.ts::apply(referrerCode?)',
  '/src/services/v2/incidentService.ts::listAllIncidents(limite?)',
  '/src/services/weatherService.ts::fetchCurrentWeather(useCache?)',
  '/src/telemetry/bande.ts::formeRecommandee(seuil?)',
  '/src/telemetry/courbeDelta.ts::ancreRepere(ecartMin?)',
  '/src/types/domain.ts::marginZoneOf(thresholds?)',
  '/src/types/expo-print-shim.d.ts::printToFileAsync(PrintToFileOptions.margins?)',
  '/src/ui/v2/media/blurhash.ts::photoRecyclingKey(id?)',
  '/src/ui/v2/motion/motionMath.ts::pullAngle(sweep?)',
  '/src/ui/v2/motion/useCondensingHeader.tsx::useCondensingHeader(CondensingHeaderOptions.band?)',
  '/src/ui/v2/motion/useCondensingHeader.tsx::useCondensingHeader(CondensingHeaderOptions.threshold?)',
  '/src/ui/v2/vizMath.ts::radarRingPath(count?)',
  '/src/utils/time.ts::timeAgoFr(now?)',
  '/supabase/functions/ritual_dispatcher/lib/resend.ts::sendEmail(SendEmailParams.replyTo?)',
].sort();

const RECENSE = entreesOptionnellesJamaisRenseignees().map((e) => `${e.fichier}::${e.signature}`);

describe('les entrées optionnelles que personne ne renseigne', () => {
  /**
   * La preuve que l'outil voit ce pour quoi il a été écrit. Sans elle, la
   * garde pourrait être verte en ne trouvant rien du tout.
   */
  it('l’outil voit le cas qui l’a fait naître', () => {
    expect(RECENSE).toContain(
      '/src/services/marginCalculator.ts::computeMargin(ComputeMarginInput.vehicle?)'
    );
  });

  it('il recense un dépôt entier, pas trois fichiers', () => {
    expect(RECENSE.length).toBeGreaterThan(50);
  });

  /**
   * LE CŒUR. Toute entrée NOUVELLE fait échouer, et son ajout à la liste
   * demande d'avoir lu ce qu'elle décide en silence.
   */
  it('aucune entrée nouvelle depuis l’inventaire du 14/08/2026', () => {
    const nouvelles = RECENSE.filter((e) => !INVENTAIRE.includes(e));
    expect(nouvelles).toEqual([]);
  });

  /**
   * Et l'inverse : une entrée qui a disparu doit sortir de la liste. Un
   * inventaire qui garde des lignes mortes cesse d'être un inventaire.
   */
  it('l’inventaire ne garde pas de lignes périmées', () => {
    const disparues = INVENTAIRE.filter((e) => !RECENSE.includes(e));
    expect(disparues).toEqual([]);
  });
});
