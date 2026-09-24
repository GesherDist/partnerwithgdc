/**
 * Cost Components Feature Module
 *
 * Public API for the Cost Components feature.
 * Only export what should be accessible from outside this feature.
 */

// Types
export type {
  CostComponent,
  CostComponentWithDetails,
  CostComponentType,
  CostComponentListParams,
  CreateCostComponentDTO,
  UpdateCostComponentDTO,
  CostComponentSummary,
  LandedCostSummary,
} from './types';

export {
  COST_COMPONENT_TYPES,
  COST_COMPONENT_TYPE_LABELS,
} from './types';

// Hooks
export { useCostComponents } from './hooks';

// Actions
export {
  listCostComponents,
  getCostComponent,
  createCostComponent,
  updateCostComponent,
  deleteCostComponent,
  getLandedCostSummary,
} from './actions';

// Services (for internal use by other features)
export { costComponentService } from './services';
