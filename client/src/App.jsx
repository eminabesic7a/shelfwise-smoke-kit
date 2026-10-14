import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BooksPage from './pages/BooksPage.jsx';
import BookDetailsPage from './pages/BookDetailsPage.jsx';
import BookFormPage from './pages/BookFormPage.jsx';
import MembersPage from './pages/MembersPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="books" element={<BooksPage />} />
          <Route path="books/new" element={<BookFormPage />} />
          <Route path="books/:id" element={<BookDetailsPage />} />
          <Route path="books/:id/edit" element={<BookFormPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="loans" element={<LoansPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
