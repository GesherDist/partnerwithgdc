/**
 * Support Request API Route
 *
 * POST /api/support - Help & Support widget message
 *
 * Request: FormData with 'message', 'pagePath', 'pageUrl' and up to 5 'files'
 * Files are stored in AWS S3; the message is saved and emailed to SUPPORT_EMAIL.
 * Any logged-in user can send one (no extra permission).
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  badRequestResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { getCurrentUser } from '@/shared/lib/auth';
import {
  supportService,
  SUPPORT_FILE_TYPES,
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MAX_MESSAGE,
  type SupportFile,
} from '@/features/support/services/support.service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse('Please sign in again to send a message');
    }

    const formData = await request.formData();
    const message = String(formData.get('message') ?? '').trim();
    const pagePath = String(formData.get('pagePath') ?? '').slice(0, 500);
    const pageUrl = String(formData.get('pageUrl') ?? '').slice(0, 2000);
    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

    if (!message) {
      return badRequestResponse('Please write a message');
    }
    if (message.length > SUPPORT_MAX_MESSAGE) {
      return badRequestResponse(`Message is longer than ${SUPPORT_MAX_MESSAGE} characters`);
    }
    if (files.length > SUPPORT_MAX_FILES) {
      return badRequestResponse(`You can attach up to ${SUPPORT_MAX_FILES} files`);
    }
    for (const file of files) {
      if (!SUPPORT_FILE_TYPES.includes(file.type)) {
        return badRequestResponse(`${file.name}: only images (PNG, JPG, GIF, WebP) and PDF files`);
      }
      if (file.size > SUPPORT_MAX_FILE_BYTES) {
        return badRequestResponse(`${file.name} is larger than 5 MB`);
      }
    }

    const supportFiles: SupportFile[] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        buffer: Buffer.from(await file.arrayBuffer()),
      }))
    );

    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    const result = await supportService.createRequest({
      sender: { id: user.id, name, email: user.email },
      message,
      pagePath,
      pageUrl,
      files: supportFiles,
    });

    if (!result.success) {
      return internalErrorResponse(result.error);
    }
    return successResponse(result.data);
  } catch (error) {
    console.error('POST /api/support error:', error);
    return internalErrorResponse('Your message could not be sent. Please try again.');
  }
}
