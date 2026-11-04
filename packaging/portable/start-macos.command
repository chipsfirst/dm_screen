#!/bin/bash
# Портативный запуск «Ширмы мастера» на macOS: локальный сервер + браузер.
# Нужен python3 (входит в Command Line Tools). Данные хранятся в браузере.
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 не найден — открываю файл напрямую (часть функций может не работать)."
  open index.html
  exit 0
fi

PORT=$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
)

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT INT TERM
sleep 1
open "http://127.0.0.1:$PORT/"
echo "Ширма мастера: http://127.0.0.1:$PORT/  (закройте это окно, чтобы остановить)"
wait $SRV
