/**
 * Sales Orders Feature Module
 *
 * Public API for the Sales Orders feature.
 */

// Components
export * from './components';

// Hooks
export * from './hooks';

// Types
export * from './types';

// Actions
export * from './actions';

// Schemas
export * from './lib/schemas';

// Lib (utilities and mock data)
export {
  MOCK_SALES_ORDERS_LIST,
  MOCK_MASTER_DATA,
  getMockSalesOrdersListResponse,
  getMockMasterDataResponse,
  formatCurrency,
  formatDate,
  generateOrderNumber,
  createEmptyOrderItem,
} from './lib/mock-data';
