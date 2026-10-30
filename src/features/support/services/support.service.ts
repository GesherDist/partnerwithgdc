/**
 * Support Request Service
 *
 * Handles a message from the Help & Support widget:
 * 1. Files go to AWS S3 (support-requests/<id>/...), never to Supabase storage
 * 2. The message is saved in support_requests (text + S3 keys only)
 * 3. An email goes to SUPPORT_EMAIL with Reply-To = the user, so replying
 *    from the mailbox reaches them directly
 *
 * A step that fails does not stop the others; the request only fails when
 * the message could neither be saved nor emailed.
 */

import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '@/shared/lib/supabase/database';
import { getS3Client, AWS_S3_BUCKET } from '@/shared/lib/aws/s3-client';

// ============================================
// CONSTANTS
// ============================================

export const SUPPORT_MAX_MESSAGE = 2000;
export const SUPPORT_MAX_FILES = 5;
export const SUPPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SUPPORT_FILE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

/** Postmark allows 10 MB per email; bigger sets are sent as S3 links instead */
const MAX_EMAIL_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days (max allowed by AWS)

// ============================================
// TYPES
// ============================================

export interface SupportSender {
  id: string;
  name: string;
  email: string;
}

export interface SupportFile {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

export interface CreateSupportRequestInput {
  sender: SupportSender;
  message: string;
  pagePath: string;
  pageUrl: string;
  files: SupportFile[];
}

interface StoredAttachment {
  name: string;
  size: number;
  type: string;
  key: string | null;
}

type ServiceResult = { success: true; data: { id: string } } | { success: false; error: string };

// ============================================
// HELPERS
// ============================================

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-120) || 'file';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadFiles(requestId: string, files: SupportFile[]): Promise<StoredAttachment[]> {
  if (files.length === 0) {
    return [];
  }

  let s3: ReturnType<typeof getS3Client> | null = null;
  try {
    s3 = getS3Client();
  } catch (error) {
    console.error('[SupportService] S3 not configured:', error);
  }

  return Promise.all(
    files.map(async (file, index) => {
      const stored: StoredAttachment = { name: file.name, size: file.size, type: file.type, key: null };
      if (!s3) {
        return stored;
      }
      const key = `support-requests/${requestId}/${index + 1}_${safeFilename(file.name)}`;
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.type,
            Metadata: { requestId, uploadedAt: new Date().toISOString() },
          })
        );
        stored.key = key;
      } catch (error) {
        console.error(`[SupportService] Failed to upload ${file.name}:`, error);
      }
      return stored;
    })
  );
}

async function signedLinks(attachments: StoredAttachment[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const uploaded = attachments.filter((a) => a.key);
  if (uploaded.length === 0) {
    return links;
  }
  const s3 = getS3Client();
  await Promise.all(
    uploaded.map(async (a) => {
      try {
        const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: a.key! }), {
          expiresIn: SIGNED_URL_EXPIRY,
        });
        links.set(a.key!, url);
      } catch (error) {
        console.error(`[SupportService] Failed to sign ${a.key}:`, error);
      }
    })
  );
  return links;
}

async function sendSupportEmail(
  requestId: string,
  input: CreateSupportRequestInput,
  attachments: StoredAttachment[]
): Promise<void> {
  const to = process.env.SUPPORT_EMAIL;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!to) {
    throw new Error('SUPPORT_EMAIL is not configured');
  }
  if (!user || !pass) {
    throw new Error('SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)');
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.postmarkapp.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
  const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';

  // Attach the files when they fit in one email, otherwise link to S3
  const totalBytes = input.files.reduce((sum, f) => sum + f.size, 0);
  const attachInline = totalBytes <= MAX_EMAIL_ATTACHMENT_BYTES;
  const links = attachInline ? new Map<string, string>() : await signedLinks(attachments);

  const { sender } = input;
  const fileLines = attachments.map((a) => {
    const link = a.key ? links.get(a.key) : undefined;
    return { label: `${a.name} (${formatSize(a.size)})`, link };
  });

  const text = [
    `From: ${sender.name} <${sender.email}>`,
    `Page: ${input.pagePath}`,
    `URL: ${input.pageUrl}`,
    `Request ID: ${requestId}`,
    '',
    input.message,
    '',
    ...(fileLines.length > 0
      ? [
          attachInline ? 'Attached files:' : 'Files (links valid for 7 days):',
          ...fileLines.map((f) => `- ${f.label}${f.link ? `: ${f.link}` : ''}`),
        ]
      : []),
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937;">
      <p style="margin: 0 0 12px;"><strong>${escapeHtml(sender.name)}</strong> &lt;${escapeHtml(sender.email)}&gt; sent a message from <strong>${escapeHtml(input.pagePath)}</strong>.</p>
      <div style="white-space: pre-wrap; padding: 12px; background: #f3f4f6; border-radius: 6px;">${escapeHtml(input.message)}</div>
      ${
        fileLines.length > 0
          ? `<p style="margin: 16px 0 4px;"><strong>${attachInline ? 'Attached files' : 'Files (links valid for 7 days)'}</strong></p>
             <ul style="margin: 0; padding-left: 20px;">${fileLines
               .map((f) => `<li>${f.link ? `<a href="${escapeHtml(f.link)}">${escapeHtml(f.label)}</a>` : escapeHtml(f.label)}</li>`)
               .join('')}</ul>`
          : ''
      }
      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
        Page URL: ${escapeHtml(input.pageUrl)}<br />
        Request ID: ${requestId}<br />
        Reply to this email to answer ${escapeHtml(sender.name)} directly.
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    replyTo: `"${sender.name}" <${sender.email}>`,
    subject: `Help request from ${sender.name}: ${input.pagePath}`,
    text,
    html,
    attachments: attachInline
      ? input.files.map((f) => ({ filename: f.name, content: f.buffer, contentType: f.type }))
      : undefined,
  });
}

// ============================================
// SERVICE
// ============================================

export const supportService = {
  async createRequest(input: CreateSupportRequestInput): Promise<ServiceResult> {
    const requestId = randomUUID();
    const attachments = await uploadFiles(requestId, input.files);

    // 1. Save the message (text and S3 keys only)
    let saved = false;
    const { error: insertError } = await db.from('support_requests').insert({
      id: requestId,
      user_id: input.sender.id,
      user_name: input.sender.name,
      user_email: input.sender.email,
      message: input.message,
      page_path: input.pagePath,
      page_url: input.pageUrl,
      attachments,
    });
    if (insertError) {
      console.error('[SupportService] Failed to save support request:', insertError);
    } else {
      saved = true;
    }

    // 2. Email support
    let emailError: string | null = null;
    try {
      await sendSupportEmail(requestId, input, attachments);
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Failed to send email';
      console.error('[SupportService] Failed to email support request:', error);
    }

    if (saved) {
      const { error: updateError } = await db
        .from('support_requests')
        .update({
          email_status: emailError ? 'failed' : 'sent',
          email_error: emailError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (updateError) {
        console.error('[SupportService] Failed to update email status:', updateError);
      }
    }

    if (!saved && emailError) {
      return { success: false, error: 'Your message could not be sent. Please try again.' };
    }
    return { success: true, data: { id: requestId } };
  },
};
