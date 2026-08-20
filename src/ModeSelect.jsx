import { MODES } from './modes.js';

export default function ModeSelect({ onSelect }) {
  return (
    <div className="card">
      <p className="lede">Which checkout are you emulating?</p>

      {Object.values(MODES).map((mode) => (
        <button
          key={mode.key}
          type="button"
          className="choice"
          onClick={() => onSelect(mode.key)}
        >
          <strong>{mode.label}</strong>
          <span>{mode.blurb}</span>
          <span>
            <code>{mode.secretExample}</code> &rarr; <code>{mode.confirmCall}</code>
          </span>
        </button>
      ))}

      <p className="hint">
        The Payment Element mounts differently for each: a PaymentIntent secret is confirmed with{' '}
        <code>confirmPayment</code>, a SetupIntent secret with <code>confirmSetup</code>. Mixing them
        throws <code>IntegrationError</code>, so the flow is chosen before Stripe.js loads.
      </p>
    </div>
  );
}
