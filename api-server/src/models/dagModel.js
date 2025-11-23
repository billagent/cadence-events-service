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
    const validWidgetCadenceRequestTypes = ['seat_license_daily', 'seat_license'];
    
    const requiredWidgetCadenceFields = [
      'contract_uuid',
      'request_type',
      'organization_uuid',
      'customer_id',
      'sku_id',
      'widget_uuid',
      'requestor_uuid',
      'tenant_uuid'
    ];
    const validInvoiceRequestTypes = ['generate_invoice'];
    const requiredInvoiceFields = [
      'contract_uuid',
      'request_type',
      'organization_uuid',
      'customer_id',
      'requestor_uuid',
      'tenant_uuid'
    ];

    if (validInvoiceRequestTypes.includes(this.request_type)) {
      for (const field of requiredInvoiceFields) {
        if (!this[field]) {
          throw new DAGValidationError(`Missing required field for invoice_generation request: ${field}`);
        }
      }
    } else if (validWidgetCadenceRequestTypes.includes(this.request_type)) {
      for (const field of requiredWidgetCadenceFields) {
        if (!this[field]) {
          throw new DAGValidationError(`Missing required field for widget_cadence request: ${field}`);
        }
      }
    } else {
      throw new DAGValidationError(`Invalid request_type. Must be one of: ${validWidgetCadenceRequestTypes.join(', ')} for widget cadence requests or must be one of: ${validInvoiceRequestTypes.join(', ')} for invoice requests. Got: ${this.request_type}`);
    }
  }
}

module.exports = {
  DAGValidationError,
  DAGNotFoundError,
  DAGData
};
