# Stripe Elements Checkout Demo (Phase 3 Transaction Engine)

Quick and dirty React SPA that emulates the **browser side** of the two Phase 3 checkouts described in `app-flows-phase-3-transaction-engine.md`: the immediate charge (Diagram 5, verified in `curl-log-phase-3-immediate-charge.md`) and the free trial (Diagram 6).

It starts from the moment you already have the client secret. You create the subscription server side, read the confirmation secret, paste it here, and the SPA mounts the payment UI and confirms — with a card through the Payment Element, or with an IBAN through SEPA Direct Debit. There is no backend in this repo; you make the Stripe API calls yourself.

## Pick the flow first

The first screen asks which checkout you are emulating, because the Payment Element is mounted and confirmed differently for each:

| Flow | Client secret | Retrieve | Confirm |
|------|---------------|----------|---------|
| Immediate charge (Diagram 5) | `pi_..._secret_...` from `latest_invoice.confirmation_secret.client_secret` | `stripe.retrievePaymentIntent` | `stripe.confirmPayment` |
| Free trial (Diagram 6) | `seti_..._secret_...` from `pending_setup_intent.client_secret` | `stripe.retrieveSetupIntent` | `stripe.confirmSetup` |

Crossing them is a hard error, not a degraded experience — Stripe.js throws `IntegrationError: Invalid value for stripe.retrievePaymentIntent intent secret: value should be a PaymentIntent client secret. You specified: a SetupIntent client secret.` The setup form validates the `pi_` / `seti_` prefix against the chosen flow and offers to switch, so the mismatch never reaches Stripe.js.

## What it shows

1. You pick the flow, then paste the platform publishable key and the client secret.
2. The SPA retrieves the intent (client-side call, allowed with just the publishable key) to show the amount or the trial notice, plus the intent id, status, and `payment_method_types`.
3. It mounts the payment UI you pick on the tabs: the `PaymentElement` with `Elements options={{ clientSecret }}`, or the `IbanElement` for SEPA Direct Debit.
4. On submit it calls `confirmPayment` / `confirmSetup`, or `confirmSepaDebitPayment` / `confirmSepaDebitSetup`, with `redirect: 'if_required'`.
5. It shows the resulting intent status. The subscription activates on the `invoice.paid` webhook (server side, not shown here); for a trial, that webhook fires when the trial ends.

## Card or SEPA

Each flow offers two ways to collect the details, on tabs above the form. Both confirm the *same* intent against the same client secret:

| Tab | Element | Immediate charge | Free trial |
|-----|---------|------------------|------------|
| Payment Element | `PaymentElement` | `stripe.confirmPayment` | `stripe.confirmSetup` |
| SEPA Direct Debit | `IbanElement` | `stripe.confirmSepaDebitPayment` | `stripe.confirmSepaDebitSetup` |

The Payment Element grows a **SEPA tab of its own** — IBAN field, name, email and mandate, all rendered by Stripe — as soon as the intent allows `sepa_debit`. That is the path Stripe recommends, and it needs no client code. The dedicated SEPA tab is the explicit alternative: it collects the IBAN itself, so you can see the pieces the Payment Element hides, and it works against an intent the Payment Element would only offer cards for.

Both need `sepa_debit` on the intent's `payment_method_types`, and that is a server-side and Dashboard matter, not something the browser can fix. The SPA reads `payment_method_types` off the retrieved intent, shows it in the summary, and warns on the SEPA tab when it is missing, rather than letting the confirm call be the first hint.

### Enable it on the connected account, not the platform

These are destination charges with `on_behalf_of`, which makes the **connected account** the merchant of record. Stripe's rule: *"For charges where the connected account is the MoR, including direct charges and indirect charges that have `on_behalf_of` set, the payment method must be enabled on the connected account."*

There are two layers, and SEPA needs both:

| Layer | Controls | Where |
|-------|----------|-------|
| `sepa_debit_payments` capability | Whether the account *can* process SEPA at all | Account create/update call |
| Payment method configuration | Whether dynamic payment methods *offer* SEPA | Settings → Connect → Payment methods → [Connected accounts](https://dashboard.stripe.com/settings/payment_methods/connected_accounts) |

The page that matters for the second is the **connected accounts** configuration, not the platform's own payment method settings, where everything will already look correct.

For the first: request the capability when you create the account. Express and Custom accounts do not get payment method capabilities by default the way full-Dashboard accounts do, so this is required, not a shortcut. In Accounts v2 it sits beside `card_payments`:

```json
"configuration": {
  "merchant": {
    "capabilities": {
      "card_payments": { "requested": true },
      "sepa_debit_payments": { "requested": true }
    }
  }
}
```

For Express accounts SEPA adds no verification requirements beyond `card_payments`, so this costs nothing at onboarding. Check where it landed with:

```bash
curl -G https://api.stripe.com/v2/core/accounts/acct_xxx \
  -u "$STRIPE_KEY:" \
  -H "Stripe-Version: 2025-12-15.preview" \
  -d "include[0]=configuration.merchant" \
  -d "include[1]=requirements"
# -> capabilities.sepa_debit_payments.status should be "active"
```

Once both layers are on, the subscription call needs no changes: dynamic payment methods pick SEPA up on their own.

### Not sepa_bank_transfer_payments

The Dashboard lists `sepa_bank_transfer_payments` right next to the capability you want. It is a different product and it cannot serve these flows:

| | `sepa_debit_payments` | `sepa_bank_transfer_payments` |
|---|---|---|
| Payment method | SEPA Direct Debit | SEPA Credit Transfer |
| Direction | Pull, against a mandate | Push, customer sends to a virtual IBAN |
| API enum | `sepa_debit` | `customer_balance` |
| SetupIntents | Supported | Unsupported |
| `on_behalf_of` | Supported | **Not supported** |

Both of the last two rows rule it out on their own: every flow here sets `on_behalf_of`, and the trial flow mounts a SetupIntent. Bank transfer also confirms nothing in the browser — the customer gets funding instructions, pays days later, and the funds land in a customer balance to be reconciled against the invoice. That is the [invoicing bank transfer flow](https://docs.stripe.com/invoicing/bank-transfer), not a checkout.

### Do not reach for payment_method_types

Setting `payment_settings[payment_method_types][]` explicitly **turns dynamic payment methods off** — you get exactly the list you write and silently lose anything you omit (Klarna and Link, typically). It also does not substitute for enabling the method: *"If you explicitly specify payment methods for each payment, you need to make sure that those payment methods are enabled."* Use it only when you deliberately want to pin the list.

### Other reasons SEPA gets filtered out

- **EUR only.** SEPA does not settle in any other currency.
- **10,000 EUR per transaction**, plus an additional 10,000 EUR weekly limit on new accounts. An invoice above the limit drops SEPA from the dynamic list even when everything else is right.

### Two things behave differently from cards

- **Success is `processing`, not `succeeded`.** SEPA is a delayed notification method: a debit that is going through fine returns `processing` and settles in roughly 2 to 14 business days. `invoice.paid` — and with it the subscription activation — fires then, not at confirm time. Keep listening for `payment_intent.payment_failed`: a direct debit can still be refused after it was accepted.
- **The mandate is not optional copy.** Displaying Stripe's authorisation text is how the customer signs the SEPA mandate, and `billing_details.name` and `billing_details.email` are required at confirm because they go on it. The Payment Element renders its own; the SEPA tab renders it from `src/sepa.js`. Set `VITE_SEPA_CREDITOR_NAME` to your legal entity — it defaults to a placeholder.

## Get the client secret first (your side)

Immediate charge — create the subscription incomplete and expand the confirmation secret (the corrected call from the curl log):

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

Free trial — same subscription, plus a trial, and expand the pending SetupIntent instead. Nothing is due now, so there is no PaymentIntent to confirm:

```bash
curl https://api.stripe.com/v1/subscriptions \
  -u "$STRIPE_KEY:" \
  -d "customer=cus_..." \
  -d "items[0][price]=price_..." \
  -d "trial_period_days=14" \
  -d "payment_behavior=default_incomplete" \
  -d "transfer_data[destination]=acct_..." \
  -d "on_behalf_of=acct_..." \
  -d "application_fee_percent=15" \
  -d "expand[0]=pending_setup_intent"
# -> pending_setup_intent.client_secret is what you paste into the SPA
```

## Run

Requires Node 18+ (tested on Node 24).

```bash
npm install
cp .env.example .env   # optional: prefill the publishable key and the SEPA creditor name
npm run dev
```

Open http://localhost:5173.

## Test cards

| Scenario | Card |
|----------|------|
| Success, no authentication | 4242 4242 4242 4242 |
| Requires 3DS / SCA | 4000 0027 6000 3184 |

Any future expiry, any CVC, any postal code.

## Test IBANs

| Scenario | IBAN |
|----------|------|
| Succeeds | DE89370400440532013000 |
| Fails, back to `requires_payment_method` | DE62370400440532013001 |
| Succeeds, then disputed | DE35370400440532013002 |
| Succeeds (Austria) | AT611904300234573201 |

These work in both the Payment Element's SEPA tab and the dedicated one. The full table, including the delayed-success and limit-breach IBANs and the other SEPA countries, is in the [Stripe testing docs](https://docs.stripe.com/testing?testing-method=payment-methods#sepa-direct-debit).

## Notes

- **Platform publishable key.** This is a Connect destination charge (`on_behalf_of`), processed on the platform, so initialize Stripe.js with the platform publishable key and do not set `stripeAccount`.
- **Client secret type.** For the immediate charge flow the confirmation secret is a `payment_intent` secret (`pi_..._secret_...`). The trial flow has no amount due, so there you mount a SetupIntent secret (`seti_..._secret_...`) and confirm with `confirmSetup`. If your account returns `latest_invoice.confirmation_secret` on a zero-amount trial invoice, it is a `setup_intent` secret — same `seti_` prefix, same flow in this SPA.
- **Ephemeral.** The client secret is scoped to one payment attempt and its incomplete subscription auto-expires after roughly 23h. Grab a fresh one if it stops working.
