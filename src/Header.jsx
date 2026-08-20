export default function Header({ config }) {
  return (
    <header>
      <h1>Stripe Elements Checkout</h1>
      <p className="sub">
        {config ? (
          config.headerBlurb
        ) : (
          <>
            Phase 3 transaction engine, browser side only. Pick the flow first: an immediate charge
            mounts the invoice <code>PaymentIntent</code>, a free trial mounts the subscription{' '}
            <code>SetupIntent</code>. The Payment Element is mounted and confirmed differently for
            each, so the choice cannot be deferred.
          </>
        )}
      </p>
    </header>
  );
}
