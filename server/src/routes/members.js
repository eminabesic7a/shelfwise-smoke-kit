const express = require('express');
const store = require('../store');
const { conflict } = require('../errors');
const { validateMember } = require('../validation');

const router = express.Router();

// GET /api/members  - list members (optional ?search= on name or email)
router.get('/', (req, res) => {
  const q = String(req.query.search || '').trim().toLowerCase();
  let members = store.db().members;
  if (q) members = members.filter((m) => m.name.toLowerCase().includes(q) || m.email.includes(q));
  const items = [...members].sort((a, b) => a.name.localeCompare(b.name)).map(store.toMemberDto);
  res.json(items);
});

// POST /api/members  - register a member
router.post('/', (req, res) => {
  const data = validateMember(req.body);
  if (store.db().members.some((m) => m.email === data.email)) {
    throw conflict('A member with this email already exists', { email: 'A member with this email already exists' });
  }
  const member = { id: store.nextId('member'), ...data, joinedAt: new Date().toISOString() };
  store.db().members.push(member);
  res.status(201).json(store.toMemberDto(member));
});

module.exports = router;
