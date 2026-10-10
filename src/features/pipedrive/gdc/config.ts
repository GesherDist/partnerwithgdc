/**
 * GDC Pipedrive CRM configuration (Ankur's "GDC Pipedrive CRM – Developer Spec").
 *
 * Single source of truth for names the integration creates or matches in
 * Pipedrive. Names are matched case-insensitively; existing records are reused,
 * never renamed or reordered.
 */

// ============================================
// PIPELINE & STAGES
// ============================================

export const GDC_PIPELINE_NAME = 'GDC Sales';

export const GDC_STAGES = [
  { key: 'lead_prospect', name: 'Lead / Prospect' },
  { key: 'contacted', name: 'Contacted' },
  { key: 'needs_assessment', name: 'Needs Assessment' },
  { key: 'quote_sent', name: 'Quote Sent' },
  { key: 'negotiation', name: 'Negotiation' },
  { key: 'won_order_placed', name: 'Won – Order Placed' },
] as const;

export type GdcStageKey = (typeof GDC_STAGES)[number]['key'];

/** Position of each stage (0-based); used to only ever move deals forward */
export const GDC_STAGE_ORDER: Record<GdcStageKey, number> = Object.fromEntries(
  GDC_STAGES.map((stage, index) => [stage.key, index])
) as Record<GdcStageKey, number>;

// ============================================
// LOST REASONS
// ============================================
// Configured in Pipedrive (Company settings > Lost reasons, free-form disabled);
// Pipedrive has no public API for the lost-reason list. Gesher sends the same
// exact text as the deal's lost_reason.

export const GDC_LOST_REASONS = ['Price', 'Competitor', 'Timing', 'No response', 'Other'] as const;
export type GdcLostReason = (typeof GDC_LOST_REASONS)[number];

export function isGdcLostReason(value: unknown): value is GdcLostReason {
  return typeof value === 'string' && (GDC_LOST_REASONS as readonly string[]).includes(value);
}

// ============================================
// ACCOUNT TYPES
// ============================================

export const GDC_ACCOUNT_TYPES = ['Lead', 'Prospect', 'Current Customer'] as const;
export type GdcAccountType = (typeof GDC_ACCOUNT_TYPES)[number];

// ============================================
// ACTIVITY TYPES
// ============================================
// icon_key values are from Pipedrive's documented list for POST /v1/activityTypes.

export const GDC_ACTIVITY_TYPES = [
  { key: 'call', name: 'Call', iconKey: 'call', requiresReport: true },
  { key: 'site_visit', name: 'Site visit', iconKey: 'car', requiresReport: true },
  { key: 'meeting', name: 'Meeting', iconKey: 'meeting', requiresReport: false },
  { key: 'quote_follow_up', name: 'Quote follow-up', iconKey: 'pricetag', requiresReport: false },
  { key: 'delivery_follow_up', name: 'Delivery follow-up', iconKey: 'truck', requiresReport: false },
  { key: 'task', name: 'Task', iconKey: 'task', requiresReport: false },
] as const;

export type GdcActivityTypeKey = (typeof GDC_ACTIVITY_TYPES)[number]['key'];

/** Outcome values for call / site-visit reports (Pipedrive activity "Outcome" field) */
export const GDC_ACTIVITY_OUTCOMES = ['Connected', 'Voicemail', 'No answer'] as const;

/** Activity types that count as follow-ups in the monthly report */
export const GDC_FOLLOW_UP_ACTIVITY_TYPES: GdcActivityTypeKey[] = [
  'call',
  'site_visit',
  'meeting',
  'quote_follow_up',
  'delivery_follow_up',
  'task',
];

/** Activity types that mark a lead as "contacted" */
export const GDC_CONTACT_ACTIVITY_TYPES: GdcActivityTypeKey[] = ['call', 'site_visit'];

// ============================================
// CUSTOM FIELDS
// ============================================

export type GdcFieldEntity = 'organization' | 'person' | 'deal';

export interface GdcFieldDefinition {
  key: string;
  entity: GdcFieldEntity;
  name: string;
  fieldType: 'varchar' | 'enum' | 'double';
  options?: readonly string[];
}

export const GDC_CUSTOM_FIELDS = [
  { key: 'org_account_type', entity: 'organization', name: 'Account Type', fieldType: 'enum', options: GDC_ACCOUNT_TYPES },
  { key: 'org_erp_customer_id', entity: 'organization', name: 'ERP Customer ID', fieldType: 'varchar' },
  { key: 'person_role', entity: 'person', name: 'Role', fieldType: 'varchar' },
  { key: 'deal_erp_quote_number', entity: 'deal', name: 'ERP Quote #', fieldType: 'varchar' },
  { key: 'deal_erp_order_number', entity: 'deal', name: 'ERP Sales Order #', fieldType: 'varchar' },
  { key: 'deal_customer_po', entity: 'deal', name: 'Customer PO #', fieldType: 'varchar' },
  { key: 'deal_tire_count', entity: 'deal', name: 'Tire Count', fieldType: 'double' },
] as const satisfies readonly GdcFieldDefinition[];

export type GdcFieldKey = (typeof GDC_CUSTOM_FIELDS)[number]['key'];

// ============================================
// PURCHASE HISTORY
// ============================================

/**
 * Sales order statuses counted as purchases (orders placed). Draft, pending
 * and cancelled orders are excluded.
 */
export const PURCHASE_HISTORY_ORDER_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'] as const;

/** Marker that identifies the integration-managed purchase history note on an organization */
export const PURCHASE_HISTORY_NOTE_MARKER = '[GDC Purchase History]';

/** Marker on notes the integration adds to deals for ERP events */
export const ERP_NOTE_MARKER = '[GDC ERP]';

export type TireSize = '24' | '38' | 'other';
