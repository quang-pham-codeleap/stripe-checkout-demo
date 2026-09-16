import { useRef, useState } from 'react';
import { BillingAddressElement } from '@stripe/react-stripe-js/checkout';
import { postBillingUpdate } from './ewcs.js';

// Step 9, the edit loop. Everything here is live Stripe elements rather than the
// read-only billing profile the intent-first checkout rendered, because under
// EWCS these fields are still allowed to change the price.
//
// There are two re-pricing mechanisms and they are not interchangeable:
//
//   9a  Native. With the element mounted, an address or email edit goes
//       browser -> Stripe directly, Stripe re-prices, and the change event
//       pushes new totals into every mounted element. No JTL round trip.
//
//   9b  runServerUpdate. A *manual* txr_ rate does not re-derive itself -- a
//       fixed rate stays fixed no matter what the Buyer types -- so a rate swap
//       is only reachable through our backend: resolveManualTax decides,
//       checkout.sessions.update swaps the rate. Stripe re-reads the session
//       when the user function resolves.
//
// No VAT-ID is collected here. The Tax ID Element requires the session to have
// been created with tax_id_collection[enabled]=true, and this flow prices off a
// manual txr_ rate on the line item instead, so mounting it throws
// "You cannot create the Tax ID Element if tax_id_collection.enabled is not
// true" and takes the tree with it. That leaves the buyer country as the only
// pricing input this form carries; to exercise the VAT-ID half of
// resolveManualTax, call the Stripe methods directly rather than through an
// element.
export default function BillingFields({ checkout, options, pending, onPendingChange }) {
  const [note, setNote] = useState(null);
  const [email, setEmail] = useState(checkout.email || '');
  const [emailError, setEmailError] = useState('');

  // Mutated synchronously by the change handler so the drain loop below always
  // reads the newest value, not the one captured when the run started.
  const addressRef = useRef(null);
  const lastRunRef = useRef('');
  const inFlightRef = useRef(false);
  const seenRef = useRef({ address: false });

  // The session re-prices under us, so `checkout` is a new object on every
  // change. A drain loop can span several of those; read the current one.
  const checkoutRef = useRef(checkout);
  checkoutRef.current = checkout;

  // resolveManualTax(sellerCountry, buyerCountry, hasVerifiedVatId): the buyer
  // country is its only input from this form, so that is what a re-resolve has
  // to be keyed on. Keying on the signature rather than on "did this event
  // change something" also survives a country switch that blanks the postal
  // code: the edit is remembered until a complete state actually reaches the
  // backend.
  const signature = () => addressRef.current?.country || '';

  const runServerUpdate = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      // Drain rather than debounce: a keystroke that lands mid-flight would
      // otherwise be dropped, leaving the session priced for an identity the
      // Buyer has already moved on from.
      while (signature() !== lastRunRef.current) {
        lastRunRef.current = signature();

        const address = addressRef.current;

        onPendingChange(true);
        setNote(null);

        const result = await checkoutRef.current.runServerUpdate(async () => {
          await postBillingUpdate({
            endpoint: options.billingEndpoint,
            sessionId: checkoutRef.current.id,
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

  // The element emits a change event as it mounts, carrying the identity the
  // session was already created from. That first one is not an edit: recording
  // it as applied is what stops a redundant round trip on page load.
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
    // a backend round trip, and the signature is what enforces that.
    if (event.complete && signature() !== lastRunRef.current) runServerUpdate();
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

      <p className="hint">
        No VAT-ID field: the Tax ID Element needs a session created with{' '}
        <code>tax_id_collection[enabled]=true</code>, and this one prices off a manual{' '}
        <code>txr_</code> rate instead. The buyer country is the only pricing input this form
        carries.
      </p>

      {note && <p className={note.ok ? 'ok' : 'warn'}>{note.message}</p>}
    </>
  );
}
