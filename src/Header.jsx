export default function Header({ config }) {
  return (
    <header>
      <h1>Stripe Elements Checkout</h1>
      <p className="sub">
        {config ? (
          config.headerBlurb
        ) : (
          <>
            Phase 3 transaction engine, browser side only. Pick the flow first. EWCS mounts a{' '}
            <code>Checkout Session</code> and commits nothing until <code>confirm()</code>; the
            intent-first flows mount an invoice <code>PaymentIntent</code> or a subscription{' '}
            <code>SetupIntent</code> that already exists. Each is mounted and confirmed differently,
            so the choice cannot be deferred.
          </>
        )}
      </p>
    </header>
  );
}
