import { MODES } from './modes.js';

export default function ModeSelect({ onSelect }) {
  const flows = Object.values(MODES);
  const proposed = flows.filter((m) => !m.legacy);
  const legacy = flows.filter((m) => m.legacy);

  const choice = (mode) => (
    <button key={mode.key} type="button" className="choice" onClick={() => onSelect(mode.key)}>
      <strong>{mode.label}</strong>
      <span>{mode.blurb}</span>
      <span>
        <code>{mode.secretExample}</code> &rarr; <code>{mode.confirmCall}</code>
      </span>
    </button>
  );

  return (
    <div className="card">
      <p className="lede">Which checkout are you emulating?</p>

      {proposed.map(choice)}

      <p className="hint section">Intent-first, in production today:</p>
      {legacy.map(choice)}

      <p className="hint">
        The difference is where the commit point sits. The intent-first flows are handed an intent
        that already exists, so the subscription and its first invoice were created — and finalized —
        before the browser saw anything, and the billing data on that invoice is frozen. EWCS is
        handed a session that has committed nothing: the <code>Subscription</code> and the{' '}
        <code>Invoice</code> are created by <code>confirm()</code>, from whatever billing identity the
        session holds at that moment. That is what lets the Buyer edit the address
        mid-checkout and still have it land on invoice 1.
      </p>
    </div>
  );
}
