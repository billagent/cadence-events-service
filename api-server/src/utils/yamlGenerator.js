const yaml = require('js-yaml');

class YAMLGenerator {
  /**
   * Generate DAG YAML content from request data
   */
  generateDAGYAML(dagData, dagName) {
    // Check to see if the incoming schedule is on the 29th of any month, the 30th of any month, or the 31st of any month if so then run 28-31
    
    let newSchedule = dagData.schedule || "0 */5 * * *";
    let scheduleDay = null;
    let contractTimeZone = dagData.contract_timezone || "America/New_York";
    
    // Parse cron string to extract day-of-month (3rd field: minute hour day month weekday)
    // Format: "minute hour day-of-month month day-of-week"
    if (newSchedule) {
      const cronParts = newSchedule.trim().split(/\s+/);
      if (cronParts.length >= 3) {
        const dayField = cronParts[2]; // day-of-month is the 3rd field (0-indexed: 2)
        
        // Check if it's a single day number
        const dayMatch = dayField.match(/^(\d+)$/);
        if (dayMatch) {
          scheduleDay = parseInt(dayMatch[1], 10);
        } else if (dayField.includes('-')) {
          // Handle ranges like "28-31" - extract the first number
          const rangeMatch = dayField.match(/^(\d+)-/);
          if (rangeMatch) {
            scheduleDay = parseInt(rangeMatch[1], 10);
          }
        }
      }
    }
     // 0 0 29 * *
    // If schedule is for day 29, 30, or 31, change to run on 28-31 with preconditions
    if (scheduleDay === 29 || scheduleDay === 30 || scheduleDay === 31) {
      newSchedule = "0 0 28-31 * *";
    }
    // add timezone to the schedule per https://docs.dagu.cloud/features/scheduling#timezone-support
    newSchedule = `CRON_TZ=${contractTimeZone} ${newSchedule}`;

    dagData.schedule = newSchedule;
    // Build precondition based on schedule day
    // Dagu expects preconditions as an array with condition and expected fields
    let precondition;

    
    // if schedule day is 29 then create a precondition (handles leap year feb and regular year feb)
    // if today is 29 OR (today is 28 AND tomorrow is the first)
    if (scheduleDay === 29) {
      // Construct bash command to check if today is 29th OR (today is 28th AND tomorrow is 1st)
      // BusyBox-compatible: calculate tomorrow by adding 86400 seconds to current epoch time
      const bashCondition = `\`bash -lc 't=$(TZ=\"${contractTimeZone}\" date +%d); tm=$(TZ=\"${contractTimeZone}\" date -d @$(($(TZ=\"${contractTimeZone}\" date +%s) + 86400)) +%d); if [ "$t" = "29" ] || { [ "$t" = "28" ] && [ "$tm" = "01" ]; }; then echo true; else echo false; fi'\``;

      precondition = {
        condition: bashCondition,
        expected: "true"
      };
    }
    // if schedule day is 30 then create a precondition
    // if today is 30 OR (tomorrow is 1st AND today < 30)
    else if (scheduleDay === 30) {
      // Construct bash command to check if today is 30th OR (tomorrow is 1st AND today < 30)
      // BusyBox-compatible: calculate tomorrow by adding 86400 seconds to current epoch time
      const bashCondition = `\`bash -lc 't=$(TZ=\"${contractTimeZone}\" date +%d); tm=$(TZ=\"${contractTimeZone}\" date -d @$(($(TZ=\"${contractTimeZone}\" date +%s) + 86400)) +%d); if [ "$t" = "30" ] || { [ "$tm" = "01" ] && [ "$t" -lt 30 ]; }; then echo true; else echo false; fi'\``;

      precondition = {
        condition: bashCondition,
        expected: "true"
      };
    }
    // if schedule day is 31 then create a precondition
    // if tomorrow is the first day of the month
    else if (scheduleDay === 31) {
      // Construct bash command to check if tomorrow is the first day of the month
      // BusyBox-compatible: calculate tomorrow by adding 86400 seconds to current epoch time
      const bashCondition = `\`bash -lc 'tm=$(TZ=\"${contractTimeZone}\" date -d @$(($(TZ=\"${contractTimeZone}\" date +%s) + 86400)) +%d); if [ "$tm" = "01" ]; then echo true; else echo false; fi'\``;

      precondition = {
        condition: bashCondition,
        expected: "true"
      };
    }
    // if schedule day is 28 or less, always run (no precondition needed)
    // For days <= 28, we can either omit the precondition or use a simple always-true condition
    else if (scheduleDay !== null && scheduleDay <= 28) {
      precondition = {
        condition: "`bash -lc 'echo true'`",
        expected: "true"
      };
    }
    // Default fallback for any edge cases (null scheduleDay or other values)
    else {
      precondition = {
        condition: "`bash -lc 'echo true'`",
        expected: "true"
      };
    }

    const dagTemplate = {
      name: dagName,
      description: dagData.description || `${dagData.request_type} workflow for contract ${dagData.contract_uuid}`,
      schedule: dagData.schedule || "0 */5 * * *", // Default to every 5 minutes
      preconditions: [precondition],
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
        `TENANT_UUID=${dagData.tenant_uuid}`,
        `CONTRACT_TIMEZONE=${dagData.contract_timezone}`
        `SCHEDULE_DAY=${scheduleDay}`
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
