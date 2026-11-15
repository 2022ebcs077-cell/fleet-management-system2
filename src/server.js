const backendApp = require('./backendApp');
const { createGatewayApp } = require('./gateway');

const BACKEND_PORT = process.env.BACKEND_PORT || 4000;
const GATEWAY_PORT = process.env.PORT || process.env.GATEWAY_PORT || 3000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

backendApp.listen(BACKEND_PORT, '127.0.0.1', () => {
  console.log(`Backend microservices running internally on port ${BACKEND_PORT}`);

  const gatewayApp = createGatewayApp(BACKEND_URL);
  gatewayApp.listen(GATEWAY_PORT, '0.0.0.0', () => {
    console.log(`API Gateway live on port ${GATEWAY_PORT}`);
  });
});