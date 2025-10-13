require('dotenv').config();

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  serviceName: process.env.SERVICE_NAME || 'notification-service',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  },

  // Azure Communication Service
  azure: {
    email: {
      connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
      from: process.env.AZURE_EMAIL_FROM || 'donotreply@eduhub.academy',
    },
    sms: {
      connectionString: process.env.AZURE_SMS_CONNECTION_STRING,
      from: process.env.AZURE_SMS_FROM,
    },
  },

  // Queue Configuration
  queue: {
    attempts: parseInt(process.env.QUEUE_ATTEMPTS, 10) || 3,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.QUEUE_BACKOFF_DELAY, 10) || 5000,
    },
    removeOnComplete: {
      age: parseInt(process.env.QUEUE_CLEANUP_AGE, 10) || 86400000, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: parseInt(process.env.QUEUE_CLEANUP_AGE, 10) || 86400000 * 7, // 7 days
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validation
const validateConfig = () => {
  const errors = [];

  if (!config.azure.email.connectionString) {
    errors.push('AZURE_COMMUNICATION_CONNECTION_STRING is required');
  }

  if (config.nodeEnv === 'production') {
    if (!config.redis.password) {
      console.warn('WARNING: Running in production without Redis password');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Validate on load
if (config.nodeEnv !== 'test') {
  validateConfig();
}

module.exports = config;
