const yaml = require('js-yaml');

class YAMLGenerator {
  /**
   * Generate DAG YAML content from request data
   */
  generateDAGYAML(dagData) {
    const dagName = `${dagData.contract_uuid}-${dagData.request_type.replace('_', '-')}`;
    const dagTemplate = {
      name: dagName,
      description: dagData.description || `${dagData.request_type} workflow for contract ${dagData.contract_uuid}`,
      schedule: dagData.schedule || "0 */5 * * *", // Default to every 5 minutes
      env: [
        'USAGE_TERM_MATCHER_HOST=usage-term-matcher-ps-grpc.billing-agreement-service-layer.svc.cluster.local',
        'USAGE_TERM_MATCHER_PORT=50051',
        `ORGANIZATION_UUID=${dagData.organization_uuid}`,
        `CUSTOMER_ID=${dagData.customer_id}`,
        `CONTRACT_UUID=${dagData.contract_uuid}`,
        `SKU_ID=${dagData.sku_id}`,
        `WIDGET_UUID=${dagData.widget_uuid}`,
        `REQUEST_TYPE=${dagData.request_type}`,
        `REQUESTOR_UUID=${dagData.requestor_uuid}`,
        `TENANT_UUID=${dagData.tenant_uuid}`
      ],
      steps: [{
        name: 'call-usage-term-matcher',
        command: '/opt/dagu/scripts/grpc-client.js',
        executor: 'shell'
      }]
    };

    // Add additional environment variables if provided
    if (dagData.additional_env) {
      dagTemplate.env.push(...dagData.additional_env);
    }

    // Add custom steps if provided
    if (dagData.custom_steps) {
      dagTemplate.steps = dagData.custom_steps;
    }

    return yaml.dump(dagTemplate, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
  }

  /**
   * Parse DAG YAML content back to object
   */
  parseDAGYAML(yamlContent) {
    try {
      return yaml.load(yamlContent);
    } catch (error) {
      throw new Error(`Failed to parse YAML content: ${error.message}`);
    }
  }
}

module.exports = new YAMLGenerator();
