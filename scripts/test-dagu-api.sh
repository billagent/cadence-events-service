#!/bin/bash

# Test script for DAG Management API
# This script tests the API endpoints after the container is running

set -e

API_BASE_URL="http://localhost:3000"
TEST_CONTRACT_UUID="019907f1-5fcc-74c8-a493-3b92cf089c7e"
TEST_ORGANIZATION_UUID="9671650f-dd35-4ec6-8972-4ebb741b62a5"

echo "🧪 Testing DAG Management API..."

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$API_BASE_URL/health" | jq '.'
echo ""

# Test 2: Create seat license DAG
echo "2. Creating seat license DAG..."
SEAT_LICENSE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/cadence-event" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_uuid": "'$TEST_CONTRACT_UUID'",
    "request_type": "seat_license",
    "schedule": "*/5 * * * *",
    "organization_uuid": "'$TEST_ORGANIZATION_UUID'",
    "customer_id": "test-customer-workflow",
    "sku_id": "CT-BASIC-01",
    "widget_uuid": "019907f1-5fcc-78d2-a738-3a5f5a52bf8e",
    "description": "Test seat license workflow"
  }')

echo "$SEAT_LICENSE_RESPONSE" | jq '.'
echo ""

# Test 3: Create generate invoice DAG
echo "3. Creating generate invoice DAG..."
GENERATE_INVOICE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/cadence-event" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_uuid": "'$TEST_CONTRACT_UUID'",
    "request_type": "generate_invoice",
    "schedule": "0 0 1 * *",
    "organization_uuid": "'$TEST_ORGANIZATION_UUID'",
    "customer_id": "test-customer-workflow",
    "sku_id": "CT-PREMIUM-01",
    "widget_uuid": "019907f1-5fcc-78c4-8107-7e6bceff4041",
    "description": "Test generate invoice workflow"
  }')

echo "$GENERATE_INVOICE_RESPONSE" | jq '.'
echo ""

# Test 4: Get seat license DAG
echo "4. Getting seat license DAG..."
curl -s "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/seat-license" | jq '.'
echo ""

# Test 5: Get generate invoice DAG
echo "5. Getting generate invoice DAG..."
curl -s "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/generate-invoice" | jq '.'
echo ""

# Test 6: Update seat license DAG
echo "6. Updating seat license DAG..."
curl -s -X PUT "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/seat-license" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_uuid": "'$TEST_CONTRACT_UUID'",
    "request_type": "seat_license",
    "schedule": "*/10 * * * *",
    "organization_uuid": "'$TEST_ORGANIZATION_UUID'",
    "customer_id": "test-customer-workflow",
    "sku_id": "CT-BASIC-01",
    "widget_uuid": "019907f1-5fcc-78d2-a738-3a5f5a52bf8e",
    "description": "Updated seat license workflow - every 10 minutes"
  }' | jq '.'
echo ""

# Test 7: Verify DAG files were created
echo "7. Verifying DAG files were created..."
echo "DAG files in container:"
docker exec cadence-events-local ls -la /home/dagu/dags/ | grep "$TEST_CONTRACT_UUID"
echo ""

# Test 8: Check if Dagu loaded the DAGs
echo "8. Checking if Dagu loaded the DAGs..."
curl -s "http://localhost:8080/api/v2/dags" | jq '.dags[] | select(.dag.name | contains("'$TEST_CONTRACT_UUID'")) | {name: .dag.name, description: .dag.description}'
echo ""

# Test 9: Clean up - Delete DAGs
echo "9. Cleaning up - Deleting test DAGs..."
curl -s -X DELETE "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/seat-license" | jq '.'
curl -s -X DELETE "$API_BASE_URL/api/cadence-event/$TEST_CONTRACT_UUID/generate-invoice" | jq '.'
echo ""

echo "✅ API testing completed!"
