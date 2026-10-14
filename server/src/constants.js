const GENRES = [
  'Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Non-Fiction',
  'History',
  'Science',
  'Biography',
];

const MEMBERSHIP_TYPES = ['Standard', 'Premium'];

// Maximum number of books a member can have on loan at the same time.
const LOAN_LIMITS = { Standard: 3, Premium: 5 };

const DEFAULT_LOAN_DAYS = 14;
const MAX_LOAN_DAYS = 30;

const BOOK_SORT_FIELDS = ['title', 'author', 'publishedYear', 'createdAt'];
const LOAN_STATUSES = ['active', 'overdue', 'returned'];

module.exports = {
  GENRES,
  MEMBERSHIP_TYPES,
  LOAN_LIMITS,
  DEFAULT_LOAN_DAYS,
  MAX_LOAN_DAYS,
  BOOK_SORT_FIELDS,
  LOAN_STATUSES,
};
