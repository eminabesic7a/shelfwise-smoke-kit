// Same-origin by default. Set VITE_API_BASE_URL at build time to target an API on another host.
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed with status ${status}`);
    this.status = status;
    this.details = body?.details || {};
  }
}

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the server. Check your connection and try again.' });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  listBooks: (params) => request(`/books${toQuery(params)}`),
  getBook: (id) => request(`/books/${id}`),
  createBook: (book) => request('/books', { method: 'POST', body: book }),
  updateBook: (id, book) => request(`/books/${id}`, { method: 'PUT', body: book }),
  deleteBook: (id) => request(`/books/${id}`, { method: 'DELETE' }),
  listMembers: (params) => request(`/members${toQuery(params)}`),
  createMember: (member) => request('/members', { method: 'POST', body: member }),
  listLoans: (params) => request(`/loans${toQuery(params)}`),
  createLoan: (loan) => request('/loans', { method: 'POST', body: loan }),
  returnLoan: (id) => request(`/loans/${id}/return`, { method: 'PATCH' }),
};
