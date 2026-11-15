const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../store/db');
const auth = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = auth.JWT_SECRET || process.env.JWT_SECRET || 'fleet_super_secret_key_2026';

// Resolve the JWT middleware regardless of whether auth.js names it authenticateJWT or verifyToken
const verifyAuth =
  auth.authenticateJWT ||
  auth.verifyToken ||
  ((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or malformed Bearer token' });
    }
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired JWT token' });
    }
  });

// POST /api/users/login - Authenticate user and issue JWT
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  return res.status(200).json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// GET /api/users/profile - Verify JWT and return decoded user profile
router.get('/profile', verifyAuth, (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;