'use client';

/**
 * DealerLocationCard Component
 *
 * Card component to display dealer location details.
 * Similar to how LocationContactsTable displays contacts.
 */

import { MapPin, Phone, Mail, User, MoreHorizontal, Pencil, Trash2, Package } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import type { PlatinumDealerLocation } from '@/features/platinum-dealers/types';

// ============================================
// TYPES
// ============================================

interface DealerLocationCardProps {
  location: PlatinumDealerLocation;
  inventorySummary?: {
    productCount: number;
    totalOnHand: number;
    totalAllocated: number;
    totalAvailable: number;
    products: Array<{
      sku: string;
      description: string;
      onHand: number;
      allocated: number;
      available: number;
    }>;
  } | null;
  onEdit?: (location: PlatinumDealerLocation) => void;
  onDelete?: (location: PlatinumDealerLocation) => void;
  onViewInventory?: (location: PlatinumDealerLocation) => void;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function DealerLocationCard({
  location,
  inventorySummary,
  onEdit,
  onDelete,
  onViewInventory,
}: DealerLocationCardProps) {
  // Format address
  const addressParts = [
    location.addressCity,
    location.addressState,
    location.addressPostalCode,
  ].filter(Boolean);

  const address = addressParts.length > 0 ? addressParts.join(', ') : null;
  const fullAddress = [location.addressStreet, address].filter(Boolean).join(', ');

  const isActive = location.status === 'active';

  return (
    <Card className={!isActive ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-base font-semibold truncate">{location.locationName}</h4>
                <Badge variant={isActive ? 'default' : 'secondary'} className="flex-shrink-0">
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {location.locationCode && (
                <p className="text-xs text-muted-foreground font-mono">{location.locationCode}</p>
              )}
            </div>

            {/* Actions Dropdown */}
            {(onEdit || onDelete || onViewInventory) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onViewInventory && (
                    <DropdownMenuItem onClick={() => onViewInventory(location)}>
                      <Package className="mr-2 h-4 w-4" />
                      View Inventory
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(location)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={() => onDelete(location)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Location Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Address */}
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={fullAddress}
            />

            {/* Contact Name */}
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Contact"
              value={location.contactName}
            />

            {/* Phone */}
            <InfoRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={location.phone}
            />

            {/* Email */}
            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={location.email}
            />
          </div>

          {/* Notes (if any) */}
          {location.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{location.notes}</p>
            </div>
          )}

          {/* Inventory Summary */}
          {inventorySummary && inventorySummary.products.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Inventory Summary</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">
                    {inventorySummary.productCount} {inventorySummary.productCount === 1 ? 'Product' : 'Products'}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {inventorySummary.totalOnHand.toLocaleString()} On Hand
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {inventorySummary.totalAllocated.toLocaleString()} Allocated
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 font-medium">
                    {inventorySummary.totalAvailable.toLocaleString()} Available
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {inventorySummary.products.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono text-foreground">{product.sku}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.description}</p>
                    </div>
                    <div className="flex gap-3 ml-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">On Hand</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {product.onHand.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Allocated</p>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          {product.allocated.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="text-sm font-bold text-sky-600 dark:text-sky-400">
                          {product.available.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
