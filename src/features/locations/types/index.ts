/**
 * Locations Module - TypeScript Types
 *
 * DTOs and types for the Locations module
 */

/**
 * Location type enum
 */
export type LocationType = 'warehouse' | 'drop_ship' | 'virtual';

// ============================================
// BASE TYPES
// ============================================

/**
 * Location entity type (from database)
 */
export interface Location {
  id: string;
  locationCode: string;
  name: string;
  locationType: LocationType;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Location with formatted address
 */
export interface LocationWithFormattedAddress extends Location {
  formattedAddress: string;
  fullAddress: string;
}

// ============================================
// DTO TYPES
// ============================================

/**
 * Create Location DTO
 */
export interface CreateLocationDTO {
  locationCode: string;
  name: string;
  locationType?: LocationType;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

/**
 * Update Location DTO
 */
export interface UpdateLocationDTO {
  locationCode?: string;
  name?: string;
  locationType?: LocationType;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Location list query parameters
 */
export interface LocationListParams {
  page?: number;
  limit?: number;
  search?: string;
  locationType?: LocationType;
  isActive?: boolean;
  sortBy?: keyof Location;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Location list response
 */
export interface LocationListResponse {
  data: Location[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// FORM TYPES
// ============================================

/**
 * Location form values (for React Hook Form)
 */
export interface LocationFormValues {
  locationCode: string;
  name: string;
  locationType: LocationType;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  isActive: boolean;
  isDefault: boolean;
}

// ============================================
// TABLE TYPES
// ============================================

/**
 * Location table row (for TanStack Table)
 */
export interface LocationTableRow {
  id: string;
  locationCode: string;
  name: string;
  locationType: LocationType;
  city: string | null;
  state: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Location type options for select inputs
 */
export const LOCATION_TYPE_OPTIONS = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'drop_ship', label: 'Direct' },
  { value: 'virtual', label: 'Virtual' },
] as const;

/**
 * US States for select inputs
 */
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
] as const;

/**
 * Default location form values
 */
export const DEFAULT_LOCATION_FORM_VALUES: LocationFormValues = {
  locationCode: '',
  name: '',
  locationType: 'warehouse',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  isActive: true,
  isDefault: false,
};

// ============================================
// DRAWER TYPES
// ============================================

/**
 * Props for CreateLocationDrawer
 */
export interface CreateLocationDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (location: Location) => void;
}

/**
 * Props for EditLocationDrawer
 */
export interface EditLocationDrawerProps {
  open: boolean;
  locationId: string | null;
  onClose: () => void;
  onSuccess?: (location: Location) => void;
}

/**
 * Props for ViewLocationDrawer
 */
export interface ViewLocationDrawerProps {
  open: boolean;
  locationId: string | null;
  onClose: () => void;
  onEdit?: (locationId: string) => void;
}

// ============================================
// LOCATION CONTACT TYPES
// ============================================

/**
 * Props for LocationContactsTable component
 */
export interface LocationContactsTableProps {
  locationId: string;
}

/**
 * Props for AddLocationContactDialog
 */
export interface AddLocationContactDialogProps {
  open: boolean;
  locationId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Props for EditLocationContactDialog
 */
export interface EditLocationContactDialogProps {
  open: boolean;
  contactId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}
