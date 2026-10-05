/**
 * IMPORT HISTORICAL DATA BUTTON
 * ==============================
 * Button to open the import wizard
 */

'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Upload } from 'lucide-react';
import { ImportWizardModal } from './ImportWizardModal';

export function ImportHistoricalDataButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <Upload className="w-4 h-4 mr-2" />
        Import Historical Data
      </Button>

      <ImportWizardModal open={open} onOpenChange={setOpen} />
    </>
  );
}
