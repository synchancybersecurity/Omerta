#!/bin/bash
# Omerta Watchdog — auto-restarts server and tunnel if they die
# Usage: bash watchdog.sh
# Run in background: nohup bash watchdog.sh > watchdog.log 2>&1 &

cd ~/Omerta

SERVER_PID=""
TUNNEL_PID=""

start_server() {
  pkill -f "node server.js" 2>/dev/null
  sleep 1
  nohup node server.js > server.log 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Server started PID: $SERVER_PID"
}

start_tunnel() {
  pkill -f "cloudflared tunnel" 2>/dev/null
  sleep 2
  nohup cloudflared tunnel --url http://localhost:7777 > tunnel.log 2>&1 &
  TUNNEL_PID=$!
  echo "[$(date)] Tunnel started PID: $TUNNEL_PID"
  # Print the URL when it appears
  (tail -f tunnel.log 2>/dev/null &)
}

echo "[$(date)] Omerta Watchdog starting..."

# Initial start
start_server
sleep 3
start_tunnel

# Watch loop
while true; do
  sleep 10

  # Check server
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[$(date)] Server died, restarting..."
    start_server
  fi

  # Check tunnel
  if ! kill -0 $TUNNEL_PID 2>/dev/null; then
    echo "[$(date)] Tunnel died, restarting..."
    start_tunnel
  fi

  # Also check if tunnel can reach origin
  if ! curl -s http://localhost:7777/api/posts > /dev/null 2>&1; then
    echo "[$(date)] Server not responding, restarting..."
    start_server
    sleep 2
    start_tunnel
  fi
done
