const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const store = require('./store');
const { HttpError } = require('./errors');
const booksRouter = require('./routes/books');
const membersRouter = require('./routes/members');
const loansRouter = require('./routes/loans');
const { version } = require('../package.json');

function createApp() {
  const app = express();
  const startedAt = Date.now();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Optional artificial latency, handy for testing loading states: API_DELAY_MS=800 npm start
  const delay = Number(process.env.API_DELAY_MS || 0);
  if (delay > 0) app.use('/api', (req, res, next) => setTimeout(next, delay));

  // ---- Infrastructure endpoints -------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
  });

  // Restores the seed data. Lets tests start from a known state.
  // Disable in a public deployment with ENABLE_TEST_API=false.
  if (process.env.ENABLE_TEST_API !== 'false') {
    app.post('/api/test/reset', (req, res) => {
      store.reset();
      res.json({ message: 'Data reset to seed state' });
    });
  }

  // ---- Business endpoints ---------------------------------------------------------
  app.use('/api/books', booksRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/loans', loansRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'NotFound', message: `No API route for ${req.method} ${req.originalUrl}` });
  });

  // ---- Frontend (production build) ------------------------------------------------
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // ---- Error handling ---------------------------------------------------------------
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'BadRequest', message: 'Request body is not valid JSON' });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: err.error,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
    }
    console.error(err);
    return res.status(500).json({ error: 'InternalServerError', message: 'Unexpected server error' });
  });

  return app;
}

module.exports = { createApp };
