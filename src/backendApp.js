const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/openapi');

const usersRouter = require('./routes/users');
const vehiclesRouter = require('./routes/vehicles');
const telemetryRouter = require('./routes/telemetry');
const mapsRouter = require('./routes/maps');
const notificationsRouter = require('./routes/notifications');

const app = express();
app.use(express.json());

// Serve interactive Swagger UI documentation at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Backend Microservices UP' });
});

// Mount microservice routes
app.use('/api/users', usersRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/maps', mapsRouter);
app.use('/api/notifications', notificationsRouter);

// Global 404 handler for unmapped backend routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist on backend service.`
  });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Backend Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

if (require.main === module) {
  const PORT = process.env.BACKEND_PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Backend microservices running on http://localhost:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;