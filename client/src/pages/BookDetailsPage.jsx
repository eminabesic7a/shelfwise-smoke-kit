import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { DEFAULT_LOAN_DAYS, MAX_LOAN_DAYS, genreClass, formatDate } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Loading, ErrorState, AvailabilityBadge, LoanStatusBadge, Field } from '../components/Status.jsx';

export default function BookDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: book, error, loading, reload } = useApi(() => api.getBook(id), [id]);
  const { data: members, reload: reloadMembers } = useApi(() => api.listMembers(), []);

  const [memberId, setMemberId] = useState('');
  const [days, setDays] = useState(String(DEFAULT_LOAN_DAYS));
  const [lendError, setLendError] = useState('');
  const [lending, setLending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [returningId, setReturningId] = useState(null);

  if (loading && !book) return <Loading label="Loading book…" />;
  if (error?.status === 404) {
    return (
      <div className="page" data-testid="book-not-found">
        <h1>Book not found</h1>
        <p>There is no book with id {id}. It may have been deleted.</p>
        <Link to="/books" className="btn btn-quiet">Back to books</Link>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function lend(e) {
    e.preventDefault();
    setLendError('');
    if (!memberId) {
      setLendError('Choose a member to lend this book to.');
      return;
    }
    setLending(true);
    try {
      const loan = await api.createLoan({ bookId: book.id, memberId: Number(memberId), days: Number(days) });
      toast.success(`Lent to ${loan.memberName}. Due ${formatDate(loan.dueDate)}`);
      setMemberId('');
      setDays(String(DEFAULT_LOAN_DAYS));
      reload();
      reloadMembers();
    } catch (err) {
      setLendError(err.details?.days || err.message);
    } finally {
      setLending(false);
    }
  }

  async function markReturned(loan) {
    setReturningId(loan.id);
    try {
      await api.returnLoan(loan.id);
      toast.success(`Returned from ${loan.memberName}`);
      reload();
      reloadMembers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReturningId(null);
    }
  }

  async function deleteBook() {
    setDeleting(true);
    try {
      await api.deleteBook(book.id);
      toast.success(`Deleted "${book.title}"`);
      navigate('/books');
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const noCopies = book.availableCopies === 0;

  return (
    <div className="page" data-testid="book-details-page">
      <Link to="/books" className="back-link">Books</Link>

      <div className="book-head">
        <span className={`cover-spine ${genreClass(book.genre)}`} aria-hidden="true" />
        <div className="book-head-text">
          <h1 data-testid="book-title">{book.title}</h1>
          <p className="byline" data-testid="book-author">by {book.author}</p>
          <AvailabilityBadge available={book.availableCopies} total={book.copies} />
        </div>
        <div className="head-actions">
          <Link to={`/books/${book.id}/edit`} className="btn btn-quiet" data-testid="edit-book">Edit</Link>
          <button type="button" className="btn btn-danger-quiet" onClick={() => setConfirmDelete(true)} data-testid="delete-book">Delete</button>
        </div>
      </div>

      <div className="two-col">
        <section className="panel" aria-labelledby="details-title">
          <h2 id="details-title">Details</h2>
          <dl className="detail-list">
            <div><dt>ISBN</dt><dd data-testid="book-isbn">{book.isbn}</dd></div>
            <div><dt>Genre</dt><dd data-testid="book-genre">{book.genre}</dd></div>
            <div><dt>Published</dt><dd data-testid="book-year">{book.publishedYear}</dd></div>
            <div><dt>Copies owned</dt><dd data-testid="book-copies">{book.copies}</dd></div>
            <div><dt>Added</dt><dd>{formatDate(book.createdAt)}</dd></div>
          </dl>
          {book.description && <p className="description" data-testid="book-description">{book.description}</p>}
        </section>

        <section className="panel" aria-labelledby="lend-title">
          <h2 id="lend-title">Lend this book</h2>
          {noCopies && <p className="notice" data-testid="no-copies-notice">Every copy is out. Return a copy before lending it again.</p>}
          <form onSubmit={lend} noValidate data-testid="lend-form">
            <Field id="lend-member" label="Member">
              <select id="lend-member" value={memberId} onChange={(e) => setMemberId(e.target.value)} disabled={noCopies} data-testid="lend-member">
                <option value="">Choose a member</option>
                {(members || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.activeLoans}/{m.loanLimit} on loan)
                  </option>
                ))}
              </select>
            </Field>
            <Field id="lend-days" label="Loan period in days" hint={`Between 1 and ${MAX_LOAN_DAYS} days`}>
              <input id="lend-days" type="number" min="1" max={MAX_LOAN_DAYS} value={days} onChange={(e) => setDays(e.target.value)} disabled={noCopies} data-testid="lend-days" />
            </Field>
            {lendError && <p className="form-error" role="alert" data-testid="lend-error">{lendError}</p>}
            <button type="submit" className="btn btn-primary" disabled={noCopies || lending} data-testid="lend-submit">
              {lending ? 'Lending…' : 'Lend book'}
            </button>
          </form>
        </section>
      </div>

      <section className="panel" aria-labelledby="history-title">
        <h2 id="history-title">Loan history</h2>
        {book.loans.length === 0 ? (
          <p className="empty" data-testid="history-empty">This book has never been lent out.</p>
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="loan-history">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Lent</th>
                  <th scope="col">Due</th>
                  <th scope="col">Returned</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {book.loans.map((loan) => (
                  <tr key={loan.id} data-testid="history-row" data-loan-id={loan.id}>
                    <td>{loan.memberName}</td>
                    <td>{formatDate(loan.loanDate)}</td>
                    <td>{formatDate(loan.dueDate)}</td>
                    <td>{formatDate(loan.returnedAt)}</td>
                    <td><LoanStatusBadge status={loan.status} /></td>
                    <td className="row-actions">
                      {loan.status !== 'returned' && (
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
      </section>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this book?"
        message={`"${book.title}" and its returned-loan history will be removed. This cannot be undone.`}
        confirmLabel="Delete book"
        busy={deleting}
        onConfirm={deleteBook}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
