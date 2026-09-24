'use client';

/**
 * Supplier Contacts Table Component
 *
 * Displays list of contacts for a supplier with actions.
 */

import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Mail, Phone, Smartphone, MoreHorizontal, Pencil, Trash2, Star } from 'lucide-react';
import { DataTable } from '@/shared/components/data-table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { SupplierContactListItem } from '../types';
import { CONTACT_TYPE_LABELS } from '../types';

// ============================================
// TYPES
// ============================================

interface SupplierContactsTableProps {
  contacts: SupplierContactListItem[];
  onEdit?: (contact: SupplierContactListItem) => void;
  onDelete?: (contact: SupplierContactListItem) => void;
  loading?: boolean;
}

interface GetColumnsOptions {
  onEdit?: (contact: SupplierContactListItem) => void;
  onDelete?: (contact: SupplierContactListItem) => void;
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

function getColumns({ onEdit, onDelete }: GetColumnsOptions): ColumnDef<SupplierContactListItem>[] {
  return [
    {
      accessorKey: 'fullName',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            {row.original.title && (
              <p className="text-sm text-muted-foreground">{row.original.title}</p>
            )}
          </div>
          {row.original.isPrimary && (
            <Badge variant="default" className="ml-2">
              <Star className="mr-1 h-3 w-3" />
              Primary
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'contactType',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant="outline">
          {CONTACT_TYPE_LABELS[row.original.contactType]}
        </Badge>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => {
        const email = row.original.email;
        return email ? (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-4 w-4" />
            {email}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => {
        const phone = row.original.phone;
        return phone ? (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2 text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="h-4 w-4" />
            {phone}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => {
        const mobile = row.original.mobile;
        return mobile ? (
          <a
            href={`tel:${mobile}`}
            className="flex items-center gap-2 text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Smartphone className="h-4 w-4" />
            {mobile}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const contact = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(contact);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(contact);
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// ============================================
// COMPONENT
// ============================================

export function SupplierContactsTable({
  contacts,
  onEdit,
  onDelete,
  loading = false,
}: SupplierContactsTableProps) {
  const columns = useMemo(
    () => getColumns({ onEdit, onDelete }),
    [onEdit, onDelete]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading contacts...</p>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-muted-foreground">No contacts found</p>
        <p className="text-sm text-muted-foreground">Add your first contact to get started</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={contacts}
      enableGlobalFilter
      filterPlaceholder="Search contacts..."
      searchableColumns={['fullName', 'email', 'phone', 'mobile']}
      showPagination={contacts.length > 10}
      pageSizeOptions={[10, 20, 50]}
      defaultPageSize={10}
      getRowId={(row) => row.id}
    />
  );
}
