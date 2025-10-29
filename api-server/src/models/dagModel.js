/**
 * Custom error classes for DAG operations
 */
class DAGValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DAGValidationError';
  }
}

class DAGNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DAGNotFoundError';
  }
}

/**
 * DAG data structure
 */
class DAGData {
  constructor(data) {
    this.contract_uuid = data.contract_uuid;
    this.request_type = data.request_type;
    this.schedule = data.schedule || "0 */5 * * *";
    this.organization_uuid = data.organization_uuid;
    this.customer_id = data.customer_id;
    this.sku_id = data.sku_id;
    this.widget_uuid = data.widget_uuid;
    this.requestor_uuid = data.requestor_uuid;
    this.tenant_uuid = data.tenant_uuid;
    this.description = data.description;
    this.additional_env = data.additional_env || [];
    this.custom_steps = data.custom_steps;
  }

  /**
   * Validate DAG data
   */
  validate() {
    const requiredFields = [
      'contract_uuid',
      'request_type',
      'organization_uuid',
      'customer_id',
      'sku_id',
      'widget_uuid',
      'requestor_uuid',
      'tenant_uuid'
    ];

    for (const field of requiredFields) {
      if (!this[field]) {
        throw new DAGValidationError(`Missing required field: ${field}`);
      }
    }

    const validRequestTypes = ['seat_license', 'generate_invoice', 'seat_license_daily'];
    if (!validRequestTypes.includes(this.request_type)) {
      throw new DAGValidationError(`Invalid request_type. Must be one of: ${validRequestTypes.join(', ')}`);
    }
  }
}

module.exports = {
  DAGValidationError,
  DAGNotFoundError,
  DAGData
};
