/**
 * HISTORICAL IMPORT - WIZARD MODAL
 * =================================
 * Main wizard modal with multi-step flow
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Progress } from '@/shared/components/ui/progress';
import { ImportWizardStep, ImportWizardState, RawExcelRow } from '../types';
import { UploadStep } from './steps/UploadStep';
import { ReviewDataStep } from './steps/ReviewDataStep';
import { PreviewQuoteStep } from './steps/PreviewQuoteStep';
import { PreviewSalesOrderStep } from './steps/PreviewSalesOrderStep';
import { PreviewFulfillmentStep } from './steps/PreviewFulfillmentStep';
import { CompleteStep } from './steps/CompleteStep';

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

const STEPS: { id: ImportWizardStep; title: string; description: string }[] = [
  {
    id: 'upload',
    title: 'Upload File',
    description: 'Upload Excel/CSV file with historical data',
  },
  {
    id: 'review-data',
    title: 'Review Data',
    description: 'Review and edit parsed data',
  },
  {
    id: 'preview-quote',
    title: 'Preview Quotes',
    description: 'Review quotes before creation',
  },
  {
    id: 'preview-so',
    title: 'Preview Sales Orders',
    description: 'Review sales orders before creation',
  },
  {
    id: 'preview-fulfillment',
    title: 'Preview Fulfillment',
    description: 'Review PO/Pick Tickets before creation',
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'Import summary',
  },
];

// ============================================================================
// PROPS
// ============================================================================

interface ImportWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportWizardModal({ open, onOpenChange }: ImportWizardModalProps) {
  const [state, setState] = useState<ImportWizardState>({
    currentStep: 'upload',
    fileName: null,
    fileSize: null,
    rawRows: [],
    validation: null,
    quotePreviews: [],
    soPreviews: [],
    poPreviews: [],
    pickTicketPreviews: [],
    shipmentPreviews: [],
    result: null,
    isProcessing: false,
    error: null,
  });

  // ============================================================================
  // STEP NAVIGATION
  // ============================================================================

  const currentStepIndex = STEPS.findIndex((s) => s.id === state.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setState((prev) => ({
        ...prev,
        currentStep: STEPS[nextIndex]!.id,
      }));
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setState((prev) => ({
        ...prev,
        currentStep: STEPS[prevIndex]!.id,
      }));
    }
  };

  // ============================================================================
  // UPDATE STATE
  // ============================================================================

  const updateState = useCallback((updates: Partial<ImportWizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateRow = useCallback(async (rowIndex: number, updates: Partial<RawExcelRow>) => {
    // If customer field is being updated, re-validate the row
    if (updates.customer !== undefined) {
      const { isInternalCustomer } = await import('../lib/parser');
      const { normalizeCustomerName } = await import('../lib/customer-mapping');

      const isInternal = isInternalCustomer(updates.customer);

      // Update isInternalCustomer flag
      updates.isInternalCustomer = isInternal;

      if (isInternal) {
        // Internal customer - no need to check database
        updates.customerExists = true;
        updates.customerId = null;
      } else if (updates.customer) {
        // External customer - check database
        try {
          const normalized = normalizeCustomerName(updates.customer);
          const response = await fetch('/api/historical-import/validate-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerName: normalized }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.exists) {
              updates.customerExists = true;
              updates.customerId = data.customerId;
              updates.customer = data.customerName; // Use database name
            } else {
              updates.customerExists = false;
              updates.customerId = null;
            }
          }
        } catch (error) {
          console.error('Failed to validate customer:', error);
        }
      }
    }

    setState((prev) => ({
      ...prev,
      rawRows: prev.rawRows.map((row) =>
        row.rowIndex === rowIndex ? { ...row, ...updates } : row
      ),
    }));
  }, []);

  // ============================================================================
  // RESET & CLOSE
  // ============================================================================

  const handleClose = () => {
    // Reset state
    setState({
      currentStep: 'upload',
      fileName: null,
      fileSize: null,
      rawRows: [],
      validation: null,
      quotePreviews: [],
      soPreviews: [],
      poPreviews: [],
      pickTicketPreviews: [],
      shipmentPreviews: [],
      result: null,
      isProcessing: false,
      error: null,
    });
    onOpenChange(false);
  };

  // ============================================================================
  // RENDER CURRENT STEP
  // ============================================================================

  const renderStep = () => {
    switch (state.currentStep) {
      case 'upload':
        return (
          <UploadStep
            state={state}
            updateState={updateState}
            onNext={goToNextStep}
          />
        );

      case 'review-data':
        return (
          <ReviewDataStep
            state={state}
            updateState={updateState}
            updateRow={updateRow}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );

      case 'preview-quote':
        return (
          <PreviewQuoteStep
            state={state}
            updateState={updateState}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );

      case 'preview-so':
        return (
          <PreviewSalesOrderStep
            state={state}
            updateState={updateState}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );

      case 'preview-fulfillment':
        return (
          <PreviewFulfillmentStep
            state={state}
            updateState={updateState}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        );

      case 'complete':
        return <CompleteStep state={state} onClose={handleClose} />;

      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const currentStepConfig = STEPS[currentStepIndex]!;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold">Import Historical Data</div>
              <div className="text-sm text-muted-foreground font-normal mt-1">
                Step {currentStepIndex + 1} of {STEPS.length}: {currentStepConfig.title}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 text-center ${
                  index === currentStepIndex
                    ? 'text-primary font-semibold'
                    : index < currentStepIndex
                    ? 'text-green-600'
                    : ''
                }`}
              >
                {index < currentStepIndex ? '✓' : index + 1}. {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}
