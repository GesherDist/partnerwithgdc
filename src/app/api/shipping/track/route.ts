/**
 * Container Tracking API
 *
 * Manual/on-demand container tracking using CMA CGM API
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  trackContainer,
  isCmaCgmConfigured,
} from '@/features/shipping/services';

/**
 * GET /api/shipping/track?container=CMAU1234567
 *
 * Track a single container and return current status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerNumber = searchParams.get('container');

    if (!containerNumber) {
      return NextResponse.json(
        { error: 'Container number required. Use ?container=CMAU1234567' },
        { status: 400 }
      );
    }

    // Check if CMA CGM is configured
    if (!isCmaCgmConfigured()) {
      return NextResponse.json({
        success: false,
        containerNumber,
        error: 'CMA CGM API key not configured',
        configured: false,
      });
    }

    // Track the container
    const result = await trackContainer(containerNumber);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          containerNumber,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      containerNumber,
      eventsCount: result.events?.length || 0,
      latestEvent: result.latestEvent
        ? {
            eventType: result.latestEvent.eventType,
            eventCode:
              result.latestEvent.eventType === 'EQUIPMENT'
                ? (result.latestEvent as { equipmentEventTypeCode: string })
                    .equipmentEventTypeCode
                : (result.latestEvent as { transportEventTypeCode: string })
                    .transportEventTypeCode,
            eventDateTime:
              result.latestEvent.eventDateTime ||
              result.latestEvent.eventCreatedDateTime,
            classifier: result.latestEvent.eventClassifierCode,
          }
        : null,
      mappedStatus: result.mappedStatus,
      allEvents: result.events?.map((e) => ({
        eventType: e.eventType,
        eventCode:
          e.eventType === 'EQUIPMENT'
            ? (e as { equipmentEventTypeCode: string }).equipmentEventTypeCode
            : (e as { transportEventTypeCode: string }).transportEventTypeCode,
        eventDateTime: e.eventDateTime || e.eventCreatedDateTime,
        classifier: e.eventClassifierCode,
      })),
    });
  } catch (error) {
    console.error('[Track API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
