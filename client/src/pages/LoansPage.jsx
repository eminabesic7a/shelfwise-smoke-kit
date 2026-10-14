import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { DEFAULT_LOAN_DAYS, MAX_LOAN_DAYS, formatDate } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import { Loading, ErrorState, LoanStatusBadge, Field } from '../components/Status.jsx';

const TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'On loan' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'returned', label: 'Returned' },
];

export default function LoansPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const memberId = params.get('memberId') || '';
  const formOpen = params.get('new') === '1';

  const { data: loans, error, loading, reload } = useApi(() => api.listLoans({ status, memberId }), [status, memberId]);
  const { data: members, reload: reloadMembers } = useApi(() => api.listMembers(), []);
  const { data: books, reload: reloadBooks } = useApi(
    () => (formOpen ? api.listBooks({ available: 'true', pageSize: 100 }) : Promise.resolve(null)),
    [formOpen],
  );

  const [form, setForm] = useState({ bookId: '', memberId: '', days: String(DEFAULT_LOAN_DAYS) });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [returningId, setReturningId] = useState(null);

  const filterMember = members?.find((m) => String(m.id) === memberId);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFormErrors((errs) => ({ ...errs, [field]: undefined, form: undefined }));
  };

  async function createLoan(e) {
    e.preventDefault();
    const errs = {};
    if (!form.bookId) errs.bookId = 'Choose a book';
    if (!form.memberId) errs.memberId = 'Choose a member';
    const days = Number(form.days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_LOAN_DAYS) errs.days = `Loan period must be between 1 and ${MAX_LOAN_DAYS} days`;
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const loan = await api.createLoan({ bookId: Number(form.bookId), memberId: Number(form.memberId), days });
      toast.success(`Lent "${loan.bookTitle}" to ${loan.memberName}. Due ${formatDate(loan.dueDate)}`);
      setForm({ bookId: '', memberId: '', days: String(DEFAULT_LOAN_DAYS) });
      setParam('new', '');
      reload();
      reloadBooks();
      reloadMembers();
    } catch (err) {
      setFormErrors({ ...err.details, form: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function markReturned(loan) {
    setReturningId(loan.id);
    try {
      await api.returnLoan(loan.id);
      toast.success(`Returned "${loan.bookTitle}" from ${loan.memberName}`);
      reload();
      reloadBooks();
      reloadMembers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReturningId(null);
    }
  }

  return (
    <div className="page" data-testid="loans-page">
      <div className="page-head">
        <h1>Loans</h1>
        {!formOpen && (
          <button type="button" className="btn btn-primary" onClick={() => setParam('new', '1')} data-testid="new-loan-button">
            Lend a book
          </button>
        )}
      </div>

      {formOpen && (
        <section className="panel form-panel" aria-labelledby="new-loan-title">
          <h2 id="new-loan-title">Lend a book</h2>
          <form onSubmit={createLoan} noValidate className="form" data-testid="loan-form">
            {formErrors.form && <p className="form-error" role="alert" data-testid="form-error">{formErrors.form}</p>}
            <div className="field-row three">
              <Field id="loan-book" label="Book" error={formErrors.bookId} hint="Only books with a copy on the shelf">
                <select id="loan-book" value={form.bookId} onChange={set('bookId')} data-testid="loan-book">
                  <option value="">Choose a book</option>
                  {(books?.items || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} on shelf)</option>
                  ))}
                </select>
              </Field>
              <Field id="loan-member" label="Member" error={formErrors.memberId}>
                <select id="loan-member" value={form.memberId} onChange={set('memberId')} data-testid="loan-member">
                  <option value="">Choose a member</option>
                  {(members || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.activeLoans}/{m.loanLimit} on loan)</option>
                  ))}
                </select>
              </Field>
              <Field id="loan-days" label="Days" error={formErrors.days}>
                <input id="loan-days" type="number" min="1" max={MAX_LOAN_DAYS} value={form.days} onChange={set('days')} data-testid="loan-days" />
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving} data-testid="save-loan">
                {saving ? 'Lending…' : 'Lend book'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setParam('new', '')} data-testid="cancel-loan">Cancel</button>
            </div>
          </form>
        </section>
      )}

      <div className="tabs" role="tablist" aria-label="Filter loans by status">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`tab${status === tab.value ? ' is-selected' : ''}`}
            onClick={() => setParam('status', tab.value)}
            data-testid={`tab-${tab.value || 'all'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {memberId && (
        <p className="filter-chip" data-testid="member-filter">
          Showing loans for <strong>{filterMember ? filterMember.name : `member #${memberId}`}</strong>
          <button type="button" className="btn btn-link" onClick={() => setParam('memberId', '')} data-testid="clear-member-filter">
            Show all members
          </button>
        </p>
      )}

      {error && <ErrorState error={error} onRetry={reload} />}
      {!loans && loading && <Loading label="Loading loans…" />}
      {loans && loans.length === 0 && (
        <p className="empty-block" data-testid="loans-empty">No loans match this filter.</p>
      )}
      {loans && loans.length > 0 && (
        <div className="table-wrap">
          <table className="table" data-testid="loans-table">
            <thead>
              <tr>
                <th scope="col">Book</th>
                <th scope="col">Member</th>
                <th scope="col">Lent</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className={loan.status === 'overdue' ? 'row-overdue' : ''} data-testid="loan-row" data-loan-id={loan.id}>
                  <td><Link to={`/books/${loan.bookId}`} data-testid="loan-book-title">{loan.bookTitle}</Link></td>
                  <td data-testid="loan-member-name">{loan.memberName}</td>
                  <td>{formatDate(loan.loanDate)}</td>
                  <td data-testid="loan-due">{formatDate(loan.dueDate)}</td>
                  <td><LoanStatusBadge status={loan.status} /></td>
                  <td className="row-actions">
                    {loan.status === 'returned' ? (
                      <span className="muted">{formatDate(loan.returnedAt)}</span>
                    ) : (
                      <button type="button" className="btn btn-small btn-quiet" disabled={returningId === loan.id} onClick={() => markReturned(loan)} data-testid="return-loan">
                        {returningId === loan.id ? 'Returning…' : 'Mark returned'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
