// Which element collects the payment details. Both confirm the same intent
// against the same client secret; they differ in what they collect and which
// confirm call takes it.
const METHODS = {
  element: {
    key: 'element',
    label: 'Payment Element',
    blurb: 'Cards, wallets, and a SEPA tab of its own when the intent allows sepa_debit.',
  },
  sepa: {
    key: 'sepa',
    label: 'SEPA Direct Debit',
    blurb: 'IBAN Element, collected directly, with the mandate shown here.',
  },
};

export default function MethodTabs({ method, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {Object.values(METHODS).map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={method === m.key}
          className={`tab${method === m.key ? ' on' : ''}`}
          onClick={() => onChange(m.key)}
        >
          <strong>{m.label}</strong>
          <span>{m.blurb}</span>
        </button>
      ))}
    </div>
  );
}
