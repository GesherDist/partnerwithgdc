/**
 * Reject Extracted Email Data
 *
 * POST /api/inbound-emails/reject
 *
 * Marks an inbound email as rejected.
 * Used when Jenny rejects AI-extracted data from AutoExtractedDataSection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';

// ============================================
// POST /api/inbound-emails/reject
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { emailId, reason } = body;

    if (!emailId) {
      return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
    }

    console.log('[Reject Email] Rejecting email:', emailId);

    // ============================================
    // UPDATE EMAIL STATUS
    // ============================================

    const updateData: any = {
      status: 'ignored',
      extraction_status: 'rejected',
      updated_at: new Date().toISOString(),
    };

    // Add rejection reason if provided
    if (reason) {
      updateData.rejection_reason = reason;
    }

    const { data: email, error: updateError } = await adminClient
      .from('inbound_emails')
      .update(updateData)
      .eq('id', emailId)
      .select()
      .single();

    if (updateError) {
      console.error('[Reject Email] Error updating email:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject email', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Reject Email] Email rejected successfully');

    // ============================================
    // RETURN SUCCESS
    // ============================================

    return NextResponse.json({
      success: true,
      message: 'Email marked as rejected',
      emailId: email.id,
    });
  } catch (error) {
    console.error('[Reject Email] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
