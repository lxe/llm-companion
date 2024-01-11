#!/bin/bash

set -e

OAI_HOST="${OAI_HOST:-"http://127.0.0.1:5000"}"
TTS_HOST="${TTS_HOST:-"http://127.0.0.1:5050"}"

# Start the first server in the background
python3 server.py --debug --host 0.0.0.0 --port 443 \
    --proxy oai:${OAI_HOST} \
    --proxy tts:${TTS_HOST} &

# Save its PID
SERVER_PID=$!

# Function to kill background process
function cleanup() {
    echo "Caught Signal...cleaning up."
    kill -SIGINT $SERVER_PID
    wait $SERVER_PID
    echo "Done."
}

# Trap SIGINT and SIGTERM to cleanup function
trap cleanup SIGINT SIGTERM

# Run the second server in the foreground
exec python3 -m tts_server.server

# The script will wait here for the foreground process to finish.
