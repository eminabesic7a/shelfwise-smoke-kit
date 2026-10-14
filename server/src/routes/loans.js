const express = require('express');
const store = require('../store');
const { badRequest, notFound, conflict } = require('../errors');
const { parseId, validateLoan } = require('../validation');
const { LOAN_STATUSES, LOAN_LIMITS } = require('../constants');

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;

// GET /api/loans  - list loans (optional ?status=active|overdue|returned&memberId=&bookId=)
router.get('/', (req, res) => {
  const { status = '' } = req.query;
  if (status && !LOAN_STATUSES.includes(status)) {
    throw badRequest('Invalid query parameters', { status: `Status must be one of: ${LOAN_STATUSES.join(', ')}` });
  }
  const memberId = req.query.memberId ? parseId(req.query.memberId, 'memberId') : null;
  const bookId = req.query.bookId ? parseId(req.query.bookId, 'bookId') : null;

  let loans = store.db().loans.map(store.toLoanDto);
  if (status) loans = loans.filter((l) => l.status === status);
  if (memberId) loans = loans.filter((l) => l.memberId === memberId);
  if (bookId) loans = loans.filter((l) => l.bookId === bookId);
  loans.sort((a, b) => b.loanDate.localeCompare(a.loanDate) || b.id - a.id);

  res.json(loans);
});

// POST /api/loans  - lend a book to a member
// Rules are checked in this order: member has overdue loans -> member at loan limit
// -> member already holds this book -> no copies available.
router.post('/', (req, res) => {
  const { bookId, memberId, days } = validateLoan(req.body);
  const data = store.db();

  const book = data.books.find((b) => b.id === bookId);
  if (!book) throw notFound('Book');
  const member = data.members.find((m) => m.id === memberId);
  if (!member) throw notFound('Member');

  const memberLoans = store.openLoansForMember(member.id);
  if (memberLoans.some((l) => store.loanStatus(l) === 'overdue')) {
    throw conflict(`${member.name} has overdue loans and cannot borrow until they are returned`);
  }
  const limit = LOAN_LIMITS[member.membershipType];
  if (memberLoans.length >= limit) {
    throw conflict(`${member.name} has reached the loan limit of ${limit} for ${member.membershipType} membership`);
  }
  if (memberLoans.some((l) => l.bookId === book.id)) {
    throw conflict(`${member.name} already has a copy of "${book.title}"`);
  }
  if (store.toBookDto(book).availableCopies < 1) {
    throw conflict(`No copies of "${book.title}" are available`);
  }

  const now = Date.now();
  const loan = {
    id: store.nextId('loan'),
    bookId: book.id,
    memberId: member.id,
    loanDate: new Date(now).toISOString(),
    dueDate: new Date(now + days * DAY).toISOString(),
    returnedAt: null,
  };
  data.loans.push(loan);
  res.status(201).json(store.toLoanDto(loan));
});

// PATCH /api/loans/:id/return  - mark a loan as returned
router.patch('/:id/return', (req, res) => {
  const loan = store.db().loans.find((l) => l.id === parseId(req.params.id));
  if (!loan) throw notFound('Loan');
  if (loan.returnedAt) throw conflict('This loan has already been returned');
  loan.returnedAt = new Date().toISOString();
  res.json(store.toLoanDto(loan));
});

module.exports = router;
