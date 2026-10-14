import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { GENRES, genreClass, formatDate, daysBetween } from '../lib/constants.js';
import { Loading, ErrorState, LoanStatusBadge } from '../components/Status.jsx';

// Spine height is derived from the title so the shelf looks natural but stays stable between renders.
const spineHeight = (title) => 150 + ((title.length * 37) % 70);

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi(
    () => Promise.all([api.listBooks({ pageSize: 100, sort: 'title' }), api.listMembers(), api.listLoans()]),
    [],
  );

  if (loading && !data) return <Loading label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const [books, members, loans] = data;
  const shelf = [...books.items].sort((a, b) => GENRES.indexOf(a.genre) - GENRES.indexOf(b.genre) || a.title.localeCompare(b.title));
  const onShelf = books.items.reduce((sum, b) => sum + b.availableCopies, 0);
  const active = loans.filter((l) => l.status === 'active');
  const overdue = loans.filter((l) => l.status === 'overdue');
  const recent = loans.slice(0, 5);

  return (
    <div className="page dashboard" data-testid="dashboard-page">
      <section className="shelf-hero" aria-labelledby="dashboard-title">
        <div className="shelf-intro">
          <h1 id="dashboard-title">The shelf today</h1>
          <p className="lede" data-testid="dashboard-summary">
            {books.total} titles in the catalogue, {onShelf} copies on the shelf and {active.length + overdue.length} out with members.
          </p>
        </div>
        <div className="shelf" data-testid="shelf" role="list" aria-label="Books by genre">
          {shelf.map((book) => (
            <Link
              key={book.id}
              to={`/books/${book.id}`}
              role="listitem"
              className={`spine ${genreClass(book.genre)}${book.availableCopies === 0 ? ' is-out' : ''}`}
              style={{ height: spineHeight(book.title) }}
              title={`${book.title} — ${book.author}`}
              aria-label={`${book.title} by ${book.author}${book.availableCopies === 0 ? ', all copies out' : ''}`}
              data-testid="shelf-book"
            >
              <span className="spine-title">{book.title}</span>
            </Link>
          ))}
        </div>
        <ul className="shelf-legend" aria-label="Genre colours">
          {GENRES.map((g) => (
            <li key={g}>
              <span className={`legend-swatch ${genreClass(g)}`} aria-hidden="true" />
              {g}
            </li>
          ))}
          <li>
            <span className="legend-swatch is-out" aria-hidden="true" />
            All copies out
          </li>
        </ul>
      </section>

      <dl className="stat-row" data-testid="stats">
        <div><dt>Titles</dt><dd data-testid="stat-titles">{books.total}</dd></div>
        <div><dt>Members</dt><dd data-testid="stat-members">{members.length}</dd></div>
        <div><dt>On loan</dt><dd data-testid="stat-active">{active.length}</dd></div>
        <div className={overdue.length ? 'is-alert' : ''}><dt>Overdue</dt><dd data-testid="stat-overdue">{overdue.length}</dd></div>
      </dl>

      <div className="two-col">
        <section aria-labelledby="overdue-title" className="panel">
          <div className="panel-head">
            <h2 id="overdue-title">Overdue</h2>
            <Link to="/loans?status=overdue">See all overdue</Link>
          </div>
          {overdue.length === 0 ? (
            <p className="empty" data-testid="overdue-empty">Nothing is overdue. Every loan is within its due date.</p>
          ) : (
            <ul className="plain-list" data-testid="overdue-list">
              {overdue.map((l) => (
                <li key={l.id} data-testid="overdue-item">
                  <Link to={`/books/${l.bookId}`}>{l.bookTitle}</Link>
                  <span className="muted"> with {l.memberName}, {daysBetween(l.dueDate)} days late</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-title" className="panel">
          <div className="panel-head">
            <h2 id="recent-title">Recent loans</h2>
            <Link to="/loans">All loans</Link>
          </div>
          <ul className="plain-list" data-testid="recent-loans">
            {recent.map((l) => (
              <li key={l.id} className="recent-item">
                <span>
                  <Link to={`/books/${l.bookId}`}>{l.bookTitle}</Link>
                  <span className="muted"> lent to {l.memberName} on {formatDate(l.loanDate)}</span>
                </span>
                <LoanStatusBadge status={l.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="quick-actions">
        <Link to="/books/new" className="btn btn-primary" data-testid="quick-add-book">Add a book</Link>
        <Link to="/loans?new=1" className="btn btn-quiet" data-testid="quick-new-loan">Lend a book</Link>
        <Link to="/members?new=1" className="btn btn-quiet" data-testid="quick-add-member">Register a member</Link>
      </div>
    </div>
  );
}
