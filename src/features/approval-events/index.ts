/**
 * Approval Events Feature Module
 *
 * Public API for the Approval Events feature.
 * Only export what should be accessible from outside this feature.
 * Per client doc: "the audit spine"
 */

// Types
export type {
  ApprovalEvent,
  ApprovalEventWithDetails,
  ApprovalEventListItem,
  ApprovalEventListParams,
  ApprovalEventType,
  ApprovalStatus,
  CreateApprovalEventDTO,
  DecideApprovalEventDTO,
  ApprovalEventsTableProps,
} from './types';

export {
  APPROVAL_EVENT_TYPES,
  APPROVAL_EVENT_TYPE_LABELS,
  APPROVAL_STATUSES,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
} from './types';

// Hooks
export { useApprovalEvents, usePendingApprovals } from './hooks';

// Actions
export {
  listApprovalEvents,
  getPendingApprovals,
  getApprovalEvent,
  getApprovalEventsBySubject,
  requestApproval,
  approveApprovalEvent,
  rejectApprovalEvent,
} from './actions';

// Services (for internal use by other features)
export { approvalEventService } from './services';
