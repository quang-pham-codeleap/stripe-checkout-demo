import { CheckoutElementsProvider } from '@stripe/react-stripe-js/checkout';
import EwcsForm from './EwcsForm.jsx';

// The provider swap. Three things differ from the intent-first <Elements>:
//
//   1. It comes from the /checkout subpath. CheckoutProvider and useCheckout at
//      the package root are deprecated since v6.3.0 and go away in v7.
//   2. `appearance` moves inside options.elementsOptions -- it is no longer a
//      sibling of clientSecret.
//   3. `defaultValues` exists at all. That is the KundenCenter pre-fill, and it
//      is the half of "pre-filled but editable" that the intent-first flow could
//      not offer, because by then the invoice was already finalized.
//
// clientSecret cannot be changed once the provider has mounted, so the panel is
// only rendered after the secret has been entered and validated.
export default function EwcsPanel({ stripePromise, clientSecret, defaultValues, options, onReset }) {
  const providerOptions = {
    clientSecret,
    elementsOptions: { appearance: { theme: 'stripe' } },
    ...(defaultValues ? { defaultValues } : null),
  };

  return (
    <div className="card">
      <CheckoutElementsProvider stripe={stripePromise} options={providerOptions}>
        <EwcsForm options={options} onReset={onReset} />
      </CheckoutElementsProvider>
    </div>
  );
}
