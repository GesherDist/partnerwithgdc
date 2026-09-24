/**
 * Supplier Settings Page
 *
 * Profile and settings for supplier portal users.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2, User, Mail, Phone, MapPin } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { supplierPortalService } from '@/features/supplier-portal';

export const metadata: Metadata = {
  title: 'Settings | Supplier Portal',
  description: 'Supplier profile settings',
};

export default async function SupplierSettingsPage() {
  const user = await getCurrentUser();

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_module')) {
    redirect('/no-permission');
  }

  const supplier = await supplierPortalService.getSupplier(user.supplierId);

  if (!supplier) {
    redirect('/supplier-portal');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          View your company profile and settings
        </p>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Supplier Code
              </p>
              <p className="font-medium">{supplier.supplierCode}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Company Name
              </p>
              <p className="font-medium">{supplier.name}</p>
            </div>
            {supplier.legalName && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Legal Name
                </p>
                <p className="font-medium">{supplier.legalName}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Primary Contact
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p>{supplier.primaryContactName || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </p>
                <p>{supplier.primaryContactEmail || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </p>
                <p>{supplier.primaryContactPhone || '-'}</p>
              </div>
            </div>
          </div>

          {(supplier.addressStreet || supplier.addressCity) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4" />
                  Address
                </h4>
                <div>
                  {supplier.addressStreet && <p>{supplier.addressStreet}</p>}
                  <p>
                    {[
                      supplier.addressCity,
                      supplier.addressState,
                      supplier.addressPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>{supplier.addressCountry}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="font-medium">
                {user.firstName} {user.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p>{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Role</p>
              <p>{user.role?.name || 'Supplier'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Currency</p>
              <p className="font-medium">{supplier.currencyCode}</p>
            </div>
            {supplier.paymentTerms && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Payment Terms
                </p>
                <p className="font-medium">{supplier.paymentTerms}</p>
              </div>
            )}
            {supplier.taxId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tax ID</p>
                <p className="font-medium">{supplier.taxId}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        To update your company information, please contact Gesher Distribution.
      </p>
    </div>
  );
}
