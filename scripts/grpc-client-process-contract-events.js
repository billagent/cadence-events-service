#!/usr/bin/env node

// gRPC Client for ProcessContractEvents
// This script makes gRPC calls to TriggerMatcherService.ProcessContractEvents

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Get parameters from environment variables (set by Dagu)
const organizationUuid = process.env.ORGANIZATION_UUID;
const customerId = process.env.CUSTOMER_ID;
const contractUuid = process.env.CONTRACT_UUID;
const requestorUuid = process.env.REQUESTOR_UUID;
const tenantUuid = process.env.TENANT_UUID;

/**
 * Calculate scheduled time from cron schedule
 * This gives us when the DAG was SUPPOSED to run, not when it actually ran
 * This is important for retries - if a DAG fails and retries later, we still want
 * the original scheduled time, not the retry execution time
 */
function calculateScheduledTimeFromCron(schedule) {
  if (!schedule) {
    // No schedule - use current time normalized to midnight
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  // Parse cron expression: "minute hour day-of-month month day-of-week"
  // Format: "0 0 * * *" = daily at midnight
  // Format: "0 0 1 * *" = monthly on 1st at midnight
  const cronParts = schedule.trim().split(/\s+/);
  if (cronParts.length < 5) {
    console.warn(`Invalid cron format: ${schedule}, using current time normalized to midnight`);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  const minute = cronParts[0];
  const hour = cronParts[1];
  const dayOfMonth = cronParts[2];
  const month = cronParts[3];
  const dayOfWeek = cronParts[4];

  const now = new Date();
  let scheduledDate = new Date(now);

  // Set time (hour and minute)
  if (hour !== '*' && !isNaN(parseInt(hour, 10))) {
    scheduledDate.setHours(parseInt(hour, 10));
  } else {
    scheduledDate.setHours(0);
  }
  
  if (minute !== '*' && !isNaN(parseInt(minute, 10))) {
    scheduledDate.setMinutes(parseInt(minute, 10));
  } else {
    scheduledDate.setMinutes(0);
  }
  
  scheduledDate.setSeconds(0);
  scheduledDate.setMilliseconds(0);

  // Handle day-of-month
  if (dayOfMonth !== '*' && !dayOfMonth.includes('-') && !dayOfMonth.includes(',')) {
    const day = parseInt(dayOfMonth, 10);
    if (!isNaN(day)) {
      // For monthly schedules (e.g., "0 0 1 * *"), use the scheduled day
      // If today is past that day, use this month; otherwise use last month
      const today = now.getDate();
      if (day <= today) {
        // Scheduled day has passed this month, use this month
        scheduledDate.setDate(day);
      } else {
        // Scheduled day hasn't come yet this month, use last month
        scheduledDate.setMonth(now.getMonth() - 1);
        scheduledDate.setDate(day);
      }
    }
  } else if (dayOfMonth.includes('-')) {
    // Handle ranges like "28-31" - use the first day of the range
    const rangeMatch = dayOfMonth.match(/^(\d+)-/);
    if (rangeMatch) {
      const firstDay = parseInt(rangeMatch[1], 10);
      const today = now.getDate();
      if (firstDay <= today) {
        scheduledDate.setDate(firstDay);
      } else {
        scheduledDate.setMonth(now.getMonth() - 1);
        scheduledDate.setDate(firstDay);
      }
    }
  }
  // For "*" (any day) or complex expressions, use current day

  return scheduledDate;
}

/**
 * Determine which schedule triggered the DAG run and calculate the correct event time
 * When multiple schedules exist, we calculate scheduled times for all and pick the one
 * closest to (but not in the future from) the actual run time
 */
function determineEventTimeFromSchedules(schedules) {
  if (!schedules || schedules.length === 0) {
    // No schedules - use current time normalized to midnight
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  const now = new Date();
  const scheduledTimes = schedules.map(schedule => ({
    schedule,
    scheduledTime: calculateScheduledTimeFromCron(schedule)
  }));

  console.log('All schedules and their calculated times:');
  scheduledTimes.forEach(({ schedule, scheduledTime }) => {
    console.log(`  Schedule: ${schedule} -> ${scheduledTime.toISOString()}`);
  });

  // Filter out scheduled times in the future (shouldn't happen for scheduled runs, but handle it)
  const pastScheduledTimes = scheduledTimes.filter(({ scheduledTime }) => scheduledTime <= now);

  if (pastScheduledTimes.length === 0) {
    // All scheduled times are in the future (unlikely but handle it)
    // Use the earliest future time
    const earliest = scheduledTimes.reduce((earliest, current) => 
      current.scheduledTime < earliest.scheduledTime ? current : earliest
    );
    console.warn(`All scheduled times are in the future, using earliest: ${earliest.scheduledTime.toISOString()}`);
    return earliest.scheduledTime;
  }

  // Find the scheduled time closest to now (but not in the future)
  const closest = pastScheduledTimes.reduce((closest, current) => {
    const closestDiff = now - closest.scheduledTime;
    const currentDiff = now - current.scheduledTime;
    return currentDiff < closestDiff ? current : closest;
  });

  console.log(`Selected scheduled time: ${closest.scheduledTime.toISOString()} from schedule: ${closest.schedule}`);
  return closest.scheduledTime;
}

// Get schedules from environment variable (set by Dagu YAML)
// SCHEDULES is a JSON array of all schedules
const schedulesJson = process.env.SCHEDULES;
let schedules = [];

if (schedulesJson) {
  try {
    schedules = JSON.parse(schedulesJson);
    if (!Array.isArray(schedules)) {
      schedules = [schedules];
    }
  } catch (error) {
    console.error(`Failed to parse SCHEDULES JSON: ${schedulesJson}`, error);
    // Fallback to single schedule if parsing fails
    schedules = [schedulesJson];
  }
} else {
  // Fallback: check for old SCHEDULE variable (backward compatibility)
  const oldSchedule = process.env.SCHEDULE;
  if (oldSchedule) {
    console.warn('SCHEDULES not found, using legacy SCHEDULE variable');
    schedules = [oldSchedule];
  }
}

// Calculate scheduled time from all schedules
// This gives us when the DAG was SUPPOSED to run, not when it actually ran
let eventTime = determineEventTimeFromSchedules(schedules);

if (schedules.length > 0) {
  console.log(`Schedules: ${schedules.join(', ')}`);
  console.log(`Calculated scheduled time: ${eventTime.toISOString()}`);
} else {
  console.warn('No schedules found, using current time normalized to midnight');
}

const serviceHost = process.env.USAGE_TERM_MATCHER_HOST || 'usage-term-matcher-ps-grpc.billing-agreement-service-layer.svc.cluster.local';
const servicePort = process.env.USAGE_TERM_MATCHER_PORT || '50051';

console.log(`Executing ProcessContractEvents for contract ${contractUuid}`);
console.log(`Event time: ${eventTime.toISOString()}`);
console.log(`Service: ${serviceHost}:${servicePort}`);

// Validate required environment variables
if (!requestorUuid) {
  console.error('REQUESTOR_UUID environment variable is required');
  process.exit(1);
}

if (!tenantUuid) {
  console.error('TENANT_UUID environment variable is required');
  process.exit(1);
}

if (!contractUuid) {
  console.error('CONTRACT_UUID environment variable is required');
  process.exit(1);
}

if (!organizationUuid) {
  console.error('ORGANIZATION_UUID environment variable is required');
  process.exit(1);
}

if (!customerId) {
  console.error('CUSTOMER_ID environment variable is required');
  process.exit(1);
}

console.log(`Requestor UUID: ${requestorUuid}`);
console.log(`Tenant UUID: ${tenantUuid}`);

// Build security context JSON (double-stringify like old script)
const securityContext = JSON.stringify({
  requestor_uuid: requestorUuid,
  tenant_uuid: tenantUuid,
  organization_uuid: organizationUuid
});

// Build gRPC request for ProcessContractEvents
const request = {
  contract_uuid: contractUuid,
  c1_organization_uuid: organizationUuid,
  c2_id: customerId,
  event_time: eventTime.toISOString()
};

// Convert to JSON string for grpcurl
const requestJson = JSON.stringify(request);

// Build grpcurl command (use single quotes for security-context like old script)
const grpcurlCommand = `grpcurl -plaintext -H 'security-context: ${securityContext}' -d '${requestJson}' ${serviceHost}:${servicePort} service.v1.TriggerMatcherService/ProcessContractEvents`;

console.log(`Executing: ${grpcurlCommand}`);

execAsync(grpcurlCommand)
  .then(({ stdout, stderr }) => {
    if (stdout) {
      console.log('Response:', stdout);
    }
    if (stderr) {
      console.error('Error output:', stderr);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to execute ProcessContractEvents:', error);
    process.exit(1);
  });
