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
  app.js
  app-data.js
  library-data.js
  bestiary-data.js
  shop-data.js
  shop-catalog-data.js
  books-data.js
  srd-data.js
  icons.js
  logo.svg
  icon.svg
  hex.svg
  manifest.json
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "Нет файла: $f" >&2
    exit 1
  fi
  cp "$f" "$OUT/"
done

if [ -d icons ]; then
  cp -R icons "$OUT/icons"
else
  echo "Нет папки icons" >&2
  exit 1
fi

touch "$OUT/.nojekyll"

echo "Готово: $OUT ($(du -sh "$OUT" | cut -f1))"
