export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="pagination" aria-label="Pagination" data-testid="pagination">
      <button type="button" className="btn btn-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)} data-testid="page-prev">
        Previous
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`page-btn${p === page ? ' is-current' : ''}`}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Page ${p}`}
          onClick={() => onChange(p)}
          data-testid={`page-${p}`}
        >
          {p}
        </button>
      ))}
      <button type="button" className="btn btn-quiet" disabled={page >= totalPages} onClick={() => onChange(page + 1)} data-testid="page-next">
        Next
      </button>
    </nav>
  );
}
