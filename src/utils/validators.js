const Joi = require('joi');

const emailNotificationSchema = Joi.object({
  to: Joi.alternatives()
    .try(
      Joi.string().email().required(),
      Joi.array().items(Joi.string().email()).min(1).required()
    )
    .required(),
  subject: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).required(),
  isHtml: Joi.boolean().default(false),
  cc: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email())
  ).optional(),
  bcc: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email())
  ).optional(),
  templateId: Joi.string().optional(),
  templateData: Joi.object().optional(),
  priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
  metadata: Joi.object().optional(),
});

const smsNotificationSchema = Joi.object({
  to: Joi.alternatives()
    .try(
      Joi.string().pattern(/^\+[1-9]\d{1,14}$/).required(),
      Joi.array().items(Joi.string().pattern(/^\+[1-9]\d{1,14}$/)).min(1).required()
    )
    .required(),
  message: Joi.string().min(1).max(160).required(),
  priority: Joi.string().valid('high', 'normal', 'low').default('normal'),
  metadata: Joi.object().optional(),
});

const bulkNotificationSchema = Joi.object({
  notifications: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid('email', 'sms').required(),
        data: Joi.when('type', {
          is: 'email',
          then: emailNotificationSchema,
          otherwise: smsNotificationSchema,
        }),
      })
    )
    .min(1)
    .max(100)
    .required(),
  scheduledAt: Joi.date().iso().min('now').optional(),
});

const validateEmailNotification = (data) => {
  return emailNotificationSchema.validate(data, { abortEarly: false });
};

const validateSmsNotification = (data) => {
  return smsNotificationSchema.validate(data, { abortEarly: false });
};

const validateBulkNotification = (data) => {
  return bulkNotificationSchema.validate(data, { abortEarly: false });
};

module.exports = {
  validateEmailNotification,
  validateSmsNotification,
  validateBulkNotification,
};
