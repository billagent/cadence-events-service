const yaml = require('js-yaml');

class YAMLGenerator {
  /**
   * Generate DAG YAML content from request data
   */
  generateDAGYAML(dagData, dagName) {
    // Check to see if the incomming schedule is on the 29th of any month, the 30th of any month, or the 31st of any month if so then run 28-31
    const schedule = dagData.schedule;
    const scheduleDate = new Date(schedule);
    const scheduleDay = scheduleDate.getDate();
    const scheduleMonth = scheduleDate.getMonth();
    const scheduleYear = scheduleDate.getFullYear();
    if (scheduleDay === 29 || scheduleDay === 30 || scheduleDay === 31) {
      dagData.schedule = "0 0 28-31 * *";
    }
    
    // Initialize preconditionScript with a default value
    let preconditionScript;
    
    // if schedule day is 29 then create a precondition that run a bash script (this handles leap year feb and regular year feb)
    // if today is 29 or if (today = 28th AND tomorrow is the first)
    if (scheduleDay === 29) {
      preconditionScript = `bash -lc "t=$(date +%d); tm=$(date -d tomorrow +%d); if [ \"$t\" = \"29\" ] || { [ \"$t\" = \"28\" ] && [ \"$tm\" = \"01\" ]; }; then echo true; else echo false; fi"`;
    }
    // if schedule day is 30 then create a precondition that run a bash script
    // if today is 30 or if (today less than 30th AND tomorrow is the first)
    else if (scheduleDay === 30) {
      preconditionScript = `bash -lc "t=$(date +%d); tm=$(date -d tomorrow +%d); if [ \"$t\" = \"30\" ] || { [ \"$tm\" = \"01\" ] && [ \"$t\" -lt 30 ]; }; then echo true; else echo false; fi"`;
    }
    // if schedule day is 31 then create a precondition that run a bash script
    // if tomorrow is the first day of the month
    else if (scheduleDay === 31) {
      preconditionScript = `bash -lc "if [ \"$(date -d tomorrow +%d)\" = \"01\" ]; then echo true; else echo false; fi"`;
    }
    // if schedule day is 28 or less then run a bash script
    // that always returns true
    else if (scheduleDay <= 28) {
      preconditionScript = `bash -lc "echo true"`;
    }
    // Default fallback for any edge cases
    else {
      preconditionScript = `bash -lc "echo true"`;
    }
    

    const dagTemplate = {
      name: dagName,
      description: dagData.description || `${dagData.request_type} workflow for contract ${dagData.contract_uuid}`,
      schedule: dagData.schedule || "0 */5 * * *", // Default to every 5 minutes
      precondition: {
        condition: preconditionScript,
        expected: "true"
      },
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
