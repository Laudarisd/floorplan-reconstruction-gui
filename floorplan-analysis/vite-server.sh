#!/bin/bash

# ===============================================================
#  MUST READ BEFORE USING
# ===============================================================
#  1️⃣  This file MUST be placed inside:
#      ~/floorplan-reconstruction-gui/floorplan-analysis/
#
#      (Inside the floorplan-analysis directory)
#
#  2️⃣  Create this file in that folder:
#      nano vite-server.sh
#
#  3️⃣  Make it executable:
#      chmod +x vite-server.sh
#
#  4️⃣  First-time setup (only once):
#      npm install
#      npm install -g serve
#
#  5️⃣  First build (very important):
#      ./vite-server.sh build
#
#  6️⃣  Start production server:
#      ./vite-server.sh start
#
#  7️⃣  Check if running:
#      ./vite-server.sh status
#
#  8️⃣  Stop server:
#      ./vite-server.sh stop
#
#  9️⃣  Restart (auto rebuild + start):
#      ./vite-server.sh restart
#
#  🔎  View logs:
#      tail -f app.log
#
# ===============================================================
#  Production Server Control Script
#  Project: floorplan-analysis
#  Server IP: 61.97.120.204
#  Port: 5173
# ===============================================================

PROJECT_DIR="$HOME/floorplan-reconstruction-gui/floorplan-analysis"
PORT=5173
PID_FILE="$PROJECT_DIR/app.pid"
LOG_FILE="$PROJECT_DIR/app.log"

# Load nvm (important for server environment)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

find_running_pid() {
    local pid=""

    if [ -f "$PID_FILE" ]; then
        pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
            echo "$pid"
            return 0
        fi
    fi

    # Fallback: locate serve process bound to this port when PID file is missing/stale.
    pid=$(ps -eo pid,args | awk -v port="$PORT" '$0 ~ /bin\/serve/ && $0 ~ ("-l " port) { print $1; exit }')
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        echo "$pid"
        return 0
    fi

    return 1
}

build() {
    echo "🔨 Building production app..."
    cd "$PROJECT_DIR" || exit 1
    npm run build
    echo "✅ Build complete"
}

start() {
    RUNNING_PID=$(find_running_pid)
    if [ -n "$RUNNING_PID" ]; then
        echo "⚠️  Server already running (PID: $RUNNING_PID)"
        echo "$RUNNING_PID" > "$PID_FILE"
        exit 1
    fi

    if [ -f "$PID_FILE" ]; then
        echo "Removing stale PID file..."
        rm -f "$PID_FILE"
    fi

    echo "🚀 Starting production server..."
    cd "$PROJECT_DIR" || exit 1

    # Make sure build exists
    if [ ! -d "dist" ]; then
        echo "⚠️  dist folder not found. Building..."
        build
    fi

    npx serve -s dist -l $PORT > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"

    echo "✅ Server started"
    echo "PID: $(cat $PID_FILE)"
    echo "URL: http://61.97.120.204:$PORT"
}

stop() {
    PID=$(find_running_pid)

    if [ -z "$PID" ]; then
        echo "❌ Server is not running"
        rm -f "$PID_FILE"
        return 0
    fi

    echo "🛑 Stopping server (PID: $PID)..."
    kill "$PID"

    for _ in 1 2 3 4 5; do
        if ! ps -p "$PID" > /dev/null 2>&1; then
            rm -f "$PID_FILE"
            echo "✅ Server stopped"
            return 0
        fi
        sleep 1
    done

    echo "⚠️  Graceful stop timed out, forcing kill..."
    kill -9 "$PID" > /dev/null 2>&1
    rm -f "$PID_FILE"
    echo "✅ Server stopped (forced)"
}

status() {
    PID=$(find_running_pid)
    if [ -n "$PID" ]; then
        echo "$PID" > "$PID_FILE"
        echo "✅ Server is running (PID: $PID)"
        echo "URL: http://61.97.120.204:$PORT"
    else
        rm -f "$PID_FILE"
        echo "❌ Server is not running"
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        stop
        sleep 1
        build
        start
        ;;
    build)
        build
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|build}"
        ;;
esac
