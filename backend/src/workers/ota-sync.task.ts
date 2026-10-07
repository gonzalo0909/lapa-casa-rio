// Sincronizacion real de feeds iCal (Booking, Airbnb, Hostelworld, Expedia) y
// despues resolucion automatica de conflictos por prioridad de canal, para que
// cualquier conflicto que channel-service.ts haya dejado abierto durante el
// import no espere a que un admin lo revise manualmente.

import { syncICalFeeds } from '../services/ical-service';
import { conflictService } from '../services/conflict-service';
import { logger } from '../utils/logger';

export async function runOtaSync(): Promise<void> {
  const result = await syncICalFeeds();
  logger.info('ota-sync: sincronización completada', {
    totalFeeds: result.totalFeeds,
    successfulFeeds: result.successfulFeeds,
    failedFeeds: result.failedFeeds,
    totalImported: result.totalImported,
    totalCancelled: result.totalCancelled,
  });

  const conflicts = await conflictService.detectConflicts(result.currentFeedIds);
  if (conflicts.newlyDetected > 0 || conflicts.autoResolved > 0) {
    logger.info('ota-sync: conflictos procesados', conflicts);
  }
}
