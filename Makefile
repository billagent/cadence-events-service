# Simple Makefile for Dagu local testing
.PHONY: build build-amd64 build-multi run stop logs clean test push

# Build the Docker image specifically for AMD64 (Azure deployment)
build:
	docker build --platform linux/amd64 -t cadence-events-service:latest .

# Build multi-platform image (both ARM64 and AMD64)
build-multi:
	docker buildx build --platform linux/amd64,linux/arm64 -t cadence-events-service:latest .
	
# Build the Docker image for local architecture (ARM64 on Apple Silicon)
build-arm64:
	docker build -t cadence-events-service:arm64 .

# Push the image to Azure Container Registry
push:
	az acr login -n subscripifycontreg
	docker build --platform linux/amd64 -t subscripifycontreg.azurecr.io/prod/cadence-events-service:latest .
	docker push subscripifycontreg.azurecr.io/prod/cadence-events-service:latest

# Run the container locally
run:
	telepresence docker-run --rm \
		--name cadence-events-local \
		-p 8080:8080 \
		-p 3000:3000 \
		-v "$(PWD)/dagu-data:/home/dagu/.dagu" \
		-v "$(PWD)/dagu-dags:/home/dagu/dags" \
		-v "$(PWD)/dagu-logs:/home/dagu/.dagu/logs" \
		--hostname localhost \
		cadence-events-service:latest &

# Stop the container
stop:
	docker stop cadence-events-local || true
	docker rm cadence-events-local || true

# View container logs
logs:
	docker logs -f cadence-events-local

# Clean up local data (WARNING: This will delete all Dagu state)
clean:
	docker stop cadence-events-local || true
	docker rm cadence-events-local || true
	rm -rf dagu-data dagu-dags dagu-logs
	mkdir -p dagu-data dagu-dags dagu-logs

# Run tests
test:
	./scripts/test-dagu-api.sh
