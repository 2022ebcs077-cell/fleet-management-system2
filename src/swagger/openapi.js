module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Fleet Management System API',
    version: '1.0.0',
    description:
      'REST API documentation for the Fleet Management System covering JWT authentication, role-based access control (Admin/Driver), OpenStreetMap geolocation, GPS telemetry, mock Twilio SMS alerts, and API Gateway security.'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'API Gateway (Requires x-api-key header)' },
    { url: 'http://localhost:4000', description: 'Direct Backend Microservices' }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API Gateway key (fleet-gateway-key-2026)'
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from POST /api/users/login'
      }
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin' },
          password: { type: 'string', example: 'password123' }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'u1' },
              username: { type: 'string', example: 'admin' },
              role: { type: 'string', enum: ['admin', 'driver'], example: 'admin' }
            }
          }
        }
      },
      VehicleInput: {
        type: 'object',
        required: ['plateNumber', 'model'],
        properties: {
          plateNumber: { type: 'string', example: 'AP-16-TX-8899' },
          model: { type: 'string', example: 'Tata Ace EV' },
          address: { type: 'string', example: 'Benz Circle, Vijayawada' },
          lat: { type: 'number', example: 16.501 },
          lng: { type: 'number', example: 80.642 }
        }
      },
      Vehicle: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'v1' },
          plateNumber: { type: 'string', example: 'FL-1001' },
          model: { type: 'string', example: 'Ford Transit' },
          status: {
            type: 'string',
            enum: ['active', 'maintenance', 'offline', 'emergency'],
            example: 'active'
          },
          location: {
            type: 'object',
            properties: {
              lat: { type: 'number', example: 16.5062 },
              lng: { type: 'number', example: 80.648 },
              address: { type: 'string', example: 'Vijayawada, AP' }
            }
          }
        }
      },
      StatusUpdateInput: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'maintenance', 'offline', 'emergency'],
            example: 'maintenance'
          }
        }
      },
      TelemetryInput: {
        type: 'object',
        required: ['vehicleId', 'lat', 'lng'],
        properties: {
          vehicleId: { type: 'string', example: 'v1' },
          lat: { type: 'number', example: 16.512 },
          lng: { type: 'number', example: 80.651 },
          speedKmh: { type: 'number', example: 48 },
          batteryLevel: { type: 'number', example: 12 },
          event: {
            type: 'string',
            enum: ['NORMAL', 'ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'],
            example: 'LOW_BATTERY'
          }
        }
      },
      NotificationRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sms_1731667200000_123' },
          provider: { type: 'string', example: 'Twilio-Mock-Sandbox' },
          to: { type: 'string', example: '+15550100001' },
          message: {
            type: 'string',
            example: 'CRITICAL ALERT [LOW_BATTERY]: Vehicle FL-1001 at (16.512, 80.651).'
          },
          eventType: { type: 'string', example: 'LOW_BATTERY' },
          vehicleId: { type: 'string', example: 'v1' },
          status: { type: 'string', enum: ['sent', 'failed'], example: 'sent' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-11-15T10:30:00.000Z' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Forbidden' },
          message: { type: 'string', example: 'Requires role [admin]' }
        }
      }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/api/users/login': {
      post: {
        summary: 'Authenticate user and issue JWT',
        description:
          'Public endpoint (requires Gateway x-api-key only). Returns a signed JWT token containing user ID and role.',
        tags: ['Users'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: { username: 'admin', password: 'password123' }
            }
          }
        },
        responses: {
          200: {
            description: 'JWT token issued',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' }
              }
            }
          },
          401: {
            description: 'Invalid credentials or missing API key',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Invalid credentials' }
              }
            }
          },
          429: { description: 'Too Many Requests (API Gateway rate limit exceeded)' }
        }
      }
    },
    '/api/users/profile': {
      get: {
        summary: 'Verify JWT & Get Current User Profile',
        description: 'Requires valid Gateway API Key and Bearer JWT token (`admin` or `driver`).',
        tags: ['Users'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        responses: {
          200: {
            description: 'Decoded JWT user payload',
            content: {
              'application/json': {
                example: { user: { id: 'u1', username: 'admin', role: 'admin' } }
              }
            }
          },
          401: { description: 'Missing or malformed Bearer token' },
          403: { description: 'Invalid or expired JWT token' }
        }
      }
    },
    '/api/vehicles': {
      get: {
        summary: 'Retrieve All Vehicles',
        description: 'Accessible by any authenticated user (`admin` or `driver`).',
        tags: ['Vehicles'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        responses: {
          200: {
            description: 'List of registered fleet vehicles',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Vehicle' }
                }
              }
            }
          },
          401: { description: 'Unauthorized' }
        }
      },
      post: {
        summary: 'Register a New Vehicle (Admin Only)',
        description:
          'Requires **admin** role. Automatically geocodes `address` via OpenStreetMap Nominatim if coordinates are omitted.',
        tags: ['Vehicles'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VehicleInput' },
              example: {
                plateNumber: 'AP-16-TX-8899',
                model: 'Tata Ace EV',
                address: 'Benz Circle, Vijayawada'
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Vehicle registered successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Vehicle' }
              }
            }
          },
          400: { description: 'Bad Request (missing plateNumber or model)' },
          403: { description: 'Forbidden (Driver role cannot register vehicles)' },
          422: { description: 'Unprocessable Entity (Address could not be geocoded)' }
        }
      }
    },
    '/api/vehicles/{id}/status': {
      patch: {
        summary: 'Update Vehicle Operational Status & Trigger SMS',
        description:
          'Updates operational status (`active`, `maintenance`, `offline`, `emergency`) and sends an SMS alert to the fleet administrator.',
        tags: ['Vehicles'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'v1' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StatusUpdateInput' },
              example: { status: 'maintenance' }
            }
          }
        },
        responses: {
          200: { description: 'Status updated and SMS notification dispatched' },
          400: { description: 'Invalid status value' },
          404: { description: 'Vehicle not found' }
        }
      }
    },
    '/api/vehicles/{id}': {
      delete: {
        summary: 'Delete a Vehicle (Admin Only)',
        description: 'Requires **admin** role. Non-admin users (`driver`) receive HTTP 403 Forbidden.',
        tags: ['Vehicles'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', example: 'v1' } }
        ],
        responses: {
          200: {
            description: 'Vehicle deleted successfully',
            content: { 'application/json': { example: { message: 'Vehicle deleted' } } }
          },
          403: { description: 'Forbidden: Requires role [admin]' },
          404: { description: 'Vehicle not found' }
        }
      }
    },
    '/api/telemetry': {
      post: {
        summary: 'Submit Vehicle GPS & Health Telemetry',
        description:
          'Updates vehicle GPS coordinates in the database. Automatically triggers an SMS alert to the administrator on critical events (`ENGINE_FAULT`, `LOW_BATTERY`, `EMERGENCY_STOP`) or battery < 15%.',
        tags: ['Telemetry'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TelemetryInput' },
              example: {
                vehicleId: 'v1',
                lat: 16.512,
                lng: 80.651,
                speedKmh: 50,
                batteryLevel: 12,
                event: 'LOW_BATTERY'
              }
            }
          }
        },
        responses: {
          201: { description: 'Telemetry saved and alert evaluated' },
          404: { description: 'Vehicle ID not found' }
        }
      }
    },
    '/api/maps/geocode': {
      get: {
        summary: 'Geocode Street Address via OpenStreetMap',
        description: 'Converts a human-readable address into latitude and longitude coordinates.',
        tags: ['Maps'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        parameters: [
          {
            name: 'address',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'Vijayawada, Andhra Pradesh' }
          }
        ],
        responses: {
          200: {
            description: 'Geocoded coordinates',
            content: {
              'application/json': {
                example: {
                  lat: 16.5062,
                  lng: 80.648,
                  displayName: 'Vijayawada, Andhra Pradesh, India'
                }
              }
            }
          },
          400: { description: 'Missing address query parameter' },
          422: { description: 'Address not found' }
        }
      }
    },
    '/api/maps/nearby': {
      get: {
        summary: 'Find Vehicles Within X km Radius',
        description:
          'Uses the Haversine formula to find all vehicles within `radius` kilometers of `(lat, lng)`.',
        tags: ['Maps'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', example: 16.5062 } },
          { name: 'lng', in: 'query', required: true, schema: { type: 'number', example: 80.648 } },
          {
            name: 'radius',
            in: 'query',
            required: false,
            schema: { type: 'number', example: 10, default: 10 }
          }
        ],
        responses: {
          200: {
            description: 'Nearby vehicles sorted by distance in km',
            content: {
              'application/json': {
                example: {
                  center: { lat: 16.5062, lng: 80.648 },
                  radiusKm: 10,
                  count: 1,
                  vehicles: [{ id: 'v1', plateNumber: 'FL-1001', distanceKm: 0 }]
                }
              }
            }
          },
          400: { description: 'Invalid or missing lat/lng coordinates' }
        }
      }
    },
    '/api/notifications': {
      get: {
        summary: 'Retrieve SMS Notification Delivery Logs',
        description:
          'Returns all SMS notifications dispatched by the mock Twilio service along with `sent` or `failed` status.',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        responses: {
          200: {
            description: 'Audit log of SMS notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NotificationRecord' }
                }
              }
            }
          },
          401: { description: 'Unauthorized' }
        }
      }
    }
  }
};