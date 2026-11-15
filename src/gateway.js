const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const VALID_API_KEY = process.env.API_KEY || 'fleet-gateway-key-2026';

function createGatewayApp(backendUrl = DEFAULT_BACKEND_URL) {
  const app = express();

  // Root landing route (redirects to Swagger UI)
  app.get('/', (req, res) => {
    res.redirect('/api-docs');
  });

  // 1. Public Gateway Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API Gateway UP', targetBackend: backendUrl });
  });

  // 2. Public Swagger UI Documentation Proxy (mounted BEFORE API key verification)
  app.use(
    '/api-docs',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      on: {
        error: (err, req, res) => {
          if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway: Documentation service unavailable' });
          }
        }
      }
    })
  );

  // 3. Rate Limiting Middleware (prevents excessive requests per IP)
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // Max 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.'
    }
  });
  app.use('/api', apiLimiter);

  // 4. API Key Verification Middleware
  app.use('/api', (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({
        error: 'Unauthorized: Missing or invalid x-api-key header'
      });
    }
    next();
  });

  // 5. Microservice Routing Table
  const serviceRoutes = [
    { path: '/api/users', serviceName: 'User Service' },
    { path: '/api/vehicles', serviceName: 'Vehicle/Fleet Service' },
    { path: '/api/telemetry', serviceName: 'Telemetry Service' },
    { path: '/api/maps', serviceName: 'Geolocation Service' },
    { path: '/api/notifications', serviceName: 'Notification Service' }
  ];

  serviceRoutes.forEach(({ path, serviceName }) => {
    app.use(
      path,
      createProxyMiddleware({
        target: backendUrl,
        changeOrigin: true,
        pathRewrite: (reqPath) => `${path}${reqPath}`,
        on: {
          error: (err, req, res) => {
            if (!res.headersSent) {
              res.status(502).json({
                error: 'Service Unavailable',
                message: `${serviceName} is currently unreachable.`
              });
            }
          }
        }
      })
    );
  });

  // 6. Invalid / Unmapped Gateway Route Handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `No gateway route configured for ${req.method} ${req.originalUrl}`
    });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.GATEWAY_PORT || 3000;
  const app = createGatewayApp();
  app.listen(PORT, () => {
    console.log(`API Gateway running on http://localhost:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = { createGatewayApp, VALID_API_KEY };