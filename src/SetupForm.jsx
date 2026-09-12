import EwcsOptions from './EwcsOptions.jsx';

export default function SetupForm({
  config,
  publishableKey,
  clientSecret,
  onPublishableKeyChange,
  onClientSecretChange,
  prefill,
  onPrefillChange,
  error,
  suggestedMode,
  onSelectMode,
  onChangeMode,
  onSubmit,
}) {
  const ewcs = config.key === 'ewcs';

  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="lede">
        {config.label} <span className="tag">{config.intentName}</span>
      </p>

      <label>
        Publishable key (platform, pk_test_...)
        <input
          value={publishableKey}
          onChange={(e) => onPublishableKeyChange(e.target.value)}
          placeholder="pk_test_..."
          autoComplete="off"
          spellCheck="false"
        />
      </label>
      <label>
        Client secret ({config.secretExample})
        <input
          value={clientSecret}
          onChange={(e) => onClientSecretChange(e.target.value)}
          placeholder={config.secretExample}
          autoComplete="off"
          spellCheck="false"
        />
      </label>

      {ewcs && <EwcsOptions prefill={prefill} onChange={onPrefillChange} />}

      {error && <p className="err">{error}</p>}

      {suggestedMode && (
        <button type="button" className="link" onClick={() => onSelectMode(suggestedMode.key)}>
          Switch to {suggestedMode.label}
        </button>
      )}

      <button type="submit">{ewcs ? 'Mount the checkout elements' : 'Mount Payment Element'}</button>

      <button type="button" className="link" onClick={onChangeMode}>
        Pick a different flow
      </button>

      <p className="hint">
        Source: <code>{config.secretSource}</code>. Destination charge: use the{' '}
        <strong>platform</strong> publishable key, not the connected account, and no{' '}
        <code>stripeAccount</code> option.
        {ewcs && (
          <>
            {' '}
            The session must have been created with <code>ui_mode=custom</code>:{' '}
            <code>elements</code> needs API version <code>2026-03-25.dahlia</code> and is rejected on
            the pinned <code>2025-08-27.basil</code>.
          </>
        )}
      </p>
    </form>
  );
}
