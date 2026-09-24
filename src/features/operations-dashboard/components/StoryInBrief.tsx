'use client';

/**
 * Story In Brief Component
 *
 * Executive summary text that explains the current inventory status.
 */

import { Info } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';

// ============================================
// TYPES
// ============================================

interface StoryInBriefProps {
  content: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function StoryInBrief({ content }: StoryInBriefProps) {
  return (
    <Alert className="bg-blue-50 border-blue-200">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800">Story in Brief</AlertTitle>
      <AlertDescription className="text-blue-700 mt-1">
        {content}
      </AlertDescription>
    </Alert>
  );
}
