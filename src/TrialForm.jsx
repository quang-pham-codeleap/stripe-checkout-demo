import { useEffect, useState } from 'react';
import { PaymentElement, IbanElement, useStripe, useElements } from '@stripe/react-stripe-js';
import SepaFields from './SepaFields.jsx';
import SepaNotice from './SepaNotice.jsx';
import { setupOutcome } from './outcome.js';
import { MODES } from './modes.js';

export default function TrialForm({ clientSecret, method, onReset }) {
  const stripe = useStripe();
  const elements = useElements();
  const [si, setSi] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const sepa = method === 'sepa';

  // Trial subscriptions have nothing due now, so the confirmation secret is a
  // SetupIntent. retrieveSetupIntent is the client-side read for it, allowed
  // with just the publishable key.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    stripe.retrieveSetupIntent(clientSecret).then(({ setupIntent, error }) => {
      if (setupIntent) setSi(setupIntent);
      else if (error) setResult({ ok: false, message: error.message });
    });
  }, [stripe, clientSecret]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setResult(null);

    // The setup twins of the confirm calls in CheckoutForm. Saving a SEPA
    // mandate off session is the whole point of the trial flow: the mandate
    // collected here is what gets debited when the trial ends.
    const { error, setupIntent } = sepa
      ? await stripe.confirmSepaDebitSetup(clientSecret, {
          payment_method: {
            sepa_debit: elements.getElement(IbanElement),
            billing_details: { name: name.trim(), email: email.trim() },
          },
        })
      : await stripe.confirmSetup({
          elements,
          redirect: 'if_required',
          confirmParams: { return_url: window.location.href },
        });

    if (error) {
      setResult({ ok: false, message: error.message });
    } else if (setupIntent) {
      setSi(setupIntent);
      setResult(setupOutcome(setupIntent));
    }
    setSubmitting(false);
  };

  const done = result?.ok;
  const incomplete = sepa && (!name.trim() || !email.trim());

  return (
    <form onSubmit={handleSubmit}>
      <div className="summary">
        <div>
          <span>Amount due now</span>
          <strong>Nothing (trial)</strong>
        </div>
        {si && (
          <>
            <div>
              <span>SetupIntent</span>
              <code>{si.id}</code>
            </div>
            <div>
              <span>Status</span>
              <code>{si.status}</code>
            </div>
            <div>
              <span>Usage</span>
              <code>{si.usage || 'off_session'}</code>
            </div>
            <div>
              <span>Methods</span>
              <code>{(si.payment_method_types || []).join(', ')}</code>
            </div>
          </>
        )}
      </div>

      {!done && sepa && <SepaNotice intent={si} intentName={MODES.setup.intentName} />}

      {!done &&
        (sepa ? (
          <SepaFields
            name={name}
            email={email}
            onNameChange={setName}
            onEmailChange={setEmail}
            disabled={submitting}
          />
        ) : (
          <PaymentElement options={{ layout: 'tabs', paymentMethodOrder: ['card', 'sepa_debit'] }} />
        ))}

      {!done && (
        <button type="submit" disabled={!stripe || submitting || incomplete}>
          {submitting ? 'Saving...' : sepa ? 'Save mandate' : 'Save payment method'}
        </button>
      )}

      {result && <p className={result.ok ? 'ok' : 'err'}>{result.message}</p>}

      <button type="button" className="link" onClick={onReset}>
        Start over
      </button>

      {!sepa && (
        <p className="hint">
          Test card: 4242 4242 4242 4242, any future expiry, any CVC, any postal code. For SCA, use
          4000 0027 6000 3184.
        </p>
      )}
    </form>
  );
}
