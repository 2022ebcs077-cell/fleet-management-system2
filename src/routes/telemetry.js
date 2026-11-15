const express = require('express');
const db = require('../store/db');
const { authenticateJWT } = require('../middleware/auth');
const { sendSms } = require('../services/smsService');

const router = express.Router();

const CRITICAL_EVENTS = ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'];

// Submit GPS coordinates and vehicle diagnostics
router.post('/', authenticateJWT, async (req, res) => {
  const { vehicleId, lat, lng, batteryLevel, event } = req.body;

  if (!vehicleId || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'vehicleId, lat, and lng are required' });
  }

  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // Update live GPS coordinates on the vehicle
  vehicle.location = { lat, lng };

  const entry = {
    id: `tel_${Date.now()}`,
    vehicleId,
    lat,
    lng,
    batteryLevel: batteryLevel ?? 100,
    event: event || 'NORMAL',
    timestamp: new Date().toISOString()
  };
  db.telemetry.push(entry);

  let notification = null;
  const isCritical = CRITICAL_EVENTS.includes(event) || (typeof batteryLevel === 'number' && batteryLevel < 15);

  if (isCritical) {
    const alertType = CRITICAL_EVENTS.includes(event) ? event : 'LOW_BATTERY';
    const adminUser = db.users.find((u) => u.role === 'admin');
    notification = await sendSms({
      to: adminUser.phone,
      message: `CRITICAL ALERT [${alertType}] on vehicle ${vehicle.plateNumber} at (${lat}, ${lng}).`,
      eventType: alertType,
      vehicleId: vehicle.id
    });
  }

  res.status(201).json({ telemetry: entry, notification });
});

router.get('/:vehicleId', authenticateJWT, (req, res) => {
  const logs = db.telemetry.filter((t) => t.vehicleId === req.params.vehicleId);
  res.json(logs);
});

module.exports = router;