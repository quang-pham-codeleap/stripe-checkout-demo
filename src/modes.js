// The two Phase 3 checkout flows. They differ in what the invoice confirmation
// secret points at, so the Payment Element has to be mounted and confirmed
// against one intent type or the other. Picking the flow up front is what keeps
// retrievePaymentIntent/confirmPayment away from a seti_ secret and vice versa.
export const MODES = {
  payment: {
    key: 'payment',
    label: 'Immediate charge',
    blurb: 'Something is due now. The subscription invoice carries a PaymentIntent.',
    intentName: 'PaymentIntent',
    secretPrefix: 'pi_',
    secretExample: 'pi_..._secret_...',
    secretSource: 'latest_invoice.confirmation_secret.client_secret',
    confirmCall: 'stripe.confirmPayment',
    diagram: 'Diagram 5',
    curlLog: 'curl-log-phase-3-immediate-charge.md',
    headerBlurb:
      'Phase 3.1, immediate charge. You have already created the incomplete subscription server side and read latest_invoice.confirmation_secret.client_secret. Paste it here to mount the Payment Element and confirm the payment.',
  },
  setup: {
    key: 'setup',
    label: 'Free trial',
    blurb: 'Nothing is due now. The subscription carries a SetupIntent that saves the card for later.',
    intentName: 'SetupIntent',
    secretPrefix: 'seti_',
    secretExample: 'seti_..._secret_...',
    secretSource: 'pending_setup_intent.client_secret',
    confirmCall: 'stripe.confirmSetup',
    diagram: 'Diagram 6',
    curlLog: 'app-flows-phase-3-transaction-engine.md',
    headerBlurb:
      'Phase 3.2, free trial. You have already created the trialing subscription server side and read pending_setup_intent.client_secret. Paste it here to mount the Payment Element and save the payment method for the end of the trial.',
  },
};

// Which flow does this client secret actually belong to, if any.
export const modeForSecret = (secret) =>
  Object.values(MODES).find((m) => secret.startsWith(m.secretPrefix)) || null;
