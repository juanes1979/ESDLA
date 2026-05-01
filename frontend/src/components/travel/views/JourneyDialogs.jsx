/**
 * JourneyDialogs — Agrupa los 4 diálogos flotantes del sistema de viaje:
 *   • CampDialog            (acampada y descansos)
 *   • ProvisionsShopDialog  (compra de provisiones antes del viaje)
 *   • SauronEyeOverlay      (animación durante viaje automatizado)
 *   • MapPickDialog         (selector de origen/destino sobre el mapa)
 *
 * Extraído de `EnhancedTravelSystem.jsx` durante el refactor P1 (Mayo 2026).
 * No tiene estado propio: todo llega por props desde el orquestador.
 */
import CampDialog from '@/components/travel/CampDialog';
import ProvisionsShopDialog from '@/components/travel/ProvisionsShopDialog';
import SauronEyeOverlay from '@/components/travel/SauronEyeOverlay';
import MapPickDialog from '@/components/travel/MapPickDialog';

export const JourneyDialogs = ({
  // Camp
  showCampDialog,
  setShowCampDialog,
  miembros,
  acompanantes,
  characters,
  activeJourney,
  region,
  partyProvisions,
  setPartyProvisions,
  setCharacters,
  travelEvents,
  onJourneyUpdate,
  terrenoViaje,
  performForaging,
  desgloseVelocidades,
  consecutiveCampDays,
  diasSinComida,
  diasSinAgua,
  currentClima,
  currentTerreno,
  onCampDayCompleted,
  onFatigueSave,
  onFatigueChange,

  // Provisions shop
  showProvisionsShop,
  setShowProvisionsShop,
  diasViaje,
  origenRegionName,
  terrenoShop,
  tipoTierra,
  onPurchaseComplete,

  // Automation overlay (Sauron's Eye)
  autoRunning,
  autoProgress,
  autoMessage,
  autoSubtitle,
  onAutoCancel,

  // Map pick dialog
  mapPickFor,
  setMapPickFor,
  locations,
  onMapPick,
}) => (
  <>
    <CampDialog
      open={showCampDialog}
      onClose={() => setShowCampDialog(false)}
      miembros={miembros}
      acompanantes={acompanantes}
      characters={characters}
      activeJourney={activeJourney}
      region={region}
      partyProvisions={partyProvisions}
      setPartyProvisions={setPartyProvisions}
      setCharacters={setCharacters}
      travelEvents={travelEvents}
      onJourneyUpdate={onJourneyUpdate}
      terrenoViaje={terrenoViaje}
      onForage={performForaging}
      desgloseVelocidades={desgloseVelocidades}
      consecutiveCampDays={consecutiveCampDays}
      diasSinComida={diasSinComida}
      diasSinAgua={diasSinAgua}
      currentClima={currentClima}
      currentTerreno={currentTerreno}
      onCampDayCompleted={onCampDayCompleted}
      onFatigueSave={onFatigueSave}
      onFatigueChange={onFatigueChange}
    />

    <ProvisionsShopDialog
      open={showProvisionsShop}
      onClose={() => setShowProvisionsShop(false)}
      miembros={miembros}
      acompanantes={acompanantes}
      characters={characters}
      diasViaje={diasViaje}
      origenRegionName={origenRegionName}
      terreno={terrenoShop}
      tipoTierra={tipoTierra}
      onPurchaseComplete={onPurchaseComplete}
    />

    <SauronEyeOverlay
      visible={autoRunning}
      percent={autoProgress}
      message={autoMessage}
      subtitle={autoSubtitle}
      onCancel={onAutoCancel}
    />

    <MapPickDialog
      open={!!mapPickFor}
      onClose={() => setMapPickFor(null)}
      target={mapPickFor || 'origen'}
      locations={locations}
      onPick={onMapPick}
    />
  </>
);

export default JourneyDialogs;
