export default function SetupForm({
  publishableKey,
  clientSecret,
  onPublishableKeyChange,
  onClientSecretChange,
  error,
  onSubmit,
}) {
  return (
    <form className="card" onSubmit={onSubmit}>
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
        Client secret (pi_..._secret_...)
        <input
          value={clientSecret}
          onChange={(e) => onClientSecretChange(e.target.value)}
          placeholder="pi_..._secret_..."
          autoComplete="off"
          spellCheck="false"
        />
      </label>
      {error && <p className="err">{error}</p>}
      <button type="submit">Mount Payment Element</button>
      <p className="hint">
        Destination charge: use the <strong>platform</strong> publishable key, not the connected account,
        and no <code>stripeAccount</code> option.
      </p>
    </form>
  );
}
