const express = require('express');
const router = express.Router();
const { getQueueStats } = require('../queues/notificationQueue');
const Redis = require('ioredis');
const config = require('../config');
const smsService = require('../services/smsService');

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/detailed
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  const health = {
    success: true,
    status: 'healthy',
    service: config.serviceName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    checks: {},
  };

  // Check Redis connectivity
  try {
    const redis = new Redis(config.redis);
    await redis.ping();
    await redis.quit();
    health.checks.redis = { status: 'up' };
  } catch (error) {
    health.checks.redis = {
      status: 'down',
      error: error.message,
    };
    health.status = 'degraded';
    health.success = false;
  }

  // Check queue
  try {
    const stats = await getQueueStats();
    health.checks.queue = {
      status: 'up',
      stats,
    };
  } catch (error) {
    health.checks.queue = {
      status: 'down',
      error: error.message,
    };
    health.status = 'degraded';
    health.success = false;
  }

  // Check SMS service availability
  health.checks.sms = {
    status: smsService.isEnabled() ? 'enabled' : 'disabled',
  };

  // Check email service (configuration)
  health.checks.email = {
    status: config.azure.email.connectionString ? 'configured' : 'not_configured',
  };

  // Memory usage
  const memUsage = process.memoryUsage();
  health.memory = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if Redis is accessible
    const redis = new Redis(config.redis);
    await redis.ping();
    await redis.quit();

    // Check if queue is operational
    await getQueueStats();

    res.json({
      success: true,
      ready: true,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      ready: false,
      error: error.message,
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  res.json({
    success: true,
    alive: true,
  });
});

module.exports = router;
