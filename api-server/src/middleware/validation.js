const Joi = require('joi');

/**
 * Validate DAG request data
 */
const validateDAGRequest = (req, res, next) => {
  // For process_contract_events, schedule is required and can be string or array
  // sku_id and widget_uuid are optional
  // For other request types, schedule is optional, sku_id/widget_uuid may be required
  const baseSchema = {
    contract_uuid: Joi.string().uuid().required(),
    request_type: Joi.string().valid('seat_license', 'generate_invoice', 'seat_license_daily', 'process_contract_events').required(),
    organization_uuid: Joi.string().uuid().required(),
    contract_timezone: Joi.string().required(),
    customer_id: Joi.string().required(),
    requestor_uuid: Joi.string().uuid().required(),
    tenant_uuid: Joi.string().uuid().required(),
    description: Joi.string().optional(),
    additional_env: Joi.array().items(Joi.string()).optional(),
    custom_steps: Joi.array().optional()
  };

  // Check request_type first to determine which schema to use
  const requestType = req.body.request_type;
  let schema;

  if (requestType === 'process_contract_events') {
    schema = Joi.object({
      ...baseSchema,
      schedule: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
      sku_id: Joi.string().optional(),
      widget_uuid: Joi.string().uuid().optional()
    });
  } else {
    schema = Joi.object({
      ...baseSchema,
      schedule: Joi.string().optional(),
      sku_id: Joi.string().optional(),
      widget_uuid: Joi.string().uuid().optional()
    });
  }

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
