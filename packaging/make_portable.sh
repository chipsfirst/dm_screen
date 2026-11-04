#!/usr/bin/env bash
# Собирает портативную сборку: папка с приложением + лаунчеры + zip.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="build/portable/ShirmaMaster"
rm -rf build/portable
mkdir -p "$OUT"

bash packaging/pack_web.sh "$OUT" >/dev/null
cp packaging/portable/start-macos.command "$OUT/"
cp packaging/portable/start-windows.bat "$OUT/"
cp packaging/portable/serve.ps1 "$OUT/"
chmod +x "$OUT/start-macos.command"

cat > "$OUT/КАК-ЗАПУСТИТЬ.txt" <<'TXT'
Ширма мастера — портативная сборка
==================================

macOS:  двойной клик по start-macos.command (нужен python3 из Command Line Tools).
Windows: двойной клик по start-windows.bat (PowerShell уже есть в системе).

Скрипт поднимает локальный сервер на 127.0.0.1 и открывает приложение в браузере.
Так надёжно работают localStorage и IndexedDB (карты, картинки, резервные копии).

Данные хранятся в браузере и привязаны к адресу 127.0.0.1.
Чтобы перенести ширму со старой версии (запуск через index.html), откройте старую
версию и сделайте «Экспорт», а в новой — «Импорт».
TXT

cd build/portable
zip -qr ../ShirmaMaster-portable.zip ShirmaMaster
cd ../..
echo "Готово: build/ShirmaMaster-portable.zip ($(du -sh build/ShirmaMaster-portable.zip | cut -f1))"
