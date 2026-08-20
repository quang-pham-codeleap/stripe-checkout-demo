import { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm.jsx';
import TrialForm from './TrialForm.jsx';
import MethodTabs from './MethodTabs.jsx';

export default function CheckoutPanel({ stripePromise, clientSecret, mode, onReset }) {
  const secret = clientSecret.trim();
  const [method, setMethod] = useState('element');

  // Elements infers its mode from the secret; the form has to match, because
  // retrieve/confirm are intent specific (confirmPayment vs confirmSetup).
  const Form = mode === 'setup' ? TrialForm : CheckoutForm;

  // The Payment Element is driven by the client secret on the Elements group.
  // The iban Element is not -- confirmSepaDebitPayment/Setup takes the secret as
  // its own first argument -- and mixing a Payment Element with an individual
  // Element in one group is not allowed. Keying on the method gives each its own
  // Elements instance, so only one of the two is ever mounted.
  const options =
    method === 'sepa'
      ? { appearance: { theme: 'stripe' } }
      : { clientSecret: secret, appearance: { theme: 'stripe' } };

  return (
    <div className="card">
      <MethodTabs method={method} onChange={setMethod} />

      <Elements key={method} stripe={stripePromise} options={options}>
        <Form clientSecret={secret} method={method} onReset={onReset} />
      </Elements>
    </div>
  );
}
