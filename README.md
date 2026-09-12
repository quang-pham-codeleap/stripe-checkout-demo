# Stripe Elements Checkout Demo (Phase 3 Transaction Engine)

Quick and dirty React SPA that emulates the **browser side** of the Phase 3 checkouts. Three flows: the proposed EWCS checkout from `ewcs-migration.md`, and the two intent-first flows in production today from `app-flows-phase-3-transaction-engine.md` — the immediate charge (Diagram 5, verified in `curl-log-phase-3-immediate-charge.md`) and the free trial (Diagram 6).

It starts from the moment you already have the client secret. You make the Stripe API call server side, paste the secret here, and the SPA mounts the payment UI and confirms. There is no backend in this repo; you make the Stripe API calls yourself.

## Pick the flow first

The first screen asks which checkout you are emulating, because each mounts a different provider and confirms differently:

| Flow | Client secret | Provider | Confirm |
|------|---------------|----------|---------|
| **EWCS** (proposed) | `cs_..._secret_...` from `checkout.sessions.create` | `CheckoutElementsProvider` | `checkout.confirm` |
| Immediate charge (Diagram 5) | `pi_..._secret_...` from `latest_invoice.confirmation_secret.client_secret` | `Elements` | `stripe.confirmPayment` |
| Free trial (Diagram 6) | `seti_..._secret_...` from `pending_setup_intent.client_secret` | `Elements` | `stripe.confirmSetup` |

Crossing the two intent-first flows is a hard error, not a degraded experience — Stripe.js throws `IntegrationError: Invalid value for stripe.retrievePaymentIntent intent secret: value should be a PaymentIntent client secret. You specified: a SetupIntent client secret.` The setup form validates the `cs_` / `pi_` / `seti_` prefix against the chosen flow and offers to switch, so the mismatch never reaches Stripe.js.

All three stay in the SPA on purpose. The migration is a proposal with an open go/no-go on the invoice footer, and its own rollout note allows a coexistence window that branches on exactly this prefix.

## EWCS: where the commit point moves

The intent-first flows create the subscription **and finalize the first invoice** before the browser sees anything. Finalization snapshots `customer_name`, `customer_address` and `customer_tax_ids`, so nothing typed at checkout can reach invoice 1 — and since a VIES-verified VAT-ID flips 19% to reverse charge, an inline edit would also have to void the invoice and rebuild the subscription.

A `mode=subscription` Checkout Session commits nothing until `confirm()`. There is no Subscription and no Invoice until then, so billing data stays editable and still lands on invoice 1.

```
INTENT-FIRST  resolve tax → createPreview → subscriptions.create → invoice FINALIZED → [form] → confirmPayment
                                                                   ↑ commit point: everything after is frozen

EWCS          resolve tax → checkout.sessions.create → [form, Buyer edits, session re-prices] → confirm()
                                                                                                ↑ commit point
```

### What the EWCS screen does

1. **`CheckoutElementsProvider`**, from the `@stripe/react-stripe-js/checkout` subpath — not the package root, where `CheckoutProvider` / `useCheckout` are deprecated since v6.3.0 and gone in v7. `appearance` moves inside `options.elementsOptions`.
2. **Pre-fill, editable.** The "KundenCenter pre-fill and session options" block on the setup screen stands in for KundenCenter and seeds `options.defaultValues`. In production the backend supplies it.
3. **A reactive order summary.** There is no `createPreview` and no preview DTO — the session *is* the price preview. Amounts are read from `checkout.total`, `checkout.taxAmounts` and `checkout.lineItems`, divided by `checkout.minorUnitsAmountDivisor`. That divisor is what replaces the hard-coded `/100`, which is wrong for zero-decimal (JPY) and three-decimal (BHD) currencies.
4. **The edit loop**, which is the heart of the design — see below.
5. **One confirm.** `checkout.confirm({ returnUrl, redirect: 'if_required' })`. No `elements.submit()`, no client-secret prefix sniffing, no `PAYMENT` / `SETUP` fork: trials are the same flow with `subscription_data[trial_period_days]` on the session.

### The edit loop: 9a and 9b are not interchangeable

**9a, native.** With `BillingAddressElement` and `TaxIdElement` mounted, an address or email edit goes browser → Stripe directly. Stripe re-prices and pushes new totals into every mounted element. No JTL round trip. The email field here calls `checkout.updateEmail()` on blur.

**9b, `runServerUpdate`.** A *manual* `txr_` rate does not re-derive itself — a fixed rate stays fixed no matter what VAT-ID is typed — so reverse charge is only reachable through our backend:

```
VAT-ID or country changes
  → checkout.runServerUpdate(async () => POST …/checkout-session/billing)
  → backend: VIES verify → resolveManualTax → checkout.sessions.update
  → Stripe re-reads the session and pushes the new totals down
```

The backend must resend the **whole** `line_items` array. `tax_rates` alone is a `400: You must provide one of 'price' or 'price_data' for each line item when using prices.` So it holds the cart; it cannot diff one field.

There is no backend in this repo, so leave **Billing endpoint** empty and the round trip is only slept through — `runServerUpdate` and the pending state still run, but nothing is re-priced, because swapping the rate needs a secret key. Point it at a real endpoint (it is POSTed `{ sessionId, vatId, businessName, address }`) to watch the rate actually move.

Two things the SPA does deliberately here:

- **It seeds, then diffs.** Each element emits a change event as it mounts, carrying the identity the session was already created from. That first event is recorded as applied rather than fired on, so page load does not trigger a redundant VIES round trip.
- **It re-resolves on an emptied VAT-ID too, not just a complete one.** Clearing the field has to revert off reverse charge, and an emptied optional field never reports `complete`. Watching only `complete` would leave a 0% rate on a Buyer who deleted the ID that earned it.

### The trap on trials

On a trial session the inline re-price does **not** move `amount_total` — it is €0 before *and* after the tax swap, because the charge is deferred to trial end. The rate genuinely changed; the session total cannot show it. The summary therefore previews **per rate**, and says so on screen. Reading `amount_total` would report "nothing changed" to a Buyer who just entered a valid VAT-ID.

### Two open questions this screen exists to answer

- **Does an existing Customer tax ID suppress the Tax ID Element when mounted explicitly?** Checkout only collects tax IDs on Customers that do not already have one, and we pre-seed the Customer from KundenCenter — which would suppress the field the requirement says must stay editable. `TaxIdElement` is mounted with `visibility: 'always'` and the SPA surfaces the `visible` flag from its change event. No API call can answer this; only a browser can.
- **Firma or person in `name`?** Stripe's contact has one `name`; KundenCenter has Firma, Vorname and Nachname. The **Name field on the BillingAddressElement** selector switches `display.name` between `full`, `split` and `organization` so the choice can be seen rather than argued. Whichever wins is what the first invoice shows as the legal name.

One correction to `ewcs-migration.md` worth noting: it says `BillingAddressElement` takes `allowedCountries` in place of the pinned `BILLING_COUNTRY_CODES = ['DE']`. It does not. The checkout variant's options are only `contacts`, `display` and `fields` (`StripeCheckoutAddressElementOptions`) — `allowedCountries` belongs to the plain Elements `AddressElement`. The country restriction has to be re-expressed server side on the session, not on this element.

## What the intent-first flows show

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

EWCS — create a Checkout Session. Nothing is committed: it comes back with `subscription: null` and `invoice: null`.

```bash
curl https://api.stripe.com/v1/checkout/sessions \
  -u "$STRIPE_KEY:" \
  -d "mode=subscription" \
  -d "ui_mode=custom" \
  -d "customer=cus_..." \
  -d "line_items[0][price]=price_..." \
  -d "line_items[0][quantity]=1" \
  -d "line_items[0][tax_rates][0]=txr_..." \
  -d "subscription_data[metadata][tenantId]=..." \
  -d "subscription_data[transfer_data][destination]=acct_..." \
  -d "subscription_data[on_behalf_of]=acct_..." \
  -d "billing_address_collection=required" \
  -d "tax_id_collection[enabled]=true" \
  -d "customer_update[address]=auto" \
  -d "customer_update[name]=auto" \
  -d "payment_method_collection=always" \
  -d "return_url=http://localhost:5173"
# -> client_secret (cs_..._secret_...) is what you paste into the SPA
```

Trial plans add `subscription_data[trial_period_days]=N` and nothing else — same flow, same confirm.

Four things here are easy to get wrong and silent when wrong:

- **`ui_mode=custom`, not `elements`.** `elements` needs API version `2026-03-25.dahlia`; on the pinned `2025-08-27.basil` it is rejected outright.
- **`subscription_data[metadata]`, not top-level `metadata`.** Session-level metadata stays on the Session and never reaches the Subscription, which is where the webhook handler reads it.
- **`application_fee_percent` goes under `subscription_data`.** Top-level is a 400.
- **The updatable surface is tiny.** `subscription_data`, `customer_update`, `billing_address_collection`, `payment_method_collection`, `tax_id_collection` and `return_url` are all `400 parameter_unknown` on update. Anything that must be editable has to be right at create time.

To unwind a session (the duplicate-subscription guard) use `POST /v1/checkout/sessions/{id}/expire` — much cheaper than cancelling an incomplete subscription, because there is nothing to unwind.

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
cp .env.example .env   # optional: prefill the publishable key, the SEPA creditor name, the billing endpoint
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
- **Client secret type.** EWCS mounts a Checkout Session secret (`cs_..._secret_...`) and never an intent secret. For the immediate charge flow the confirmation secret is a `payment_intent` secret (`pi_..._secret_...`). The trial flow has no amount due, so there you mount a SetupIntent secret (`seti_..._secret_...`) and confirm with `confirmSetup`. If your account returns `latest_invoice.confirmation_secret` on a zero-amount trial invoice, it is a `setup_intent` secret — same `seti_` prefix, same flow in this SPA.
- **Ephemeral.** The client secret is scoped to one payment attempt and its incomplete subscription auto-expires after roughly 23h. Grab a fresh one if it stops working. A Checkout Session expires on the same sort of clock.
- **Package versions.** EWCS needs `@stripe/react-stripe-js` ≥ 6.3.0 for the `/checkout` subpath (this repo is on ^6.10.0) and `@stripe/stripe-js` ≥ 9.16.0. Real-time VAT-ID verification additionally needs the `custom_checkout_tax_id_verification_1` beta on the account; the checkbox on the setup screen passes it to `loadStripe`, and without it the Tax ID Element format-checks only.
- **The invoice footer is unsolved.** Nothing in this SPA addresses it, because it cannot be addressed from the browser: `subscription_data[invoice_settings][footer]` is `parameter_unknown` and `invoice_creation` is `mode=payment` only, so there is no per-subscription footer on the first invoice. That is the open go/no-go on the whole migration — see `ewcs-migration.md`.
