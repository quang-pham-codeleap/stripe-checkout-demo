export default function Footer({ config }) {
  return (
    <footer>
      <p>
        Maps to <code>app-flows-phase-3-transaction-engine.md</code>
        {config ? (
          <>
            {' '}
            {config.diagram}, confirmed with <code>{config.confirmCall}</code>.
          </>
        ) : (
          <> Diagram 5 (immediate charge) and Diagram 6 (free trial).</>
        )}
      </p>
    </footer>
  );
}
