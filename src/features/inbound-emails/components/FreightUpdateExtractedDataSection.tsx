'use client';

/**
 * Freight Update Extracted Data Section Component
 *
 * Displays AI-extracted freight tracking update data with matching results.
 * Shows confidence score and tracking status for low confidence cases.
 */

import { CheckCircle, AlertCircle, Ship, MapPin, Calendar, Package, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

interface FreightUpdateExtractedDataSectionProps {
  emailId: string;
  extractedData: {
    parsed: {
      forwarderName: string | null;
      forwarderEmail: string | null;
      contactPerson: string | null;
      containerNumber: string | null;
      mblNumber: string | null;
      hblNumber: string | null;
      bookingNumber: string | null;
      soNumber: string | null;
      poNumber: string | null;
      vesselName: string | null;
      voyageNumber: string | null;
      currentStatus: string | null;
      trackingStatus: 'booked' | 'departed_origin' | 'in_transit' | 'arrived_port' | 'loaded_on_rail' | 'arrived_destination' | 'out_for_delivery' | 'delivered' | 'delayed' | 'on_hold' | 'cancelled' | 'unknown' | null;
      currentLocation: string | null;
      statusDescription: string | null;
      etaOriginPort: string | null;
      etdOriginPort: string | null;
      etaDestinationPort: string | null;
      etdDestinationPort: string | null;
      etaFinalDestination: string | null;
      lfdDate: string | null;
      actualArrivalDate: string | null;
      actualDeliveryDate: string | null;
      portOfLoading: string | null;
      portOfDischarge: string | null;
      finalDestination: string | null;
      hasIssue: boolean;
      issueType: 'delay' | 'damage' | 'documentation' | 'customs' | 'missing_cargo' | 'routing_change' | 'other' | null;
      issueDescription: string | null;
      isDelayed: boolean;
      delayReason: string | null;
      cargoDescription: string | null;
      weight: string | null;
      volume: string | null;
      notes: string | null;
    };
    matching: {
      shipment: {
        shipmentId: string | null;
        matchedBy: 'container' | 'mbl' | 'so' | 'po' | 'not_found';
        matchType: string;
        confidence: number;
      };
      overallConfidence: number;
      hasIssues: boolean;
      issues: string[];
    };
  };
  confidence: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FreightUpdateExtractedDataSection({
  emailId: _emailId,
  extractedData,
  confidence,
}: FreightUpdateExtractedDataSectionProps) {
  const { parsed, matching } = extractedData;

  // Determine confidence level
  const confidenceLevel = confidence > 0.85 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  const confidenceColor =
    confidenceLevel === 'high'
      ? 'bg-green-100 text-green-800 border-green-200'
      : confidenceLevel === 'medium'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';

  // Tracking status badge
  const getTrackingStatusBadge = () => {
    switch (parsed.trackingStatus) {
      case 'booked':
        return <Badge variant="outline">📋 Booked</Badge>;
      case 'departed_origin':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🚢 Departed Origin</Badge>;
      case 'in_transit':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🌊 In Transit</Badge>;
      case 'arrived_port':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">⚓ Arrived at Port</Badge>;
      case 'loaded_on_rail':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">🚂 Loaded on Rail</Badge>;
      case 'arrived_destination':
        return <Badge className="bg-green-100 text-green-800 border-green-200">📍 Arrived Destination</Badge>;
      case 'out_for_delivery':
        return <Badge className="bg-green-100 text-green-800 border-green-200">🚛 Out for Delivery</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Delivered</Badge>;
      case 'delayed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">⏰ Delayed</Badge>;
      case 'on_hold':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏸️ On Hold</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200">❌ Cancelled</Badge>;
      default:
        return <Badge variant="outline">❓ Unknown</Badge>;
    }
  };

  // Issue type badge
  const getIssueTypeBadge = () => {
    if (!parsed.issueType) return null;

    switch (parsed.issueType) {
      case 'delay':
        return <Badge className="bg-red-100 text-red-800 border-red-200">⏰ Delay</Badge>;
      case 'damage':
        return <Badge className="bg-red-100 text-red-800 border-red-200">💥 Damage</Badge>;
      case 'documentation':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">📄 Documentation</Badge>;
      case 'customs':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🛃 Customs</Badge>;
      case 'missing_cargo':
        return <Badge className="bg-red-100 text-red-800 border-red-200">📦 Missing Cargo</Badge>;
      case 'routing_change':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🔄 Routing Change</Badge>;
      default:
        return <Badge variant="outline">⚠️ Other Issue</Badge>;
    }
  };

  return (
    <div className="border-t pt-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">🤖 Auto-Extracted Freight Tracking Data</h3>
          <Badge className={confidenceColor}>
            {(confidence * 100).toFixed(0)}% Confidence
          </Badge>
        </div>
      </div>

      {/* Issues Warning */}
      {matching.hasIssues && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Matching Issues:</p>
                <ul className="list-disc list-inside mt-2 text-sm text-yellow-700">
                  {matching.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Freight Issue Warning */}
      {(parsed.hasIssue || parsed.isDelayed) && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium text-red-800">Shipment Issue Detected</p>
                  {getIssueTypeBadge()}
                </div>
                {parsed.issueDescription && (
                  <p className="text-sm text-red-700">{parsed.issueDescription}</p>
                )}
                {parsed.isDelayed && parsed.delayReason && (
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-medium">Delay Reason:</span> {parsed.delayReason}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data Display */}
      <div className="space-y-4">
        {/* Freight Forwarder */}
        <div className="flex items-start gap-2">
          <Ship className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Freight Forwarder</p>
            <p className="font-medium">{parsed.forwarderName || 'Unknown Forwarder'}</p>
            {parsed.forwarderEmail && (
              <p className="text-xs text-muted-foreground">{parsed.forwarderEmail}</p>
            )}
            {parsed.contactPerson && (
              <p className="text-xs text-muted-foreground">Contact: {parsed.contactPerson}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Shipment Match */}
        <div className="flex items-start gap-2">
          {matching.shipment.matchedBy === 'not_found' ? (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          ) : matching.shipment.confidence >= 0.95 ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Matched Shipment</p>
            {matching.shipment.matchedBy === 'not_found' ? (
              <p className="text-red-600 font-medium">Shipment not found in database</p>
            ) : (
              <>
                <p className="font-medium">
                  Matched by{' '}
                  {matching.shipment.matchedBy === 'container'
                    ? 'Container Number'
                    : matching.shipment.matchedBy === 'mbl'
                    ? 'Master B/L'
                    : matching.shipment.matchedBy === 'so'
                    ? 'Sales Order'
                    : 'Purchase Order'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Confidence: {(matching.shipment.confidence * 100).toFixed(0)}%
                </p>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Reference Numbers */}
        <div className="grid grid-cols-2 gap-4">
          {parsed.containerNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Container Number</p>
              <p className="font-medium font-mono">{parsed.containerNumber}</p>
            </div>
          )}
          {parsed.mblNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Master B/L</p>
              <p className="font-medium font-mono">{parsed.mblNumber}</p>
            </div>
          )}
          {parsed.hblNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">House B/L</p>
              <p className="font-medium font-mono">{parsed.hblNumber}</p>
            </div>
          )}
          {parsed.bookingNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Booking Number</p>
              <p className="font-medium font-mono">{parsed.bookingNumber}</p>
            </div>
          )}
          {parsed.soNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sales Order</p>
              <p className="font-medium">{parsed.soNumber}</p>
            </div>
          )}
          {parsed.poNumber && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Purchase Order</p>
              <p className="font-medium">{parsed.poNumber}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Current Status */}
        <div className="flex items-start gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">Current Status</p>
            <div className="flex items-center gap-2">
              {getTrackingStatusBadge()}
            </div>
            {parsed.currentLocation && (
              <p className="text-sm text-muted-foreground mt-1">
                📍 {parsed.currentLocation}
              </p>
            )}
            {parsed.statusDescription && (
              <p className="text-sm text-muted-foreground mt-1">{parsed.statusDescription}</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Vessel Information */}
        {(parsed.vesselName || parsed.voyageNumber) && (
          <>
            <div className="flex items-start gap-2">
              <Ship className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Vessel Information</p>
                {parsed.vesselName && (
                  <p className="font-medium">
                    {parsed.vesselName}
                    {parsed.voyageNumber && ` (Voyage ${parsed.voyageNumber})`}
                  </p>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Ports & Routing */}
        {(parsed.portOfLoading || parsed.portOfDischarge || parsed.finalDestination) && (
          <>
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Route Information</p>
                <div className="space-y-1 text-sm">
                  {parsed.portOfLoading && (
                    <p>
                      <span className="font-medium">Origin Port:</span> {parsed.portOfLoading}
                    </p>
                  )}
                  {parsed.portOfDischarge && (
                    <p>
                      <span className="font-medium">Discharge Port:</span> {parsed.portOfDischarge}
                    </p>
                  )}
                  {parsed.finalDestination && (
                    <p>
                      <span className="font-medium">Final Destination:</span> {parsed.finalDestination}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Important Dates */}
        <div className="flex items-start gap-2">
          <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">Important Dates</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {parsed.etdOriginPort && (
                <div>
                  <p className="text-muted-foreground">ETD Origin</p>
                  <p className="font-medium">{new Date(parsed.etdOriginPort).toLocaleDateString()}</p>
                </div>
              )}
              {parsed.etaDestinationPort && (
                <div>
                  <p className="text-muted-foreground">ETA Destination Port</p>
                  <p className="font-medium">{new Date(parsed.etaDestinationPort).toLocaleDateString()}</p>
                </div>
              )}
              {parsed.etaFinalDestination && (
                <div>
                  <p className="text-muted-foreground">ETA Final Destination</p>
                  <p className="font-medium">{new Date(parsed.etaFinalDestination).toLocaleDateString()}</p>
                </div>
              )}
              {parsed.lfdDate && (
                <div>
                  <p className="text-muted-foreground">Last Free Day (LFD)</p>
                  <p className="font-medium text-red-600">{new Date(parsed.lfdDate).toLocaleDateString()}</p>
                </div>
              )}
              {parsed.actualArrivalDate && (
                <div>
                  <p className="text-muted-foreground">Actual Arrival</p>
                  <p className="font-medium">{new Date(parsed.actualArrivalDate).toLocaleDateString()}</p>
                </div>
              )}
              {parsed.actualDeliveryDate && (
                <div>
                  <p className="text-muted-foreground">Actual Delivery</p>
                  <p className="font-medium">{new Date(parsed.actualDeliveryDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Cargo Details */}
        {(parsed.cargoDescription || parsed.weight || parsed.volume) && (
          <>
            <div className="flex items-start gap-2">
              <Package className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Cargo Information</p>
                <div className="space-y-1 text-sm">
                  {parsed.cargoDescription && (
                    <p>
                      <span className="font-medium">Description:</span> {parsed.cargoDescription}
                    </p>
                  )}
                  <div className="flex gap-4">
                    {parsed.weight && (
                      <p>
                        <span className="font-medium">Weight:</span> {parsed.weight}
                      </p>
                    )}
                    {parsed.volume && (
                      <p>
                        <span className="font-medium">Volume:</span> {parsed.volume}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Notes */}
        {parsed.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Additional Notes</p>
            <p className="text-sm text-muted-foreground">{parsed.notes}</p>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 rounded-md bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-800">
          ℹ️ This tracking update has been automatically processed. The shipment record has been{' '}
          {confidence >= 0.6 ? (
            <span className="font-medium">updated in the system</span>
          ) : (
            <span className="font-medium">saved for manual review</span>
          )}
          .
        </p>
      </div>
    </div>
  );
}
