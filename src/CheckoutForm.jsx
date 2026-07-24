import { useEffect, useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const money = (minor, currency) => {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (currency || 'eur').toUpperCase(),
    }).format((minor || 0) / 100);
  } catch {
    return `${((minor || 0) / 100).toFixed(2)} ${(currency || '').toUpperCase()}`;
  }
};

export default function CheckoutForm({ clientSecret, onReset }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pi, setPi] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Read the PaymentIntent behind the client secret so we can show amount and status.
  // retrievePaymentIntent is a client-side call, allowed with just the publishable key.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent, error }) => {
      if (paymentIntent) setPi(paymentIntent);
      else if (error) setResult({ ok: false, message: error.message });
    });
  }, [stripe, clientSecret]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setResult(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      setResult({ ok: false, message: error.message });
    } else if (paymentIntent) {
      setPi(paymentIntent);
      setResult({
        ok: paymentIntent.status === 'succeeded',
        message: `PaymentIntent ${paymentIntent.status}. The subscription activates on the invoice.paid webhook (server side).`,
      });
    }
    setSubmitting(false);
  };

  const done = result?.ok;

  return (
    <form onSubmit={handleSubmit}>
      {pi && (
        <div className="summary">
          <div>
            <span>Amount due</span>
            <strong>{money(pi.amount, pi.currency)}</strong>
          </div>
          <div>
            <span>PaymentIntent</span>
            <code>{pi.id}</code>
          </div>
          <div>
            <span>Status</span>
            <code>{pi.status}</code>
          </div>
        </div>
      )}

      {!done && <PaymentElement options={{ layout: 'tabs' }} />}

      {!done && (
        <button type="submit" disabled={!stripe || submitting}>
          {submitting ? 'Processing...' : pi ? `Pay ${money(pi.amount, pi.currency)}` : 'Pay now'}
        </button>
      )}

      {result && <p className={result.ok ? 'ok' : 'err'}>{result.message}</p>}

      <button type="button" className="link" onClick={onReset}>
        Start over
      </button>

      <p className="hint">
        Test card: 4242 4242 4242 4242, any future expiry, any CVC, any postal code. For SCA, use
        4000 0027 6000 3184.
      </p>
    </form>
  );
}
