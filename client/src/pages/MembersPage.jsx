import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useDebounced } from '../lib/useApi.js';
import { MEMBERSHIP_TYPES, LOAN_LIMITS, formatDate } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import { Loading, ErrorState, Field } from '../components/Status.jsx';

const EMPTY = { name: '', email: '', membershipType: 'Standard' };

function validate(form) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length < 2 || name.length > 100) errors.name = 'Name must be between 2 and 100 characters';
  if (!email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email must be a valid email address';
  return errors;
}

export default function MembersPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { data, error, loading, reload } = useApi(() => api.listMembers({ search: debounced }), [debounced]);

  const formOpen = params.get('new') === '1';
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function toggleForm(open) {
    const next = new URLSearchParams(params);
    if (open) next.set('new', '1');
    else next.delete('new');
    setParams(next);
    if (!open) {
      setForm(EMPTY);
      setErrors({});
    }
  }

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const member = await api.createMember(form);
      toast.success(`Registered ${member.name}`);
      toggleForm(false);
      reload();
    } catch (err) {
      setErrors({ ...err.details, form: Object.keys(err.details || {}).length ? '' : err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" data-testid="members-page">
      <div className="page-head">
        <h1>Members</h1>
        {!formOpen && (
          <button type="button" className="btn btn-primary" onClick={() => toggleForm(true)} data-testid="add-member-button">
            Register member
          </button>
        )}
      </div>

      {formOpen && (
        <section className="panel form-panel" aria-labelledby="new-member-title">
          <h2 id="new-member-title">Register a member</h2>
          <form onSubmit={onSubmit} noValidate className="form" data-testid="member-form">
            {errors.form && <p className="form-error" role="alert" data-testid="form-error">{errors.form}</p>}
            <div className="field-row">
              <Field id="member-name" label="Full name" error={errors.name}>
                <input id="member-name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} data-testid="input-name" />
              </Field>
              <Field id="member-email" label="Email" error={errors.email}>
                <input id="member-email" type="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} data-testid="input-email" />
              </Field>
            </div>
            <fieldset className="radio-group">
              <legend>Membership</legend>
              {MEMBERSHIP_TYPES.map((type) => (
                <label key={type} className="radio">
                  <input
                    type="radio"
                    name="membershipType"
                    value={type}
                    checked={form.membershipType === type}
                    onChange={set('membershipType')}
                    data-testid={`membership-${type.toLowerCase()}`}
                  />
                  {type} <span className="muted">(up to {LOAN_LIMITS[type]} books at a time)</span>
                </label>
              ))}
            </fieldset>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving} data-testid="save-member">
                {saving ? 'Registering…' : 'Register member'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => toggleForm(false)} data-testid="cancel-member">Cancel</button>
            </div>
          </form>
        </section>
      )}

      <div className="toolbar" role="search">
        <div className="field field-grow">
          <label htmlFor="member-search">Search</label>
          <input id="member-search" type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="member-search" />
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && loading && <Loading label="Loading members…" />}
      {data && data.length === 0 && (
        <p className="empty-block" data-testid="members-empty">No members match “{debounced}”.</p>
      )}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table" data-testid="members-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Membership</th>
                <th scope="col">Books out</th>
                <th scope="col">Joined</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} data-testid="member-row" data-member-id={m.id}>
                  <td data-testid="member-name">{m.name}</td>
                  <td data-testid="member-email">{m.email}</td>
                  <td><span className={`badge badge-${m.membershipType.toLowerCase()}`} data-testid="member-type">{m.membershipType}</span></td>
                  <td data-testid="member-loans">
                    {m.activeLoans} / {m.loanLimit}
                    {m.overdueLoans > 0 && <span className="badge badge-overdue inline-badge">{m.overdueLoans} overdue</span>}
                  </td>
                  <td>{formatDate(m.joinedAt)}</td>
                  <td className="row-actions">
                    <Link to={`/loans?memberId=${m.id}`} className="btn btn-small btn-quiet" data-testid="view-member-loans">View loans</Link>
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
