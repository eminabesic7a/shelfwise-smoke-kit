// Keep in sync with server/src/constants.js
export const GENRES = ['Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Non-Fiction', 'History', 'Science', 'Biography'];
export const MEMBERSHIP_TYPES = ['Standard', 'Premium'];
export const LOAN_LIMITS = { Standard: 3, Premium: 5 };
export const DEFAULT_LOAN_DAYS = 14;
export const MAX_LOAN_DAYS = 30;

export const genreClass = (genre) => `genre-${String(genre).toLowerCase().replace(/[^a-z]+/g, '-')}`;

/** Dates are shown as YYYY-MM-DD so they are unambiguous and easy to assert in tests. */
export const formatDate = (iso) => (iso ? String(iso).slice(0, 10) : '—');

export function daysBetween(fromIso, to = new Date()) {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86400000);
}
