#!/bin/bash
BINARY="fangserver"
DIR="/www/wwwroot/admin"
LOG="/var/log/fangserver.log"

cd "$DIR"

killall "$BINARY" 2>/dev/null || true
sleep 1

nohup ./"$BINARY" >> "$LOG" 2>&1 &
echo $! > "$DIR/$BINARY.pid"

sleep 1
if pgrep -x "$BINARY" > /dev/null; then
    echo "started ok, pid=$(cat $DIR/$BINARY.pid)"
else
    echo "start failed, check $LOG"
fi
