# Stripe Elements Checkout Demo (Phase 3.1 Immediate Charge)

Quick and dirty React SPA that emulates the **browser side** of the immediate charge checkout described in `app-flows-phase-3-transaction-engine.md` (Diagram 5) and verified in `curl-log-phase-3-immediate-charge.md`.

It starts from the moment you already have the client secret. You create the incomplete subscription server side, read `latest_invoice.confirmation_secret.client_secret`, paste it here, and the SPA mounts the Payment Element and confirms the payment. There is no backend in this repo; you make the Stripe API calls yourself.

## What it shows

1. You paste the platform publishable key and the invoice `confirmation_secret.client_secret`.
2. The SPA calls `stripe.retrievePaymentIntent(clientSecret)` to show the amount and status.
3. It mounts the `PaymentElement` with `Elements options={{ clientSecret }}`.
4. On submit it calls `stripe.confirmPayment({ elements, redirect: 'if_required' })`.
5. It shows the resulting PaymentIntent status. The subscription activates on the `invoice.paid` webhook (server side, not shown here).

## Get the client secret first (your side)

Create the subscription incomplete and expand the confirmation secret (the corrected call from the curl log):

```bash
curl https://api.stripe.com/v1/subscriptions \
  -u "$STRIPE_KEY:" \
  -d "customer=cus_..." \
  -d "items[0][price]=price_..." \
  -d "items[0][tax_rates][0]=txr_..." \
  -d "payment_behavior=default_incomplete" \
  -d "transfer_data[destination]=acct_..." \
  -d "on_behalf_of=acct_..." \
  -d "application_fee_percent=15" \
  -d "expand[0]=latest_invoice.confirmation_secret"
# -> latest_invoice.confirmation_secret.client_secret is what you paste into the SPA
```

## Run

Requires Node 18+ (tested on Node 24).

```bash
npm install
cp .env.example .env   # optional: set VITE_STRIPE_PUBLISHABLE_KEY to prefill the key
npm run dev
```

Open http://localhost:5173.

## Test cards

| Scenario | Card |
|----------|------|
| Success, no authentication | 4242 4242 4242 4242 |
| Requires 3DS / SCA | 4000 0027 6000 3184 |

Any future expiry, any CVC, any postal code.

## Notes

- **Platform publishable key.** This is a Connect destination charge (`on_behalf_of`), processed on the platform, so initialize Stripe.js with the platform publishable key and do not set `stripeAccount`.
- **Client secret type.** For the immediate charge flow the confirmation secret is a `payment_intent` secret (`pi_..._secret_...`). The trial flow (Diagram 6) has no amount due, so there you mount a SetupIntent secret instead.
- **Ephemeral.** The client secret is scoped to one payment attempt and its incomplete subscription auto-expires after roughly 23h. Grab a fresh one if it stops working.
