/**
 * Customer Contacts API Routes
 *
 * GET /api/customers/[customerId]/contacts - List contacts for a customer
 * POST /api/customers/[customerId]/contacts - Create a new contact
 */

import { NextRequest } from 'next/server';
import { customerContactService } from '@/features/customers/services/customer-contact.service';
import { createCustomerContactSchema } from '@/features/customers/lib/schemas';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '@/shared/lib/api/response';
import { createClient } from '@/shared/lib/supabase/server';

interface RouteParams {
  params: Promise<{ customerId: string }>;
}

/**
 * GET /api/customers/[customerId]/contacts
 * List all contacts for a customer
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { customerId } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate customerId format
    if (!customerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return badRequestResponse('Invalid customer ID format');
    }

    // Fetch contacts
    const result = await customerContactService.listByCustomer(customerId);

    if (!result.success) {
      if (result.error === 'Customer not found') {
        return notFoundResponse('Customer');
      }
      return internalErrorResponse(result.error);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/customers/[customerId]/contacts error:', error);
    return internalErrorResponse('Failed to fetch contacts');
  }
}

/**
 * POST /api/customers/[customerId]/contacts
 * Create a new contact for a customer
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { customerId } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Validate customerId format
    if (!customerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
      return badRequestResponse('Invalid customer ID format');
    }

    // Parse request body
    const body = await request.json();

    // Add customerId to body
    const input = {
      ...body,
      customerId,
    };

    // Validate input
    const validation = createCustomerContactSchema.safeParse(input);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Create contact
    const result = await customerContactService.create(validation.data, user.id);

    if (!result.success) {
      if (result.error === 'Customer not found') {
        return notFoundResponse('Customer');
      }
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to create contact');
    }

    return createdResponse(result.data);
  } catch (error) {
    console.error('POST /api/customers/[customerId]/contacts error:', error);
    return internalErrorResponse('Failed to create contact');
  }
}
