import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { GENRES } from '../lib/constants.js';
import { useToast } from '../components/Toast.jsx';
import { Loading, ErrorState, Field } from '../components/Status.jsx';

const EMPTY = { title: '', author: '', isbn: '', genre: '', publishedYear: '', copies: '1', description: '' };
const DESCRIPTION_MAX = 1000;

function validate(form) {
  const errors = {};
  const maxYear = new Date().getFullYear();
  const isbn = form.isbn.replace(/[-\s]/g, '');
  const year = Number(form.publishedYear);
  const copies = Number(form.copies);

  if (!form.title.trim()) errors.title = 'Title is required';
  else if (form.title.trim().length > 200) errors.title = 'Title must be at most 200 characters';
  if (!form.author.trim()) errors.author = 'Author is required';
  else if (form.author.trim().length > 100) errors.author = 'Author must be at most 100 characters';
  if (!isbn) errors.isbn = 'ISBN is required';
  else if (!/^\d{13}$/.test(isbn)) errors.isbn = 'ISBN must contain exactly 13 digits';
  if (!form.genre) errors.genre = 'Genre is required';
  if (form.publishedYear === '') errors.publishedYear = 'Published year is required';
  else if (!Number.isInteger(year) || year < 1000 || year > maxYear) errors.publishedYear = `Published year must be between 1000 and ${maxYear}`;
  if (form.copies === '') errors.copies = 'Number of copies is required';
  else if (!Number.isInteger(copies) || copies < 1 || copies > 50) errors.copies = 'Copies must be a whole number between 1 and 50';
  if (form.description.length > DESCRIPTION_MAX) errors.description = `Description must be at most ${DESCRIPTION_MAX} characters`;
  return errors;
}

export default function BookFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loadState, setLoadState] = useState({ loading: isEdit, error: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setForm(EMPTY);
      return;
    }
    setLoadState({ loading: true, error: null });
    api
      .getBook(id)
      .then((b) => {
        setForm({
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          genre: b.genre,
          publishedYear: String(b.publishedYear),
          copies: String(b.copies),
          description: b.description || '',
        });
        setLoadState({ loading: false, error: null });
      })
      .catch((error) => setLoadState({ loading: false, error }));
  }, [id, isEdit]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError('Fix the highlighted fields and save again.');
      return;
    }
    setSaving(true);
    const payload = { ...form, publishedYear: Number(form.publishedYear), copies: Number(form.copies) };
    try {
      const saved = isEdit ? await api.updateBook(id, payload) : await api.createBook(payload);
      toast.success(isEdit ? `Saved changes to "${saved.title}"` : `Added "${saved.title}"`);
      navigate(`/books/${saved.id}`);
    } catch (err) {
      setErrors(err.details || {});
      setFormError(err.message);
      setSaving(false);
    }
  }

  if (loadState.loading) return <Loading label="Loading book…" />;
  if (loadState.error) return <ErrorState error={loadState.error} />;

  const describedBy = (field) => (errors[field] ? `${field}-error` : undefined);

  return (
    <div className="page narrow" data-testid="book-form-page">
      <Link to={isEdit ? `/books/${id}` : '/books'} className="back-link">{isEdit ? 'Back to book' : 'Books'}</Link>
      <h1>{isEdit ? 'Edit book' : 'Add a book'}</h1>

      <form onSubmit={onSubmit} noValidate className="form" data-testid="book-form">
        {formError && <p className="form-error" role="alert" data-testid="form-error">{formError}</p>}

        <Field id="title" label="Title" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy('title')} data-testid="input-title" />
        </Field>
        <Field id="author" label="Author" error={errors.author}>
          <input id="author" value={form.author} onChange={set('author')} aria-invalid={Boolean(errors.author)} aria-describedby={describedBy('author')} data-testid="input-author" />
        </Field>
        <div className="field-row">
          <Field id="isbn" label="ISBN" error={errors.isbn} hint="13 digits, hyphens allowed">
            <input id="isbn" inputMode="numeric" value={form.isbn} onChange={set('isbn')} aria-invalid={Boolean(errors.isbn)} aria-describedby={describedBy('isbn')} data-testid="input-isbn" />
          </Field>
          <Field id="genre" label="Genre" error={errors.genre}>
            <select id="genre" value={form.genre} onChange={set('genre')} aria-invalid={Boolean(errors.genre)} aria-describedby={describedBy('genre')} data-testid="input-genre">
              <option value="">Choose a genre</option>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
        </div>
        <div className="field-row">
          <Field id="publishedYear" label="Year published" error={errors.publishedYear}>
            <input id="publishedYear" type="number" value={form.publishedYear} onChange={set('publishedYear')} aria-invalid={Boolean(errors.publishedYear)} aria-describedby={describedBy('publishedYear')} data-testid="input-year" />
          </Field>
          <Field id="copies" label="Copies owned" error={errors.copies} hint="1 to 50">
            <input id="copies" type="number" min="1" max="50" value={form.copies} onChange={set('copies')} aria-invalid={Boolean(errors.copies)} aria-describedby={describedBy('copies')} data-testid="input-copies" />
          </Field>
        </div>
        <Field id="description" label="Description (optional)" error={errors.description}>
          <textarea id="description" rows="4" value={form.description} onChange={set('description')} aria-invalid={Boolean(errors.description)} aria-describedby={describedBy('description')} data-testid="input-description" />
        </Field>
        <p className={`char-count${form.description.length > DESCRIPTION_MAX ? ' is-over' : ''}`} data-testid="description-count">
          {form.description.length} / {DESCRIPTION_MAX}
        </p>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving} data-testid="save-book">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add book'}
          </button>
          <Link to={isEdit ? `/books/${id}` : '/books'} className="btn btn-quiet" data-testid="cancel">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
