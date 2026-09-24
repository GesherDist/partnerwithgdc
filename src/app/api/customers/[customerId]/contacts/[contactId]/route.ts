/**
 * Customer Contact by ID API Routes
 *
 * GET /api/customers/[customerId]/contacts/[contactId] - Get a single contact
 * PUT /api/customers/[customerId]/contacts/[contactId] - Update a contact
 * DELETE /api/customers/[customerId]/contacts/[contactId] - Soft delete a contact
 */

import { NextRequest } from 'next/server';
import { customerContactService } from '@/features/customers/services/customer-contact.service';
import { updateCustomerContactSchema } from '@/features/customers/lib/schemas';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  noContentResponse,
} from '@/shared/lib/api/response';
import { createClient } from '@/shared/lib/supabase/server';

interface RouteParams {
  params: Promise<{ customerId: string; contactId: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/customers/[customerId]/contacts/[contactId]
 * Get a single contact by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { customerId, contactId } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate ID formats
    if (!customerId || !UUID_REGEX.test(customerId)) {
      return badRequestResponse('Invalid customer ID format');
    }
    if (!contactId || !UUID_REGEX.test(contactId)) {
      return badRequestResponse('Invalid contact ID format');
    }

    // Fetch contact
    const result = await customerContactService.getById(contactId);

    if (!result.success) {
      if (result.error === 'Contact not found') {
        return notFoundResponse('Contact');
      }
      return internalErrorResponse(result.error);
    }

    // Verify contact belongs to the customer
    if (result.data && result.data.customerId !== customerId) {
      return notFoundResponse('Contact');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/customers/[customerId]/contacts/[contactId] error:', error);
    return internalErrorResponse('Failed to fetch contact');
  }
}

/**
 * PUT /api/customers/[customerId]/contacts/[contactId]
 * Update a contact
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { customerId, contactId } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate ID formats
    if (!customerId || !UUID_REGEX.test(customerId)) {
      return badRequestResponse('Invalid customer ID format');
    }
    if (!contactId || !UUID_REGEX.test(contactId)) {
      return badRequestResponse('Invalid contact ID format');
    }

    // Verify contact belongs to customer first
    const existing = await customerContactService.getById(contactId);
    if (!existing.success || !existing.data) {
      return notFoundResponse('Contact');
    }
    if (existing.data.customerId !== customerId) {
      return notFoundResponse('Contact');
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = updateCustomerContactSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Update contact
    const result = await customerContactService.update(contactId, validation.data, user.id);

    if (!result.success) {
      if (result.error === 'Contact not found') {
        return notFoundResponse('Contact');
      }
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to update contact');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('PUT /api/customers/[customerId]/contacts/[contactId] error:', error);
    return internalErrorResponse('Failed to update contact');
  }
}

/**
 * PATCH /api/customers/[customerId]/contacts/[contactId]
 * Partial update a contact (same as PUT)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return PUT(request, { params });
}

/**
 * DELETE /api/customers/[customerId]/contacts/[contactId]
 * Soft delete a contact
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { customerId, contactId } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate ID formats
    if (!customerId || !UUID_REGEX.test(customerId)) {
      return badRequestResponse('Invalid customer ID format');
    }
    if (!contactId || !UUID_REGEX.test(contactId)) {
      return badRequestResponse('Invalid contact ID format');
    }

    // Verify contact belongs to customer first
    const existing = await customerContactService.getById(contactId);
    if (!existing.success || !existing.data) {
      return notFoundResponse('Contact');
    }
    if (existing.data.customerId !== customerId) {
      return notFoundResponse('Contact');
    }

    // Delete contact
    const result = await customerContactService.delete(contactId, user.id);

    if (!result.success) {
      if (result.error === 'Contact not found') {
        return notFoundResponse('Contact');
      }
      return badRequestResponse(result.error || 'Failed to delete contact');
    }

    return noContentResponse();
  } catch (error) {
    console.error('DELETE /api/customers/[customerId]/contacts/[contactId] error:', error);
    return internalErrorResponse('Failed to delete contact');
  }
}
