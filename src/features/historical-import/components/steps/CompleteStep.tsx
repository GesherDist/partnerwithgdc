/**
 * STEP 6: COMPLETE
 * =================
 * Import success summary
 */

'use client';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { CheckCircle2, X } from 'lucide-react';
import { ImportWizardState } from '../../types';

// ============================================================================
// PROPS
// ============================================================================

interface CompleteStepProps {
  state: ImportWizardState;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompleteStep({ state, onClose }: CompleteStepProps) {
  const result = state.result;

  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No import result available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="text-center py-8">
        {result.success ? (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Import Completed Successfully!</h3>
            <p className="text-muted-foreground">
              All historical data has been imported into the system.
            </p>
          </>
        ) : (
          <>
            <X className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Import Completed with Errors</h3>
            <p className="text-muted-foreground">
              Some records were imported successfully, but there were errors.
            </p>
          </>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quotes Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.quotesCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Quotes Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.quotesUpdated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sales Orders Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.salesOrdersCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sales Orders Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.salesOrdersUpdated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.purchaseOrdersCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pick Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.pickTicketsCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{result.stats.shipmentsCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Errors</CardTitle>
            <CardDescription>
              The following errors occurred during import:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {result.errors.map((error, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm"
                >
                  {error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center pt-4">
        <Button onClick={onClose} size="lg">
          Close
        </Button>
      </div>
    </div>
  );
}
