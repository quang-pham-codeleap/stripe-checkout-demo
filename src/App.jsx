import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ModeSelect from './ModeSelect.jsx';
import SetupForm from './SetupForm.jsx';
import CheckoutPanel from './CheckoutPanel.jsx';
import { MODES, modeForSecret } from './modes.js';

const PREFILLED_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

export default function App() {
  const [mode, setMode] = useState('');
  const [publishableKey, setPublishableKey] = useState(PREFILLED_PK);
  const [clientSecret, setClientSecret] = useState('');
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [suggestedMode, setSuggestedMode] = useState('');

  const config = MODES[mode] || null;

  // loadStripe runs once, after the user confirms the platform publishable key.
  const stripePromise = useMemo(
    () => (mounted && publishableKey ? loadStripe(publishableKey.trim()) : null),
    [mounted, publishableKey]
  );

  const handleMount = (e) => {
    e.preventDefault();
    setError('');
    setSuggestedMode('');

    const pk = publishableKey.trim();
    const cs = clientSecret.trim();

    if (!pk.startsWith('pk_')) {
      setError('Publishable key should start with pk_test_ or pk_live_.');
      return;
    }

    if (!cs.includes('_secret_')) {
      setError(`Client secret should look like ${config.secretExample} (from ${config.secretSource}).`);
      return;
    }

    // The mismatch that produces "value should be a PaymentIntent client secret.
    // You specified: a SetupIntent client secret." Catch it before Stripe.js does.
    if (!cs.startsWith(config.secretPrefix)) {
      const actual = modeForSecret(cs);
      if (actual) {
        setSuggestedMode(actual.key);
        setError(
          `That is a ${actual.intentName} client secret, which belongs to the ${actual.label} flow. ` +
            `The ${config.label} flow mounts a ${config.intentName} (${config.secretExample}).`
        );
      } else {
        setError(`The ${config.label} flow needs a ${config.intentName} secret (${config.secretExample}).`);
      }
      return;
    }

    setMounted(true);
  };

  const selectMode = (key) => {
    setMode(key);
    setError('');
    setSuggestedMode('');
  };

  // Back to the secret form, same flow.
  const reset = () => {
    setMounted(false);
    setClientSecret('');
    setError('');
    setSuggestedMode('');
  };

  // Back to the flow picker. Stripe.js is keyed off `mounted`, so this unmounts it.
  const changeMode = () => {
    reset();
    setMode('');
  };

  return (
    <div className="page">
      <Header config={config} />

      {!mode && <ModeSelect onSelect={selectMode} />}

      {mode && !mounted && (
        <SetupForm
          config={config}
          publishableKey={publishableKey}
          clientSecret={clientSecret}
          onPublishableKeyChange={setPublishableKey}
          onClientSecretChange={setClientSecret}
          error={error}
          suggestedMode={suggestedMode ? MODES[suggestedMode] : null}
          onSelectMode={selectMode}
          onChangeMode={changeMode}
          onSubmit={handleMount}
        />
      )}

      {mode && mounted && stripePromise && (
        <CheckoutPanel
          stripePromise={stripePromise}
          clientSecret={clientSecret}
          mode={mode}
          onReset={reset}
        />
      )}

      <Footer config={config} />
    </div>
  );
}
