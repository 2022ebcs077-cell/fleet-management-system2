const db = require('../store/db');

/**
 * Mock SMS Service (simulates Twilio Messages API).
 * Fails intentionally if recipient phone starts with "+1555999" (for negative testing).
 */
async function sendSms({ to, message, eventType, vehicleId }) {
  const isSimulatedFailure = to.startsWith('+1555999');

  const record = {
    id: `sms_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    provider: 'Twilio-Mock-Sandbox',
    to,
    message,
    eventType,
    vehicleId,
    status: isSimulatedFailure ? 'failed' : 'sent',
    timestamp: new Date().toISOString()
  };

  db.notifications.push(record);
  return record;
}

module.exports = { sendSms };