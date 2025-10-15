#!/bin/bash

echo "🗑️  Deleting all DAGs using REST API..."

# Get list of all DAGs
DAGS=$(curl -s http://localhost:8080/api/v2/dags | jq -r '.dags[].dag.name')

if [ -z "$DAGS" ]; then
    echo "✅ No DAGs found to delete"
    exit 0
fi

echo "Found DAGs:"
echo "$DAGS"
echo ""

# Delete each DAG
for dag in $DAGS; do
    echo "Deleting DAG: $dag"
    response=$(curl -s -X DELETE http://localhost:8080/api/v2/dags/$dag)
    
    if [ -z "$response" ]; then
        echo "✅ Successfully deleted: $dag"
    else
        echo "⚠️  Response for $dag: $response"
    fi
done

echo ""
echo "🔍 Verifying deletion..."

# Check remaining DAGs
remaining=$(curl -s http://localhost:8080/api/v2/dags | jq -r '.dags[].dag.name')

if [ -z "$remaining" ]; then
    echo "✅ All DAGs successfully deleted!"
else
    echo "⚠️  Remaining DAGs (may have configuration errors):"
    echo "$remaining"
    echo ""
    echo "🗑️  Attempting to delete remaining DAGs from file system..."
    
    # Delete remaining DAG files from file system
    for dag in $remaining; do
        if [ -f "dagu-dags/$dag.yaml" ]; then
            echo "Deleting file: dagu-dags/$dag.yaml"
            rm "dagu-dags/$dag.yaml"
        fi
    done
    
    echo "✅ File system cleanup complete!"
fi
