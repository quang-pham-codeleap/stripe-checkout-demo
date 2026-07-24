export default function Header() {
  return (
    <header>
      <h1>Stripe Elements Checkout</h1>
      <p className="sub">
        Phase 3.1, immediate charge. This SPA emulates the browser step only: you have already created the
        incomplete subscription server side and received{' '}
        <code>latest_invoice.confirmation_secret.client_secret</code>. Paste it here to mount the Payment
        Element and confirm the payment.
      </p>
    </header>
  );
}
