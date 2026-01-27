const yaml = require('js-yaml');

class YAMLGenerator {
  /**
   * Generate DAG YAML content from request data
   */
  generateDAGYAML(dagData, dagName) {
    // Handle schedule as string or array
    let schedules = [];
    if (Array.isArray(dagData.schedule)) {
      schedules = dagData.schedule;
    } else {
      schedules = [dagData.schedule || "0 0 * * *"];
    }
    
    let contractTimeZone = dagData.contract_timezone || "America/New_York";
    
    // Process each schedule for day 29-31 handling
    const processedSchedules = schedules.map(schedule => {
      let rawCron = schedule; // Keep original for script parsing
      let newSchedule = schedule;
      let scheduleDay = null;
      
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
    
      // If schedule is for day 29, 30, or 31, change to run on 28-31
      if (scheduleDay === 29 || scheduleDay === 30 || scheduleDay === 31) {
        newSchedule = "0 0 28-31 * *";
        rawCron = "0 0 28-31 * *"; // Update raw cron too
      }
      
      // Add timezone to the schedule per https://docs.dagu.cloud/features/scheduling#timezone-support
      const dagSchedule = `CRON_TZ=${contractTimeZone} ${newSchedule}`;
      
      return { 
        schedule: dagSchedule,  // For Dagu YAML (with CRON_TZ)
        rawCron: rawCron,       // For script parsing (without CRON_TZ)
        scheduleDay 
      };
    });
    
    // Use array if multiple schedules, string if single (for Dagu YAML)
    const finalSchedule = processedSchedules.length === 1 
      ? processedSchedules[0].schedule 
      : processedSchedules.map(p => p.schedule);
    
    // Extract raw cron expressions for script (without CRON_TZ prefix)
    const rawCronSchedules = processedSchedules.length === 1
      ? processedSchedules[0].rawCron
      : processedSchedules.map(p => p.rawCron);
    
    // Build precondition based on schedule day(s)
    let precondition;

    if (processedSchedules.length === 1) {
      // Single schedule - use timezone-aware logic
      const scheduleDay = processedSchedules[0].scheduleDay;
      
      // if schedule day is 29 then create a precondition (handles leap year feb and regular year feb)
      // if today is 29 OR (today is 28 AND tomorrow is the first)
      if (scheduleDay === 29) {
        // Construct bash command to check if today is 29th OR (today is 28th AND tomorrow is 1st)
        // BusyBox-compatible: calculate tomorrow by adding 86400 seconds to current epoch time
        const bashCondition = `\`bash -lc 't=$(TZ="${contractTimeZone}" date +%d); tm=$(TZ="${contractTimeZone}" date -d @$(($(TZ="${contractTimeZone}" date +%s) + 86400)) +%d); if [ "$t" = "29" ] || { [ "$t" = "28" ] && [ "$tm" = "01" ]; }; then echo true; else echo false; fi'\``;

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
        const bashCondition = `\`bash -lc 't=$(TZ="${contractTimeZone}" date +%d); tm=$(TZ="${contractTimeZone}" date -d @$(($(TZ="${contractTimeZone}" date +%s) + 86400)) +%d); if [ "$t" = "30" ] || { [ "$tm" = "01" ] && [ "$t" -lt 30 ]; }; then echo true; else echo false; fi'\``;

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
        const bashCondition = `\`bash -lc 'tm=$(TZ="${contractTimeZone}" date -d @$(($(TZ="${contractTimeZone}" date +%s) + 86400)) +%d); if [ "$tm" = "01" ]; then echo true; else echo false; fi'\``;

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
    } else {
      // Multiple schedules - use a combined precondition
      // For simplicity, use always-true since Dagu will handle schedule matching
      precondition = {
        condition: "`bash -lc 'echo true'`",
        expected: "true"
      };
    }

    // Build environment variables
    const envVars = [
      'USAGE_TERM_MATCHER_HOST=usage-term-matcher-ps-grpc.billing-agreement-service-layer.svc.cluster.local',
      'USAGE_TERM_MATCHER_PORT=50051',
      `ORGANIZATION_UUID=${dagData.organization_uuid}`,
      `CUSTOMER_ID=${dagData.customer_id}`,
      `CONTRACT_UUID=${dagData.contract_uuid}`,
      // Only include SKU_ID and WIDGET_UUID if present (for backward compatibility)
      ...(dagData.sku_id ? [`SKU_ID=${dagData.sku_id}`] : []),
      ...(dagData.widget_uuid ? [`WIDGET_UUID=${dagData.widget_uuid}`] : []),
      `REQUEST_TYPE=${dagData.request_type}`,
      `REQUESTOR_UUID=${dagData.requestor_uuid}`,
      `TENANT_UUID=${dagData.tenant_uuid}`,
      `CONTRACT_TIMEZONE=${contractTimeZone}`,
      // Pass all schedules as JSON array (raw cron expressions without CRON_TZ prefix)
      // so script can determine which one triggered and calculate correct event_time
      `SCHEDULES=${JSON.stringify(Array.isArray(rawCronSchedules) ? rawCronSchedules : [rawCronSchedules])}`
    ];

    // Determine step command based on request type
    const stepCommand = dagData.request_type === 'process_contract_events'
      ? '/opt/dagu/scripts/grpc-client-process-contract-events.js'
      : '/opt/dagu/scripts/grpc-client.js';
    
    const stepName = dagData.request_type === 'process_contract_events'
      ? 'call-process-contract-events'
      : 'call-usage-term-matcher';

    const dagTemplate = {
      name: dagName,
      description: dagData.description || `${dagData.request_type} workflow for contract ${dagData.contract_uuid}`,
      schedule: finalSchedule,
      preconditions: [precondition],
      env: envVars,
      steps: [{
        name: stepName,
        command: stepCommand,
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
