const express = require('express');
const router = express.Router();
const {
  addEmailJob,
  addSmsJob,
  getJobStatus,
  getQueueStats,
  retryJob,
  removeJob,
  cleanJobs,
} = require('../queues/notificationQueue');
const {
  validateEmailNotification,
  validateSmsNotification,
} = require('../utils/validators');
const templateService = require('../services/templateService');
const logger = require('../utils/logger');

/**
 * POST /notifications/email
 * Send an email notification
 */
router.post('/email', async (req, res, next) => {
  try {
    const { error, value } = validateEmailNotification(req.body);

    if (error) {
      error.isJoi = true;
      throw error;
    }

    // Check if template is requested
    if (value.templateId) {
      if (!templateService.hasTemplate(value.templateId)) {
        return res.status(400).json({
          success: false,
          error: `Template not found: ${value.templateId}`,
          availableTemplates: templateService.getAvailableTemplates(),
        });
      }
    }

    const job = await addEmailJob(value);

    res.status(202).json({
      success: true,
      message: 'Email notification queued',
      jobId: job.id,
      data: {
        to: value.to,
        subject: value.subject,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/sms
 * Send an SMS notification
 */
router.post('/sms', async (req, res, next) => {
  try {
    const { error, value } = validateSmsNotification(req.body);

    if (error) {
      error.isJoi = true;
      throw error;
    }

    const job = await addSmsJob(value);

    res.status(202).json({
      success: true,
      message: 'SMS notification queued',
      jobId: job.id,
      data: {
        to: value.to,
        message: value.message.substring(0, 50) + '...',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/bulk
 * Send bulk notifications (mixed email and SMS)
 */
router.post('/bulk', async (req, res, next) => {
  try {
    const { notifications } = req.body;

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'notifications array is required and must not be empty',
      });
    }

    if (notifications.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 notifications allowed per bulk request',
      });
    }

    const jobs = [];
    const errors = [];

    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];

      try {
        if (notification.type === 'email') {
          const { error, value } = validateEmailNotification(notification.data);
          if (error) throw error;
          const job = await addEmailJob(value);
          jobs.push({ index: i, type: 'email', jobId: job.id });
        } else if (notification.type === 'sms') {
          const { error, value } = validateSmsNotification(notification.data);
          if (error) throw error;
          const job = await addSmsJob(value);
          jobs.push({ index: i, type: 'sms', jobId: job.id });
        } else {
          errors.push({
            index: i,
            error: 'Invalid notification type. Must be "email" or "sms"',
          });
        }
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
        });
      }
    }

    res.status(202).json({
      success: true,
      message: 'Bulk notifications processed',
      summary: {
        total: notifications.length,
        queued: jobs.length,
        failed: errors.length,
      },
      jobs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/job/:jobId
 * Get job status
 */
router.get('/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);

    res.json({
      success: true,
      job: status,
    });
  } catch (error) {
    if (error.message === 'Job not found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }
    next(error);
  }
});

/**
 * POST /notifications/job/:jobId/retry
 * Retry a failed job
 */
router.post('/job/:jobId/retry', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    await retryJob(jobId);

    res.json({
      success: true,
      message: 'Job retry initiated',
      jobId,
    });
  } catch (error) {
    if (error.message === 'Job not found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }
    next(error);
  }
});

/**
 * DELETE /notifications/job/:jobId
 * Remove a job from the queue
 */
router.delete('/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    await removeJob(jobId);

    res.json({
      success: true,
      message: 'Job removed',
      jobId,
    });
  } catch (error) {
    if (error.message === 'Job not found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }
    next(error);
  }
});

/**
 * GET /notifications/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req, res, next) => {
  try {
    const stats = await getQueueStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/queue/clean
 * Clean old jobs from the queue
 */
router.post('/queue/clean', async (req, res, next) => {
  try {
    const { grace = 86400000, status = 'completed' } = req.body;

    if (!['completed', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "completed" or "failed"',
      });
    }

    const cleaned = await cleanJobs(grace, status);

    res.json({
      success: true,
      message: `Cleaned ${cleaned} ${status} jobs`,
      cleaned,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/templates
 * Get list of available templates
 */
router.get('/templates', async (req, res, next) => {
  try {
    const templates = templateService.getAvailableTemplates();

    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
