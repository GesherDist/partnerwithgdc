'use client';

/**
 * Supplier Shipment Detail
 *
 * Detail view for a shipment in the supplier portal.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Ship,
  Package,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  Edit,
  MapPin,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Separator } from '@/shared/components/ui/separator';
import { cn, formatDate } from '@/shared/lib/utils';
import type { SupplierShipment, ShipmentStatus } from '../types';
import { ShipmentUpdateForm } from './ShipmentUpdateForm';

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: ShipmentStatus) {
  const configs: Record<ShipmentStatus, { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-gray-100 text-gray-700' },
    in_transit: { label: 'In Transit', icon: Truck, className: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Delivered', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
    failed: { label: 'Failed', icon: XCircle, className: 'bg-red-100 text-red-700' },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium', config.className)}>
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SupplierShipmentDetailProps {
  shipment: SupplierShipment;
}

export function SupplierShipmentDetail({ shipment }: SupplierShipmentDetailProps) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/supplier-portal/shipments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{shipment.shipmentNumber}</h1>
              {getStatusBadge(shipment.status)}
            </div>
            <p className="text-muted-foreground">
              {shipment.purchaseOrder
                ? `For ${shipment.purchaseOrder.poNumber}`
                : 'Shipment Details'}
            </p>
          </div>
        </div>

        <Button onClick={() => setShowUpdateForm(true)}>
          <Edit className="mr-2 h-4 w-4" />
          Update Shipment
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shipping Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              Shipping Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Container Number</p>
                <p className="font-medium">{shipment.containerNumber || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bill of Lading</p>
                <p className="font-medium">{shipment.billOfLading || 'Not provided'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Vessel Name</p>
                <p className="font-medium">{shipment.vesselName || 'Not provided'}</p>
              </div>
            </div>

            {shipment.carrier && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Carrier</p>
                <p className="font-medium">{shipment.carrier}</p>
              </div>
            )}

            {shipment.trackingNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tracking Number</p>
                <p className="font-medium">{shipment.trackingNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ports & Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ports & Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Port of Loading</p>
                <p className="font-medium">{shipment.portOfLoading || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Port of Discharge</p>
                <p className="font-medium">{shipment.portOfDischarge || 'Not provided'}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ETD (Departure)</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {shipment.etd ? formatDate(shipment.etd) : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ETA Port</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {shipment.etaPort ? formatDate(shipment.etaPort) : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">ETA Customer</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {shipment.etaCustomer ? formatDate(shipment.etaCustomer) : 'Not set'}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ship Date</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(shipment.shipmentDate)}
                </p>
              </div>
              {shipment.actualArrival && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Actual Arrival</p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    {formatDate(shipment.actualArrival)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Destination */}
      {shipment.shipToName && (
        <Card>
          <CardHeader>
            <CardTitle>Ship To</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{shipment.shipToName}</p>
            {shipment.shipToAddressStreet && (
              <p className="text-muted-foreground">
                {shipment.shipToAddressStreet}
                <br />
                {shipment.shipToAddressCity}, {shipment.shipToAddressState}{' '}
                {shipment.shipToAddressPostalCode}
                <br />
                {shipment.shipToAddressCountry}
              </p>
            )}
            {shipment.deliveryInstructions && (
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Delivery Instructions
                </p>
                <p className="mt-1 rounded-lg bg-muted p-3 text-sm">
                  {shipment.deliveryInstructions}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {shipment.items && shipment.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items ({shipment.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Quantity Shipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipment.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">{item.quantityShipped}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Package Info */}
      <Card>
        <CardHeader>
          <CardTitle>Package Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Packages</p>
              <p className="text-lg font-medium">{shipment.totalPackages}</p>
            </div>
            {shipment.totalWeight && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Weight</p>
                <p className="text-lg font-medium">
                  {shipment.totalWeight} {shipment.weightUnit}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {shipment.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg bg-muted p-3 text-sm">{shipment.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      {shipment.supplierUpdatedAt && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated by supplier on {formatDate(shipment.supplierUpdatedAt)}
        </div>
      )}

      {/* Update Form Dialog */}
      <ShipmentUpdateForm
        open={showUpdateForm}
        onOpenChange={setShowUpdateForm}
        shipment={shipment}
      />
    </div>
  );
}
