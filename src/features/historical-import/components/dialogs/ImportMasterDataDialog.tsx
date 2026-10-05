/**
 * Import Master Data Dialog
 * =========================
 * Upload CSV files for Customers and Products
 */

'use client';

import { useState } from 'react';
import { Upload, Users, Package, Check, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

interface ImportMasterDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  success: boolean;
  message: string;
  created?: number;
  updated?: number;
  errors?: string[];
}

export function ImportMasterDataDialog({ open, onOpenChange }: ImportMasterDataDialogProps) {
  const [activeTab, setActiveTab] = useState<'customers' | 'products'>('customers');
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'customers' | 'products') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'customers') {
        setCustomerFile(file);
      } else {
        setProductFile(file);
      }
      setResult(null); // Clear previous results
    }
  };

  const handleImport = async () => {
    const file = activeTab === 'customers' ? customerFile : productFile;
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', activeTab);

      const response = await fetch('/api/historical-import/import-master-data', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          created: data.created,
          updated: data.updated,
        });

        // Clear file after successful import
        if (activeTab === 'customers') {
          setCustomerFile(null);
        } else {
          setProductFile(null);
        }
      } else {
        setResult({
          success: false,
          message: data.message || 'Import failed',
          errors: data.errors,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to import data. Please try again.',
        errors: [(error as Error).message],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setCustomerFile(null);
    setProductFile(null);
    setResult(null);
    setActiveTab('customers');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Master Data
          </DialogTitle>
          <DialogDescription>
            Upload CSV files to bulk import customers and products
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'customers' | 'products')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format:</strong> name, email, phone, address_street, address_city, address_state, address_postal_code, channel (oem/dealer)
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('customer-file-input')?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {customerFile ? customerFile.name : 'Choose CSV File'}
                </Button>
                <input
                  id="customer-file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'customers')}
                />
                {customerFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomerFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {customerFile && (
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? 'Importing...' : `Import ${customerFile.name}`}
                </Button>
              )}
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Example CSV:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`name,email,phone,address_street,address_city,address_state,address_postal_code,channel
Lindsay Irrigation Solutions,info@lindsay.com,555-0100,"123 Main St","Omaha","NE","68001","oem"
Valley Irrigation LLC,contact@valley.com,555-0200,"456 Oak Ave","McCook","NE","69001","dealer"`}
              </pre>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format:</strong> sku, name, description, category (tire/rim/accessory), cost, price, tire_size, rim_size, weight_lbs
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('product-file-input')?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {productFile ? productFile.name : 'Choose CSV File'}
                </Button>
                <input
                  id="product-file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'products')}
                />
                {productFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProductFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {productFile && (
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? 'Importing...' : `Import ${productFile.name}`}
                </Button>
              )}
            </div>

            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Example CSV:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`sku,name,description,category,cost,price,tire_size,rim_size,weight_lbs
290/85R38,38" Agricultural Tire,Premium ag tire,tire,1000,1200,290/85R38,38,85
380/85R24,24" Agricultural Tire,Premium ag tire,tire,650,800,380/85R24,24,65`}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        {/* Import Results */}
        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'} className="mt-4">
            {result.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <p className="font-medium">{result.message}</p>
              {result.created !== undefined && (
                <p className="text-sm mt-1">Created: {result.created} | Updated: {result.updated}</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul className="text-sm mt-2 space-y-1">
                  {result.errors.slice(0, 5).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... and {result.errors.length - 5} more errors</li>
                  )}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
