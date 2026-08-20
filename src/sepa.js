// SEPA Direct Debit, collected with the `iban` Element and confirmed with
// stripe.confirmSepaDebitPayment / stripe.confirmSepaDebitSetup.
//
// There are two ways to take SEPA in this SPA and both are wired up:
//
//   1. The Payment Element grows its own SEPA tab (IBAN field, name, email and
//      mandate, all rendered by Stripe) as soon as the intent allows
//      sepa_debit. That path needs no code in this file -- it is a server-side
//      and Dashboard setting, which is exactly why it looks like it is missing
//      when it is not enabled. See allowsSepa below.
//
//   2. The dedicated SEPA tab, backed by this module. It collects the IBAN
//      itself, so it works against an intent the Payment Element would only
//      offer cards for, and it has to display the mandate wording itself.

// Creditor shown in the mandate. Substitute your own legal entity name.
export const CREDITOR_NAME = import.meta.env.VITE_SEPA_CREDITOR_NAME || 'this business';

// Stripe's standard mandate acceptance text. Showing it next to the submit
// button is how the customer implicitly signs the SEPA mandate, so it is a
// compliance requirement, not decoration. The Payment Element renders its own
// copy of this; when you collect the IBAN yourself, you display it yourself.
export const mandateText = (creditor = CREDITOR_NAME) =>
  `By providing your payment information and confirming this payment, you authorise ` +
  `(A) ${creditor} and Stripe, our payment service provider, to send instructions to your bank ` +
  `to debit your account and (B) your bank to debit your account in accordance with those ` +
  `instructions. As part of your rights, you are entitled to a refund from your bank under the ` +
  `terms and conditions of your agreement with your bank. A refund must be claimed within 8 weeks ` +
  `starting from the date on which your account was debited.`;

export const IBAN_ELEMENT_OPTIONS = {
  supportedCountries: ['SEPA'],
  placeholderCountry: 'DE',
  style: {
    base: {
      fontSize: '14px',
      color: '#1a1f36',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      '::placeholder': { color: '#9aa1ae' },
    },
    invalid: { color: '#b3261e', iconColor: '#b3261e' },
  },
};

// A handful of the test IBANs; the full table is in the Stripe testing docs.
export const TEST_IBANS = [
  { iban: 'DE89370400440532013000', outcome: 'succeeds' },
  { iban: 'DE62370400440532013001', outcome: 'fails, back to requires_payment_method' },
  { iban: 'DE35370400440532013002', outcome: 'succeeds, then disputed' },
  { iban: 'AT611904300234573201', outcome: 'succeeds (Austria)' },
];

// SEPA only settles in euro, and only if the intent was created allowing it.
// Both are decided server side, so surface them rather than fail at confirm.
export const allowsSepa = (intent) => !!intent?.payment_method_types?.includes('sepa_debit');
export const isEuro = (currency) => !currency || currency.toLowerCase() === 'eur';
