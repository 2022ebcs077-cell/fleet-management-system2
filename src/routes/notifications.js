// src/routes/notifications.js
const express = require('express');
const db = require('../store/db');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateJWT, (req, res) => {
  res.json(db.notifications);
});

module.exports = router;