const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const backendApp = require('../src/backendApp');
const { createGatewayApp } = require('../src/gateway');

describe('Fleet Management System - End-to-End & Gateway Test Suite', function () {
  let backendServer;
  let gatewayServer;
  let gatewayUrl;
  let adminToken;
  let driverToken;
  const API_KEY = 'fleet-gateway-key-2026';

  before((done) => {
    backendServer = backendApp.listen(0, () => {
      const backendPort = backendServer.address().port;
      const gatewayApp = createGatewayApp({
        backendTarget: `http://127.0.0.1:${backendPort}`,
        validApiKeys: [API_KEY],
        rateLimitMax: 50,
        rateLimitWindowMs: 60000
      });

      gatewayServer = gatewayApp.listen(0, () => {
        const gatewayPort = gatewayServer.address().port;
        gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
        done();
      });
    });
  });

  after((done) => {
    nock.cleanAll();
    gatewayServer.close(() => backendServer.close(done));
  });

  // Flow 1: User login and JWT token verification
  it('1. should authenticate users and verify JWT tokens', async () => {
    const adminRes = await request(gatewayUrl)
      .post('/api/users/login')
      .set('x-api-key', API_KEY)
      .send({ username: 'admin', password: 'password123' });

    expect(adminRes.status).to.equal(200);
    expect(adminRes.body).to.have.property('token');
    adminToken = adminRes.body.token;

    const driverRes = await request(gatewayUrl)
      .post('/api/users/login')
      .set('x-api-key', API_KEY)
      .send({ username: 'driver1', password: 'password123' });

    expect(driverRes.status).to.equal(200);
    driverToken = driverRes.body.token;

    const profileRes = await request(gatewayUrl)
      .get('/api/users/profile')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(profileRes.status).to.equal(200);
    expect(profileRes.body.user.role).to.equal('admin');
  });

  // Flow 2: Vehicle registration and retrieval (with mocked OpenStreetMap geocoding)
  it('2. should register a new vehicle by geocoding its address and retrieve vehicles', async () => {
    nock('https://nominatim.openstreetmap.org')
      .get('/search')
      .query(true)
      .reply(200, [
        {
          lat: '16.5417',
          lon: '80.8050',
          display_name: 'Gannavaram, Krishna, Andhra Pradesh, India'
        }
      ]);

    const createRes = await request(gatewayUrl)
      .post('/api/vehicles')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plateNumber: 'AP-16-BZ-2026',
        model: 'BharatBenz 2823R',
        address: 'Gannavaram, Andhra Pradesh'
      });

    expect(createRes.status).to.equal(201);
    expect(createRes.body.plateNumber).to.equal('AP-16-BZ-2026');
    expect(createRes.body.location).to.deep.equal({ lat: 16.5417, lng: 80.805 });

    const listRes = await request(gatewayUrl)
      .get('/api/vehicles')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).to.equal(200);
    expect(listRes.body).to.be.an('array').with.lengthOf(2);
  });

  // Flow 3: Vehicle telemetry submission, storage, and critical event SMS alert
  it('3. should store GPS telemetry and trigger SMS on critical ENGINE_FAULT event', async () => {
    const telRes = await request(gatewayUrl)
      .post('/api/telemetry')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        vehicleId: 'v1',
        lat: 16.5100,
        lng: 80.6500,
        batteryLevel: 78,
        event: 'ENGINE_FAULT'
      });

    expect(telRes.status).to.equal(201);
    expect(telRes.body.telemetry.vehicleId).to.equal('v1');
    expect(telRes.body.notification).to.be.an('object');
    expect(telRes.body.notification.eventType).to.equal('ENGINE_FAULT');
    expect(telRes.body.notification.status).to.equal('sent');
  });

  // Flow 4: Vehicle operational status update and notification triggering
  it('4. should update vehicle operational status and send an SMS notification', async () => {
    const statusRes = await request(gatewayUrl)
      .patch('/api/vehicles/v1/status')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'maintenance' });

    expect(statusRes.status).to.equal(200);
    expect(statusRes.body.vehicle.status).to.equal('maintenance');
    expect(statusRes.body.notification.status).to.equal('sent');
    expect(statusRes.body.notification.message).to.include('maintenance');

    const logsRes = await request(gatewayUrl)
      .get('/api/notifications')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(logsRes.status).to.equal(200);
    expect(logsRes.body.length).to.be.at.least(2);
  });

  // Flow 5: Role-based access control (Driver attempting to delete a vehicle)
  it('5. should block non-admin users from deleting vehicles (RBAC)', async () => {
    const deleteRes = await request(gatewayUrl)
      .delete('/api/vehicles/v1')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(deleteRes.status).to.equal(403);
    expect(deleteRes.body.error).to.include('Forbidden');
  });

  // Flow 6: Nearby vehicle search using geolocation service
  it('6. should retrieve vehicles within a specified radius (X km)', async () => {
    // Search within 5 km of Vijayawada center (should match v1, exclude v2 ~17 km away)
    const nearby5km = await request(gatewayUrl)
      .get('/api/maps/nearby?lat=16.5062&lng=80.6480&radius=5')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(nearby5km.status).to.equal(200);
    expect(nearby5km.body.count).to.equal(1);
    expect(nearby5km.body.vehicles[0].id).to.equal('v1');

    // Search within 25 km (should match both v1 and v2)
    const nearby25km = await request(gatewayUrl)
      .get('/api/maps/nearby?lat=16.5062&lng=80.6480&radius=25')
      .set('x-api-key', API_KEY)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(nearby25km.status).to.equal(200);
    expect(nearby25km.body.count).to.equal(2);
  });

  // Flow 7: API Gateway API key verification and rate-limiting behavior
  it('7. should enforce API key verification and rate limiting at the API Gateway', async () => {
    // 7a. Missing or invalid API key
    const unauthRes = await request(gatewayUrl)
      .get('/api/vehicles')
      .set('x-api-key', 'wrong-key');

    expect(unauthRes.status).to.equal(401);
    expect(unauthRes.body.error).to.include('x-api-key');

    // 7b. Rate limiting on an isolated gateway instance (max 2 requests)
    const strictGateway = createGatewayApp({
      backendTarget: 'http://127.0.0.1:59999',
      validApiKeys: [API_KEY],
      rateLimitMax: 2,
      rateLimitWindowMs: 60000
    });

    await request(strictGateway).get('/api/unknown').set('x-api-key', API_KEY);
    await request(strictGateway).get('/api/unknown').set('x-api-key', API_KEY);
    const rateLimitedRes = await request(strictGateway)
      .get('/api/unknown')
      .set('x-api-key', API_KEY);

    expect(rateLimitedRes.status).to.equal(429);
    expect(rateLimitedRes.body.error).to.include('Too many requests');
  });
});