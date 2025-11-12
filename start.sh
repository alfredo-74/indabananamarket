#!/bin/bash
echo "Starting OrderFlowAI Local (ET: $(date '+%a %b %d %I:%M:%S %p %Z %Y'))"
echo "IB GATEWAY + ESZ5 OBSERVATION + MESZ5 READY"

# Activate venv & start Python bridge
source venv/bin/activate
uvicorn dist.server.ibkr_connector:sio_app --host 0.0.0.0 --port 8765 &
PYTHON_PID=$!
sleep 3

# Start Node server
node dist/server/index.cjs

# Cleanup on exit
kill $PYTHON_PID 2>/dev/null || true
