/**
 * Credit Notes Feature Module
 *
 * Public API for the Credit Notes feature.
 * Only export what should be accessible from outside this feature.
 */

// Types
export type {
  CreditNote,
  CreditNoteItem,
  CreditNoteWithItems,
  CreditNoteListItem,
  CreditNoteListParams,
  CreditNoteStatus,
  CreditNoteReason,
  CreateCreditNoteDTO,
  UpdateCreditNoteDTO,
  CreateCreditNoteItemDTO,
  CreditNotesTableProps,
} from './types';

export {
  CREDIT_NOTE_STATUSES,
  CREDIT_NOTE_STATUS_LABELS,
  CREDIT_NOTE_STATUS_COLORS,
  CREDIT_NOTE_STATUS_TRANSITIONS,
  CREDIT_NOTE_REASONS,
  CREDIT_NOTE_REASON_LABELS,
} from './types';

// Hooks
export { useCreditNotes, useCreditNote } from './hooks';

// Actions
export {
  listCreditNotes,
  getCreditNote,
  createCreditNote,
  updateCreditNote,
  deleteCreditNote,
  issueCreditNote,
  applyCreditNote,
  cancelCreditNote,
} from './actions';

// Services (for internal use by other features)
export { creditNoteService } from './services';
