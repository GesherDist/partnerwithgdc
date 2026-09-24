/**
 * Deals Feature Module
 *
 * Export all public APIs from the deals feature.
 */

// Types
export * from './types';

// Components
export * from './components';

// Hooks
export * from './hooks';

// Actions
export {
  getDeal,
  getDeals,
  getDealStats,
  createDeal,
  updateDeal,
  deleteDeal,
  markDealAsWon,
  markDealAsLost,
  reopenDeal,
  linkDealToCustomer,
  getDealNotes,
  addDealNote,
  deleteDealNote,
} from './actions';

// Services
export { dealsService } from './services/deals.service';

// Repository
export { dealsRepository } from './repositories/deals.repository';
