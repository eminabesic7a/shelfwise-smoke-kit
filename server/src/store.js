const { createSeed } = require('./seed');
const { LOAN_LIMITS } = require('./constants');

// In-memory data store. Data resets on every server restart (and via POST /api/test/reset).
const state = { data: null };

function reset() {
  state.data = createSeed();
}
reset();

const db = () => state.data;
const nextId = (kind) => state.data.nextId[kind]++;

const isOpen = (loan) => !loan.returnedAt;

function loanStatus(loan, now = Date.now()) {
  if (loan.returnedAt) return 'returned';
  return new Date(loan.dueDate).getTime() < now ? 'overdue' : 'active';
}

const openLoansForBook = (bookId) => db().loans.filter((l) => l.bookId === bookId && isOpen(l));
const openLoansForMember = (memberId) => db().loans.filter((l) => l.memberId === memberId && isOpen(l));

function toBookDto(book) {
  return { ...book, availableCopies: book.copies - openLoansForBook(book.id).length };
}

function toMemberDto(member) {
  const open = openLoansForMember(member.id);
  return {
    ...member,
    activeLoans: open.length,
    overdueLoans: open.filter((l) => loanStatus(l) === 'overdue').length,
    loanLimit: LOAN_LIMITS[member.membershipType],
  };
}

function toLoanDto(loan) {
  const book = db().books.find((b) => b.id === loan.bookId);
  const member = db().members.find((m) => m.id === loan.memberId);
  return {
    ...loan,
    status: loanStatus(loan),
    bookTitle: book ? book.title : null,
    memberName: member ? member.name : null,
  };
}

module.exports = {
  db,
  reset,
  nextId,
  loanStatus,
  openLoansForBook,
  openLoansForMember,
  toBookDto,
  toMemberDto,
  toLoanDto,
};
