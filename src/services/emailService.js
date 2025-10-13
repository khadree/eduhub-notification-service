const { EmailClient } = require('@azure/communication-email');
const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    if (!config.azure.email.connectionString) {
      throw new Error('Azure Email connection string is not configured');
    }

    this.client = new EmailClient(config.azure.email.connectionString);
    this.fromAddress = config.azure.email.from;
  }

  /**
   * Send a single email
   * @param {Object} emailData
   * @param {string|string[]} emailData.to - Recipient email address(es)
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.body - Email body content
   * @param {boolean} emailData.isHtml - Whether body is HTML
   * @param {string|string[]} emailData.cc - CC recipients (optional)
   * @param {string|string[]} emailData.bcc - BCC recipients (optional)
   * @param {Object} emailData.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Send result with message ID
   */
  async sendEmail(emailData) {
    try {
      const { to, subject, body, isHtml = false, cc, bcc, metadata = {} } = emailData;

      // Normalize recipients to arrays
      const toRecipients = Array.isArray(to) ? to : [to];
      const ccRecipients = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
      const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

      const message = {
        senderAddress: this.fromAddress,
        content: {
          subject,
          ...(isHtml ? { html: body } : { plainText: body }),
        },
        recipients: {
          to: toRecipients.map(email => ({ address: email })),
          ...(ccRecipients && { cc: ccRecipients.map(email => ({ address: email })) }),
          ...(bccRecipients && { bcc: bccRecipients.map(email => ({ address: email })) }),
        },
      };

      logger.info('Sending email', {
        to: toRecipients,
        subject,
        isHtml,
        metadata,
      });

      const poller = await this.client.beginSend(message);
      const result = await poller.pollUntilDone();

      logger.info('Email sent successfully', {
        messageId: result.id,
        status: result.status,
        to: toRecipients,
      });

      return {
        success: true,
        messageId: result.id,
        status: result.status,
        recipients: toRecipients,
      };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        stack: error.stack,
        to: emailData.to,
        subject: emailData.subject,
      });

      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  /**
   * Send bulk emails
   * @param {Array<Object>} emails - Array of email data objects
   * @returns {Promise<Object>} Results summary
   */
  async sendBulkEmails(emails) {
    const results = {
      total: emails.length,
      successful: 0,
      failed: 0,
      details: [],
    };

    logger.info(`Starting bulk email send: ${emails.length} emails`);

    for (const emailData of emails) {
      try {
        const result = await this.sendEmail(emailData);
        results.successful++;
        results.details.push({
          to: emailData.to,
          success: true,
          messageId: result.messageId,
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          to: emailData.to,
          success: false,
          error: error.message,
        });
      }
    }

    logger.info('Bulk email send completed', {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });

    return results;
  }

  /**
   * Get email send status
   * @param {string} messageId - Message ID from send operation
   * @returns {Promise<Object>} Status information
   */
  async getEmailStatus(messageId) {
    try {
      const status = await this.client.getSendStatus(messageId);

      return {
        messageId: status.id,
        status: status.status,
      };
    } catch (error) {
      logger.error('Failed to get email status', {
        messageId,
        error: error.message,
      });

      throw new Error(`Failed to get email status: ${error.message}`);
    }
  }
}

module.exports = new EmailService();
