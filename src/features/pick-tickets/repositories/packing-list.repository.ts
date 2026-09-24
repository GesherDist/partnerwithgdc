/**
 * Packing List Repository
 *
 * Data access layer for Packing Lists.
 * Handles all database operations for the packing phase of fulfillment.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  PackingList,
  PackingListItem,
  PackingListWithItems,
  PackingListListItem,
  PackingListListParams,
  CreatePackingListDTO,
  PackingListStatus,
  PaginatedResult,
} from '../types';

// ============================================
// MAPPERS
// ============================================

function mapPackingListRow(row: Record<string, unknown>): PackingList {
  return {
    id: row.id as string,
    packingListNumber: row.packing_list_number as string,
    pickTicketId: row.pick_ticket_id as string,
    salesOrderId: row.sales_order_id as string,
    shipmentId: row.shipment_id as string | null,
    totalPackages: row.total_packages as number,
    totalWeight: row.total_weight as number | null,
    weightUnit: row.weight_unit as string,
    status: row.status as PackingListStatus,
    packedAt: row.packed_at ? new Date(row.packed_at as string) : null,
    packedBy: row.packed_by as string | null,
    // Delivery tracking fields (replaces shipment for warehouse orders)
    trackingNumber: row.tracking_number as string | null,
    carrier: row.carrier as string | null,
    shippedDate: row.shipped_date ? new Date(row.shipped_date as string) : null,
    deliveredDate: row.delivered_date ? new Date(row.delivered_date as string) : null,
    deliveryNotes: row.delivery_notes as string | null,
    notes: row.notes as string | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    createdBy: row.created_by as string | null,
    updatedBy: row.updated_by as string | null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
  };
}

function mapPackingListItemRow(row: Record<string, unknown>): PackingListItem {
  return {
    id: row.id as string,
    packingListId: row.packing_list_id as string,
    pickTicketItemId: row.pick_ticket_item_id as string,
    productId: row.product_id as string,
    sku: row.sku as string,
    description: row.description as string | null,
    quantityPacked: row.quantity_packed as number,
    packageNumber: row.package_number as number,
    weight: row.weight as number | null,
    sortOrder: row.sort_order as number,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    createdBy: row.created_by as string | null,
    updatedBy: row.updated_by as string | null,
  };
}

// ============================================
// REPOSITORY
// ============================================

export const PackingListRepository = {
  /**
   * Find packing lists with pagination and filtering
   */
  async findMany(
    params: PackingListListParams = {}
  ): Promise<PaginatedResult<PackingListListItem>> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      pickTicketId,
      salesOrderId,
      dateFrom,
      dateTo,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('packing_lists')
      .select(
        `
        id,
        packing_list_number,
        pick_ticket_id,
        sales_order_id,
        shipment_id,
        total_packages,
        total_weight,
        status,
        tracking_number,
        carrier,
        shipped_date,
        delivered_date,
        created_at,
        pick_tickets!inner (
          pick_ticket_number
        ),
        sales_orders!inner (
          order_number,
          customers!inner (
            name
          )
        ),
        shipments (
          shipment_number
        )
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    // Apply filters
    if (search) {
      query = query.or(
        `packing_list_number.ilike.%${search}%,pick_tickets.pick_ticket_number.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (pickTicketId) {
      query = query.eq('pick_ticket_id', pickTicketId);
    }

    if (salesOrderId) {
      query = query.eq('sales_order_id', salesOrderId);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'packing_list_number', 'status', 'total_packages'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(safeSortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[PackingListRepository.findMany] Error:', error);
      throw new Error(`Failed to fetch packing lists: ${error.message}`);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Map to list items
    // Use type assertion through unknown since Supabase types don't know about joins
    const items: PackingListListItem[] = (data || []).map((row) => {
      const pickTicket = row.pick_tickets as unknown as { pick_ticket_number: string } | null;
      const salesOrder = row.sales_orders as unknown as { order_number: string; customers: { name: string } | null } | null;
      const shipment = row.shipments as unknown as { shipment_number: string } | null;

      return {
        id: row.id,
        packingListNumber: row.packing_list_number,
        pickTicketNumber: pickTicket?.pick_ticket_number || '',
        salesOrderNumber: salesOrder?.order_number || '',
        customerName: salesOrder?.customers?.name || '',
        totalPackages: row.total_packages,
        totalWeight: row.total_weight,
        status: row.status as PackingListStatus,
        shipmentNumber: shipment?.shipment_number || null,
        // Delivery tracking fields (warehouse orders)
        trackingNumber: row.tracking_number || null,
        carrier: row.carrier || null,
        shippedDate: row.shipped_date ? new Date(row.shipped_date) : null,
        deliveredDate: row.delivered_date ? new Date(row.delivered_date) : null,
        createdAt: new Date(row.created_at),
      };
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  },

  /**
   * Find a packing list by ID with all related data
   */
  async findById(id: string): Promise<PackingListWithItems | null> {
    // Fetch packing list
    const { data: plData, error: plError } = await db
      .from('packing_lists')
      .select(
        `
        *,
        pick_tickets (
          id,
          pick_ticket_number,
          status
        ),
        sales_orders (
          id,
          order_number,
          status,
          customers (
            name
          )
        ),
        shipments (
          id,
          shipment_number,
          status
        )
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (plError) {
      if (plError.code === 'PGRST116') {
        return null;
      }
      console.error('[PackingListRepository.findById] Error:', plError);
      throw new Error(`Failed to fetch packing list: ${plError.message}`);
    }

    if (!plData) {
      return null;
    }

    // Fetch items
    const { data: itemsData, error: itemsError } = await db
      .from('packing_list_items')
      .select('*')
      .eq('packing_list_id', id)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      console.error('[PackingListRepository.findById] Items error:', itemsError);
      throw new Error(`Failed to fetch packing list items: ${itemsError.message}`);
    }

    const packingList = mapPackingListRow(plData);
    const items = (itemsData || []).map(mapPackingListItemRow);

    return {
      ...packingList,
      items,
      pickTicket: plData.pick_tickets
        ? {
            id: plData.pick_tickets.id,
            pickTicketNumber: plData.pick_tickets.pick_ticket_number,
            status: plData.pick_tickets.status,
          }
        : undefined,
      salesOrder: plData.sales_orders
        ? {
            id: plData.sales_orders.id,
            orderNumber: plData.sales_orders.order_number,
            status: plData.sales_orders.status,
            customerName: plData.sales_orders.customers?.name || '',
          }
        : undefined,
      shipment: plData.shipments
        ? {
            id: plData.shipments.id,
            shipmentNumber: plData.shipments.shipment_number,
            status: plData.shipments.status,
          }
        : undefined,
    };
  },

  /**
   * Find packing list by pick ticket ID
   */
  async findByPickTicketId(pickTicketId: string): Promise<PackingListWithItems | null> {
    const { data, error } = await db
      .from('packing_lists')
      .select('id')
      .eq('pick_ticket_id', pickTicketId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[PackingListRepository.findByPickTicketId] Error:', error);
      throw new Error(`Failed to fetch packing list: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return this.findById(data.id);
  },

  /**
   * Create a new packing list with items
   */
  async create(
    dto: CreatePackingListDTO,
    userId?: string
  ): Promise<PackingList> {
    const now = new Date().toISOString();

    // Generate packing list number
    const { data: packingListNumber, error: numError } = await db.rpc('generate_packing_list_number');
    if (numError || !packingListNumber) {
      console.error('[PackingListRepository.create] Failed to generate packing list number:', numError);
      throw new Error('Failed to generate packing list number');
    }

    // Insert packing list
    const { data: plData, error: plError } = await db
      .from('packing_lists')
      .insert({
        packing_list_number: packingListNumber,
        pick_ticket_id: dto.pickTicketId,
        sales_order_id: dto.salesOrderId,
        total_packages: dto.totalPackages || 1,
        total_weight: dto.totalWeight || null,
        weight_unit: dto.weightUnit || 'lbs',
        status: 'draft' as PackingListStatus,
        notes: dto.notes || null,
        created_at: now,
        updated_at: now,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (plError) {
      console.error('[PackingListRepository.create] Error:', plError);
      throw new Error(`Failed to create packing list: ${plError.message}`);
    }

    // Insert items
    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map((item, index) => ({
        packing_list_id: plData.id,
        pick_ticket_item_id: item.pickTicketItemId,
        product_id: item.productId,
        sku: item.sku,
        description: item.description || null,
        quantity_packed: item.quantityPacked,
        package_number: item.packageNumber,
        weight: item.weight || null,
        sort_order: index + 1,
        created_at: now,
        updated_at: now,
        created_by: userId || null,
        updated_by: userId || null,
      }));

      const { error: itemsError } = await db
        .from('packing_list_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback - delete the packing list
        await db.from('packing_lists').delete().eq('id', plData.id);
        console.error('[PackingListRepository.create] Items error:', itemsError);
        throw new Error(`Failed to create packing list items: ${itemsError.message}`);
      }
    }

    return mapPackingListRow(plData);
  },

  /**
   * Update packing list status
   */
  async updateStatus(
    id: string,
    status: PackingListStatus,
    userId?: string
  ): Promise<PackingList> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };

    // If status is 'packed', set packed_at and packed_by
    if (status === 'packed') {
      updateData.packed_at = new Date().toISOString();
      updateData.packed_by = userId || null;
    }

    // If status is 'shipped', set shipped_date (auto)
    if (status === 'shipped') {
      updateData.shipped_date = new Date().toISOString().split('T')[0];
    }

    // If status is 'delivered', set delivered_date (auto)
    if (status === 'delivered') {
      updateData.delivered_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await db
      .from('packing_lists')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PackingListRepository.updateStatus] Error:', error);
      throw new Error(`Failed to update packing list status: ${error.message}`);
    }

    return mapPackingListRow(data);
  },

  /**
   * Update packing list notes
   */
  async updateNotes(
    id: string,
    notes: string | null,
    userId?: string
  ): Promise<PackingList> {
    const { data, error } = await db
      .from('packing_lists')
      .update({
        notes,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PackingListRepository.updateNotes] Error:', error);
      throw new Error(`Failed to update packing list notes: ${error.message}`);
    }

    return mapPackingListRow(data);
  },

  /**
   * Update packing list delivery tracking
   * (Replaces shipment tracking for warehouse orders)
   */
  async updateDeliveryTracking(
    id: string,
    deliveryData: {
      trackingNumber?: string | null;
      carrier?: string | null;
      shippedDate?: Date | null;
      deliveredDate?: Date | null;
      deliveryNotes?: string | null;
      status?: PackingListStatus;
    },
    userId?: string
  ): Promise<PackingList> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };

    if (deliveryData.trackingNumber !== undefined) {
      updateData.tracking_number = deliveryData.trackingNumber;
    }
    if (deliveryData.carrier !== undefined) {
      updateData.carrier = deliveryData.carrier;
    }
    if (deliveryData.shippedDate !== undefined) {
      updateData.shipped_date = deliveryData.shippedDate
        ? deliveryData.shippedDate.toISOString().split('T')[0]
        : null;
    }
    if (deliveryData.deliveredDate !== undefined) {
      updateData.delivered_date = deliveryData.deliveredDate
        ? deliveryData.deliveredDate.toISOString().split('T')[0]
        : null;
    }
    if (deliveryData.deliveryNotes !== undefined) {
      updateData.delivery_notes = deliveryData.deliveryNotes;
    }
    if (deliveryData.status !== undefined) {
      updateData.status = deliveryData.status;
    }

    const { data, error } = await db
      .from('packing_lists')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PackingListRepository.updateDeliveryTracking] Error:', error);
      throw new Error(`Failed to update delivery tracking: ${error.message}`);
    }

    return mapPackingListRow(data);
  },

  /**
   * Link packing list to shipment
   * Note: This only links the shipment_id, does NOT change status.
   * Status should be managed through transitionStatus in the service layer.
   */
  async linkToShipment(
    id: string,
    shipmentId: string,
    userId?: string
  ): Promise<PackingList> {
    const { data, error } = await db
      .from('packing_lists')
      .update({
        shipment_id: shipmentId,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PackingListRepository.linkToShipment] Error:', error);
      throw new Error(`Failed to link packing list to shipment: ${error.message}`);
    }

    return mapPackingListRow(data);
  },

  /**
   * Soft delete a packing list
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('packing_lists')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      console.error('[PackingListRepository.delete] Error:', error);
      throw new Error(`Failed to delete packing list: ${error.message}`);
    }
  },
};
