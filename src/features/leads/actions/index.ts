/**
 * Leads Server Actions
 *
 * Server actions for the Leads module.
 * Handles CRUD operations and Pipedrive sync.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { leadsRepository } from '../repositories/leads.repository';
import type {
  Lead,
  LeadListParams,
  LeadListResult,
  CreateLeadDTO,
  UpdateLeadDTO,
  ConvertLeadDTO,
  LeadNote,
} from '../types';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { pipedriveSyncService } from '@/features/pipedrive/services/pipedrive-sync.service';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of leads
 */
export async function getLeads(
  params: LeadListParams = {}
): Promise<ActionResult<LeadListResult>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const result = await leadsRepository.list(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('[getLeads] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch leads',
    };
  }
}

/**
 * Get a single lead by ID
 */
export async function getLead(id: string): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    console.log('[getLead] Fetching lead with ID:', id);
    const lead = await leadsRepository.getById(id);
    if (!lead) {
      console.log('[getLead] Lead not found');
      return { success: false, error: 'Lead not found' };
    }
    console.log('[getLead] Retrieved lead:', lead.id, 'Name:', lead.name, 'Company:', lead.company, 'UpdatedAt:', lead.updatedAt);
    return { success: true, data: lead };
  } catch (error) {
    console.error('[getLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lead',
    };
  }
}

/**
 * Get lead by Pipedrive person ID
 */
export async function getLeadByPipedriveId(
  pipedrivePersonId: number
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const lead = await leadsRepository.getByPipedrivePersonId(pipedrivePersonId);
    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }
    return { success: true, data: lead };
  } catch (error) {
    console.error('[getLeadByPipedriveId] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lead',
    };
  }
}

// ============================================
// CRUD ACTIONS
// ============================================

/**
 * Create a new lead
 */
export async function createLead(
  data: CreateLeadDTO
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Create lead locally first
    let lead = await leadsRepository.create(data, appUser.id);

    // Try to push to Pipedrive if connected
    try {
      const isConnected = await pipedrivePushService.isConnected();
      if (isConnected) {
        const pushResult = await pipedrivePushService.pushNewLead({
          title: data.name, // Lead title should be person name
          personName: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          // Address fields
          addressStreet: data.addressStreet,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressPostalCode: data.addressPostalCode,
          addressCountry: data.addressCountry,
          // Deal info
          value: data.dealValue,
          currency: data.dealCurrency || 'USD',
          expectedCloseDate: data.expectedCloseDate,
          notes: data.notes,
          labelIds: data.pipedriveLabels || undefined,
        });

        if (pushResult.success && pushResult.pipedriveLeadId) {
          // Update local lead with Pipedrive IDs
          lead = await leadsRepository.update(lead.id, {
            pipedriveLeadId: pushResult.pipedriveLeadId,
            pipedrivePersonId: pushResult.pipedrivePersonId,
            pipedriveOrgId: pushResult.pipedriveOrgId,
          }, appUser.id);
        }
      }
    } catch (pipedriveError) {
      // Log but don't fail - lead is already created locally
      console.warn('[createLead] Pipedrive sync warning:', pipedriveError);
    }

    revalidatePath('/leads');
    return { success: true, data: lead };
  } catch (error) {
    console.error('[createLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create lead',
    };
  }
}

/**
 * Update an existing lead
 * Optionally syncs changes to Pipedrive if the lead is linked
 */
export async function updateLead(
  id: string,
  data: UpdateLeadDTO,
  labelIds?: string[]
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Get current lead to check if it's linked to Pipedrive
    const currentLead = await leadsRepository.getById(id);
    if (!currentLead) {
      return { success: false, error: 'Lead not found' };
    }

    console.log('[updateLead] Updating lead:', id);
    console.log('[updateLead] Data received:', JSON.stringify(data, null, 2));
    console.log('[updateLead] Label IDs received:', labelIds);

    // If labelIds are provided, convert them to label names for local storage
    let labelNames: string[] | undefined;
    if (labelIds && labelIds.length > 0) {
      try {
        const availableLabels = await pipedriveSyncService.getLeadLabels();
        labelNames = labelIds
          .map((id) => availableLabels.find((l) => l.id === id)?.name)
          .filter((name): name is string => !!name);
        console.log('[updateLead] Mapped label IDs to names:', labelNames);
      } catch (labelError) {
        console.warn('[updateLead] Could not fetch labels:', labelError);
      }
    } else if (labelIds && labelIds.length === 0) {
      // User explicitly cleared all labels
      labelNames = [];
    }

    // Prepare update data including labels if provided
    const updateData: UpdateLeadDTO = {
      ...data,
      ...(labelNames !== undefined && { pipedriveLabels: labelNames }),
    };

    // Update lead locally
    console.log('[updateLead] Calling repository.update with data:', JSON.stringify({
      name: updateData.name,
      company: updateData.company,
      email: updateData.email,
      pipedriveLabels: updateData.pipedriveLabels,
    }, null, 2));

    const lead = await leadsRepository.update(id, updateData, appUser.id);
    console.log('[updateLead] Repository returned lead:', JSON.stringify({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      updatedAt: lead.updatedAt,
    }, null, 2));

    // Verify the update by reading back from database
    console.log('[updateLead] Verification: reading lead from database...');
    const verifyLead = await leadsRepository.getById(id);
    console.log('[updateLead] Verification result:', JSON.stringify({
      name: verifyLead?.name,
      company: verifyLead?.company,
      updatedAt: verifyLead?.updatedAt,
    }, null, 2));

    if (verifyLead && data.name && verifyLead.name !== data.name) {
      console.error('[updateLead] !!!!! VERIFICATION FAILED !!!!!');
      console.error('[updateLead] Database has:', verifyLead.name, 'but expected:', data.name);
      console.error('[updateLead] This indicates the UPDATE did not commit!');
    } else {
      console.log('[updateLead] Verification PASSED - data matches');
    }

    // Try to push to Pipedrive if connected and lead has Pipedrive ID
    if (currentLead.pipedriveLeadId) {
      try {
        const isConnected = await pipedrivePushService.isConnected();
        if (isConnected) {
          const pushResult = await pipedrivePushService.updateExistingLead(
            id,
            currentLead.pipedriveLeadId,
            currentLead.pipedrivePersonId,
            currentLead.pipedriveOrgId,
            {
              name: data.name,
              email: data.email,
              phone: data.phone,
              company: data.company,
              addressStreet: data.addressStreet,
              addressCity: data.addressCity,
              addressState: data.addressState,
              addressPostalCode: data.addressPostalCode,
              addressCountry: data.addressCountry,
              dealTitle: data.dealTitle,
              dealValue: data.dealValue,
              currency: 'USD',
              expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
              labelIds: labelIds,
            }
          );

          if (!pushResult.success) {
            console.warn('[updateLead] Pipedrive sync warning:', pushResult.error);
          }
        }
      } catch (pipedriveError) {
        // Log but don't fail - lead is already updated locally
        console.warn('[updateLead] Pipedrive sync warning:', pipedriveError);
      }
    }

    revalidatePath('/leads');
    revalidatePath(`/leads/${id}`);
    return { success: true, data: lead };
  } catch (error) {
    console.error('[updateLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update lead',
    };
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    await leadsRepository.delete(id);
    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error('[deleteLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete lead',
    };
  }
}

// ============================================
// CONVERSION ACTIONS
// ============================================

/**
 * Convert a lead to a deal (NOT customer)
 * Customer is created only when deal is marked as "won"
 *
 * New workflow:
 * Lead → Convert to Deal (status: open) → Mark as Won → Customer created
 *
 * Handles duplicates:
 * - If lead already has pipedriveDealId, check if a deal exists with that ID
 * - If yes, link to existing deal instead of creating duplicate
 */
export async function convertLeadToDeal(
  id: string,
  _data: ConvertLeadDTO
): Promise<ActionResult<{ leadId: string; dealId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Get the lead
    const lead = await leadsRepository.getById(id);
    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    if (lead.convertedDealId) {
      return { success: false, error: 'Lead has already been converted to a deal' };
    }

    let dealId: string;

    // Check if a deal already exists with this Pipedrive Deal ID (prevents duplicates)
    if (lead.pipedriveDealId) {
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('pipedrive_deal_id', lead.pipedriveDealId)
        .is('deleted_at', null)
        .single();

      if (existingDeal) {
        // Use existing deal - just link the lead to it
        dealId = existingDeal.id;
        console.log('[convertLeadToDeal] Found existing deal with Pipedrive ID:', lead.pipedriveDealId);

        // Update the existing deal with lead info
        await supabase
          .from('deals')
          .update({
            lead_id: id,
            contact_name: lead.name,
            contact_email: lead.email,
            contact_phone: lead.phone,
            organization_name: lead.company,
            updated_by: appUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', dealId);
      } else {
        // No existing deal, create new one
        const { data: newDeal, error: dealError } = await supabase
          .from('deals')
          .insert({
            title: lead.dealTitle || `Deal for ${lead.company || lead.name}`,
            value: lead.dealValue,
            currency: lead.dealCurrency || 'USD',
            status: 'open',
            pipeline_id: lead.dealPipelineId,
            pipeline_name: lead.dealPipeline,
            stage_id: lead.dealStageId,
            stage_name: lead.dealStage,
            probability: lead.dealProbability,
            expected_close_date: lead.expectedCloseDate,
            contact_name: lead.name,
            contact_email: lead.email,
            contact_phone: lead.phone,
            organization_name: lead.company,
            lead_id: id,
            pipedrive_deal_id: lead.pipedriveDealId,
            pipedrive_person_id: lead.pipedrivePersonId,
            pipedrive_org_id: lead.pipedriveOrgId,
            owner_id: appUser.id,
            created_by: appUser.id,
            updated_by: appUser.id,
          })
          .select('id')
          .single();

        if (dealError) {
          throw new Error(`Failed to create deal: ${dealError.message}`);
        }

        dealId = newDeal.id;
      }
    } else {
      // No Pipedrive Deal ID - create new deal
      const { data: newDeal, error: dealError } = await supabase
        .from('deals')
        .insert({
          title: lead.dealTitle || `Deal for ${lead.company || lead.name}`,
          value: lead.dealValue,
          currency: lead.dealCurrency || 'USD',
          status: 'open',
          pipeline_id: lead.dealPipelineId,
          pipeline_name: lead.dealPipeline,
          stage_id: lead.dealStageId,
          stage_name: lead.dealStage,
          probability: lead.dealProbability,
          expected_close_date: lead.expectedCloseDate,
          contact_name: lead.name,
          contact_email: lead.email,
          contact_phone: lead.phone,
          organization_name: lead.company,
          lead_id: id,
          pipedrive_person_id: lead.pipedrivePersonId,
          pipedrive_org_id: lead.pipedriveOrgId,
          owner_id: appUser.id,
          created_by: appUser.id,
          updated_by: appUser.id,
        })
        .select('id')
        .single();

      if (dealError) {
        throw new Error(`Failed to create deal: ${dealError.message}`);
      }

      dealId = newDeal.id;
    }

    // Mark lead as converted to deal (not customer yet)
    await leadsRepository.markAsConvertedToDeal(id, dealId, appUser.id);

    // Sync to Pipedrive - create deal (status: open) and delete lead from inbox
    if (lead.pipedriveLeadId || lead.pipedrivePersonId) {
      pipedrivePushService.convertLeadToDealInPipedrive(id, {
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        dealTitle: lead.dealTitle,
        dealValue: lead.dealValue,
        pipedriveLeadId: lead.pipedriveLeadId,
        pipedriveDealId: lead.pipedriveDealId,
        pipedrivePersonId: lead.pipedrivePersonId,
        pipedriveOrgId: lead.pipedriveOrgId,
      }).then(async (result) => {
        if (result.success && result.pipedriveDealId) {
          console.log('[convertLeadToDeal] Synced to Pipedrive, deal ID:', result.pipedriveDealId);
          // Update local deal with Pipedrive deal ID if not already set
          await supabase.from('deals')
            .update({ pipedrive_deal_id: result.pipedriveDealId })
            .eq('id', dealId)
            .is('pipedrive_deal_id', null); // Only update if not already set
        } else {
          console.warn('[convertLeadToDeal] Pipedrive sync warning:', result.error);
        }
      }).catch((error) => {
        console.error('[convertLeadToDeal] Pipedrive sync error:', error);
      });
    }

    revalidatePath('/leads');
    revalidatePath('/deals');

    return {
      success: true,
      data: { leadId: id, dealId },
    };
  } catch (error) {
    console.error('[convertLeadToDeal] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert lead to deal',
    };
  }
}

/**
 * @deprecated Use convertLeadToDeal instead
 * This function is kept for backward compatibility
 */
export async function convertLeadToCustomer(
  id: string,
  data: ConvertLeadDTO
): Promise<ActionResult<{ leadId: string; customerId?: string; dealId?: string }>> {
  // Redirect to new function
  const result = await convertLeadToDeal(id, data);
  if (result.success && result.data) {
    return {
      success: true,
      data: { leadId: result.data.leadId, dealId: result.data.dealId },
    };
  }
  return result as ActionResult<{ leadId: string; customerId?: string; dealId?: string }>;
}

// ============================================
// NOTES ACTIONS
// ============================================

/**
 * Get notes for a lead
 */
export async function getLeadNotes(
  leadId: string
): Promise<ActionResult<LeadNote[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const notes = await leadsRepository.getNotes(leadId);
    return { success: true, data: notes };
  } catch (error) {
    console.error('[getLeadNotes] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch notes',
    };
  }
}

/**
 * Add a note to a lead
 * Saves locally and auto-pushes to Pipedrive if connected
 */
export async function addLeadNote(
  leadId: string,
  content: string
): Promise<ActionResult<LeadNote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // 1. Save note locally first
    const note = await leadsRepository.addNote(leadId, content, appUser.id);

    // 2. Try to push to Pipedrive (non-blocking - don't fail if Pipedrive push fails)
    try {
      const isConnected = await pipedriveSyncService.isConnected();
      if (isConnected) {
        const pushResult = await pipedrivePushService.pushLeadNote(leadId, content);
        if (pushResult.success && pushResult.pipedriveNoteId) {
          // Mark note as synced to Pipedrive
          await leadsRepository.markNoteSynced(note.id, pushResult.pipedriveNoteId);
          // Update local note object
          note.pipedriveNoteId = pushResult.pipedriveNoteId;
          note.syncedToPipedrive = true;
          console.log(`[addLeadNote] Note synced to Pipedrive: ${pushResult.pipedriveNoteId}`);
        } else {
          console.log(`[addLeadNote] Pipedrive push skipped: ${pushResult.error || 'No Pipedrive link'}`);
        }
      }
    } catch (pipedriveError) {
      // Log but don't fail - note is saved locally
      console.warn('[addLeadNote] Pipedrive push failed (non-blocking):', pipedriveError);
    }

    revalidatePath(`/leads/${leadId}`);
    return { success: true, data: note };
  } catch (error) {
    console.error('[addLeadNote] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note',
    };
  }
}

/**
 * Delete a note from a lead
 * Also deletes from Pipedrive if synced
 */
export async function deleteLeadNote(
  noteId: string,
  leadId: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get note to check if it has Pipedrive ID
    const note = await leadsRepository.getNoteById(noteId);

    // Delete from Pipedrive if synced (non-blocking)
    if (note?.pipedriveNoteId) {
      try {
        const isConnected = await pipedriveSyncService.isConnected();
        if (isConnected) {
          await pipedrivePushService.deleteNoteFromPipedrive(note.pipedriveNoteId);
          console.log(`[deleteLeadNote] Note deleted from Pipedrive: ${note.pipedriveNoteId}`);
        }
      } catch (pipedriveError) {
        console.warn('[deleteLeadNote] Pipedrive delete failed (non-blocking):', pipedriveError);
      }
    }

    // Delete locally
    await leadsRepository.deleteNote(noteId);
    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    console.error('[deleteLeadNote] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete note',
    };
  }
}

/**
 * Update a note
 * Also updates in Pipedrive if synced
 */
export async function updateLeadNote(
  noteId: string,
  leadId: string,
  content: string
): Promise<ActionResult<LeadNote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get existing note to check Pipedrive ID
    const existingNote = await leadsRepository.getNoteById(noteId);
    if (!existingNote) {
      return { success: false, error: 'Note not found' };
    }

    // Update locally first
    const updatedNote = await leadsRepository.updateNote(noteId, content);

    // Update in Pipedrive if synced (non-blocking)
    if (existingNote.pipedriveNoteId) {
      try {
        const isConnected = await pipedriveSyncService.isConnected();
        if (isConnected) {
          await pipedrivePushService.updateNoteInPipedrive(existingNote.pipedriveNoteId, content);
          console.log(`[updateLeadNote] Note updated in Pipedrive: ${existingNote.pipedriveNoteId}`);
        }
      } catch (pipedriveError) {
        console.warn('[updateLeadNote] Pipedrive update failed (non-blocking):', pipedriveError);
      }
    }

    revalidatePath(`/leads/${leadId}`);
    return { success: true, data: updatedNote };
  } catch (error) {
    console.error('[updateLeadNote] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update note',
    };
  }
}

// ============================================
// STATS ACTIONS
// ============================================

/**
 * Get lead statistics
 * Only counts active leads (not deleted, not converted to deal/customer)
 */
export async function getLeadStats(): Promise<ActionResult<{
  total: number;
  newThisMonth: number;
  qualified: number;
  converted: number;
  totalDealValue: number;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get only active leads (not deleted, not converted to deal/customer)
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, status, deal_value, created_at')
      .is('deleted_at', null)
      .not('status', 'in', '("deal","converted")');

    if (error) {
      throw new Error(error.message);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      total: leads?.length || 0,
      newThisMonth: leads?.filter(
        (l) => new Date(l.created_at) >= startOfMonth
      ).length || 0,
      qualified: leads?.filter(
        (l) => l.status === 'qualified' || l.status === 'proposal'
      ).length || 0,
      converted: 0, // Converted leads are now tracked in Deals module
      totalDealValue: leads?.reduce(
        (sum, l) => sum + (Number(l.deal_value) || 0),
        0
      ) || 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('[getLeadStats] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    };
  }
}
