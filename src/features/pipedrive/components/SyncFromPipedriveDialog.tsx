'use client';

/**
 * SyncFromPipedriveDialog Component
 *
 * Dialog for syncing leads/customers from Pipedrive.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Check, AlertCircle, Users } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Progress } from '@/shared/components/ui/progress';

import { syncFromPipedrive, checkPipedriveConnection } from '../actions';

// ============================================
// TYPES
// ============================================

interface SyncFromPipedriveDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  syncType: 'leads' | 'customers';
}

interface SyncPreview {
  newCount: number;
  updateCount: number;
  skipCount: number;
  items: Array<{
    id: number;
    name: string;
    email?: string;
    company?: string;
    status: 'new' | 'update' | 'skip';
    existingId?: string;
  }>;
}

type SyncStep = 'checking' | 'preview' | 'syncing' | 'complete' | 'error';

// ============================================
// COMPONENT
// ============================================

export function SyncFromPipedriveDialog({
  open,
  onClose,
  onSuccess,
  syncType,
}: SyncFromPipedriveDialogProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [step, setStep] = useState<SyncStep>('checking');
  const [isConnected, setIsConnected] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  useEffect(() => {
    if (open) {
      checkConnection();
    } else {
      // Reset state when closed
      setStep('checking');
      setPreview(null);
      setSelectedIds(new Set());
      setProgress(0);
      setResult(null);
      setError(null);
    }
  }, [open]);

  // ----------------------------------------
  // ACTIONS
  // ----------------------------------------

  const checkConnection = async () => {
    setStep('checking');
    try {
      const result = await checkPipedriveConnection();
      if (result.success && result.data?.connected) {
        setIsConnected(true);
        await fetchPreview();
      } else {
        setIsConnected(false);
        setError('Pipedrive is not connected. Please connect in Settings first.');
        setStep('error');
      }
    } catch (err) {
      console.error('Check connection error:', err);
      setError('Failed to check Pipedrive connection');
      setStep('error');
    }
  };

  const fetchPreview = async () => {
    try {
      const result = await syncFromPipedrive({ preview: true, syncType });
      if (result.success && result.data) {
        const previewData: SyncPreview = {
          newCount: result.data.created || 0,
          updateCount: result.data.updated || 0,
          skipCount: result.data.skipped || 0,
          items: result.data.items || [],
        };
        setPreview(previewData);
        // Select all new items by default
        const newIds = new Set(
          previewData.items
            .filter((item) => item.status === 'new')
            .map((item) => item.id)
        );
        setSelectedIds(newIds);
        setStep('preview');
      } else {
        setError(result.error || 'Failed to fetch preview');
        setStep('error');
      }
    } catch (err) {
      console.error('Fetch preview error:', err);
      setError('Failed to fetch data from Pipedrive');
      setStep('error');
    }
  };

  const handleSync = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one item to sync');
      return;
    }

    setStep('syncing');
    setProgress(0);

    try {
      const result = await syncFromPipedrive({
        preview: false,
        syncType,
        selectedIds: Array.from(selectedIds),
        onProgress: (p) => setProgress(p),
      });

      if (result.success && result.data) {
        setResult({
          created: result.data.created || 0,
          updated: result.data.updated || 0,
          deleted: result.data.deleted || 0,
          errors: result.data.errors || [],
        });
        setStep('complete');
        onSuccess?.();
      } else {
        setError(result.error || 'Sync failed');
        setStep('error');
      }
    } catch (err) {
      console.error('Sync error:', err);
      setError('Sync failed unexpectedly');
      setStep('error');
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!preview) return;
    const allIds = preview.items.filter((i) => i.status !== 'skip').map((i) => i.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  const title = syncType === 'leads' ? 'Sync Leads from Pipedrive' : 'Sync Customers from Pipedrive';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {syncType === 'leads'
              ? 'Import persons from Pipedrive as leads.'
              : 'Import won deals from Pipedrive as customers.'}
          </DialogDescription>
        </DialogHeader>

        {/* Checking Connection */}
        {step === 'checking' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Connecting to Pipedrive...</p>
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-sm">
                {preview.newCount} New
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {preview.updateCount} Updates
              </Badge>
              <Badge variant="outline" className="text-sm">
                {preview.skipCount} Skipped
              </Badge>
            </div>

            {/* Items List */}
            {preview.items.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-4 space-y-2">
                  {/* Select All */}
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      checked={
                        selectedIds.size ===
                        preview.items.filter((i) => i.status !== 'skip').length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>

                  {/* Items */}
                  {preview.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2 border-b last:border-0"
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        disabled={item.status === 'skip'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.name}</span>
                          <Badge
                            variant={
                              item.status === 'new'
                                ? 'default'
                                : item.status === 'update'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {item.status === 'new'
                              ? 'NEW'
                              : item.status === 'update'
                              ? 'UPDATE'
                              : 'SKIP'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {item.email || item.company || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p>No items found in Pipedrive</p>
              </div>
            )}
          </div>
        )}

        {/* Syncing */}
        {step === 'syncing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Syncing {selectedIds.size} items...</p>
            <Progress value={progress} className="w-64" />
            <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && result && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Sync Complete!</h3>
            <div className="flex items-center gap-4">
              <Badge variant="default">{result.created} Created</Badge>
              <Badge variant="secondary">{result.updated} Updated</Badge>
              {result.deleted > 0 && (
                <Badge variant="destructive">{result.deleted} Deleted</Badge>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="text-sm text-destructive">
                {result.errors.length} errors occurred
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold">Sync Failed</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {error}
            </p>
            {!isConnected && (
              <Button variant="outline" onClick={() => window.location.href = '/settings'}>
                Go to Settings
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSync}
                disabled={selectedIds.size === 0}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Import {selectedIds.size} Items
              </Button>
            </>
          )}
          {(step === 'complete' || step === 'error') && (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
