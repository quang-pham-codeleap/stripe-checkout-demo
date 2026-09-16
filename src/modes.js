// The checkout flows this SPA can emulate, keyed by what the client secret
// points at -- which is also what decides how the payment UI is mounted and
// which confirm call takes it, so the flow is chosen before Stripe.js loads.
//
// EWCS is the proposed flow (ewcs-migration.md). The other two are the intent-
// first flows in production today (app-flows-phase-3-transaction-engine.md).
// Both sets stay here deliberately: the migration is a proposal with an open
// go/no-go on the invoice footer, and its own rollout note allows a coexistence
// window branching on the `cs_` vs `pi_` / `seti_` prefix.
export const MODES = {
  ewcs: {
    key: 'ewcs',
    label: 'EWCS checkout',
    blurb:
      'One flow for charge and trial. The Session is the live price preview; the Subscription and the first Invoice are only created at confirm, so billing data stays editable.',
    intentName: 'Checkout Session',
    secretPrefix: 'cs_',
    secretExample: 'cs_..._secret_...',
    secretSource: 'checkout.sessions.create -> client_secret',
    confirmCall: 'checkout.confirm',
    diagram: 'the EWCS diagram',
    doc: 'ewcs-migration.md',
    headerBlurb:
      'EWCS, the proposed flow. You have created a mode=subscription Checkout Session server side with ui_mode=custom and read its client_secret. Nothing is committed yet: paste it here to mount the billing and payment elements, edit the billing data, and watch the session re-price before you confirm.',
  },
  payment: {
    key: 'payment',
    label: 'Immediate charge',
    legacy: true,
    blurb: 'Something is due now. The subscription invoice carries a PaymentIntent.',
    intentName: 'PaymentIntent',
    secretPrefix: 'pi_',
    secretExample: 'pi_..._secret_...',
    secretSource: 'latest_invoice.confirmation_secret.client_secret',
    confirmCall: 'stripe.confirmPayment',
    diagram: 'Diagram 5',
    doc: 'app-flows-phase-3-transaction-engine.md',
    curlLog: 'curl-log-phase-3-immediate-charge.md',
    headerBlurb:
      'Phase 3.1, immediate charge. You have already created the incomplete subscription server side and read latest_invoice.confirmation_secret.client_secret. Paste it here to mount the Payment Element and confirm the payment. The invoice is already finalized, so the billing data on it is frozen.',
  },
  setup: {
    key: 'setup',
    label: 'Free trial',
    legacy: true,
    blurb: 'Nothing is due now. The subscription carries a SetupIntent that saves the card for later.',
    intentName: 'SetupIntent',
    secretPrefix: 'seti_',
    secretExample: 'seti_..._secret_...',
    secretSource: 'pending_setup_intent.client_secret',
    confirmCall: 'stripe.confirmSetup',
    diagram: 'Diagram 6',
    doc: 'app-flows-phase-3-transaction-engine.md',
    headerBlurb:
      'Phase 3.2, free trial. You have already created the trialing subscription server side and read pending_setup_intent.client_secret. Paste it here to mount the Payment Element and save the payment method for the end of the trial.',
  },
};

// Which flow does this client secret actually belong to, if any.
export const modeForSecret = (secret) =>
  Object.values(MODES).find((m) => secret.startsWith(m.secretPrefix)) || null;
