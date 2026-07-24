import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import SetupForm from './SetupForm.jsx';
import CheckoutPanel from './CheckoutPanel.jsx';

const PREFILLED_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export default function App() {
  const [publishableKey, setPublishableKey] = useState(PREFILLED_PK);
  const [clientSecret, setClientSecret] = useState('');
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  // loadStripe runs once, after the user confirms the platform publishable key.
  const stripePromise = useMemo(
    () => (mounted && publishableKey ? loadStripe(publishableKey.trim()) : null),
    [mounted, publishableKey]
  );

  const handleMount = (e) => {
    e.preventDefault();
    setError('');

    const pk = publishableKey.trim();
    const cs = clientSecret.trim();

    if (!pk.startsWith('pk_')) {
      setError('Publishable key should start with pk_test_ or pk_live_.');
      return;
    }

    if (!cs.includes('_secret_')) {
      setError('Client secret should look like pi_..._secret_... (from latest_invoice.confirmation_secret).');
      return;
    }

    setMounted(true);
  };

  const reset = () => {
    setMounted(false);
    setClientSecret('');
    setError('');
  };

  return (
    <div className="page">
      <Header />

      {!mounted && (
        <SetupForm
          publishableKey={publishableKey}
          clientSecret={clientSecret}
          onPublishableKeyChange={setPublishableKey}
          onClientSecretChange={setClientSecret}
          error={error}
          onSubmit={handleMount}
        />
      )}

      {mounted && stripePromise && (
        <CheckoutPanel stripePromise={stripePromise} clientSecret={clientSecret} onReset={reset} />
      )}

      <Footer />
    </div>
  );
}
