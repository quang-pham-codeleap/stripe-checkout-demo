import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm.jsx';

export default function CheckoutPanel({ stripePromise, clientSecret, onReset }) {
  const secret = clientSecret.trim();

  return (
    <div className="card">
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: secret, appearance: { theme: 'stripe' } }}
      >
        <CheckoutForm clientSecret={secret} onReset={onReset} />
      </Elements>
    </div>
  );
}
