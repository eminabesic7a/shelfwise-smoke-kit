const LABELS = { active: 'On loan', overdue: 'Overdue', returned: 'Returned' };

export function LoanStatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`} data-testid="loan-status">
      {LABELS[status] || status}
    </span>
  );
}

export function AvailabilityBadge({ available, total }) {
  const state = available === 0 ? 'none' : available < total ? 'some' : 'all';
  return (
    <span className={`availability availability-${state}`} data-testid="availability">
      {available === 0 ? 'All copies out' : `${available} of ${total} on shelf`}
    </span>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading" role="status" data-testid="loading">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert" data-testid="error-state">
      <p>{error?.message || 'Something went wrong while loading this page.'}</p>
      {onRetry && (
        <button type="button" className="btn btn-quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`} data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
