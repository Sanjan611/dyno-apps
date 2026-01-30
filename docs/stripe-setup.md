# Stripe Integration Setup Guide

This guide walks you through setting up Stripe for credit purchases in Dyno Apps.

## Enabling Credit Purchases

Credit purchases are controlled by a **server-side feature flag**. To enable:

```bash
# In .env.local
FEATURE_BUY_CREDITS=true
```

When disabled (default), the "Buy Credits" UI is completely hidden from users. The flag is server-side only and not exposed to the client JavaScript bundle.

## Overview

The integration uses **Stripe Checkout** (hosted payment page) for secure, PCI-compliant payments. Users select a credit package, get redirected to Stripe's payment page, and credits are added automatically via webhook after successful payment.

## Credit Packages

| Package | Credits | Price | Value |
|---------|---------|-------|-------|
| Starter Pack | 50 | $5.00 | $0.10/credit |
| Popular Pack | 100 | $9.00 | $0.09/credit (10% savings) |
| Pro Pack | 250 | $20.00 | $0.08/credit (20% savings) |

---

## Setup Instructions

### Step 1: Create Stripe Account

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up or log in
3. You'll start in **Test Mode** (toggle in top-right shows "Test mode")

### Step 2: Create Products & Prices

1. Go to **Products** → **Add product**
2. Create a product called **"Dyno Apps Credits"**
3. Add three **one-time prices** (not recurring):

| Price Name | Amount |
|------------|--------|
| Starter Pack | $5.00 |
| Popular Pack | $9.00 |
| Pro Pack | $20.00 |

4. After creating each price, click on it and copy the **Price ID** (starts with `price_`)

### Step 3: Get API Keys

1. Go to **Developers** → **API keys**
2. Copy the **Secret key** (starts with `sk_test_` in test mode)

### Step 4: Configure Environment Variables

Add these to your `.env.local`:

```bash
# Stripe API
STRIPE_SECRET_KEY=sk_test_your_key_here

# Stripe Price IDs (from Step 2)
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_POPULAR=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx

# Webhook Secret (from Step 5)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 5: Apply Database Migration

The `credit_purchases` table stores purchase history. Apply the migration:

**Option A - Via Supabase Dashboard:**
1. Go to your Supabase project → **SQL Editor**
2. Open and run: `supabase/migrations/20260130100000_add_credit_purchases.sql`

**Option B - Via CLI (if linked):**
```bash
supabase db push
```

---

## Local Development Testing

### Set Up Webhook Forwarding

Stripe webhooks need to reach your local server. Use the Stripe CLI:

1. **Install Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows (scoop)
   scoop install stripe

   # Linux
   # Download from https://github.com/stripe/stripe-cli/releases
   ```

2. **Log in to Stripe:**
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server:**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Copy the webhook signing secret** displayed (starts with `whsec_`) and add it to `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

> **Important:** Keep this terminal running while testing. The webhook secret changes each time you run `stripe listen`.

### Test Cards

Use these test card numbers (any future expiry date, any 3-digit CVC):

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Declined card | `4000 0000 0000 0002` |
| Requires authentication (3D Secure) | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |

### Test the Complete Flow

1. **Start the dev server:**
   ```bash
   pnpm dev
   ```

2. **In another terminal, start webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **Test a purchase:**
   - Click the user icon → **Buy Credits**
   - Select a package
   - Use test card: `4242 4242 4242 4242`
   - Complete payment

4. **Verify:**
   - You should be redirected to `/purchase/success`
   - Check your credit balance increased
   - Check the `credit_purchases` table in Supabase
   - Check the terminal running `stripe listen` for webhook events

### Test Webhook Idempotency

Stripe may send webhooks multiple times. Test that duplicate webhooks don't double-credit:

```bash
# Resend the last webhook event
stripe events resend evt_xxxxxxxxxxxxx
```

Verify that credits are NOT added twice.

---

## Production Setup

### Step 1: Switch to Live Mode

1. In Stripe Dashboard, toggle off **Test mode** (top-right)
2. Go to **Developers** → **API keys**
3. Copy the **Live Secret key** (starts with `sk_live_`)

### Step 2: Create Live Prices

Create the same products/prices in live mode (test mode prices don't carry over).

### Step 3: Configure Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL:** `https://yourdomain.com/api/stripe/webhook`
   - **Events to send:** Select `checkout.session.completed`
4. Click **Add endpoint**
5. Copy the **Signing secret** from the endpoint details

### Step 4: Update Production Environment Variables

In your production environment (Vercel, etc.):

```bash
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx
STRIPE_PRICE_POPULAR=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx
```

### Step 5: Test with Real Card

Make a small test purchase with a real card to verify everything works.

---

## Troubleshooting

### Webhook not receiving events

1. Check that `stripe listen` is running (local dev)
2. Verify the webhook URL is correct in Stripe Dashboard (production)
3. Check the webhook signing secret matches your environment variable

### "Invalid signature" error

- The webhook secret (`STRIPE_WEBHOOK_SECRET`) doesn't match
- For local dev: copy the secret from `stripe listen` output
- For production: copy from Stripe Dashboard → Webhooks → endpoint → Signing secret

### Credits not added after payment

1. Check the webhook logs in Stripe Dashboard
2. Check your server logs for errors
3. Verify the `checkout.session.completed` event is being received
4. Check that `userId` is in the session metadata

### Duplicate credits

This shouldn't happen due to idempotency checks, but if it does:
1. Check `credit_purchases` table for duplicate `stripe_event_id` entries
2. Review webhook handler logs

---

## Architecture Reference

### Files

| File | Purpose |
|------|---------|
| `lib/stripe/client.ts` | Stripe SDK initialization |
| `lib/stripe/packages.ts` | Credit package definitions |
| `app/api/stripe/checkout/route.ts` | Creates Checkout sessions |
| `app/api/stripe/webhook/route.ts` | Handles payment webhooks |
| `components/credits/PurchaseCreditsModal.tsx` | Package selection UI |
| `app/billing/page.tsx` | Purchase history page |

### Flow Diagram

```
User clicks "Buy Credits"
        ↓
Modal shows packages
        ↓
User selects package
        ↓
POST /api/stripe/checkout
        ↓
Stripe Checkout Session created
        ↓
User redirected to Stripe
        ↓
User completes payment
        ↓
Stripe sends webhook → POST /api/stripe/webhook
        ↓
Webhook verifies signature
        ↓
Credits added via addCredits()
        ↓
Purchase recorded in credit_purchases table
        ↓
User redirected to /purchase/success
```

### Security Features

1. **Webhook signature verification** - Prevents fake webhook attacks
2. **Idempotency via stripe_event_id** - Prevents duplicate credit grants
3. **Server-side only crediting** - Never trusts client-side confirmation
4. **RLS on purchases table** - Users only see their own history
