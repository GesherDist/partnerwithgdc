/**
 * Inbound Email Types
 *
 * Types for Postmark inbound email webhook payloads and database models.
 */

// ============================================
// POSTMARK WEBHOOK PAYLOAD TYPES
// ============================================

/**
 * Email address with name
 */
export interface PostmarkEmailAddress {
  Email: string;
  Name: string;
  MailboxHash?: string;
}

/**
 * Email attachment from Postmark
 */
export interface PostmarkAttachment {
  Name: string;
  Content: string; // Base64 encoded content
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
}

/**
 * Email header
 */
export interface PostmarkHeader {
  Name: string;
  Value: string;
}

/**
 * Full Postmark inbound email webhook payload
 */
export interface PostmarkInboundPayload {
  // Basic fields
  From: string;
  FromName?: string;
  FromFull?: PostmarkEmailAddress;
  To: string;
  ToFull?: PostmarkEmailAddress[];
  Cc?: string;
  CcFull?: PostmarkEmailAddress[];
  Bcc?: string;
  BccFull?: PostmarkEmailAddress[];
  ReplyTo?: string;

  // Email content
  Subject?: string;
  MessageID?: string;
  Date?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;

  // Attachments
  Attachments?: PostmarkAttachment[];

  // Headers
  Headers?: PostmarkHeader[];

  // Metadata
  Tag?: string;
  MailboxHash?: string;
  OriginalRecipient?: string;

  // Raw email (if "Include raw email content" is enabled)
  RawEmail?: string;
}

// ============================================
// DATABASE MODEL TYPES
// ============================================

/**
 * Inbound email status
 */
export type InboundEmailStatus =
  | 'received'
  | 'attachments_processed'
  | 'extracted'
  | 'processed'
  | 'failed'
  | 'ignored';

/**
 * Inbound email database record
 */
export interface InboundEmail {
  id: string;
  message_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string;
  to_local_part: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  received_at: string;
  raw_payload: PostmarkInboundPayload;
  has_attachments: boolean;
  status: InboundEmailStatus;
  created_at: string;
  updated_at: string;
  // Attachment counts (populated by query)
  total_pdf_attachments?: number;
  processed_pdf_attachments?: number;
}

/**
 * Inbound email attachment database record
 */
export interface InboundEmailAttachment {
  id: string;
  inbound_email_id: string;
  filename: string;
  mime_type: string;
  size: number;
  stored_path: string | null;
  storage_url: string | null;
  is_pdf: boolean;
  extracted_data: Record<string, unknown> | null;
  quote_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Inbound email with attachments
 */
export interface InboundEmailWithAttachments extends InboundEmail {
  attachments: InboundEmailAttachment[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Webhook response
 */
export interface WebhookResponse {
  success: boolean;
  message?: string;
  emailId?: string;
  error?: string;
}

/**
 * List inbound emails response
 */
export interface InboundEmailListResponse {
  data: InboundEmail[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
