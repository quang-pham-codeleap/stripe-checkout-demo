// Everything the EWCS flow needs that a client secret alone does not carry.
//
// The pre-fill fields stand in for KundenCenter. In production the backend
// already knows this data and hands it to the frontend, which seeds
// options.defaultValues with it; here you type it, so you can watch a session
// mount with billing data already in the fields and still edit every one.
export default function EwcsOptions({ prefill, onChange, disabled }) {
  const field = (key) => ({
    value: prefill[key],
    onChange: (e) => onChange({ [key]: e.target.value }),
    disabled,
    autoComplete: 'off',
  });

  return (
    <details className="options">
      <summary>KundenCenter pre-fill and session options</summary>

      <label>
        Name (Firma, or Vorname + Nachname — Stripe has one field)
        <input {...field('name')} placeholder="Muster GmbH" />
      </label>

      <div className="row">
        <label>
          Straße
          <input {...field('line1')} placeholder="Hauptstraße 1" />
        </label>
        <label>
          Land
          <input {...field('country')} placeholder="DE" maxLength={2} />
        </label>
      </div>

      <div className="row">
        <label>
          PLZ
          <input {...field('postalCode')} placeholder="10115" />
        </label>
        <label>
          Stadt
          <input {...field('city')} placeholder="Berlin" />
        </label>
      </div>

      <label>
        E-Mail
        <input {...field('email')} type="email" placeholder="erika@example.com" />
      </label>

      {/* The forced mapping decision, made switchable so it can be seen rather
          than argued: Stripe's contact has one `name`, KundenCenter has Firma,
          Vorname and Nachname. Whichever this collects is what the first invoice
          shows as the legal name. */}
      <label>
        Name field on the BillingAddressElement
        <select
          value={prefill.nameDisplay}
          onChange={(e) => onChange({ nameDisplay: e.target.value })}
          disabled={disabled}
        >
          <option value="full">full — one name field (the person)</option>
          <option value="split">split — Vorname + Nachname, still sent as one name</option>
          <option value="organization">organization — the Firma</option>
        </select>
      </label>

      <label>
        Billing endpoint for runServerUpdate (optional)
        <input
          {...field('billingEndpoint')}
          placeholder="https://…/app-service/apps/subscription/checkout-session/billing"
        />
      </label>
      <p className="hint">
        There is no backend in this repo. Left empty, the step-9b round trip is only slept through:
        <code>runServerUpdate</code> and the pending state still run, but nothing is re-priced, because
        swapping the <code>txr_</code> rate needs a secret key. Point this at a real endpoint — it is
        POSTed <code>{'{ sessionId, address }'}</code> — to see the rate actually move.
      </p>
    </details>
  );
}
