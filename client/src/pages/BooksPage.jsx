import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { GENRES, genreClass } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import Pagination from '../components/Pagination.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Loading, ErrorState, AvailabilityBadge } from '../components/Status.jsx';

const PAGE_SIZE = 10;

export default function BooksPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const query = {
    search: params.get('search') || '',
    genre: params.get('genre') || '',
    available: params.get('available') || '',
    sort: params.get('sort') || 'title',
    order: params.get('order') || 'asc',
    page: Number(params.get('page') || 1),
  };

  const [searchInput, setSearchInput] = useState(query.search);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, error, loading, reload } = useApi(() => api.listBooks({ ...query, pageSize: PAGE_SIZE }), [params.toString()]);

  function updateParams(changes, resetPage = true) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) next.delete(key);
      else next.set(key, String(value));
    });
    if (resetPage) next.delete('page');
    setParams(next);
  }

  // Debounce typing into the search box before updating the URL (and fetching).
  useEffect(() => {
    if (searchInput === query.search) return undefined;
    const t = setTimeout(() => updateParams({ search: searchInput }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Keep the input in sync on back/forward navigation.
  useEffect(() => setSearchInput(query.search), [query.search]);

  const hasFilters = Boolean(query.search || query.genre || query.available);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteBook(toDelete.id);
      toast.success(`Deleted "${toDelete.title}"`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? first + data.items.length - 1 : 0;

  return (
    <div className="page" data-testid="books-page">
      <div className="page-head">
        <h1>Books</h1>
        <Link to="/books/new" className="btn btn-primary" data-testid="add-book-button">Add book</Link>
      </div>

      <div className="toolbar" role="search">
        <div className="field field-grow">
          <label htmlFor="book-search">Search</label>
          <input
            id="book-search"
            type="search"
            placeholder="Title, author or ISBN"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            data-testid="book-search"
          />
        </div>
        <div className="field">
          <label htmlFor="genre-filter">Genre</label>
          <select id="genre-filter" value={query.genre} onChange={(e) => updateParams({ genre: e.target.value })} data-testid="genre-filter">
            <option value="">All genres</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="availability-filter">Availability</label>
          <select id="availability-filter" value={query.available} onChange={(e) => updateParams({ available: e.target.value })} data-testid="availability-filter">
            <option value="">Any</option>
            <option value="true">On the shelf</option>
            <option value="false">All copies out</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort-select">Sort by</label>
          <select id="sort-select" value={query.sort} onChange={(e) => updateParams({ sort: e.target.value }, false)} data-testid="sort-select">
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="publishedYear">Year published</option>
            <option value="createdAt">Date added</option>
          </select>
        </div>
        <button
          type="button"
          className="btn btn-quiet order-btn"
          onClick={() => updateParams({ order: query.order === 'asc' ? 'desc' : 'asc' }, false)}
          aria-label={query.order === 'asc' ? 'Sort descending' : 'Sort ascending'}
          data-testid="sort-order"
        >
          {query.order === 'asc' ? 'A → Z' : 'Z → A'}
        </button>
        {hasFilters && (
          <button
            type="button"
            className="btn btn-link"
            onClick={() => { setSearchInput(''); setParams(new URLSearchParams()); }}
            data-testid="clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && loading && <Loading label="Loading books…" />}

      {data && (
        <>
          <p className="result-count" aria-live="polite" data-testid="result-count">
            {data.total === 0 ? 'No books found' : `Showing ${first}–${last} of ${data.total} books`}
            {loading && <span className="muted"> (updating)</span>}
          </p>

          {data.items.length === 0 ? (
            <div className="empty-block" data-testid="books-empty">
              <p>No books match these filters.</p>
              {hasFilters ? (
                <button type="button" className="btn btn-quiet" onClick={() => { setSearchInput(''); setParams(new URLSearchParams()); }}>
                  Clear filters
                </button>
              ) : (
                <Link to="/books/new" className="btn btn-primary">Add the first book</Link>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table" data-testid="books-table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Author</th>
                    <th scope="col">Genre</th>
                    <th scope="col" className="num">Year</th>
                    <th scope="col">Availability</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((book) => (
                    <tr key={book.id} data-testid="book-row" data-book-id={book.id}>
                      <td>
                        <span className={`row-spine ${genreClass(book.genre)}`} aria-hidden="true" />
                        <Link to={`/books/${book.id}`} className="title-link" data-testid="book-title">{book.title}</Link>
                      </td>
                      <td data-testid="book-author">{book.author}</td>
                      <td data-testid="book-genre">{book.genre}</td>
                      <td className="num" data-testid="book-year">{book.publishedYear}</td>
                      <td><AvailabilityBadge available={book.availableCopies} total={book.copies} /></td>
                      <td className="row-actions">
                        <Link to={`/books/${book.id}/edit`} className="btn btn-small btn-quiet" data-testid="edit-book">Edit</Link>
                        <button type="button" className="btn btn-small btn-danger-quiet" onClick={() => setToDelete(book)} data-testid="delete-book">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => updateParams({ page: p }, false)} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this book?"
        message={toDelete ? `"${toDelete.title}" and its returned-loan history will be removed. This cannot be undone.` : ''}
        confirmLabel="Delete book"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
