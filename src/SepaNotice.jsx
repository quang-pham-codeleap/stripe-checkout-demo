import { allowsSepa, isEuro } from './sepa.js';

// Whether SEPA is on the table is decided server side, when the intent is
// created, and in the Dashboard. Both failures look the same from the browser
// -- a Payment Element with no SEPA tab, or a confirm that errors out -- so
// name them here instead of letting the confirm call be the first hint.
//
// These flows are destination charges with on_behalf_of, which makes the
// connected account the merchant of record, which in turn means SEPA has to be
// enabled on the connected account rather than on the platform. Pointing at the
// platform's payment method settings sends you to a page where everything
// already looks correct.
export default function SepaNotice({ intent, intentName }) {
  if (!intent) return null;

  const missing = !allowsSepa(intent);
  const wrongCurrency = !isEuro(intent.currency);
  if (!missing && !wrongCurrency) return null;

  return (
    <p className="warn">
      {missing && (
        <>
          This {intentName} allows{' '}
          <code>{(intent.payment_method_types || []).join(', ') || 'nothing'}</code>, not{' '}
          <code>sepa_debit</code>, so confirming a direct debit against it will fail and the Payment
          Element has no SEPA tab to show. These flows set <code>on_behalf_of</code>, which makes the
          connected account the merchant of record, so enable SEPA on <strong>it</strong>, not on the
          platform: Settings &rarr; Connect &rarr; Payment methods &rarr; Connected accounts, and
          check that <code>sepa_debit_payments</code> is <code>active</code> on the account. Adding{' '}
          <code>payment_settings[payment_method_types][]</code> does not substitute for that, and it
          switches dynamic payment methods off, dropping everything you do not list.{' '}
        </>
      )}
      {wrongCurrency && (
        <>
          SEPA Direct Debit only settles in euro; this intent is in{' '}
          <code>{(intent.currency || '').toUpperCase()}</code>.
        </>
      )}
    </p>
  );
}
