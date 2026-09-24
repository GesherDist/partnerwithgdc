'use client';

/**
 * UploadPODialog Component
 *
 * Dialog for uploading Purchase Order PDF files and extracting data using Claude AI.
 * Converts PDF to images, sends to API for extraction, and creates quote from results.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  X,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Package,
  User,
  FileCheck,
  Maximize2,
  Pencil,
  ChevronDown,
  Plus,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { convertPdfToImages } from '../lib/pdf-to-images';
import { getProducts, createProductFromData } from '@/features/products/actions';
import type {
  ProcessedPOData,
  UploadDialogState,
} from '../types/po-extract.types';

// ============================================
// TYPES
// ============================================

interface UploadPODialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (data: ProcessedPOData) => void | Promise<void>;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  baseCost: number;
}

// ============================================
// COMPONENT
// ============================================

export function UploadPODialog({
  open,
  onClose,
  onSuccess,
}: UploadPODialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dialogState, setDialogState] = useState<UploadDialogState>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ProcessedPOData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields state
  const [editPoNumber, setEditPoNumber] = useState('');
  const [editPoDate, setEditPoDate] = useState('');
  const [editShipToName, setEditShipToName] = useState('');
  const [editShipToAddress, setEditShipToAddress] = useState('');
  const [editShipToCity, setEditShipToCity] = useState('');
  const [editShipToState, setEditShipToState] = useState('');
  const [editShipToZip, setEditShipToZip] = useState('');
  const [editLineItems, setEditLineItems] = useState<Array<{
    quantity: number;
    unitPrice: number;
    baseCost: number | null;
    selectedProductId: string | null;
    selectedProductSku: string | null;
  }>>([]);
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [creatingProductForIndex, setCreatingProductForIndex] = useState<number | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    sku: '',
    name: '',
    shortDescription: '',
    rimSize: '',
    tireSize: '',
    baseCost: '',
    basePrice: '',
    itemType: 'non_inventory' as 'inventory' | 'non_inventory' | 'service',
  });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter products based on search
  const filteredProducts = productsList.filter((p) => {
    if (!productSearch.trim()) { return true; }
    const search = productSearch.toLowerCase();
    return p.sku.toLowerCase().includes(search) || p.name.toLowerCase().includes(search);
  });

  // Initialize editable fields when extraction completes
  useEffect(() => {
    if (extractedData && dialogState === 'reviewing') {
      setEditPoNumber(extractedData.extraction.poNumber || '');
      setEditPoDate(extractedData.extraction.poDate || '');
      setEditShipToName(extractedData.extraction.shipTo?.name || '');
      setEditShipToAddress(extractedData.extraction.shipTo?.address || '');
      setEditShipToCity(extractedData.extraction.shipTo?.city || '');
      setEditShipToState(extractedData.extraction.shipTo?.state || '');
      setEditShipToZip(extractedData.extraction.shipTo?.zip || '');
      setEditLineItems(
        extractedData.products.map((p) => ({
          quantity: p.quantity,
          unitPrice: p.extractedUnitPrice,
          baseCost: p.matched ? (p.baseCost ?? null) : null,
          selectedProductId: p.matched ? (p.productId ?? null) : null,
          selectedProductSku: p.matched ? (p.sku ?? null) : null,
        }))
      );
    }
  }, [extractedData, dialogState]);

  // Fetch products list when in reviewing state
  useEffect(() => {
    const fetchProducts = async () => {
      if (dialogState === 'reviewing' && productsList.length === 0) {
        setLoadingProducts(true);
        try {
          const result = await getProducts({ status: 'active', limit: 500 });
          if (result.success && result.data && result.data.data) {
            setProductsList(
              result.data.data.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                basePrice: p.basePrice,
                baseCost: p.baseCost,
              }))
            );
          }
        } catch (error) {
          console.error('Failed to fetch products:', error);
        } finally {
          setLoadingProducts(false);
        }
      }
    };
    fetchProducts();
  }, [dialogState, productsList.length]);

  // Handle creating a new product from the form
  const handleCreateNewProduct = async (lineIndex: number) => {
    // Clear previous errors
    setFormErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!newProductForm.sku.trim()) {
      errors.sku = 'SKU is required';
    }
    if (!newProductForm.name.trim()) {
      errors.name = 'Name is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setCreatingProduct(true);
    try {
      const result = await createProductFromData({
        sku: newProductForm.sku.trim().toUpperCase(),
        name: newProductForm.name.trim(),
        shortDescription: newProductForm.shortDescription.trim() || null,
        rimSize: newProductForm.rimSize.trim() || null,
        tireSize: newProductForm.tireSize.trim() || null,
        baseCost: newProductForm.baseCost ? Math.round(parseFloat(newProductForm.baseCost) * 100) : 0,
        basePrice: newProductForm.basePrice ? Math.round(parseFloat(newProductForm.basePrice) * 100) : 0,
        itemType: newProductForm.itemType,
        status: 'active',
        isSellable: true,
      });

      if (result.success && result.data) {
        // Add to products list
        const newProduct: ProductOption = {
          id: result.data.id,
          sku: result.data.sku,
          name: result.data.name,
          basePrice: result.data.basePrice,
          baseCost: result.data.baseCost,
        };
        setProductsList(prev => [newProduct, ...prev]);

        // Select the new product for this line item
        const newItems = [...editLineItems];
        newItems[lineIndex] = {
          ...newItems[lineIndex],
          quantity: newItems[lineIndex]?.quantity ?? extractedData?.products[lineIndex]?.quantity ?? 1,
          unitPrice: result.data.basePrice / 100,
          baseCost: result.data.baseCost / 100,
          selectedProductId: result.data.id,
          selectedProductSku: result.data.sku,
        };
        setEditLineItems(newItems);

        // Reset and close
        setNewProductForm({
          sku: '',
          name: '',
          shortDescription: '',
          rimSize: '',
          tireSize: '',
          baseCost: '',
          basePrice: '',
          itemType: 'non_inventory',
        });
        setCreatingProductForIndex(null);
        setOpenPopoverIndex(null);

        // toast would be helpful here but need to import
      } else {
        // Show detailed validation errors on fields
        if (result.errors) {
          const fieldErrors: Record<string, string> = {};
          Object.entries(result.errors).forEach(([field, messages]) => {
            fieldErrors[field] = (messages as string[])[0] || 'Invalid';
          });
          setFormErrors(fieldErrors);
        }
      }
    } catch (error) {
      console.error('Create product error:', error);
    } finally {
      setCreatingProduct(false);
    }
  };

  // Create/revoke object URL for PDF preview
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setShowPreview(true);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setPreviewUrl(null);
    setShowPreview(false);
    return undefined;
  }, [selectedFile]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (file.type === 'application/pdf') {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        return;
      }
      setSelectedFile(file);
      setDialogState('file-selected');
      setError(null);
      setExtractedData(null);
    } else {
      setError('Please select a PDF file');
    }
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle upload click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setError(null);
    setDialogState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle extraction process
  const handleExtract = async () => {
    if (!selectedFile) {
      return;
    }

    setDialogState('extracting');
    setError(null);
    setProgress('Converting PDF to images...');

    try {
      // Step 1: Convert PDF to images
      const conversionResult = await convertPdfToImages(selectedFile);

      if (!conversionResult.success) {
        throw new Error(conversionResult.error || 'Failed to convert PDF');
      }

      if (conversionResult.images.length === 0) {
        throw new Error('No pages could be extracted from the PDF');
      }

      setProgress(
        `Extracted ${conversionResult.processedPages} of ${conversionResult.pageCount} pages. Sending to AI for analysis...`
      );

      // Step 2: Send images to extraction API
      const response = await fetch('/api/po/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: conversionResult.images,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Parse error and show user-friendly message
        let errorMessage = 'Extraction failed';

        if (result.error) {
          // Handle different error types
          const errorStr = typeof result.error === 'string'
            ? result.error
            : result.error.message || JSON.stringify(result.error);

          if (errorStr.includes('OPENAI_API_KEY not configured')) {
            errorMessage = 'AI service not configured. Please contact administrator to set up the OpenAI API key.';
          } else if (errorStr.includes('invalid') || errorStr.includes('authentication') || errorStr.includes('Incorrect API key')) {
            errorMessage = 'AI service authentication failed. The API key is invalid or expired. Please contact administrator.';
          } else if (errorStr.includes('rate_limit')) {
            errorMessage = 'AI service rate limit reached. Please try again in a few minutes.';
          } else if (errorStr.includes('overloaded')) {
            errorMessage = 'AI service is currently busy. Please try again in a moment.';
          } else if (response.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (response.status === 403) {
            errorMessage = 'You do not have permission to perform this action.';
          } else {
            errorMessage = errorStr;
          }
        }

        // Set error state directly instead of throwing (avoids Next.js error overlay)
        setError(errorMessage);
        setDialogState('error');
        setProgress('');
        return;
      }

      // Step 3: Show extracted data for review
      setExtractedData(result.data);
      setDialogState('reviewing');
      setProgress('');
    } catch (err) {
      // Log to console.warn instead of console.error to avoid Next.js error overlay
      console.warn('Extraction error:', err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'Failed to extract PO data');
      setDialogState('error');
      setProgress('');
    }
  };

  // Handle create quote
  const handleCreateQuote = async () => {
    if (!extractedData) {
      return;
    }

    setDialogState('creating');

    try {
      // Apply edited values to extracted data
      const updatedProducts = extractedData.products.map((product, index) => {
        const lineItem = editLineItems[index];
        // If a product was selected from dropdown, use that product's info
        if (lineItem?.selectedProductId) {
          const selectedProduct = productsList.find(p => p.id === lineItem.selectedProductId);
          return {
            ...product,
            productId: lineItem.selectedProductId,
            sku: selectedProduct?.sku || lineItem.selectedProductSku || product.sku,
            description: selectedProduct?.name || product.description, // Use selected product's name as description
            matched: true, // Mark as matched since user selected a product
            quantity: lineItem.quantity ?? product.quantity,
            extractedUnitPrice: lineItem.unitPrice ?? product.extractedUnitPrice,
            baseCost: lineItem.baseCost ?? (selectedProduct ? selectedProduct.baseCost / 100 : null),
          };
        }
        // Otherwise use the original product with any edits
        return {
          ...product,
          quantity: lineItem?.quantity ?? product.quantity,
          extractedUnitPrice: lineItem?.unitPrice ?? product.extractedUnitPrice,
          baseCost: lineItem?.baseCost ?? product.baseCost ?? null,
        };
      });

      // Include the PDF file and edited data
      const dataWithEdits: ProcessedPOData = {
        ...extractedData,
        extraction: {
          ...extractedData.extraction,
          poNumber: editPoNumber || extractedData.extraction.poNumber,
          poDate: editPoDate || extractedData.extraction.poDate,
          shipTo: {
            ...extractedData.extraction.shipTo,
            name: editShipToName || extractedData.extraction.shipTo?.name || null,
            address: editShipToAddress || extractedData.extraction.shipTo?.address || null,
            city: editShipToCity || extractedData.extraction.shipTo?.city || null,
            state: editShipToState || extractedData.extraction.shipTo?.state || null,
            zip: editShipToZip || extractedData.extraction.shipTo?.zip || null,
          },
        },
        products: updatedProducts,
        pdfFile: selectedFile || undefined,
      };
      // Pass the edited data to parent component and wait for completion
      await onSuccess?.(dataWithEdits);
      handleClose();
    } catch (err) {
      console.error('Create quote error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create quote');
      setDialogState('error');
    }
  };

  // Handle close
  const handleClose = () => {
    setSelectedFile(null);
    setIsDragging(false);
    setShowPreview(false);
    setPreviewUrl(null);
    setExtractedData(null);
    setError(null);
    setDialogState('idle');
    setProgress('');
    setIsEditing(false);
    setEditLineItems([]);
    setProductsList([]);
    setOpenPopoverIndex(null);
    setCreatingProductForIndex(null);
    setProductSearch('');
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Toggle preview
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {confidence}% confidence
        </Badge>
      );
    } else if (confidence >= 50) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {confidence}% confidence
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        {confidence}% confidence
      </Badge>
    );
  };

  // Determine dialog width based on state
  const isReviewingOrCreating = dialogState === 'reviewing' || dialogState === 'creating';
  const dialogWidth = isReviewingOrCreating
    ? 'sm:max-w-[800px]'
    : (showPreview && previewUrl && selectedFile)
      ? 'sm:max-w-[900px]'
      : 'sm:max-w-[500px]';

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={`transition-all duration-300 ${dialogWidth}`}
      >
        <DialogHeader>
          <DialogTitle>
            {isReviewingOrCreating ? 'Review Extracted Data' : 'Upload Purchase Order'}
          </DialogTitle>
          <DialogDescription>
            {isReviewingOrCreating
              ? 'Review the extracted data and create a quote.'
              : 'Upload a Purchase Order PDF to automatically create a quote.'}
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Progress Message */}
        {progress && dialogState === 'extracting' && (
          <div className="flex items-center gap-2 p-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            {progress}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Upload section / File info (hidden in reviewing/creating state) */}
          {!isReviewingOrCreating && (
          <div className="space-y-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Drop zone or File info */}
            {!selectedFile ? (
              <div
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  flex flex-col items-center justify-center gap-4 p-8
                  border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200
                  ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF files only (max 10MB)</p>
                </div>
              </div>
            ) : (
              /* Selected file info */
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                {dialogState !== 'extracting' && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={togglePreview}
                      className="h-8 w-8"
                      title={showPreview ? 'Hide preview' : 'Show preview'}
                    >
                      {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveFile}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* PDF Preview below file info (stacked layout) */}
            {showPreview && previewUrl && selectedFile && (
              <div className="border rounded-lg overflow-hidden bg-muted/20">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                  <span className="text-xs font-medium text-muted-foreground">PDF Preview</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFullscreenPreview(true)}
                    className="h-7 w-7"
                    title="View fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
                <iframe src={previewUrl} className="w-full h-[500px]" title="PDF Preview" />
              </div>
            )}
          </div>
          )}

          {/* Extracted data review - Full width when reviewing/creating */}
          {isReviewingOrCreating && extractedData && (
            <div className="space-y-4 w-full">
              {/* Extraction Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">Extraction Results</h3>
                  {getConfidenceBadge(extractedData.extraction.confidence)}
                </div>
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  {isEditing ? 'Done Editing' : 'Edit'}
                </Button>
              </div>

              <ScrollArea className="h-[500px] rounded-lg border">
                <div className="p-4 space-y-4">
                  {/* PO Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileCheck className="w-4 h-4 text-muted-foreground" />
                      PO Information
                    </div>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">PO Number</Label>
                          <Input
                            value={editPoNumber}
                            onChange={(e) => setEditPoNumber(e.target.value)}
                            placeholder="PO Number"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={editPoDate}
                            onChange={(e) => setEditPoDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">PO Number:</span>
                          <span className="ml-2 font-medium">
                            {editPoNumber || 'Not found'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <span className="ml-2 font-medium">
                            {editPoDate || 'Not found'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Customer */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Customer
                    </div>
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {extractedData.customer.name || 'Unknown'}
                        </span>
                        {extractedData.customer.matched ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Matched
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                          >
                            Will Create
                          </Badge>
                        )}
                      </div>
                      {extractedData.extraction.customer?.address && (
                        <p className="text-muted-foreground mt-1">
                          {extractedData.extraction.customer.address}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ship To */}
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      Ship To
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editShipToName}
                            onChange={(e) => setEditShipToName(e.target.value)}
                            placeholder="Recipient Name"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Address</Label>
                          <Input
                            value={editShipToAddress}
                            onChange={(e) => setEditShipToAddress(e.target.value)}
                            placeholder="Street Address"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">City</Label>
                            <Input
                              value={editShipToCity}
                              onChange={(e) => setEditShipToCity(e.target.value)}
                              placeholder="City"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">State</Label>
                            <Input
                              value={editShipToState}
                              onChange={(e) => setEditShipToState(e.target.value)}
                              placeholder="State"
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">ZIP</Label>
                            <Input
                              value={editShipToZip}
                              onChange={(e) => setEditShipToZip(e.target.value)}
                              placeholder="ZIP"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>{editShipToName || 'Not specified'}</p>
                        {editShipToAddress && <p>{editShipToAddress}</p>}
                        {(editShipToCity || editShipToState || editShipToZip) && (
                          <p>
                            {[editShipToCity, editShipToState, editShipToZip]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Line Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        Line Items ({extractedData.products.length})
                      </div>
                      {(() => {
                        // Calculate dynamic matched count based on user selections
                        const dynamicMatchedCount = editLineItems.filter(item => !!item?.selectedProductId).length;
                        const dynamicUnmatchedCount = extractedData.products.length - dynamicMatchedCount;
                        return (
                          <div className="text-xs text-muted-foreground">
                            <span className="text-emerald-600">{dynamicMatchedCount} matched</span>
                            {dynamicUnmatchedCount > 0 && (
                              <>
                                {' / '}
                                <span className="text-amber-600">
                                  {dynamicUnmatchedCount} will create
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-2">
                      {extractedData.products.map((product, index) => {
                        const lineItem = editLineItems[index];
                        const isProductSelected = !!lineItem?.selectedProductId;
                        const selectedProduct = productsList.find(p => p.id === lineItem?.selectedProductId);

                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border transition-colors ${
                              isProductSelected
                                ? 'bg-emerald-50/50 border-emerald-200'
                                : 'bg-amber-50/50 border-amber-200'
                            }`}
                          >
                          <Popover
                            open={openPopoverIndex === index}
                            onOpenChange={(open) => {
                              setOpenPopoverIndex(open ? index : null);
                              if (!open) {
                                setProductSearch('');
                                setCreatingProductForIndex(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <div
                                className={`cursor-pointer rounded transition-colors ${
                                  isProductSelected
                                    ? 'hover:bg-emerald-100/50'
                                    : 'hover:bg-amber-100/50'
                                }`}
                              >
                                {/* Inline Layout: Clickable Product Info | Qty/Price */}
                                <div className="flex items-center gap-3">
                                  {/* Left: Product Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium truncate">
                                        {isProductSelected
                                          ? (selectedProduct?.sku || lineItem?.selectedProductSku)
                                          : (product.sku || 'No SKU')}
                                      </span>
                                      {isProductSelected ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                      ) : (
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                      )}
                                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {isProductSelected
                                        ? selectedProduct?.name
                                        : product.description}
                                    </p>
                                    {!isProductSelected && (
                                      <p className="text-[10px] text-amber-600 mt-0.5">
                                        Click to map product
                                      </p>
                                    )}
                                  </div>

                                  {/* Right: Qty & Price */}
                                  <div className="text-right text-sm flex-shrink-0 w-24">
                                    <div className="font-medium">Qty: {lineItem?.quantity ?? product.quantity}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatCurrency(lineItem?.unitPrice ?? product.extractedUnitPrice)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              className="p-0"
                              align="start"
                              sideOffset={5}
                              style={{ width: 'var(--radix-popover-trigger-width)' }}
                            >
                                  {creatingProductForIndex === index ? (
                                    // Create New Product Form
                                    <>
                                      <div className="p-3 border-b bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                                        <p className="text-sm font-medium">Create New Product</p>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={() => {
                                            setCreatingProductForIndex(null);
                                            setFormErrors({});
                                          }}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      <div
                                        className="p-3 space-y-2.5 max-h-[350px] overflow-y-auto overscroll-contain"
                                        onWheel={(e) => e.stopPropagation()}
                                      >
                                        {/* SKU and Name */}
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">SKU *</Label>
                                            <Input
                                              value={newProductForm.sku}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, sku: e.target.value }));
                                                if (formErrors.sku) { setFormErrors(prev => ({ ...prev, sku: '' })); }
                                              }}
                                              placeholder="e.g. TIRE-38-IPT"
                                              className={`h-8 text-sm ${formErrors.sku ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.sku && (
                                              <p className="text-xs text-red-500">{formErrors.sku}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Product Name *</Label>
                                            <Input
                                              value={newProductForm.name}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, name: e.target.value }));
                                                if (formErrors.name) { setFormErrors(prev => ({ ...prev, name: '' })); }
                                              }}
                                              placeholder="Product name"
                                              className={`h-8 text-sm ${formErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.name && (
                                              <p className="text-xs text-red-500">{formErrors.name}</p>
                                            )}
                                          </div>
                                        </div>
                                        {/* Short Description */}
                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">Short Description</Label>
                                          <Input
                                            value={newProductForm.shortDescription}
                                            onChange={(e) => {
                                              setNewProductForm(prev => ({ ...prev, shortDescription: e.target.value }));
                                              if (formErrors.shortDescription) { setFormErrors(prev => ({ ...prev, shortDescription: '' })); }
                                            }}
                                            placeholder="Brief product summary"
                                            className={`h-8 text-sm ${formErrors.shortDescription ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          {formErrors.shortDescription && (
                                            <p className="text-xs text-red-500">{formErrors.shortDescription}</p>
                                          )}
                                        </div>
                                        {/* Rim Size and Tire Size */}
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Rim Size</Label>
                                            <Input
                                              value={newProductForm.rimSize}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, rimSize: e.target.value }));
                                                if (formErrors.rimSize) { setFormErrors(prev => ({ ...prev, rimSize: '' })); }
                                              }}
                                              placeholder='e.g. 38"'
                                              className={`h-8 text-sm ${formErrors.rimSize ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.rimSize && (
                                              <p className="text-xs text-red-500">{formErrors.rimSize}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Tire Size</Label>
                                            <Input
                                              value={newProductForm.tireSize}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, tireSize: e.target.value }));
                                                if (formErrors.tireSize) { setFormErrors(prev => ({ ...prev, tireSize: '' })); }
                                              }}
                                              placeholder="e.g. 14.9-38"
                                              className={`h-8 text-sm ${formErrors.tireSize ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.tireSize && (
                                              <p className="text-xs text-red-500">{formErrors.tireSize}</p>
                                            )}
                                          </div>
                                        </div>
                                        {/* Base Cost and Base Price */}
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Base Cost</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={newProductForm.baseCost}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, baseCost: e.target.value }));
                                                if (formErrors.baseCost) { setFormErrors(prev => ({ ...prev, baseCost: '' })); }
                                              }}
                                              placeholder="0.00"
                                              className={`h-8 text-sm ${formErrors.baseCost ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.baseCost && (
                                              <p className="text-xs text-red-500">{formErrors.baseCost}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Base Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={newProductForm.basePrice}
                                              onChange={(e) => {
                                                setNewProductForm(prev => ({ ...prev, basePrice: e.target.value }));
                                                if (formErrors.basePrice) { setFormErrors(prev => ({ ...prev, basePrice: '' })); }
                                              }}
                                              placeholder="0.00"
                                              className={`h-8 text-sm ${formErrors.basePrice ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            {formErrors.basePrice && (
                                              <p className="text-xs text-red-500">{formErrors.basePrice}</p>
                                            )}
                                          </div>
                                        </div>
                                        {/* Item Type */}
                                        <div className="space-y-1">
                                          <Label className="text-xs text-muted-foreground">Item Type</Label>
                                          <Select
                                            value={newProductForm.itemType}
                                            onValueChange={(value: 'inventory' | 'non_inventory' | 'service') => {
                                              setNewProductForm(prev => ({ ...prev, itemType: value }));
                                              if (formErrors.itemType) { setFormErrors(prev => ({ ...prev, itemType: '' })); }
                                            }}
                                          >
                                            <SelectTrigger className={`h-8 text-sm ${formErrors.itemType ? 'border-red-500 focus:ring-red-500' : ''}`}>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="inventory">Inventory</SelectItem>
                                              <SelectItem value="non_inventory">Non-Inventory</SelectItem>
                                              <SelectItem value="service">Service</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          {formErrors.itemType && (
                                            <p className="text-xs text-red-500">{formErrors.itemType}</p>
                                          )}
                                        </div>
                                        {/* Buttons */}
                                        <div className="flex gap-2 pt-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setCreatingProductForIndex(null)}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleCreateNewProduct(index)}
                                            disabled={creatingProduct}
                                          >
                                            {creatingProduct ? (
                                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                            ) : (
                                              <Plus className="w-3 h-3 mr-1" />
                                            )}
                                            Create
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    // Product List with Search
                                    <>
                                      {/* Header with Search */}
                                      <div className="p-3 border-b bg-slate-50 dark:bg-slate-900">
                                        <Input
                                          value={productSearch}
                                          onChange={(e) => setProductSearch(e.target.value)}
                                          placeholder="Search by SKU or product name..."
                                          className="w-full h-8 text-sm bg-white dark:bg-slate-800 border-slate-300"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      {/* Product List */}
                                      <div
                                        className="max-h-[250px] overflow-y-auto overscroll-contain bg-white dark:bg-slate-950"
                                        style={{ scrollbarWidth: 'thin' }}
                                        onWheel={(e) => e.stopPropagation()}
                                      >
                                        {loadingProducts ? (
                                          <div className="p-4 text-center text-sm text-muted-foreground">
                                            Loading products...
                                          </div>
                                        ) : filteredProducts.length === 0 ? (
                                          <div className="p-4 text-center text-sm text-muted-foreground">
                                            {productSearch ? 'No products match your search' : 'No products found'}
                                          </div>
                                        ) : (
                                          filteredProducts.map((p, pIndex) => (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => {
                                                const newItems = [...editLineItems];
                                                newItems[index] = {
                                                  ...newItems[index],
                                                  quantity: newItems[index]?.quantity ?? product.quantity,
                                                  unitPrice: p.basePrice / 100,
                                                  baseCost: p.baseCost / 100,
                                                  selectedProductId: p.id,
                                                  selectedProductSku: p.sku,
                                                };
                                                setEditLineItems(newItems);
                                                setOpenPopoverIndex(null);
                                                setProductSearch('');
                                              }}
                                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${
                                                lineItem?.selectedProductId === p.id
                                                  ? 'bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                                                  : pIndex % 2 === 0
                                                    ? 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900'
                                                    : 'bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                                              }`}
                                            >
                                              <div className="w-32 flex-shrink-0 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                {p.sku}
                                                {lineItem?.selectedProductId === p.id && (
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                )}
                                              </div>
                                              <div className="flex-1 text-left text-xs text-slate-600 dark:text-slate-400 truncate">
                                                {p.name}
                                              </div>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                      {/* Create New Item Button */}
                                      <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 border-slate-300 dark:border-slate-600"
                                          onClick={() => {
                                            // Reset form - start with empty fields
                                            setNewProductForm({
                                              sku: '',
                                              name: '',
                                              shortDescription: '',
                                              rimSize: '',
                                              tireSize: '',
                                              baseCost: '',
                                              basePrice: '',
                                              itemType: 'non_inventory',
                                            });
                                            setFormErrors({});
                                            setCreatingProductForIndex(index);
                                            setProductSearch('');
                                          }}
                                        >
                                          <Plus className="w-3.5 h-3.5 mr-1.5" />
                                          Create New Item
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </PopoverContent>
                          </Popover>

                            {/* Edit mode - expanded fields - inside the same card */}
                            {isEditing && (
                              <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${
                                isProductSelected ? 'border-emerald-200' : 'border-amber-200'
                              }`}>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={lineItem?.quantity ?? product.quantity}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      newItems[index] = {
                                        ...newItems[index],
                                        quantity: parseInt(e.target.value) || 1,
                                        unitPrice: newItems[index]?.unitPrice ?? product.extractedUnitPrice,
                                        baseCost: newItems[index]?.baseCost ?? null,
                                        selectedProductId: newItems[index]?.selectedProductId ?? null,
                                        selectedProductSku: newItems[index]?.selectedProductSku ?? null,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-16 text-sm text-right"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Cost</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Cost"
                                    value={lineItem?.baseCost ?? ''}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      const value = e.target.value;
                                      newItems[index] = {
                                        ...newItems[index],
                                        quantity: newItems[index]?.quantity ?? product.quantity,
                                        unitPrice: newItems[index]?.unitPrice ?? product.extractedUnitPrice,
                                        baseCost: value === '' ? null : parseFloat(value) || 0,
                                        selectedProductId: newItems[index]?.selectedProductId ?? null,
                                        selectedProductSku: newItems[index]?.selectedProductSku ?? null,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-20 text-sm text-right"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={lineItem?.unitPrice ?? product.extractedUnitPrice}
                                    onChange={(e) => {
                                      const newItems = [...editLineItems];
                                      newItems[index] = {
                                        ...newItems[index],
                                        quantity: newItems[index]?.quantity ?? product.quantity,
                                        unitPrice: parseFloat(e.target.value) || 0,
                                        baseCost: newItems[index]?.baseCost ?? null,
                                        selectedProductId: newItems[index]?.selectedProductId ?? null,
                                        selectedProductSku: newItems[index]?.selectedProductSku ?? null,
                                      };
                                      setEditLineItems(newItems);
                                    }}
                                    className="h-7 w-20 text-sm text-right"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={dialogState === 'extracting' || dialogState === 'creating'}
          >
            Cancel
          </Button>

          {dialogState === 'file-selected' && (
            <Button onClick={handleExtract}>
              <Upload className="mr-2 h-4 w-4" />
              Generate a Quote
            </Button>
          )}

          {dialogState === 'extracting' && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </Button>
          )}

          {dialogState === 'reviewing' && (
            <Button onClick={handleCreateQuote}>
              <FileCheck className="mr-2 h-4 w-4" />
              Create Quote
            </Button>
          )}

          {dialogState === 'creating' && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </Button>
          )}

          {(dialogState === 'error' || dialogState === 'idle') && selectedFile && (
            <Button onClick={handleExtract}>
              <Upload className="mr-2 h-4 w-4" />
              {dialogState === 'error' ? 'Retry' : 'Generate a Quote'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Fullscreen PDF Preview Modal */}
    <Dialog open={showFullscreenPreview} onOpenChange={setShowFullscreenPreview}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-base">
            {selectedFile?.name || 'PDF Preview'}
          </DialogTitle>
        </DialogHeader>
        {previewUrl && (
          <iframe
            src={previewUrl}
            className="w-full flex-1 border-0"
            style={{ height: 'calc(95vh - 60px)' }}
            title="PDF Fullscreen Preview"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
