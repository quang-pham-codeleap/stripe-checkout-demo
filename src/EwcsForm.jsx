import { useState } from 'react';
import { PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout';
import OrderSummary from './OrderSummary.jsx';
import BillingFields from './BillingFields.jsx';
import { checkoutOutcome } from './ewcs.js';

export default function EwcsForm({ options, onReset }) {
  // useCheckoutElements, not the deprecated useCheckout. It returns the session
  // merged with the action surface, and re-renders on every re-price, which is
  // what makes the summary below reactive at all.
  const state = useCheckoutElements();

  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (state.type === 'loading') {
    return <p className="hint">Loading the Checkout Session…</p>;
  }

  if (state.type === 'error') {
    return (
      <>
        <p className="err">{state.error.message}</p>
        <button type="button" className="link" onClick={onReset}>
          Start over
        </button>
      </>
    );
  }

  const checkout = state.checkout;
  const done = result?.ok;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    // The whole PAYMENT / SETUP fork is gone: no client-secret prefix sniffing,
    // no elements.submit(), no second stage for trials. confirm() validates the
    // mounted elements itself and then, in one atomic step, creates the
    // Subscription, creates and finalizes the first Invoice from the billing
    // identity the session holds *right now*, confirms the PaymentIntent, runs
    // SCA, charges, and transfers the Publisher's share.
    const confirmation = await checkout.confirm({
      returnUrl: window.location.href,
      redirect: 'if_required',
    });

    setResult(
      confirmation.type === 'error'
        ? { ok: false, message: confirmation.error.message }
        : checkoutOutcome(confirmation.session)
    );
    setSubmitting(false);
  };

  // canConfirm is Stripe's own readiness flag over every mounted element. The
  // other two are ours: a re-price in flight means the total on screen is not
  // the one that would be charged.
  const blocked = !checkout.canConfirm || pending || submitting;

  return (
    <form onSubmit={handleSubmit}>
      <OrderSummary checkout={checkout} pending={pending} />

      {!done && (
        <>
          <BillingFields
            checkout={checkout}
            options={options}
            pending={pending}
            onPendingChange={setPending}
          />

          <PaymentElement
            className="stripe-mount"
            options={{ layout: 'tabs', paymentMethodOrder: ['card', 'sepa_debit'] }}
          />

          <button type="submit" disabled={blocked}>
            {submitting ? 'Confirming…' : pending ? 'Re-pricing…' : 'Confirm and subscribe'}
          </button>

          {!checkout.canConfirm && !pending && (
            <p className="hint">
              <code>canConfirm</code> is false — a mounted element is still incomplete.
            </p>
          )}
        </>
      )}

      {checkout.lastPaymentError && !result && (
        <p className="err">{checkout.lastPaymentError.message}</p>
      )}

      {result && <p className={result.ok ? 'ok' : 'err'}>{result.message}</p>}

      <button type="button" className="link" onClick={onReset}>
        Start over
      </button>

      <p className="hint">
        Test card: 4242 4242 4242 4242, any future expiry, any CVC, any postal code. For SCA, use
        4000 0027 6000 3184. Which methods the Payment Element offers is decided by the session and
        the connected account, not here — SEPA needs <code>sepa_debit_payments</code> active on the
        account that <code>on_behalf_of</code> points at.
      </p>
    </form>
  );
}
