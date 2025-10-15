# DAG Management API

REST API for managing Dagu DAG files in the cadence-events-service.

## Overview

This API server provides REST endpoints for creating, reading, updating, and deleting DAG files that are automatically picked up by the Dagu workflow engine. It replaces the dependency on unreleased Dagu API features with a stable file-based approach.

## API Endpoints

### Health Check
- `GET /health` - Check API server health

### DAG Management
- `POST /api/cadence-event` - Create a new DAG
- `GET /api/cadence-event/:uuid/:requestType` - Get an existing DAG
- `PUT /api/cadence-event/:uuid/:requestType` - Update an existing DAG
- `DELETE /api/cadence-event/:uuid/:requestType` - Delete a DAG

## Request/Response Format

### Create DAG Request
```json
{
  "contract_uuid": "019907f1-5fcc-74c8-a493-3b92cf089c7e",
  "request_type": "seat_license",
  "schedule": "*/5 * * * *",
  "organization_uuid": "9671650f-dd35-4ec6-8972-4ebb741b62a5",
  "customer_id": "test-customer-workflow",
  "sku_id": "CT-BASIC-01",
  "widget_uuid": "019907f1-5fcc-78d2-a738-3a5f5a52bf8e",
  "description": "Seat license workflow for contract"
}
```

### Create DAG Response
```json
{
  "success": true,
  "message": "DAG created successfully",
  "data": {
    "contract_uuid": "019907f1-5fcc-74c8-a493-3b92cf089c7e",
    "file_path": "/home/dagu/dags/019907f1-5fcc-74c8-a493-3b92cf089c7e-seat-license.yaml",
    "dag_name": "019907f1-5fcc-74c8-a493-3b92cf089c7e-seat-license"
  }
}
```

## Supported Request Types

- `seat_license` - For seat-based billing workflows
- `generate_invoice` - For usage-based billing workflows

## Environment Variables

- `DAG_DIR` - Directory where DAG files are stored (default: `/home/dagu/dags`)
- `API_PORT` - Port for the API server (default: `3000`)

## Error Handling

The API returns structured error responses with appropriate HTTP status codes:

- `400` - Validation errors
- `404` - DAG not found
- `403` - Permission denied
- `500` - Internal server error

## Development

### Install Dependencies
```bash
cd api-server
npm install
```

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

## Integration

This API server runs alongside the Dagu server in the same Docker container:
- Dagu server: Port 8080
- API server: Port 3000

The API creates YAML files in the DAG directory, which Dagu automatically detects and loads.
