// src/routes/maps.js
const express = require('express');
const db = require('../store/db');
const { authenticateJWT } = require('../middleware/auth');
const { geocodeAddress, findNearbyVehicles } = require('../services/geolocationService');

const router = express.Router();

// Convert an address to coordinates via OpenStreetMap
router.get('/geocode', authenticateJWT, async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Query parameter "address" is required' });

  try {
    const result = await geocodeAddress(address);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Find vehicles within radius X km of a given lat/lng
router.get('/nearby', authenticateJWT, (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius || '10');

  if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
    return res.status(400).json({ error: 'Valid numeric lat, lng, and radius (km) are required' });
  }

  const nearby = findNearbyVehicles(db.vehicles, lat, lng, radius);
  res.json({ center: { lat, lng }, radiusKm: radius, count: nearby.length, vehicles: nearby });
});

module.exports = router;