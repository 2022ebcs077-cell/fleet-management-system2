const express = require('express');
const db = require('../store/db');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { geocodeAddress } = require('../services/geolocationService');
const { sendSms } = require('../services/smsService');

const router = express.Router();

// Register a new vehicle (Geocodes address if coordinates are not directly provided)
router.post('/', authenticateJWT, authorizeRoles('admin'), async (req, res) => {
  try {
    const { plateNumber, model, address, lat, lng } = req.body;
    if (!plateNumber || !model) {
      return res.status(400).json({ error: 'plateNumber and model are required' });
    }

    let location = null;
    if (typeof lat === 'number' && typeof lng === 'number') {
      location = { lat, lng };
    } else if (address) {
      const geo = await geocodeAddress(address);
      location = { lat: geo.lat, lng: geo.lng };
    }

    const newVehicle = {
      id: `v${db.vehicles.length + 1}`,
      plateNumber,
      model,
      status: 'active',
      address: address || null,
      location
    };

    db.vehicles.push(newVehicle);
    res.status(201).json(newVehicle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all vehicles
router.get('/', authenticateJWT, (req, res) => {
  res.json(db.vehicles);
});

// Get single vehicle
router.get('/:id', authenticateJWT, (req, res) => {
  const vehicle = db.vehicles.find((v) => v.id === req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

// Update operational status -> Triggers SMS notification
router.patch('/:id/status', authenticateJWT, authorizeRoles('admin'), async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ['active', 'maintenance', 'offline', 'emergency'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowedStatuses.join(', ')}` });
  }

  const vehicle = db.vehicles.find((v) => v.id === req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const previousStatus = vehicle.status;
  vehicle.status = status;

  const adminUser = db.users.find((u) => u.role === 'admin');
  const smsRecord = await sendSms({
    to: adminUser.phone,
    message: `Vehicle ${vehicle.plateNumber} operational status changed from ${previousStatus} to ${status}.`,
    eventType: 'STATUS_CHANGE',
    vehicleId: vehicle.id
  });

  res.json({ vehicle, notification: smsRecord });
});

// Delete vehicle (Admin only - used to test RBAC)
router.delete('/:id', authenticateJWT, authorizeRoles('admin'), (req, res) => {
  const index = db.vehicles.findIndex((v) => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Vehicle not found' });

  const [deleted] = db.vehicles.splice(index, 1);
  res.json({ message: 'Vehicle deleted', vehicle: deleted });
});

module.exports = router;