const backendApp = require('./backendApp');
const { createGatewayApp } = require('./gateway');

const BACKEND_PORT = process.env.BACKEND_PORT || 4000;
const GATEWAY_PORT = process.env.PORT || process.env.GATEWAY_PORT || 3000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

// 1. Start internal Backend Microservices
backendApp.listen(BACKEND_PORT, '127.0.0.1', () => {
  console.log(`Backend microservices running internally on port ${BACKEND_PORT}`);

  // 2. Start public API Gateway pointing to the internal backend
  const gatewayApp = createGatewayApp(BACKEND_URL);
  gatewayApp.listen(GATEWAY_PORT, '0.0.0.0', () => {
    console.log(`API Gateway live on port ${GATEWAY_PORT}`);
    console.log(`Swagger UI available at /api-docs`);
  });
});