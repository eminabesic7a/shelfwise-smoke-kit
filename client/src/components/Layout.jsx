import { NavLink, Outlet, Link } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/books', label: 'Books' },
  { to: '/members', label: 'Members' },
  { to: '/loans', label: 'Loans' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" data-testid="brand-link">
            <span className="brand-mark" aria-hidden="true">
              <i /><i /><i />
            </span>
            Shelfwise
          </Link>
          <nav aria-label="Main navigation">
            <ul className="nav-list">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className="nav-link" data-testid={`nav-${item.label.toLowerCase()}`}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="container main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">Shelfwise Library. Sample data resets whenever the server restarts.</div>
      </footer>
    </div>
  );
}
