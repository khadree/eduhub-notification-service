const { SmsClient } = require('@azure/communication-sms');
const config = require('../config');
const logger = require('../utils/logger');

class SmsService {
  constructor() {
    if (!config.azure.sms.connectionString) {
      logger.warn('Azure SMS connection string is not configured. SMS functionality will be disabled.');
      this.enabled = false;
      return;
    }

    if (!config.azure.sms.from) {
      logger.warn('Azure SMS from number is not configured. SMS functionality will be disabled.');
      this.enabled = false;
      return;
    }

    this.client = new SmsClient(config.azure.sms.connectionString);
    this.fromNumber = config.azure.sms.from;
    this.enabled = true;
  }

  /**
   * Check if SMS service is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Send a single SMS
   * @param {Object} smsData
   * @param {string|string[]} smsData.to - Recipient phone number(s) in E.164 format
   * @param {string} smsData.message - SMS message content (max 160 chars)
   * @param {Object} smsData.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Send result
   */
  async sendSms(smsData) {
    if (!this.enabled) {
      throw new Error('SMS service is not enabled. Check your configuration.');
    }

    try {
      const { to, message, metadata = {} } = smsData;

      // Normalize recipients to array
      const toRecipients = Array.isArray(to) ? to : [to];

      logger.info('Sending SMS', {
        to: toRecipients,
        messageLength: message.length,
        metadata,
      });

      const sendResults = await this.client.send({
        from: this.fromNumber,
        to: toRecipients,
        message,
      });

      const results = sendResults.map((result, index) => ({
        to: toRecipients[index],
        success: result.successful,
        messageId: result.messageId,
        errorMessage: result.errorMessage,
      }));

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info('SMS sent', {
        total: results.length,
        successful,
        failed,
      });

      return {
        success: failed === 0,
        total: results.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error.message,
        stack: error.stack,
        to: smsData.to,
      });

      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  /**
   * Send bulk SMS messages
   * @param {Array<Object>} messages - Array of SMS data objects
   * @returns {Promise<Object>} Results summary
   */
  async sendBulkSms(messages) {
    if (!this.enabled) {
      throw new Error('SMS service is not enabled. Check your configuration.');
    }

    const results = {
      total: messages.length,
      successful: 0,
      failed: 0,
      details: [],
    };

    logger.info(`Starting bulk SMS send: ${messages.length} messages`);

    for (const smsData of messages) {
      try {
        const result = await this.sendSms(smsData);
        results.successful += result.successful;
        results.failed += result.failed;
        results.details.push(...result.results);
      } catch (error) {
        const recipients = Array.isArray(smsData.to) ? smsData.to : [smsData.to];
        results.failed += recipients.length;

        results.details.push(
          ...recipients.map(to => ({
            to,
            success: false,
            error: error.message,
          }))
        );
      }
    }

    logger.info('Bulk SMS send completed', {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });

    return results;
  }
}

module.exports = new SmsService();
