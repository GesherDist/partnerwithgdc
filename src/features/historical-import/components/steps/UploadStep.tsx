/**
 * STEP 1: UPLOAD & PARSE
 * =======================
 * File upload and initial parsing
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { ImportWizardState } from '../../types';
import { parseExcelFile } from '../../lib/parser';
import { validateRows } from '../../lib/validator';

// ============================================================================
// PROPS
// ============================================================================

interface UploadStepProps {
  state: ImportWizardState;
  updateState: (updates: Partial<ImportWizardState>) => void;
  onNext: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UploadStep({ state, updateState, onNext }: UploadStepProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // ============================================================================
  // FILE UPLOAD HANDLER
  // ============================================================================

  const handleFileDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setParseError(null);
      setIsParsing(true);

      try {
        // Parse Excel file
        const rawRows = await parseExcelFile(file);

        if (rawRows.length === 0) {
          setParseError('No valid orders found in file');
          setIsParsing(false);
          return;
        }

        // Update state with parsed data
        updateState({
          fileName: file.name,
          fileSize: file.size,
          rawRows,
        });

        setIsParsing(false);
        setIsValidating(true);

        // Validate against database
        const validation = await validateRows(rawRows);

        updateState({
          validation,
        });

        setIsValidating(false);

        // Auto-advance to next step
        onNext();
      } catch (error) {
        console.error('Parse error:', error);
        setParseError(error instanceof Error ? error.message : 'Failed to parse file');
        setIsParsing(false);
        setIsValidating(false);
      }
    },
    [updateState, onNext]
  );

  // ============================================================================
  // DROPZONE
  // ============================================================================

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: isParsing || isValidating,
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  const isProcessing = isParsing || isValidating;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Upload Historical Data File</h3>
        <p className="text-sm text-muted-foreground">
          Upload an Excel file (.xlsx, .xls) or CSV file containing historical sales orders.
          The file should have sheets named "GDC 0", "GDC 1", and "GDC 2".
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {isParsing && 'Parsing file...'}
                  {isValidating && 'Validating data...'}
                </p>
                <p className="text-sm text-muted-foreground">
                  This may take a moment
                </p>
              </div>
            </>
          ) : (
            <>
              {isDragActive ? (
                <Upload className="w-12 h-12 text-primary" />
              ) : (
                <FileSpreadsheet className="w-12 h-12 text-muted-foreground" />
              )}
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {isDragActive ? 'Drop file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Excel (.xlsx, .xls) or CSV files only
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {parseError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {/* File Info (if uploaded) */}
      {state.fileName && !isProcessing && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">{state.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {state.fileSize ? `${(state.fileSize / 1024).toFixed(2)} KB` : 'Unknown size'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateState({
                  fileName: null,
                  fileSize: null,
                  rawRows: [],
                  validation: null,
                });
                setParseError(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* Expected Format */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold text-sm">Expected File Format:</h4>
        <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
          <li>Sheet names: "GDC 0", "GDC 1", "GDC 2"</li>
          <li>Columns: Load#, Customer, PO, Qty (38", 24"), Price, Delivery Address, Status, etc.</li>
          <li>Load numbers should start with "SO" (e.g., SO2600023)</li>
          <li>Customer names must match database records exactly</li>
        </ul>
      </div>
    </div>
  );
}
