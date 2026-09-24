# Email Templates for Supabase

This folder contains professional HTML email templates for the Gesher Distribution platform.

## Templates

| Template | File | Supabase Template Type |
|----------|------|------------------------|
| User Invitation | `invitation-email.html` | **Invite user** |
| Password Reset | `password-reset-email.html` | **Reset password** |

## How to Configure in Supabase

### Step 1: Open Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Email Templates**

### Step 2: Update Invite User Template
1. Click on **Invite user** tab
2. Copy the entire content from `invitation-email.html`
3. Paste it into the **Message body** field
4. Set **Subject**: `You've Been Invited to Gesher Distribution`
5. Click **Save**

### Step 3: Update Reset Password Template
1. Click on **Reset password** tab
2. Copy the entire content from `password-reset-email.html`
3. Paste it into the **Message body** field
4. Set **Subject**: `Reset Your Password - Gesher Distribution`
5. Click **Save**

## Template Variables

Supabase provides these variables that are automatically replaced:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The confirmation/action link |
| `{{ .Email }}` | User's email address |
| `{{ .Token }}` | The raw token (if needed) |
| `{{ .TokenHash }}` | Hashed token |
| `{{ .SiteURL }}` | Your site URL |

## Preview

### Invitation Email
- Professional dark header with Gesher branding
- Welcome message with clear CTA button
- Step-by-step guide for new users
- Expiration warning (24 hours)

### Password Reset Email
- Security-focused design with lock icon
- Clear "Reset Password" CTA
- Password security tips
- "Didn't request this?" notice
- Expiration warning (1 hour)

## Customization

To customize these templates:
1. Edit the HTML files in this folder
2. Test in browser by opening the HTML file
3. Copy updated content to Supabase Dashboard

### Brand Colors Used
- Primary Dark: `#1e293b` (Header background)
- Primary Blue: `#2563eb` (Buttons)
- Text: `#1e293b` (Headings), `#64748b` (Body)
- Background: `#f4f4f5` (Page), `#ffffff` (Card)
