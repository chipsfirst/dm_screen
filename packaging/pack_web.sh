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
  srd-chars-data.js
  icons.js
  vendor/fonts.css
  vendor/fonts-extra.css
  logo.png
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
  mkdir -p "$OUT/$(dirname "$f")"
  cp "$f" "$OUT/$f"
done

mkdir -p "$OUT/vendor"
if [ -d vendor/fonts ]; then
  cp -R vendor/fonts "$OUT/vendor/fonts"
fi

if [ -d icons ]; then
  cp -R icons "$OUT/icons"
else
  echo "Нет папки icons" >&2
  exit 1
fi

touch "$OUT/.nojekyll"

echo "Готово: $OUT ($(du -sh "$OUT" | cut -f1))"
