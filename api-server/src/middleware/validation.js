const Joi = require('joi');

/**
 * Validate DAG request data
 */
const validateDAGRequest = (req, res, next) => {
  const schema = Joi.object({
    contract_uuid: Joi.string().uuid().required(),
    request_type: Joi.string().valid('seat_license', 'generate_invoice', 'seat_license_daily').required(),
    schedule: Joi.string().optional(),
    organization_uuid: Joi.string().uuid().required(),
    customer_id: Joi.string().required(),
    sku_id: Joi.string(),
    widget_uuid: Joi.string().uuid(),
    requestor_uuid: Joi.string().uuid().required(),
    tenant_uuid: Joi.string().uuid().required(),
    description: Joi.string().optional(),
    additional_env: Joi.array().items(Joi.string()).optional(),
    custom_steps: Joi.array().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message)
    });
  }

  next();
};

/**
 * Validate UUID parameter
 */
const validateUUID = (req, res, next) => {
  const uuidSchema = Joi.string().uuid().required();
  const { error } = uuidSchema.validate(req.params.uuid);
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid UUID format'
    });
  }

  next();
};

module.exports = {
  validateDAGRequest,
  validateUUID
};
