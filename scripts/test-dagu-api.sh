#!/bin/bash

# Test script for DAG Management API
# Only request_type process_contract_events is supported.

set -e

API_BASE_URL="http://localhost:3000"
TEST_CONTRACT_UUID="019907f1-5fcc-74c8-a493-3b92cf089c7e"
TEST_ORGANIZATION_UUID="9671650f-dd35-4ec6-8972-4ebb741b62a5"
REQUEST_TYPE="process-contract-events"

echo "🧪 Testing DAG Management API (process_contract_events only)..."

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$API_BASE_URL/health" | jq '.'
echo ""

# Test 2: Create process_contract_events DAG
echo "2. Creating process_contract_events DAG..."
CREATE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/cadence-event" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_uuid": "'$TEST_CONTRACT_UUID'",
    "request_type": "process_contract_events",
    "schedule": ["0 0 * * *", "0 0 1 * *"],
    "contract_timezone": "America/New_York",
    "organization_uuid": "'$TEST_ORGANIZATION_UUID'",
    "customer_id": "test-customer-workflow",
    "requestor_uuid": "019907f1-5fcc-74c8-0000-3b92cf089c7e",
    "tenant_uuid": "019907f1-5fcc-74c8-0001-3b92cf089c7e",
    "description": "Test process contract events workflow"
  }')

echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Test 3: Get DAG
echo "3. Getting process_contract_events DAG..."
curl -s "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/$REQUEST_TYPE" | jq '.'
echo ""

# Test 4: Update DAG
echo "4. Updating process_contract_events DAG..."
curl -s -X PUT "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/$REQUEST_TYPE" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_uuid": "'$TEST_CONTRACT_UUID'",
    "request_type": "process_contract_events",
    "schedule": "0 0 * * *",
    "contract_timezone": "America/New_York",
    "organization_uuid": "'$TEST_ORGANIZATION_UUID'",
    "customer_id": "test-customer-workflow",
    "requestor_uuid": "019907f1-5fcc-74c8-0000-3b92cf089c7e",
    "tenant_uuid": "019907f1-5fcc-74c8-0001-3b92cf089c7e",
    "description": "Updated process contract events workflow"
  }' | jq '.'
echo ""

# Test 5: Verify DAG file in container (optional)
echo "5. Verifying DAG file in container..."
if command -v docker &>/dev/null; then
  docker exec cadence-events-local ls -la /home/dagu/dags/ 2>/dev/null | grep "$TEST_CONTRACT_UUID" || echo "(container not running or no matching DAG)"
else
  echo "(docker not available, skipping)"
fi
echo ""

# Test 6: Check if Dagu loaded the DAG (optional)
echo "6. Checking if Dagu loaded the DAG..."
curl -s "http://localhost:8080/api/v2/dags" 2>/dev/null | jq '.dags[] | select(.dag.name == "'$TEST_CONTRACT_UUID'") | {name: .dag.name, description: .dag.description}' || echo "(Dagu not available)"
echo ""

# Test 7: Clean up - Delete DAG
echo "7. Cleaning up - Deleting test DAG..."
curl -s -X DELETE "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/$REQUEST_TYPE" | jq '.'
echo ""

echo "✅ API testing completed!"
