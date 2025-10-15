#!/bin/bash
set -e

# Initialize Dagu if needed
if [ ! -d "/home/dagu/.dagu" ]; then
  echo "Initializing Dagu configuration..."
  dagu init
fi

# Start Dagu server and scheduler in background
echo "Starting Dagu server and scheduler on 0.0.0.0:8080..."
dagu start-all --host 0.0.0.0 --port 8080 --dags /home/dagu/dags --config /home/dagu/.config/dagu/config.yaml &

# Wait for Dagu to start
sleep 5

# Start API server
echo "Starting DAG Management API server on 0.0.0.0:3000..."
cd /opt/api-server
npm start &

# Wait for both services
wait
