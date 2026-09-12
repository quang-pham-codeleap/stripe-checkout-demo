export default function Footer({ config }) {
  return (
    <footer>
      <p>
        {config ? (
          <>
            Maps to <code>{config.doc}</code>, {config.diagram}, confirmed with{' '}
            <code>{config.confirmCall}</code>.
          </>
        ) : (
          <>
            Maps to <code>ewcs-migration.md</code> (EWCS) and{' '}
            <code>app-flows-phase-3-transaction-engine.md</code> Diagram 5 (immediate charge) and
            Diagram 6 (free trial).
          </>
        )}
      </p>
    </footer>
  );
}
