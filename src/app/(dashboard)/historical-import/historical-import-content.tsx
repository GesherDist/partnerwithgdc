'use client';

/**
 * Historical Import Page Content
 *
 * Client component for importing historical sales data
 */

import { useState } from 'react';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, Database } from 'lucide-react';
import { ImportWizardModal } from '@/features/historical-import/components/ImportWizardModal';
import { ImportMasterDataDialog } from '@/features/historical-import/components/dialogs/ImportMasterDataDialog';

// ============================================
// COMPONENT
// ============================================

export function HistoricalImportPageContent() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isMasterDataDialogOpen, setIsMasterDataDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 self-start w-full">
      {/* Page Header */}
      <PageHeader
        title="Import Historical Data"
        description="Import historical sales orders, quotes, and fulfillment data from Excel files"
      />

      {/* Main Content */}
      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Historical Data Import</CardTitle>
            <CardDescription>
              Upload Excel files containing historical sales data (GDC 0, GDC 1, GDC 2 sheets) to
              import quotes, sales orders, purchase orders, and shipments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="space-y-4">
              <h3 className="font-semibold">Before You Start:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground ml-6 list-disc">
                <li>Ensure all customers exist in the database</li>
                <li>
                  Required products must be available: 290/85R38 (38" tire) and 380/85R24 (24"
                  tire)
                </li>
                <li>Supplier "Galileo" must exist in the database</li>
                <li>Excel file should contain sheets: "GDC 0", "GDC 1", "GDC 2"</li>
              </ul>
            </div>

            {/* Import Process Steps */}
            <div className="space-y-4">
              <h3 className="font-semibold">Import Process:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Upload & Review</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Upload Excel file and review parsed data
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Preview & Edit</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Review quotes, sales orders, and fulfillment
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Import</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Create all records in the database
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What Gets Created */}
            <div className="space-y-4">
              <h3 className="font-semibold">What Gets Created:</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Quotes with items</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Sales orders with items</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Purchase orders</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Pick tickets (if GDC inventory)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Fulfillment allocations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Shipment tracking</span>
                </div>
              </div>
            </div>

            {/* Start Import Button */}
            <div className="pt-4 border-t space-y-3">
              <Button onClick={() => setIsWizardOpen(true)} size="lg" className="w-full">
                <Upload className="w-5 h-5 mr-2" />
                Start Import Wizard
              </Button>

              <Button
                onClick={() => setIsMasterDataDialogOpen(true)}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Database className="w-5 h-5 mr-2" />
                Upload CSV for Products & Customers
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Expected File Format */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Expected File Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">File Type:</span> Excel (.xlsx,
                .xls)
              </div>
              <div>
                <span className="font-semibold text-foreground">Required Sheets:</span> "GDC 0",
                "GDC 1", "GDC 2"
              </div>
              <div>
                <span className="font-semibold text-foreground">Columns:</span> Load #, Customer,
                PO, Qty (38", 24"), Price (38", 24"), Delivery Address, Dates, Status, Container
                Numbers
              </div>
              <div>
                <span className="font-semibold text-foreground">Load Numbers:</span> Must start
                with "SO" (e.g., SO2600023)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Wizard Modal */}
      <ImportWizardModal open={isWizardOpen} onOpenChange={setIsWizardOpen} />

      {/* Import Master Data Dialog */}
      <ImportMasterDataDialog
        open={isMasterDataDialogOpen}
        onOpenChange={setIsMasterDataDialogOpen}
      />
    </div>
  );
}
