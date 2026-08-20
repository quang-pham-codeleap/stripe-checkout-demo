// What a confirmed intent status means for the subscription.
//
// Cards resolve synchronously: confirm returns `succeeded` and the webhook is
// moments behind. SEPA Direct Debit is a delayed notification method -- a debit
// that is going through fine returns `processing` and only settles days later.
// Treating anything other than `succeeded` as a failure would paint a healthy
// SEPA payment red, so `processing` is a success here, with the wait spelled
// out. The final word still arrives server side on the webhook either way.

const SETTLEMENT = 'SEPA debits settle in about 2 to 14 business days';

export function paymentOutcome(pi) {
  switch (pi.status) {
    case 'succeeded':
      return {
        ok: true,
        message:
          'PaymentIntent succeeded. The subscription activates on the invoice.paid webhook (server side).',
      };
    case 'processing':
      return {
        ok: true,
        message:
          `PaymentIntent processing. ${SETTLEMENT}, so invoice.paid — and with it the subscription ` +
          'activation — fires then, not now. Listen for payment_intent.payment_failed as well: a ' +
          'direct debit can still be refused after it has been accepted.',
      };
    case 'requires_action':
      return { ok: false, message: 'PaymentIntent requires_action. The customer still has to authenticate.' };
    case 'requires_payment_method':
      return {
        ok: false,
        message: 'PaymentIntent requires_payment_method. The payment was refused; collect different details.',
      };
    default:
      return { ok: false, message: `PaymentIntent ${pi.status}.` };
  }
}

export function setupOutcome(si) {
  switch (si.status) {
    case 'succeeded':
      return {
        ok: true,
        message:
          'SetupIntent succeeded. The payment method is saved off session; the first charge happens ' +
          'when the trial ends (invoice.paid webhook, server side).',
      };
    case 'processing':
      return {
        ok: true,
        message:
          `SetupIntent processing. The SEPA mandate is being set up — ${SETTLEMENT}, and validation ` +
          'of the mandate is on the same clock. It has to reach succeeded before the trial ends for ' +
          'the first charge to go through.',
      };
    case 'requires_action':
      return { ok: false, message: 'SetupIntent requires_action. The customer still has to authenticate.' };
    case 'requires_payment_method':
      return {
        ok: false,
        message: 'SetupIntent requires_payment_method. The details were refused; collect different ones.',
      };
    default:
      return { ok: false, message: `SetupIntent ${si.status}.` };
  }
}
