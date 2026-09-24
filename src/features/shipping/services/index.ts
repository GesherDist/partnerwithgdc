/**
 * Shipping Services
 *
 * Re-exports for shipping service functions.
 */

export { extractShippingInfo } from './shipping-extract.service';
export {
  processShippingEmail,
  reprocessShippingEmail,
} from './shipping-processor.service';

// CMA CGM API integration
export {
  isCmaCgmConfigured,
  fetchContainerEvents,
  mapCmaCgmEventToStatus,
  syncAllContainers,
  trackContainer,
  getActiveContainersForTracking,
} from './cma-cgm-tracking.service';
