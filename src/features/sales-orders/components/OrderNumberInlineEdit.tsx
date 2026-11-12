'use client';

/**
 * OrderNumberInlineEdit
 *
 * The order number in the sales order drawer, with a pencil to change it in
 * place (Ankur, Nov 11 2026: "unable to edit Sales Order numbers manually").
 * ✓ saves, ✕ (or Esc) leaves the number as it was. Works in any status except
 * cancelled; items, allocations, POs and shipments stay on the order.
 */

import { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

import { changeSalesOrderNumber } from '../actions';

interface OrderNumberInlineEditProps {
  orderId: string;
  orderNumber: string;
  /** Show the pencil (permission and status checked by the caller) */
  canEdit: boolean;
  onSaved: () => void;
}

export function OrderNumberInlineEdit({ orderId, orderNumber, canEdit, onSaved }: OrderNumberInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(orderNumber);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setValue(orderNumber);
    setError(null);
    setIsEditing(true);
  };

  const cancel = () => {
    if (isSaving) {
      return;
    }
    setValue(orderNumber);
    setError(null);
    setIsEditing(false);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('The number cannot be empty.');
      return;
    }
    if (trimmed === orderNumber) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await changeSalesOrderNumber(orderId, trimmed);
      if (result.success) {
        toast.success(`Sales order number changed: ${orderNumber} → ${trimmed}`);
        setIsEditing(false);
        onSaved();
      } else {
        setError(result.error || 'Failed to change the sales order number');
      }
    } catch (err) {
      console.error('Change order number error:', err);
      setError('Failed to change the sales order number');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{orderNumber}</span>
        {canEdit && (
          <button
            type="button"
            onClick={startEdit}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Change order number"
            aria-label="Change order number"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input
          value={value}
          maxLength={50}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          className={`h-8 max-w-[220px] text-sm ${error ? 'border-destructive' : ''}`}
          disabled={isSaving}
          autoFocus
          aria-label="Sales order number"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-green-600 hover:text-green-700"
          onClick={() => void save()}
          disabled={isSaving}
          title="Save"
          aria-label="Save order number"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={cancel}
          disabled={isSaving}
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs font-normal text-destructive">{error}</p>}
    </div>
  );
}
