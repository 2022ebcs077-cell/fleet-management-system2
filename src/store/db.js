const db = {
  users: [
    { id: 'u1', username: 'admin', password: 'password123', role: 'admin', phone: '+15550100001' },
    { id: 'u2', username: 'driver1', password: 'password123', role: 'driver', phone: '+15550100002' }
  ],
  vehicles: [
    {
      id: 'v1',
      plateNumber: 'FL-1001',
      model: 'Ford Transit',
      status: 'active',
      location: { lat: 16.5062, lng: 80.6480, address: 'Vijayawada, AP' }
    }
  ],
  telemetry: [],
  notifications: []
};

module.exports = db;

