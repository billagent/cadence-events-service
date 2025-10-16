# Cadence Events Service

A Dagu-based service for scheduled gRPC calls with REST API for DAG management.

## Overview

This service provides:
- **Dagu workflow engine** for scheduling and executing workflows
- **REST API** for managing DAG files dynamically
- **gRPC client** for making scheduled service calls
- **Docker containerization** for easy deployment
- **Kubernetes manifests** for orchestration

## Components

- `api-server/` - REST API for DAG management
- `dagu-dags/` - Workflow definition files
- `scripts/` - Utility scripts and gRPC clients
- `k8s/` - Kubernetes deployment manifests
- `config/` - Dagu configuration files

## Features

- **Dynamic DAG Management**: Create, read, update, and delete workflow definitions via REST API
- **Scheduled Execution**: Cron-based scheduling for automated workflows
- **gRPC Integration**: Built-in gRPC client for service-to-service communication
- **Container Ready**: Docker support with multi-stage builds
- **Kubernetes Native**: Complete K8s deployment manifests

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (optional)
- Kubernetes cluster (for deployment)

### Local Development

1. **Install dependencies**:
```bash
# Root dependencies
npm install

# API server dependencies
cd api-server
npm install
cd ..
```

2. **Run the API server**:
```bash
cd api-server
npm run dev
```

3. **Run Dagu server**:
```bash
# Start Dagu server (requires Docker)
docker run -d -p 8080:8080 -v $(pwd)/dagu-dags:/home/dagu/dags dagu/dagu:latest
```

### Docker Deployment

```bash
# Build the image
docker build -t cadence-events-service .

# Run the container
docker run -p 8080:8080 -p 3000:3000 cadence-events-service
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## API Documentation

See [api-server/README.md](api-server/README.md) for detailed API documentation.

### Key Endpoints

- `GET /health` - Health check
- `POST /api/cadence-event` - Create new DAG
- `GET /api/cadence-event/:uuid/:requestType` - Get DAG
- `PUT /api/cadence-event/:uuid/:requestType` - Update DAG
- `DELETE /api/cadence-event/:uuid/:requestType` - Delete DAG

## Workflow Types

- `seat_license` - For seat-based billing workflows
- `generate_invoice` - For usage-based billing workflows

## Configuration

### Environment Variables

- `DAG_DIR` - Directory for DAG files (default: `/home/dagu/dags`)
- `API_PORT` - API server port (default: `3000`)
- `DAGU_PORT` - Dagu server port (default: `8080`)

### Dagu Configuration

The service uses Dagu for workflow orchestration. Configuration is managed in `config/dagu.yaml`.

## Development

### Project Structure

```
cadence-events-service/
├── api-server/          # REST API server
│   ├── src/            # Source code
│   ├── tests/          # Test files
│   └── README.md       # API documentation
├── dagu-dags/          # Workflow definitions
├── dagu-data/          # Dagu runtime data
├── dagu-logs/          # Execution logs
├── scripts/            # Utility scripts
├── k8s/               # Kubernetes manifests
├── config/            # Configuration files
└── Dockerfile         # Container definition
```

### Testing

```bash
# Run API server tests
cd api-server
npm test

# Test gRPC client
node scripts/grpc-client.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license information here]

## Support

For questions and support, please contact the development team or create an issue in this repository.
