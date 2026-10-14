class HttpError extends Error {
  constructor(status, error, message, details) {
    super(message);
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

const badRequest = (message, details) => new HttpError(400, 'ValidationError', message, details);
const notFound = (what) => new HttpError(404, 'NotFound', `${what} not found`);
const conflict = (message, details) => new HttpError(409, 'Conflict', message, details);

module.exports = { HttpError, badRequest, notFound, conflict };
