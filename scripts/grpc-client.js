#!/usr/bin/env node

// gRPC Client for Dagu
// This script makes gRPC calls to TriggerMatcherService using grpcurl

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Get parameters from environment variables (set by Dagu)
const organizationUuid = process.env.ORGANIZATION_UUID;
const customerId = process.env.CUSTOMER_ID;
const contractUuid = process.env.CONTRACT_UUID;
const skuId = process.env.SKU_ID;
const requestType = process.env.REQUEST_TYPE;
const widgetUuid = process.env.WIDGET_UUID;
const requestorUuid = process.env.REQUESTOR_UUID;
const tenantUuid = process.env.TENANT_UUID;

// Extract event time from DAG_RUN_ID (format: YYYYMMDD_HHMMSS_XXXXXX)
// DAG_RUN_ID is automatically set by Dagu for every step execution
const dagRunId = process.env.DAG_RUN_ID;
let eventTime;

if (dagRunId) {
  // Parse DAG_RUN_ID format: 20240115_140000_abc123
  const match = dagRunId.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    eventTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
    console.log(`Extracted event time from DAG_RUN_ID: ${eventTime.toISOString()}`);
  } else {
    console.warn(`Could not parse DAG_RUN_ID format: ${dagRunId}, using current time`);
    eventTime = new Date();
  }
} else {
  console.warn('DAG_RUN_ID not found, using current time');
  // Normalize to beginning of day (remove hours, minutes, seconds)
  const now = new Date();
  eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

// Get service hostname and port from environment
const serviceHost = process.env.USAGE_TERM_MATCHER_HOST || 'usage-term-matcher-ps-grpc.billing-agreement-service-layer.svc.cluster.local';
const servicePort = process.env.USAGE_TERM_MATCHER_PORT || '50051';

console.log(`Executing ${requestType} request for contract ${contractUuid}`);
console.log(`Event time: ${eventTime}`);
console.log(`Service: ${serviceHost}:${servicePort}`);

// Validate request types - only seat_license and generate_invoice are supported
const validRequestTypes = ['seat_license', 'generate_invoice', 'seat_license_daily'];
if (!validRequestTypes.includes(requestType)) {
  console.error(`Invalid request type: ${requestType}`);
  console.error(`Valid request types: ${validRequestTypes.join(', ')}`);
  process.exit(1);
}

// Validate required environment variables
if (!widgetUuid) {
  console.error('WIDGET_UUID environment variable is required');
  process.exit(1);
}

if (!requestorUuid) {
  console.error('REQUESTOR_UUID environment variable is required');
  process.exit(1);
}

if (!tenantUuid) {
  console.error('TENANT_UUID environment variable is required');
  process.exit(1);
}

console.log(`Using widget UUID: ${widgetUuid}`);
console.log(`Request type: ${requestType}`);
console.log(`Requestor UUID: ${requestorUuid}`);
console.log(`Tenant UUID: ${tenantUuid}`);

// Create the gRPC request payload for TriggerEvent
const requestPayload = {
  widget_uuid: widgetUuid,
  sku_id: skuId,
  c1_organization_uuid: organizationUuid,
  c2_id: customerId,
  contract_uuid: contractUuid,
  event_time: eventTime,
  request_type: requestType,
  count: 1
};

// Convert to JSON string for grpcurl
const requestJson = JSON.stringify(requestPayload);

// Execute grpcurl command with security context header
const securityContext = JSON.stringify({
  "requestor_uuid": requestorUuid,
  "tenant_uuid": tenantUuid,
  "organization_uuid": organizationUuid
});
const grpcurlCommand = `grpcurl -plaintext -H 'security-context: ${securityContext}' -d '${requestJson}' ${serviceHost}:${servicePort} service.v1.TriggerMatcherService/TriggerEvent`;

console.log(`Executing: ${grpcurlCommand}`);

execAsync(grpcurlCommand)
  .then(({ stdout, stderr }) => {
    if (stderr) {
      console.error('gRPC call stderr:', stderr);
    }
    
    if (stdout) {
      console.log('gRPC call successful');
      console.log('Response:', stdout);
      
      try {
        const response = JSON.parse(stdout);
        console.log('Parsed response:', JSON.stringify(response, null, 2));
        
        // Log term matches if present
        if (response.term_matches && response.term_matches.length > 0) {
          console.log('✅ Term matches found:');
          response.term_matches.forEach((match, index) => {
            console.log(`  ${index + 1}. Contract: ${match.contract_uuid}`);
            console.log(`     SKU: ${match.sku_id}`);
            console.log(`     Type: ${match.term_type}`);
            console.log(`     Description: ${match.description}`);
            console.log(`     Count: ${match.count}`);
          });
        }
        
        // Log errors if present
        if (response.term_match_errors && response.term_match_errors.length > 0) {
          console.log('⚠️  Term match errors:');
          response.term_match_errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.error}`);
          });
        }
      } catch (e) {
        console.log('Raw response (not JSON):', stdout);
      }
    }
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('gRPC call failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  });
