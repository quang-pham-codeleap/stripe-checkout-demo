// EWCS -- Elements with the Checkout Sessions API. The flow proposed in
// ewcs-migration.md, and the reason it exists:
//
// The intent-first flows create the subscription, and with it a *finalized*
// first invoice, before the browser sees anything. Finalization snapshots
// customer_name, customer_address and customer_tax_ids, so nothing the Buyer
// types at checkout can reach invoice 1. Worse, the billing country is a pricing
// input -- it is what resolveManualTax picks the txr_ rate from -- so an inline
// edit would have to void the invoice and rebuild the subscription.
//
// A mode=subscription Checkout Session moves the commit point to confirm().
// Until then there is no Subscription and no Invoice, just a session that
// re-prices itself, so billing data stays editable and still lands on invoice 1.

import { SETTLEMENT } from './outcome.js';

// No tax-ID betas here. The Tax ID Element is not mounted, because it refuses
// to be created against a session without tax_id_collection[enabled]=true --
// "You cannot create the Tax ID Element if tax_id_collection.enabled is not
// true" -- and this flow prices off a manual txr_ rate on the line item
// instead. So loadStripe gets no `betas` and the VAT-ID never reaches the
// browser; drive the VAT-ID half of resolveManualTax from the backend, or by
// calling Stripe directly.

// Every amount on a session arrives twice: `amount`, preformatted by Stripe for
// the session currency, and `minorUnitsAmount` alongside
// session.minorUnitsAmountDivisor. We format from the pair rather than take the
// string, because the divisor is precisely what replaces the hard-coded /100 the
// intent-first order summary used -- that literal is wrong for zero-decimal
// currencies (JPY) and three-decimal ones (BHD).
export const money = (amount, divisor, currency) => {
  const value = (amount?.minorUnitsAmount || 0) / (divisor || 100);
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (currency || 'eur').toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${(currency || '').toUpperCase()}`;
  }
};

// A tax line as the session reports it: "USt 19%" / "Reverse charge 0%". This is
// the field the UI has to watch on a trial, because the total cannot move there.
export const taxLabel = (tax) => {
  const percentage = typeof tax.percentage === 'number' ? ` ${tax.percentage}%` : '';
  return `${tax.displayName}${percentage}${tax.inclusive ? ' (incl.)' : ''}`;
};

// What a completed session means for the subscription. The session carries the
// subscription id, not its status -- the server still reads the subscription
// back on checkout.session.completed for the authoritative one.
export function checkoutOutcome(session) {
  const status = session?.status;

  if (status?.type === 'open') {
    return { ok: false, message: 'Session still open. Nothing was committed.' };
  }
  if (status?.type === 'expired') {
    return { ok: false, message: 'Session expired. Create a new one server side.' };
  }
  if (status?.type !== 'complete') {
    return { ok: false, message: `Session ${status?.type || 'unknown'}.` };
  }

  switch (status.paymentStatus) {
    case 'paid':
      return {
        ok: true,
        message:
          'Session complete, paid. Stripe created the Subscription and finalized the first Invoice ' +
          'at this moment, from the billing identity the session held. The server picks it up on ' +
          'checkout.session.completed and reads the subscription back for its authoritative status.',
      };
    case 'no_payment_required':
      return {
        ok: true,
        message:
          'Session complete, no payment required — this is the trial. One flow, one confirm, no ' +
          'SetupIntent: payment_method_collection=always stored the method as default_payment_method, ' +
          'and the first charge happens at trial end on invoice.paid.',
      };
    case 'unpaid':
      return {
        ok: true,
        message:
          `Session complete, unpaid — a delayed notification method (SEPA). ${SETTLEMENT}, so ` +
          'checkout.session.async_payment_succeeded or async_payment_failed decides it then, not now.',
      };
    default:
      return { ok: false, message: `Session complete, payment ${status.paymentStatus}.` };
  }
}

// Build the provider's defaultValues from the KundenCenter stand-in fields. This
// is the "pre-filled but editable" half of the requirement: Stripe seeds the
// elements with it and the Buyer can still change every field.
//
// StripeCheckoutContact is { name?, address }, and address.country is the only
// required member -- an empty string there is rejected, so a contact is only
// sent once a country exists.
export function toDefaultValues(prefill) {
  const trim = (v) => (v || '').trim();
  const out = {};

  const country = trim(prefill.country).toUpperCase();
  if (country) {
    const address = { country };
    for (const [field, key] of [
      ['line1', 'line1'],
      ['line2', 'line2'],
      ['city', 'city'],
      ['postal_code', 'postalCode'],
      ['state', 'state'],
    ]) {
      if (trim(prefill[key])) address[field] = trim(prefill[key]);
    }

    out.billingAddress = trim(prefill.name)
      ? { name: trim(prefill.name), address }
      : { address };
  }

  if (trim(prefill.email)) out.email = trim(prefill.email);

  return Object.keys(out).length ? out : undefined;
}

// Step 9b, the JTL side of the edit loop. In production this is
// POST /app-service/apps/subscription/checkout-session/billing, which re-runs
// resolveManualTax and PATCHes the session with the whole line_items array and
// the new txr_ rate -- tax_rates on its own is a 400, "you must provide one of
// 'price' or 'price_data'". So the backend holds the cart; it cannot diff one
// field.
//
// Only the address goes up: with no Tax ID Element mounted there is no VAT-ID
// to verify, so the buyer country is the single pricing input this carries.
//
// There is no backend in this repo. Point `endpoint` at a real one to drive it,
// or leave it empty and the call is only slept through, which still exercises
// runServerUpdate and the pending UI but re-prices nothing.
export async function postBillingUpdate({ endpoint, sessionId, address }) {
  if (!endpoint) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { simulated: true };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, address }),
  });

  if (!response.ok) {
    throw new Error(`Billing endpoint returned ${response.status} ${response.statusText}.`);
  }

  return { simulated: false };
}
