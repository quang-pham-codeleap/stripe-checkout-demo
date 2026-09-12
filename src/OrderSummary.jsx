import { money, taxLabel } from './ewcs.js';

// The reactive order summary. Under EWCS there is no createPreview and no
// preview DTO -- the session *is* the price preview, and it re-prices itself
// while the Buyer types, so every number here is read from the live session
// rather than from router state frozen at page load.
//
// Two things it has to get right that a static summary did not:
//
//   * The divisor. Amounts come as minorUnitsAmount plus
//     session.minorUnitsAmountDivisor, which is what replaces the hard-coded
//     /100 in the intent-first summary.
//   * The pending state. A runServerUpdate is a VIES round trip; without a
//     stale marker the Buyer stares at the old total during exactly the moment
//     the number is changing.
export default function OrderSummary({ checkout, pending }) {
  const { minorUnitsAmountDivisor: divisor, currency, total, taxAmounts, lineItems } = checkout;
  const fmt = (amount) => money(amount, divisor, currency);

  const trial = checkout.recurring?.trial || null;
  const taxes = taxAmounts || [];

  return (
    <div className={`summary${pending ? ' stale' : ''}`}>
      {(lineItems || []).map((item) => (
        <div key={item.id}>
          <span>
            {item.name}
            {item.quantity > 1 ? ` x${item.quantity}` : ''}
          </span>
          <code>{fmt(item.total)}</code>
        </div>
      ))}

      <div>
        <span>Subtotal</span>
        <code>{fmt(total.subtotal)}</code>
      </div>

      {/* The tax rate line, not the total, is what an inline VAT-ID edit moves
          visibly on a trial -- see the trial note below. Showing displayName and
          percentage means "19% -> reverse charge 0%" is legible even when the
          amount either side of it is zero. */}
      {taxes.length > 0 ? (
        taxes.map((tax) => (
          <div key={`${tax.displayName}-${tax.percentage}`}>
            <span>{taxLabel(tax)}</span>
            <code>{fmt(tax)}</code>
          </div>
        ))
      ) : (
        <div>
          <span>Tax</span>
          <code>none applied</code>
        </div>
      )}

      <div className="total">
        <span>Total due now</span>
        <strong>{pending ? 'recalculating…' : fmt(total.total)}</strong>
      </div>

      {trial && (
        <p className="warn">
          Trial ({trial.trialPeriodDays} days). <strong>The total cannot show a tax change here</strong>{' '}
          — it is {fmt(total.total)} before and after a rate swap, because the charge is deferred to
          trial end. Watch the rate line above instead. Reading <code>amount_total</code> would report
          "nothing changed" to a Buyer who just entered a valid VAT-ID.
        </p>
      )}

      {checkout.recurring && !trial && (
        <div>
          <span>Then, per {checkout.recurring.interval}</span>
          <code>{fmt(checkout.recurring.dueNext.total)}</code>
        </div>
      )}

      {checkout.tax?.status !== 'ready' && (
        <div>
          <span>Tax status</span>
          <code>{checkout.tax?.status}</code>
        </div>
      )}

      <div>
        <span>Session</span>
        <code>{checkout.id}</code>
      </div>
    </div>
  );
}
