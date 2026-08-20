import { IbanElement } from '@stripe/react-stripe-js';
import { IBAN_ELEMENT_OPTIONS, TEST_IBANS, mandateText } from './sepa.js';

// The dedicated SEPA form: IBAN Element plus the two billing_details fields
// confirmSepaDebitPayment/confirmSepaDebitSetup require, plus the mandate.
// Name and email are not optional here the way they are for a card -- Stripe
// rejects the confirm without them, because they go on the mandate.
export default function SepaFields({ name, email, onNameChange, onEmailChange, disabled }) {
  return (
    <>
      <label>
        Account holder name
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Erika Mustermann"
          autoComplete="name"
          disabled={disabled}
        />
      </label>

      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="erika@example.com"
          autoComplete="email"
          disabled={disabled}
        />
      </label>

      <label>
        IBAN
        <div className="stripe-field">
          <IbanElement options={IBAN_ELEMENT_OPTIONS} />
        </div>
      </label>

      <p className="mandate">{mandateText()}</p>

      <p className="hint">
        Test IBANs:
        {TEST_IBANS.map(({ iban, outcome }) => (
          <span key={iban} className="test-iban">
            <code>{iban}</code> {outcome}
          </span>
        ))}
      </p>
    </>
  );
}
