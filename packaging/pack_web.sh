#!/usr/bin/env bash
# Собирает runtime-файлы приложения в dist/ (без исходников сборщиков и data/).
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-dist}"
rm -rf "$OUT"
mkdir -p "$OUT"

FILES=(
  index.html
  style.css
  manifest.json
  assets/logo.png
  assets/logo.svg
  assets/icon.svg
  assets/hex.svg
  js/icons.js
  vendor/fonts.css
  vendor/fonts-extra.css
)

DIRS=(
  js/app
  js/data
  assets/svg
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "Нет файла: $f" >&2
    exit 1
  fi
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$f" "$OUT/$f"
done

for d in "${DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo "Нет папки: $d" >&2
    exit 1
  fi
  mkdir -p "$OUT/$d"
  cp -R "$d/." "$OUT/$d/"
done

if [ -d vendor/fonts ]; then
  mkdir -p "$OUT/vendor"
  cp -R vendor/fonts "$OUT/vendor/fonts"
fi

# bestiary-cos.js — промежуточный артефакт сборщика, приложение его не подключает
rm -f "$OUT/js/data/bestiary-cos.js"

# каждая часть приложения должна быть на месте — иначе приложение молча не запустится
for part in "$OUT"/js/app/*/*.js; do
  [ -f "$part" ] || { echo "В сборке нет частей приложения" >&2; exit 1; }
done

touch "$OUT/.nojekyll"

echo "Готово: $OUT ($(du -sh "$OUT" | cut -f1))"
