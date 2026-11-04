import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const files = [
  'tests/dom-stub.js',
  'shop-data.js',
  'shop-catalog-data.js',
  'app-data.js',
  'books-data.js',
  'srd-data.js',
  'icons.js',
  'app.js',
];

const ctx = vm.createContext({ console, process });
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (err) {
    console.error(`ОШИБКА при загрузке ${f}: ${err && err.message}`);
    process.exit(1);
  }
}

try {
  const blocks = vm.runInContext('blocks.length', ctx);
  const presets = vm.runInContext('MOB_PRESETS.length', ctx);
  console.log(`OK: app.js загрузился, блоков ${blocks}, пресетов ${presets}`);
} catch (err) {
  console.error(`ОШИБКА проверки состояния: ${err && err.message}`);
  process.exit(1);
}
