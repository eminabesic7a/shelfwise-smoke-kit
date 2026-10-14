const { badRequest } = require('./errors');
const { GENRES, MEMBERSHIP_TYPES, MAX_LOAN_DAYS, DEFAULT_LOAN_DAYS } = require('./constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isBlank = (v) => v === undefined || v === null || v === '';
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function fail(errors) {
  if (Object.keys(errors).length > 0) throw badRequest('Validation failed', errors);
}

function parseId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw badRequest(`Invalid ${field}`, { [field]: 'Must be a positive integer' });
  }
  return n;
}

function validateBook(body = {}) {
  const errors = {};
  const title = str(body.title);
  const author = str(body.author);
  const isbn = typeof body.isbn === 'string' ? body.isbn.replace(/[-\s]/g, '') : '';
  const description = str(body.description);
  const maxYear = new Date().getFullYear();

  if (!title) errors.title = 'Title is required';
  else if (title.length > 200) errors.title = 'Title must be at most 200 characters';

  if (!author) errors.author = 'Author is required';
  else if (author.length > 100) errors.author = 'Author must be at most 100 characters';

  if (!isbn) errors.isbn = 'ISBN is required';
  else if (!/^\d{13}$/.test(isbn)) errors.isbn = 'ISBN must contain exactly 13 digits';

  if (isBlank(body.genre)) errors.genre = 'Genre is required';
  else if (!GENRES.includes(body.genre)) errors.genre = `Genre must be one of: ${GENRES.join(', ')}`;

  const year = Number(body.publishedYear);
  if (isBlank(body.publishedYear)) errors.publishedYear = 'Published year is required';
  else if (!Number.isInteger(year) || year < 1000 || year > maxYear) {
    errors.publishedYear = `Published year must be between 1000 and ${maxYear}`;
  }

  const copies = Number(body.copies);
  if (isBlank(body.copies)) errors.copies = 'Number of copies is required';
  else if (!Number.isInteger(copies) || copies < 1 || copies > 50) {
    errors.copies = 'Copies must be a whole number between 1 and 50';
  }

  if (description.length > 1000) errors.description = 'Description must be at most 1000 characters';

  fail(errors);
  return { title, author, isbn, genre: body.genre, publishedYear: year, copies, description };
}

function validateMember(body = {}) {
  const errors = {};
  const name = str(body.name);
  const email = str(body.email).toLowerCase();

  if (!name) errors.name = 'Name is required';
  else if (name.length < 2 || name.length > 100) errors.name = 'Name must be between 2 and 100 characters';

  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email)) errors.email = 'Email must be a valid email address';

  if (isBlank(body.membershipType)) errors.membershipType = 'Membership type is required';
  else if (!MEMBERSHIP_TYPES.includes(body.membershipType)) {
    errors.membershipType = `Membership type must be one of: ${MEMBERSHIP_TYPES.join(', ')}`;
  }

  fail(errors);
  return { name, email, membershipType: body.membershipType };
}

function validateLoan(body = {}) {
  const errors = {};
  const bookId = Number(body.bookId);
  const memberId = Number(body.memberId);
  const days = isBlank(body.days) ? DEFAULT_LOAN_DAYS : Number(body.days);

  if (isBlank(body.bookId)) errors.bookId = 'Book is required';
  else if (!Number.isInteger(bookId) || bookId < 1) errors.bookId = 'Book id must be a positive integer';

  if (isBlank(body.memberId)) errors.memberId = 'Member is required';
  else if (!Number.isInteger(memberId) || memberId < 1) errors.memberId = 'Member id must be a positive integer';

  if (!Number.isInteger(days) || days < 1 || days > MAX_LOAN_DAYS) {
    errors.days = `Loan period must be between 1 and ${MAX_LOAN_DAYS} days`;
  }

  fail(errors);
  return { bookId, memberId, days };
}

module.exports = { parseId, validateBook, validateMember, validateLoan };
