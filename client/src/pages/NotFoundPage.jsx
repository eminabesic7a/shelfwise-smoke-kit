import { Link, useLocation } from 'react-router-dom';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="page narrow not-found" data-testid="not-found-page">
      <h1>This page isn’t on the shelf</h1>
      <p>Nothing lives at <code>{pathname}</code>. Check the address, or head back to the catalogue.</p>
      <div className="form-actions">
        <Link to="/" className="btn btn-primary">Go to dashboard</Link>
        <Link to="/books" className="btn btn-quiet">Browse books</Link>
      </div>
    </div>
  );
}
