#!/bin/bash
set -e

TASKS_DIR="$(cd "$(dirname "$0")/tasks" && pwd)"

for task_dir in $(ls -d "$TASKS_DIR"/*/ | sort -V); do
    task_name=$(basename "$task_dir")
    compose_file="$task_dir/docker-compose.yml"

    if [ ! -f "$compose_file" ]; then
        echo "[$task_name] No docker-compose.yml, skipping"
        continue
    fi

    echo "[$task_name] Building..."
    docker compose -p "warmup_$task_name" --project-directory "$task_dir" build
    echo "[$task_name] Done"
done

echo "All tasks warmed up."
