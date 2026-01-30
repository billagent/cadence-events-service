FROM node:lts-alpine

# Install runtime dependencies
RUN apk add --no-cache curl bash wget unzip


# Set the desired timezone for the process and install tzdata
ENV TZ=America/Los_Angeles
RUN apk add --no-cache tzdata \
 && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
 && echo $TZ > /etc/timezone


# Install Dagu using official installation script (gets latest version automatically)
RUN curl -L https://raw.githubusercontent.com/dagu-org/dagu/main/scripts/installer.sh | sh && \
    mv /root/.local/bin/dagu /usr/local/bin/dagu && \
    dagu version

# Install grpcurl (detect architecture)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        GRPCURL_ARCH="x86_64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
        GRPCURL_ARCH="arm64"; \
    else \
        echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    wget -O /tmp/grpcurl.tar.gz "https://github.com/fullstorydev/grpcurl/releases/download/v1.9.3/grpcurl_1.9.3_linux_${GRPCURL_ARCH}.tar.gz" && \
    tar -xz -C /usr/local/bin -f /tmp/grpcurl.tar.gz && \
    rm /tmp/grpcurl.tar.gz

# Create dagu user and directories
RUN adduser -D -s /bin/bash dagu && \
    mkdir -p /opt/dagu/scripts /home/dagu/.dagu /home/dagu/.config/dagu /home/dagu/dags

# Copy package.json and install dependencies for API server
COPY api-server/package.json /opt/api-server/
WORKDIR /opt/api-server
RUN npm install --production

# Copy API server source code
COPY api-server/ /opt/api-server/

# Copy scripts and configuration
COPY scripts/ /opt/dagu/scripts/
COPY config/dagu.yaml /home/dagu/.config/dagu/config.yaml

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set permissions (only process_contract_events script; grpc-client.js removed in Tier 2 cleanup)
RUN chmod +x /opt/dagu/scripts/grpc-client-process-contract-events.js
RUN chown -R dagu:dagu /home/dagu/.config /home/dagu/dags

# Set working directory
WORKDIR /home/dagu

# Expose ports
EXPOSE 8080 3000

# Use entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
