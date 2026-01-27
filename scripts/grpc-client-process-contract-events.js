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
 * Calculate scheduled time from cron schedule in a specific timezone
 * This gives us when the DAG was SUPPOSED to run, not when it actually ran
 * This is important for retries - if a DAG fails and retries later, we still want
 * the original scheduled time, not the retry execution time
 * 
 * @param {string} schedule - Cron expression (e.g., "0 0 1 * *")
 * @param {string} timezone - IANA timezone (e.g., "America/New_York")
 * @returns {Date} Scheduled time in UTC
 */
function calculateScheduledTimeFromCron(schedule, timezone) {
  if (!schedule) {
    // No schedule - use current time normalized to midnight in contract timezone
    return getMidnightInTimezone(timezone);
  }

  // Parse cron expression: "minute hour day-of-month month day-of-week"
  // Format: "0 0 * * *" = daily at midnight
  // Format: "0 0 1 * *" = monthly on 1st at midnight
  const cronParts = schedule.trim().split(/\s+/);
  if (cronParts.length < 5) {
    console.warn(`Invalid cron format: ${schedule}, using current time normalized to midnight`);
    return getMidnightInTimezone(timezone);
  }

  const minute = cronParts[0];
  const hour = cronParts[1];
  const dayOfMonth = cronParts[2];
  const month = cronParts[3];
  const dayOfWeek = cronParts[4];

  // Get current time in the contract's timezone
  const nowInTimezone = getCurrentTimeInTimezone(timezone);
  const now = new Date();

  // Determine which day to use
  let targetDay = nowInTimezone.day;
  let targetMonth = nowInTimezone.month;
  let targetYear = nowInTimezone.year;

  // Handle day-of-month
  if (dayOfMonth !== '*' && !dayOfMonth.includes('-') && !dayOfMonth.includes(',')) {
    const day = parseInt(dayOfMonth, 10);
    if (!isNaN(day)) {
      // For monthly schedules (e.g., "0 0 1 * *"), use the scheduled day
      // If today is past that day, use this month; otherwise use last month
      const today = nowInTimezone.day;
      if (day <= today) {
        // Scheduled day has passed this month, use this month
        targetDay = day;
      } else {
        // Scheduled day hasn't come yet this month, use last month
        targetMonth = nowInTimezone.month - 1;
        if (targetMonth < 0) {
          targetMonth = 11;
          targetYear--;
        }
        targetDay = day;
      }
    }
  } else if (dayOfMonth.includes('-')) {
    // Handle ranges like "28-31" - use the first day of the range
    const rangeMatch = dayOfMonth.match(/^(\d+)-/);
    if (rangeMatch) {
      const firstDay = parseInt(rangeMatch[1], 10);
      const today = nowInTimezone.day;
      if (firstDay <= today) {
        targetDay = firstDay;
      } else {
        targetMonth = nowInTimezone.month - 1;
        if (targetMonth < 0) {
          targetMonth = 11;
          targetYear--;
        }
        targetDay = firstDay;
      }
    }
  }
  // For "*" (any day) or complex expressions, use current day

  // Get hour and minute
  const targetHour = (hour !== '*' && !isNaN(parseInt(hour, 10))) ? parseInt(hour, 10) : 0;
  const targetMinute = (minute !== '*' && !isNaN(parseInt(minute, 10))) ? parseInt(minute, 10) : 0;

  // Convert the scheduled time from contract timezone to UTC
  // We create an ISO string representing the time in the contract timezone,
  // then use a method to convert it to UTC
  return convertTimezoneToUTC(targetYear, targetMonth, targetDay, targetHour, targetMinute, timezone);
}

/**
 * Convert a date/time in a specific timezone to UTC
 * Searches for the UTC time that represents the given time in the timezone
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {number} day - Day of month
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {string} timezone - IANA timezone (e.g., "America/New_York")
 * @returns {Date} UTC Date object
 */
function convertTimezoneToUTC(year, month, day, hour, minute, timezone) {
  if (!timezone || timezone === 'UTC') {
    return new Date(Date.UTC(year, month, day, hour, minute, 0));
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Start with an estimate: the UTC time that would be close to our target
  // Most timezones are within ±14 hours of UTC, so search ±16 hours to be safe
  const baseUTC = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const searchStart = baseUTC.getTime() - 16 * 60 * 60 * 1000; // -16 hours
  const searchEnd = baseUTC.getTime() + 16 * 60 * 60 * 1000;   // +16 hours
  
  // Search in 15-minute increments (faster than 1-minute, accurate enough)
  for (let t = searchStart; t <= searchEnd; t += 15 * 60000) {
    const candidate = new Date(t);
    const parts = formatter.formatToParts(candidate);
    const tzYear = parseInt(parts.find(p => p.type === 'year').value);
    const tzMonth = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const tzDay = parseInt(parts.find(p => p.type === 'day').value);
    const tzHour = parseInt(parts.find(p => p.type === 'hour').value);
    const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);
    
    if (tzYear === year && tzMonth === month && tzDay === day && tzHour === hour && tzMinute === minute) {
      // Found match! Fine-tune to the exact minute
      for (let fineTune = t - 15 * 60000; fineTune <= t + 15 * 60000; fineTune += 60000) {
        const fineCandidate = new Date(fineTune);
        const fineParts = formatter.formatToParts(fineCandidate);
        const fineYear = parseInt(fineParts.find(p => p.type === 'year').value);
        const fineMonth = parseInt(fineParts.find(p => p.type === 'month').value) - 1;
        const fineDay = parseInt(fineParts.find(p => p.type === 'day').value);
        const fineHour = parseInt(fineParts.find(p => p.type === 'hour').value);
        const fineMinute = parseInt(fineParts.find(p => p.type === 'minute').value);
        
        if (fineYear === year && fineMonth === month && fineDay === day && fineHour === hour && fineMinute === minute) {
          return fineCandidate;
        }
      }
      return candidate; // Return the 15-minute match if fine-tuning didn't find exact
    }
  }
  
  // Fallback: return the base UTC estimate
  console.warn(`Could not find exact UTC time for ${year}-${month+1}-${day} ${hour}:${minute} in ${timezone}, using estimate`);
  return baseUTC;
}

/**
 * Get current time components in a specific timezone
 */
function getCurrentTimeInTimezone(timezone) {
  if (!timezone) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth(),
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes()
    };
  }
  
  // Use Intl.DateTimeFormat to get current time in the timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value) - 1, // 0-indexed
    day: parseInt(parts.find(p => p.type === 'day').value),
    hour: parseInt(parts.find(p => p.type === 'hour').value),
    minute: parseInt(parts.find(p => p.type === 'minute').value)
  };
}

/**
 * Get midnight in a specific timezone (as UTC Date)
 */
function getMidnightInTimezone(timezone) {
  if (!timezone || timezone === 'UTC') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  }
  
  const nowTz = getCurrentTimeInTimezone(timezone);
  return convertTimezoneToUTC(nowTz.year, nowTz.month, nowTz.day, 0, 0, timezone);
}

/**
 * Determine which schedule triggered the DAG run and calculate the correct event time
 * When multiple schedules exist, we calculate scheduled times for all and pick the one
 * closest to (but not in the future from) the actual run time
 * 
 * @param {string[]} schedules - Array of cron expressions
 * @param {string} timezone - IANA timezone (e.g., "America/New_York")
 */
function determineEventTimeFromSchedules(schedules, timezone) {
  if (!schedules || schedules.length === 0) {
    // No schedules - use current time normalized to midnight in contract timezone
    return getMidnightInTimezone(timezone);
  }

  const now = new Date();
  const scheduledTimes = schedules.map(schedule => ({
    schedule,
    scheduledTime: calculateScheduledTimeFromCron(schedule, timezone)
  }));

  console.log('All schedules and their calculated times (in contract timezone):');
  scheduledTimes.forEach(({ schedule, scheduledTime }) => {
    console.log(`  Schedule: ${schedule} -> ${scheduledTime.toISOString()} UTC`);
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

// Get contract timezone from environment variable
const contractTimezone = process.env.CONTRACT_TIMEZONE || 'UTC';

// Calculate scheduled time from all schedules
// This gives us when the DAG was SUPPOSED to run, not when it actually ran
// Pass timezone so scheduled times are calculated in the contract's timezone
let eventTime = determineEventTimeFromSchedules(schedules, contractTimezone);

if (schedules.length > 0) {
  console.log(`Schedules: ${schedules.join(', ')}`);
  console.log(`Contract timezone: ${contractTimezone}`);
  console.log(`Calculated scheduled time (UTC): ${eventTime.toISOString()}`);
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
