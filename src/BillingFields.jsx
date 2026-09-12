import { useRef, useState } from 'react';
import { BillingAddressElement, TaxIdElement } from '@stripe/react-stripe-js/checkout';
import { postBillingUpdate } from './ewcs.js';

// Step 9, the edit loop, and the heart of the migration. Everything here is
// live Stripe elements rather than the read-only billing profile the intent-
// first checkout rendered, because under EWCS these fields are still allowed to
// change the price.
//
// There are two re-pricing mechanisms and they are not interchangeable:
//
//   9a  Native. With the elements mounted, an address or email edit goes
//       browser -> Stripe directly, Stripe re-prices, and the change event
//       pushes new totals into every mounted element. No JTL round trip.
//
//   9b  runServerUpdate. A *manual* txr_ rate does not re-derive itself -- a
//       fixed rate stays fixed no matter what VAT-ID is typed -- so reverse
//       charge is only reachable through our backend: VIES verifies,
//       resolveManualTax decides, checkout.sessions.update swaps the rate.
//       Stripe re-reads the session when the user function resolves.
//
// Mounting TaxIdElement is what puts the VAT-ID on the session, so it reaches
// customer_details.tax_ids and the invoice. The server round trip below is not
// a substitute for that -- it exists purely to move the *price*.
export default function BillingFields({ checkout, options, pending, onPendingChange }) {
  const [note, setNote] = useState(null);
  const [verification, setVerification] = useState(null);
  const [taxIdVisible, setTaxIdVisible] = useState(null);
  const [email, setEmail] = useState(checkout.email || '');
  const [emailError, setEmailError] = useState('');

  // Mutated synchronously by the change handlers so the drain loop below always
  // reads the newest value, not the one captured when the run started.
  const addressRef = useRef(null);
  const taxRef = useRef(null);
  const lastRunRef = useRef('');
  const inFlightRef = useRef(false);
  const seenRef = useRef({ address: false, tax: false });

  // The session re-prices under us, so `checkout` is a new object on every
  // change. A drain loop can span several of those; read the current one.
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;

  // resolveManualTax(sellerCountry, buyerCountry, hasVerifiedVatId): the buyer
  // country and the VAT-ID are its only inputs from this form, so those two are
  // what a re-resolve has to be keyed on. Keying on the signature rather than on
  // "did this event change something" also survives a country switch that blanks
  // the postal code: the edit is remembered until a complete state actually
  // reaches the backend.
  const signature = () =>
    `${addressRef.current?.country || ''}|${taxRef.current?.taxId || ''}`;

  const runServerUpdate = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      // Drain rather than debounce: a keystroke that lands mid-flight would
      // otherwise be dropped, leaving the session priced for an identity the
      // Buyer has already moved on from.
      while (signature() !== lastRunRef.current) {
        const current = signature();
        lastRunRef.current = current;

        const address = addressRef.current;
        const tax = taxRef.current;

        onPendingChange(true);
        setNote(null);

        const result = await checkoutRef.current.runServerUpdate(async () => {
          await postBillingUpdate({
            endpoint: options.billingEndpoint,
            sessionId: checkoutRef.current.id,
            taxId: tax?.taxId,
            businessName: tax?.businessName,
            address,
          });
        });

        if (result.type === 'error') {
          setNote({ ok: false, message: result.error.message });
        } else if (options.billingEndpoint) {
          setNote({
            ok: true,
            message: 'Backend re-resolved the tax and updated the session. Totals above are re-read from it.',
          });
        } else {
          setNote({
            ok: false,
            message:
              'runServerUpdate completed, but no billing endpoint is configured — the round trip was ' +
              'only slept through, so nothing was re-priced. Point the demo at a real endpoint to see ' +
              'the rate swap.',
          });
        }
      }
    } catch (err) {
      // postBillingUpdate throws on a non-OK response. The failed signature stays
      // recorded as applied on purpose: retrying it here would spin against an
      // endpoint that is down. The note says so, and the next real edit retries.
      setNote({ ok: false, message: err.message });
    } finally {
      inFlightRef.current = false;
      onPendingChange(false);
    }
  };

  // Each element emits a change event as it mounts, carrying the identity the
  // session was already created from. That first one is not an edit: recording
  // it as applied is what stops a redundant VIES round trip on page load.
  const seed = (kind) => {
    if (seenRef.current[kind]) return false;
    seenRef.current[kind] = true;
    lastRunRef.current = signature();
    return true;
  };

  const handleAddressChange = (event) => {
    addressRef.current = event.value.address;
    if (seed('address')) return;
    // Only the country moves the tax decision; a new house number does not need
    // a VIES round trip, and the signature is what enforces that.
    if (event.complete && signature() !== lastRunRef.current) runServerUpdate();
  };

  const handleTaxIdChange = (event) => {
    setTaxIdVisible(event.visible);
    setVerification(event.verification?.taxId?.status || null);
    taxRef.current = {
      taxId: event.value.taxId,
      taxIdType: event.value.taxIdType,
      businessName: event.value.businessName,
    };
    if (seed('tax')) return;
    // `empty` matters as much as `complete`: clearing the VAT-ID has to re-resolve
    // back off reverse charge, and an emptied optional field never reports
    // complete. Leaving that out would keep a 0% rate on a Buyer who deleted the
    // ID that earned it.
    if ((event.complete || event.empty) && signature() !== lastRunRef.current) runServerUpdate();
  };

  // 9a for the email: no price consequence, but it is the documented mapping
  // for the KundenCenter E-Mail field, and it is a direct browser -> Stripe call
  // with no backend in the middle.
  const handleEmailBlur = async () => {
    const value = email.trim();
    if (!value || value === checkout.email) return;
    const result = await checkout.updateEmail(value);
    setEmailError(result.type === 'error' ? result.error.message : '');
  };

  return (
    <>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="erika@example.com"
          autoComplete="email"
          disabled={pending}
        />
      </label>
      {emailError && <p className="err">{emailError}</p>}

      <label>
        Billing address
        {/* display.name is the Firma-vs-person decision made visible. Stripe has
            one `name` on the contact, and KundenCenter has Firma plus Vorname
            plus Nachname; 'organization' puts the company in it, 'full' the
            person, 'split' collects first and last separately and still sends
            one name. Whichever wins is what the invoice shows.

            Note there is no allowedCountries here: the checkout AddressElement
            takes only contacts, display and fields. The country restriction the
            intent-first form pinned to ['DE'] has to be re-expressed server side
            through the session, not on this element. */}
        <BillingAddressElement
          className="stripe-mount"
          options={{ display: { name: options.nameDisplay } }}
          onChange={handleAddressChange}
        />
      </label>

      <label>
        VAT-ID (USt-IdNr.)
        <TaxIdElement
          className="stripe-mount"
          options={{
            // 'always', not 'auto': Checkout hides tax-ID collection outright
            // when the Customer already has a tax ID saved, and we pre-seed the
            // Customer from KundenCenter, which would suppress the field the
            // requirement says must stay editable.
            visibility: 'always',
            fields: { businessName: 'always' },
            ...(options.taxIdBeta
              ? { verification: { taxId: { mode: 'if_supported' } } }
              : null),
          }}
          onChange={handleTaxIdChange}
        />
      </label>

      {/* Question 6 in the migration doc is exactly this readout: does an
          existing Customer tax ID suppress the element when it is mounted
          explicitly? `visible` answers it, and no API call can. */}
      {taxIdVisible === false && (
        <p className="warn">
          The Tax ID Element reports <code>visible: false</code>. Checkout only collects tax IDs on
          Customers that do not already have one saved — so the pre-seeded KundenCenter VAT-ID has
          suppressed the field. "Pre-filled but editable" cannot be met against this Customer.
        </p>
      )}

      {verification && (
        <p className={verification === 'verified' ? 'ok' : 'hint'}>
          Tax ID verification: <code>{verification}</code>
          {verification === 'unavailable' &&
            ' — the government registry is unreachable, so this fell back to a format check. Our own VIES call stays the gate.'}
          {verification === 'pending' && ' — confirm stays disabled until this resolves.'}
        </p>
      )}

      {!options.taxIdBeta && (
        <p className="hint">
          Real-time tax-ID verification is off: Stripe.js was loaded without the{' '}
          <code>custom_checkout_tax_id_verification_1</code> beta, so the element format-checks only.
        </p>
      )}

      {note && <p className={note.ok ? 'ok' : 'warn'}>{note.message}</p>}
    </>
  );
}
