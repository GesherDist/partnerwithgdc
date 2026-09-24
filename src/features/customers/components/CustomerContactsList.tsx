'use client';

/**
 * CustomerContactsList Component
 *
 * Displays list of contacts for a customer in a table with add/edit/delete capabilities.
 * Per client doc: contacts have role (purchasing, AP, receiving)
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, Pencil, Trash2, User } from 'lucide-react';
import { useAuthStore } from '@/shared/stores';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import { CustomerContactForm, contactToFormValues, type ContactFormInput } from './CustomerContactForm';
import { useCustomerContacts } from '../hooks/useCustomerContacts';
import {
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
  getCustomerContact,
} from '../actions/customer-contact.actions';
import {
  CONTACT_TYPE_LABELS,
  type CustomerContactListItem,
  type CustomerContact,
} from '../types';

// ============================================
// TYPES
// ============================================

interface CustomerContactsListProps {
  customerId: string;
}

// ============================================
// COMPONENT
// ============================================

export function CustomerContactsList({ customerId }: CustomerContactsListProps) {
  const { hasPermission } = useAuthStore();

  // Hydration guard
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Permissions (only check after hydration)
  const canCreate = hasMounted && hasPermission('customers.create_contact');
  const canEdit = hasMounted && hasPermission('customers.edit_contact');
  const canDelete = hasMounted && hasPermission('customers.delete_contact');

  // State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<CustomerContactListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data
  const { data: contacts, isLoading, refetch } = useCustomerContacts(customerId);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleAddClick = () => {
    setIsAddDialogOpen(true);
  };

  const handleAddClose = () => {
    setIsAddDialogOpen(false);
  };

  const handleAddSubmit = useCallback(async (data: ContactFormInput) => {
    setIsSubmitting(true);
    try {
      const result = await createCustomerContact({
        customerId,
        firstName: data.firstName,
        lastName: data.lastName,
        contactType: data.contactType,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
      });

      if (result.success) {
        toast.success('Contact added successfully');
        setIsAddDialogOpen(false);
        refetch();
      } else {
        toast.error(result.error || 'Failed to add contact');
      }
    } catch {
      toast.error('Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  }, [customerId, refetch]);

  const handleEditClick = useCallback(async (contact: CustomerContactListItem) => {
    const result = await getCustomerContact(contact.id);
    if (result.success && result.data) {
      setEditingContact(result.data);
    } else {
      toast.error('Failed to load contact details');
    }
  }, []);

  const handleEditClose = () => {
    setEditingContact(null);
  };

  const handleEditSubmit = useCallback(async (data: ContactFormInput) => {
    if (!editingContact) {return;}

    setIsSubmitting(true);
    try {
      const result = await updateCustomerContact(editingContact.id, {
        firstName: data.firstName,
        lastName: data.lastName,
        contactType: data.contactType,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
      });

      if (result.success) {
        toast.success('Contact updated successfully');
        setEditingContact(null);
        refetch();
      } else {
        toast.error(result.error || 'Failed to update contact');
      }
    } catch {
      toast.error('Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingContact, refetch]);

  const handleDeleteClick = (contact: CustomerContactListItem) => {
    setDeletingContact(contact);
  };

  const handleDeleteCancel = () => {
    setDeletingContact(null);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingContact) {return;}

    setIsSubmitting(true);
    try {
      const result = await deleteCustomerContact(deletingContact.id);

      if (result.success) {
        toast.success('Contact deleted successfully');
        setDeletingContact(null);
        refetch();
      } else {
        toast.error(result.error || 'Failed to delete contact');
      }
    } catch {
      toast.error('Failed to delete contact');
    } finally {
      setIsSubmitting(false);
    }
  }, [deletingContact, refetch]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Contacts ({contacts.length})</h3>
        {canCreate && (
          <Button size="sm" onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        )}
      </div>

      {/* Contacts Table */}
      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">No contacts added yet.</p>
            {canCreate && (
              <Button variant="link" onClick={handleAddClick}>
                Add your first contact
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Mobile</TableHead>
                  {(canEdit || canDelete) && (
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    {/* Name */}
                    <TableCell>
                      <span className="font-medium">{contact.fullName}</span>
                    </TableCell>

                    {/* Role/Type */}
                    <TableCell>
                      <Badge variant="secondary">
                        {CONTACT_TYPE_LABELS[contact.contactType]}
                      </Badge>
                    </TableCell>

                    {/* Email */}
                    <TableCell>
                      {contact.email ? (
                        <span className="text-sm">{contact.email}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Phone */}
                    <TableCell>
                      {contact.phone ? (
                        <span className="text-sm">{contact.phone}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Mobile */}
                    <TableCell>
                      {contact.mobile ? (
                        <span className="text-sm">{contact.mobile}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    {(canEdit || canDelete) && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditClick(contact)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {canDelete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteClick(contact)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Add New Contact</DialogTitle>
          </DialogHeader>
          <CustomerContactForm
            onSubmit={handleAddSubmit}
            onCancel={handleAddClose}
            isLoading={isSubmitting}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit Contact</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <CustomerContactForm
              initialData={contactToFormValues(editingContact)}
              onSubmit={handleEditSubmit}
              onCancel={handleEditClose}
              isLoading={isSubmitting}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={() => setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingContact?.fullName}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
