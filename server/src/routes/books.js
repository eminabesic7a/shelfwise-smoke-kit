const express = require('express');
const store = require('../store');
const { badRequest, notFound, conflict } = require('../errors');
const { parseId, validateBook } = require('../validation');
const { GENRES, BOOK_SORT_FIELDS } = require('../constants');

const router = express.Router();

function findBook(id) {
  const book = store.db().books.find((b) => b.id === id);
  if (!book) throw notFound('Book');
  return book;
}

function assertIsbnUnique(isbn, exceptId) {
  const clash = store.db().books.find((b) => b.isbn === isbn && b.id !== exceptId);
  if (clash) throw conflict('A book with this ISBN already exists', { isbn: 'A book with this ISBN already exists' });
}

// GET /api/books  - list with search, filters, sorting and pagination
router.get('/', (req, res) => {
  const { search = '', genre = '', available = '', sort = 'title', order = 'asc' } = req.query;
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const pageSize = req.query.pageSize === undefined ? 10 : Number(req.query.pageSize);

  const errors = {};
  if (!Number.isInteger(page) || page < 1) errors.page = 'Page must be a positive integer';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) errors.pageSize = 'Page size must be between 1 and 100';
  if (!BOOK_SORT_FIELDS.includes(sort)) errors.sort = `Sort must be one of: ${BOOK_SORT_FIELDS.join(', ')}`;
  if (!['asc', 'desc'].includes(order)) errors.order = 'Order must be asc or desc';
  if (genre && !GENRES.includes(genre)) errors.genre = `Genre must be one of: ${GENRES.join(', ')}`;
  if (available && !['true', 'false'].includes(available)) errors.available = 'Available must be true or false';
  if (Object.keys(errors).length) throw badRequest('Invalid query parameters', errors);

 // let items = store.db().books.map(store.toBookDto);
 let items = [];

  const q = String(search).trim().toLowerCase();
  if (q) {
    items = items.filter(
      (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.isbn.includes(q),
    );
  }
  if (genre) items = items.filter((b) => b.genre === genre);
  if (available === 'true') items = items.filter((b) => b.availableCopies > 0);
  if (available === 'false') items = items.filter((b) => b.availableCopies === 0);

  const dir = order === 'desc' ? -1 : 1;
  items.sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return cmp !== 0 ? cmp * dir : a.id - b.id;
  });

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;

  res.json({ items: items.slice(start, start + pageSize), total, page, pageSize, totalPages });
});

// GET /api/books/:id  - single book including its loan history
router.get('/:id', (req, res) => {
  const book = findBook(parseId(req.params.id));
  const loans = store
    .db()
    .loans.filter((l) => l.bookId === book.id)
    .sort((a, b) => b.loanDate.localeCompare(a.loanDate))
    .map(store.toLoanDto);
  res.json({ ...store.toBookDto(book), loans });
});

// POST /api/books  - create a book
router.post('/', (req, res) => {
  const data = validateBook(req.body);
  assertIsbnUnique(data.isbn);
  const book = { id: store.nextId('book'), ...data, createdAt: new Date().toISOString() };
  store.db().books.push(book);
  res.status(201).json(store.toBookDto(book));
});

// PUT /api/books/:id  - replace a book
router.put('/:id', (req, res) => {
  const book = findBook(parseId(req.params.id));
  const data = validateBook(req.body);
  assertIsbnUnique(data.isbn, book.id);

  const onLoan = store.openLoansForBook(book.id).length;
  if (data.copies < onLoan) {
    throw conflict(`Copies cannot be lower than the ${onLoan} currently on loan`, {
      copies: `Copies cannot be lower than the ${onLoan} currently on loan`,
    });
  }

  Object.assign(book, data);
  res.json(store.toBookDto(book));
});

// DELETE /api/books/:id  - delete a book that has no open loans
router.delete('/:id', (req, res) => {
  const book = findBook(parseId(req.params.id));
  if (store.openLoansForBook(book.id).length > 0) {
    throw conflict('This book has copies on loan. Return them before deleting the book.');
  }
  const data = store.db();
  data.books = data.books.filter((b) => b.id !== book.id);
  data.loans = data.loans.filter((l) => l.bookId !== book.id);
  res.status(204).end();
});

module.exports = router;
