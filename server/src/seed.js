const DAY = 24 * 60 * 60 * 1000;

/**
 * Builds a fresh, deterministic data set. Dates are relative to "now" so that
 * the seeded loans always contain active, overdue and returned examples.
 */
function createSeed(now = Date.now()) {
  const daysAgo = (n) => new Date(now - n * DAY).toISOString();

  const rawBooks = [
    ['Pride and Prejudice', 'Jane Austen', 'Fiction', 1813, 3, 'A sharp comedy of manners about first impressions.'],
    ['1984', 'George Orwell', 'Science Fiction', 1949, 4, 'A surveillance state and the man who quietly resists it.'],
    ['The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 1937, 2, 'A reluctant hobbit joins a company of dwarves on a quest.'],
    ['The Hound of the Baskervilles', 'Arthur Conan Doyle', 'Mystery', 1902, 2, 'Holmes and Watson investigate a family curse on the moors.'],
    ['A Brief History of Time', 'Stephen Hawking', 'Science', 1988, 2, 'Black holes, the big bang and the nature of time.'],
    ['Sapiens', 'Yuval Noah Harari', 'History', 2011, 3, 'How one species of human came to dominate the planet.'],
    ['Frankenstein', 'Mary Shelley', 'Science Fiction', 1818, 1, 'A scientist creates life and then abandons it.'],
    ['Dune', 'Frank Herbert', 'Science Fiction', 1965, 3, 'Politics, religion and ecology on a desert planet.'],
    ['The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', 1925, 2, 'Wealth and longing on Long Island in the 1920s.'],
    ['Murder on the Orient Express', 'Agatha Christie', 'Mystery', 1934, 2, 'A snowbound train, a murdered passenger, twelve suspects.'],
    ['On the Origin of Species', 'Charles Darwin', 'Science', 1859, 1, 'The founding text of evolutionary biology.'],
    ['Steve Jobs', 'Walter Isaacson', 'Biography', 2011, 2, 'The authorised biography of the Apple co-founder.'],
    ['The Diary of a Young Girl', 'Anne Frank', 'Biography', 1947, 2, 'Two years in hiding, recorded by a teenage girl.'],
    ['Moby-Dick', 'Herman Melville', 'Fiction', 1851, 1, 'A whaling captain hunts the white whale that maimed him.'],
    ['The Name of the Wind', 'Patrick Rothfuss', 'Fantasy', 2007, 2, 'A legendary figure tells the true story of his youth.'],
    ['Foundation', 'Isaac Asimov', 'Science Fiction', 1951, 2, 'A mathematician plans for the fall of a galactic empire.'],
    ['The Guns of August', 'Barbara W. Tuchman', 'History', 1962, 1, 'The first month of the First World War.'],
    ['Educated', 'Tara Westover', 'Biography', 2018, 3, 'From a survivalist family in Idaho to a Cambridge PhD.'],
    ['The Selfish Gene', 'Richard Dawkins', 'Science', 1976, 2, 'Evolution seen from the point of view of the gene.'],
    ['Jane Eyre', 'Charlotte Brontë', 'Fiction', 1847, 2, 'An orphaned governess with a fierce sense of self.'],
    ['The Silent Patient', 'Alex Michaelides', 'Mystery', 2019, 3, 'A painter shoots her husband and never speaks again.'],
    ['A Wizard of Earthsea', 'Ursula K. Le Guin', 'Fantasy', 1968, 1, 'A young mage unleashes a shadow and must hunt it down.'],
    ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Non-Fiction', 2011, 2, 'The two systems that drive the way we think.'],
    ['Atomic Habits', 'James Clear', 'Non-Fiction', 2018, 4, 'Small changes that compound into remarkable results.'],
  ];

  const books = rawBooks.map(([title, author, genre, publishedYear, copies, description], i) => ({
    id: i + 1,
    title,
    author,
    isbn: `9781000000${String(i + 1).padStart(3, '0')}`,
    genre,
    publishedYear,
    copies,
    description,
    createdAt: daysAgo(120 - i),
  }));

  const rawMembers = [
    ['Alice Johnson', 'alice.johnson@example.com', 'Premium', 400],
    ['Bob Smith', 'bob.smith@example.com', 'Standard', 380],
    ['Carla Gomez', 'carla.gomez@example.com', 'Standard', 300],
    ['David Lee', 'david.lee@example.com', 'Premium', 250],
    ['Emma Brown', 'emma.brown@example.com', 'Standard', 180],
    ['Farid Haddad', 'farid.haddad@example.com', 'Standard', 90],
    ['Grace Kim', 'grace.kim@example.com', 'Premium', 45],
    ['Henry Novak', 'henry.novak@example.com', 'Standard', 10],
  ];

  const members = rawMembers.map(([name, email, membershipType, joined], i) => ({
    id: i + 1,
    name,
    email,
    membershipType,
    joinedAt: daysAgo(joined),
  }));

  const loan = (id, bookId, memberId, loanedDaysAgo, returnedDaysAgo = null) => ({
    id,
    bookId,
    memberId,
    loanDate: daysAgo(loanedDaysAgo),
    dueDate: daysAgo(loanedDaysAgo - 14),
    returnedAt: returnedDaysAgo === null ? null : daysAgo(returnedDaysAgo),
  });

  const loans = [
    loan(1, 3, 1, 5), //        The Hobbit -> Alice (active)
    loan(2, 3, 2, 20), //       The Hobbit -> Bob (overdue)  => no copies of The Hobbit left
    loan(3, 7, 3, 30, 10), //   Frankenstein -> Carla (returned)
    loan(4, 2, 1, 3), //        1984 -> Alice (active)
    loan(5, 8, 4, 16), //       Dune -> David (overdue)
    loan(6, 1, 5, 25, 12), //   Pride and Prejudice -> Emma (returned)
    loan(7, 22, 6, 2), //       A Wizard of Earthsea -> Farid (active) => no copies left
    loan(8, 10, 2, 1), //       Murder on the Orient Express -> Bob (active)
  ];

  return {
    books,
    members,
    loans,
    nextId: { book: books.length + 1, member: members.length + 1, loan: loans.length + 1 },
  };
}

module.exports = { createSeed };
