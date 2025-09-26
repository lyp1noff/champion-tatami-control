#!/bin/bash
set -euo pipefail

SESSION_NAME="champion-tatami"

if [[ ! -f .env ]]; then
  echo ".env file not found."
  exit 1
fi

if tmux has-session -t $SESSION_NAME 2>/dev/null; then
  echo "Session '$SESSION_NAME' already exists. Attaching..."
  tmux attach-session -t $SESSION_NAME
  exit 0
fi

tmux new-session -d -s $SESSION_NAME
#tmux rename-window -t $SESSION_NAME:0 "Database"
#tmux send-keys -t $SESSION_NAME:0 "make db-dev" C-m
tmux new-window -t $SESSION_NAME -n "Backend"
tmux send-keys -t $SESSION_NAME:1 "make back-dev" C-m
tmux new-window -t $SESSION_NAME -n "Frontend"
tmux send-keys -t $SESSION_NAME:2 "make front-dev" C-m
tmux new-window -t $SESSION_NAME -n "Outbox"
tmux send-keys -t $SESSION_NAME:3 "make outbox-dev" C-m

tmux attach-session -t $SESSION_NAME
