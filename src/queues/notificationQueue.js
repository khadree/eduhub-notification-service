const Queue = require('bull');
const config = require('../config');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const templateService = require('../services/templateService');

// Create notification queue
const notificationQueue = new Queue('notifications', {
  redis: config.redis,
  defaultJobOptions: {
    attempts: config.queue.attempts,
    backoff: config.queue.backoff,
    removeOnComplete: config.queue.removeOnComplete,
    removeOnFail: config.queue.removeOnFail,
  },
});

// Email job processor
notificationQueue.process('email', async (job) => {
  const { data } = job;
  logger.info('Processing email job', { jobId: job.id, to: data.to });

  try {
    let emailData = { ...data };

    // Apply template if specified
    if (data.templateId && data.templateData) {
      if (!templateService.hasTemplate(data.templateId)) {
        throw new Error(`Template not found: ${data.templateId}`);
      }

      const renderedBody = templateService.render(data.templateId, data.templateData);
      emailData = {
        ...emailData,
        body: renderedBody,
        isHtml: true,
      };
    }

    const result = await emailService.sendEmail(emailData);

    logger.info('Email job completed', {
      jobId: job.id,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Email job failed', {
      jobId: job.id,
      error: error.message,
      to: data.to,
    });

    throw error;
  }
});

// SMS job processor
notificationQueue.process('sms', async (job) => {
  const { data } = job;
  logger.info('Processing SMS job', { jobId: job.id, to: data.to });

  try {
    if (!smsService.isEnabled()) {
      throw new Error('SMS service is not enabled');
    }

    const result = await smsService.sendSms(data);

    logger.info('SMS job completed', {
      jobId: job.id,
      successful: result.successful,
      failed: result.failed,
    });

    return result;
  } catch (error) {
    logger.error('SMS job failed', {
      jobId: job.id,
      error: error.message,
      to: data.to,
    });

    throw error;
  }
});

// Queue event handlers
notificationQueue.on('completed', (job, result) => {
  logger.info('Job completed', {
    jobId: job.id,
    type: job.name,
    result,
  });
});

notificationQueue.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job.id,
    type: job.name,
    error: err.message,
    attempts: job.attemptsMade,
    maxAttempts: job.opts.attempts,
  });
});

notificationQueue.on('stalled', (job) => {
  logger.warn('Job stalled', {
    jobId: job.id,
    type: job.name,
  });
});

notificationQueue.on('error', (error) => {
  logger.error('Queue error', { error: error.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing queue...');
  await notificationQueue.close();
});

/**
 * Add an email job to the queue
 * @param {Object} emailData - Email data
 * @param {Object} options - Job options (delay, priority, etc.)
 * @returns {Promise<Object>} Job object
 */
const addEmailJob = async (emailData, options = {}) => {
  const jobOptions = {
    priority: emailData.priority === 'high' ? 1 : emailData.priority === 'low' ? 3 : 2,
    ...options,
  };

  const job = await notificationQueue.add('email', emailData, jobOptions);

  logger.info('Email job added to queue', {
    jobId: job.id,
    to: emailData.to,
    subject: emailData.subject,
  });

  return job;
};

/**
 * Add an SMS job to the queue
 * @param {Object} smsData - SMS data
 * @param {Object} options - Job options (delay, priority, etc.)
 * @returns {Promise<Object>} Job object
 */
const addSmsJob = async (smsData, options = {}) => {
  const jobOptions = {
    priority: smsData.priority === 'high' ? 1 : smsData.priority === 'low' ? 3 : 2,
    ...options,
  };

  const job = await notificationQueue.add('sms', smsData, jobOptions);

  logger.info('SMS job added to queue', {
    jobId: job.id,
    to: smsData.to,
  });

  return job;
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job status information
 */
const getJobStatus = async (jobId) => {
  const job = await notificationQueue.getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  const state = await job.getState();
  const progress = job.progress();
  const failedReason = job.failedReason;

  return {
    id: job.id,
    type: job.name,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason,
    data: job.data,
    returnvalue: job.returnvalue,
  };
};

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue statistics
 */
const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    notificationQueue.getWaitingCount(),
    notificationQueue.getActiveCount(),
    notificationQueue.getCompletedCount(),
    notificationQueue.getFailedCount(),
    notificationQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
};

/**
 * Retry a failed job
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
const retryJob = async (jobId) => {
  const job = await notificationQueue.getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  await job.retry();
  logger.info('Job retry initiated', { jobId });
};

/**
 * Remove a job from the queue
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
const removeJob = async (jobId) => {
  const job = await notificationQueue.getJob(jobId);

  if (!job) {
    throw new Error('Job not found');
  }

  await job.remove();
  logger.info('Job removed', { jobId });
};

/**
 * Clean old jobs from the queue
 * @param {number} grace - Grace period in milliseconds
 * @param {string} status - Job status to clean (completed, failed)
 * @returns {Promise<number>} Number of jobs cleaned
 */
const cleanJobs = async (grace = 86400000, status = 'completed') => {
  const cleaned = await notificationQueue.clean(grace, status);
  logger.info(`Cleaned ${cleaned.length} ${status} jobs older than ${grace}ms`);
  return cleaned.length;
};

module.exports = {
  notificationQueue,
  addEmailJob,
  addSmsJob,
  getJobStatus,
  getQueueStats,
  retryJob,
  removeJob,
  cleanJobs,
};
