/**
 * Approval Events Repository
 *
 * Data access layer for Approval Events module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  ApprovalEvent,
  ApprovalEventWithDetails,
  ApprovalEventListItem,
  ApprovalEventListParams,
  CreateApprovalEventDTO,
  ApprovalEventType,
  ApprovalStatus,
  PaginatedResult,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbApprovalEvent {
  id: string;
  event_type: ApprovalEventType;
  subject_type: string;
  subject_id: string;
  status: ApprovalStatus;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  decision_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// REPOSITORY
// ============================================

class ApprovalEventRepositoryImpl {
  /**
   * Find all approval events with pagination and filtering
   */
  async findMany(params: ApprovalEventListParams = {}): Promise<PaginatedResult<ApprovalEventListItem>> {
    const {
      page = 1,
      limit = 10,
      eventType,
      subjectType,
      subjectId,
      status,
      requestedBy,
      decidedBy,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('approval_events')
      .select(
        `
        id,
        event_type,
        subject_type,
        subject_id,
        status,
        reason,
        requested_by,
        requested_at,
        decided_by,
        decided_at,
        created_at,
        requested_user:users!approval_events_requested_by_fkey (
          first_name,
          last_name
        ),
        decided_user:users!approval_events_decided_by_fkey (
          first_name,
          last_name
        )
      `,
        { count: 'exact' }
      );

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (subjectType) {
      query = query.eq('subject_type', subjectType);
    }

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (requestedBy) {
      query = query.eq('requested_by', requestedBy);
    }

    if (decidedBy) {
      query = query.eq('decided_by', decidedBy);
    }

    const sortFieldMap: Record<string, string> = {
      eventType: 'event_type',
      subjectType: 'subject_type',
      status: 'status',
      requestedAt: 'requested_at',
      decidedAt: 'decided_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch approval events: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToListItem(row)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find pending approval events
   */
  async findPending(): Promise<ApprovalEventListItem[]> {
    const result = await this.findMany({ status: 'pending', sortBy: 'createdAt', sortOrder: 'asc' });
    return result.data;
  }

  /**
   * Find a single approval event by ID
   */
  async findById(id: string): Promise<ApprovalEventWithDetails | null> {
    const { data, error } = await db
      .from('approval_events')
      .select(
        `
        *,
        requested_user:users!approval_events_requested_by_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        decided_user:users!approval_events_decided_by_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch approval event: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToApprovalEventWithDetails(data);
  }

  /**
   * Find approval events for a specific subject
   */
  async findBySubject(subjectType: string, subjectId: string): Promise<ApprovalEvent[]> {
    const { data, error } = await db
      .from('approval_events')
      .select('*')
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch approval events: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToApprovalEvent(row as DbApprovalEvent));
  }

  /**
   * Create a new approval event
   */
  async create(data: CreateApprovalEventDTO, requestedBy?: string): Promise<ApprovalEvent> {
    const { data: result, error } = await db
      .from('approval_events')
      .insert({
        event_type: data.eventType,
        subject_type: data.subjectType,
        subject_id: data.subjectId,
        status: 'pending',
        requested_by: requestedBy || null,
        requested_at: new Date().toISOString(),
        reason: data.reason || null,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create approval event: ${error.message}`);
    }

    return this.mapToApprovalEvent(result as DbApprovalEvent);
  }

  /**
   * Approve an approval event
   */
  async approve(id: string, decisionNote: string | null, decidedBy?: string): Promise<ApprovalEvent> {
    const { data: result, error } = await db
      .from('approval_events')
      .update({
        status: 'approved',
        decided_by: decidedBy || null,
        decided_at: new Date().toISOString(),
        decision_note: decisionNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve event: ${error.message}`);
    }

    return this.mapToApprovalEvent(result as DbApprovalEvent);
  }

  /**
   * Reject an approval event
   */
  async reject(id: string, decisionNote: string | null, decidedBy?: string): Promise<ApprovalEvent> {
    const { data: result, error } = await db
      .from('approval_events')
      .update({
        status: 'rejected',
        decided_by: decidedBy || null,
        decided_at: new Date().toISOString(),
        decision_note: decisionNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reject event: ${error.message}`);
    }

    return this.mapToApprovalEvent(result as DbApprovalEvent);
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToApprovalEvent(data: DbApprovalEvent): ApprovalEvent {
    return {
      id: data.id,
      eventType: data.event_type,
      subjectType: data.subject_type,
      subjectId: data.subject_id,
      status: data.status,
      requestedBy: data.requested_by,
      requestedAt: new Date(data.requested_at),
      decidedBy: data.decided_by,
      decidedAt: data.decided_at ? new Date(data.decided_at) : null,
      reason: data.reason,
      decisionNote: data.decision_note,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapToApprovalEventWithDetails(data: {
    id: string;
    event_type: ApprovalEventType;
    subject_type: string;
    subject_id: string;
    status: ApprovalStatus;
    requested_by: string | null;
    requested_at: string;
    decided_by: string | null;
    decided_at: string | null;
    reason: string | null;
    decision_note: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    requested_user: { id: string; first_name: string; last_name: string; email: string } | null;
    decided_user: { id: string; first_name: string; last_name: string; email: string } | null;
  }): ApprovalEventWithDetails {
    return {
      id: data.id,
      eventType: data.event_type,
      subjectType: data.subject_type,
      subjectId: data.subject_id,
      status: data.status,
      requestedBy: data.requested_by,
      requestedAt: new Date(data.requested_at),
      decidedBy: data.decided_by,
      decidedAt: data.decided_at ? new Date(data.decided_at) : null,
      reason: data.reason,
      decisionNote: data.decision_note,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      requestedByUser: data.requested_user
        ? {
            id: data.requested_user.id,
            firstName: data.requested_user.first_name,
            lastName: data.requested_user.last_name,
            email: data.requested_user.email,
          }
        : undefined,
      decidedByUser: data.decided_user
        ? {
            id: data.decided_user.id,
            firstName: data.decided_user.first_name,
            lastName: data.decided_user.last_name,
            email: data.decided_user.email,
          }
        : undefined,
    };
  }

  private mapToListItem(data: {
    id: string;
    event_type: ApprovalEventType;
    subject_type: string;
    subject_id: string;
    status: ApprovalStatus;
    reason: string | null;
    requested_by: string | null;
    requested_at: string;
    decided_by: string | null;
    decided_at: string | null;
    created_at: string;
    requested_user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    decided_user: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  }): ApprovalEventListItem {
    const requestedUser = Array.isArray(data.requested_user) ? data.requested_user[0] : data.requested_user;
    const decidedUser = Array.isArray(data.decided_user) ? data.decided_user[0] : data.decided_user;

    return {
      id: data.id,
      eventType: data.event_type,
      subjectType: data.subject_type,
      subjectId: data.subject_id,
      status: data.status,
      reason: data.reason,
      requestedByName: requestedUser ? `${requestedUser.first_name} ${requestedUser.last_name}` : null,
      requestedAt: new Date(data.requested_at),
      decidedByName: decidedUser ? `${decidedUser.first_name} ${decidedUser.last_name}` : null,
      decidedAt: data.decided_at ? new Date(data.decided_at) : null,
      createdAt: new Date(data.created_at),
    };
  }
}

export const approvalEventRepository = new ApprovalEventRepositoryImpl();
export type ApprovalEventRepository = typeof approvalEventRepository;
