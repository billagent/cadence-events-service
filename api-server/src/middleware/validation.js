const Joi = require('joi');

/**
 * Validate DAG request data.
 * Only request_type 'process_contract_events' is supported.
 */
const validateDAGRequest = (req, res, next) => {
  const schema = Joi.object({
    contract_uuid: Joi.string().uuid().required(),
    request_type: Joi.string().valid('process_contract_events').required(),
    organization_uuid: Joi.string().uuid().required(),
    contract_timezone: Joi.string().required(),
    customer_id: Joi.string().required(),
    requestor_uuid: Joi.string().uuid().required(),
    tenant_uuid: Joi.string().uuid().required(),
    schedule: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
    description: Joi.string().optional(),
    additional_env: Joi.array().items(Joi.string()).optional(),
    custom_steps: Joi.array().optional(),
    sku_id: Joi.string().optional(),
    widget_uuid: Joi.string().uuid().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    console.error('Validation error:', error);
    return res.status(400).json({
      success: false,
      message: 'Validation error ',
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
