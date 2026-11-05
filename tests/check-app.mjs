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

function fail(msg) {
  console.error(`ОШИБКА: ${msg}`);
  process.exit(1);
}

try {
  const blocks = vm.runInContext('blocks.length', ctx);
  const presets = vm.runInContext('MOB_PRESETS.length', ctx);
  console.log(`OK: app.js загрузился, блоков ${blocks}, пресетов ${presets}`);
} catch (err) {
  fail(`app.js не инициализировался: ${err && err.message}`);
}

/* ── Вкладки: TAB_ORDER в коде должен совпадать с кнопками и экранами в разметке ── */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tabOrder = vm.runInContext('TAB_ORDER.join(",")', ctx).split(',');
const tabButtons = [...html.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
const views = [...html.matchAll(/id="view-([a-z]+)"/g)].map((m) => m[1]);

/* «Монстры» и «Ширма» делят один экран #view-chars */
const VIEW_ALIAS = { monsters: 'chars' };
const viewOf = (tab) => VIEW_ALIAS[tab] || tab;

const uniqueButtons = [...new Set(tabButtons)];
const missingButton = tabOrder.filter((t) => !uniqueButtons.includes(t));
const missingView = tabOrder.filter((t) => !views.includes(viewOf(t)));
const extraButton = uniqueButtons.filter((t) => !tabOrder.includes(t));
const extraView = views.filter((t) => !tabOrder.some((tab) => viewOf(tab) === t));

if (missingButton.length) fail(`нет кнопки вкладки: ${missingButton.join(', ')}`);
if (missingView.length) fail(`нет экрана view-*: ${missingView.join(', ')}`);
if (extraButton.length) fail(`кнопка вне TAB_ORDER: ${extraButton.join(', ')}`);
if (extraView.length) fail(`экран вне TAB_ORDER: ${extraView.join(', ')}`);
console.log(`OK: вкладки совпадают — ${tabOrder.join(', ')}`);

/* ── Музыка: элементы, без которых плеер молча не работает ── */
const musicIds = [
  'musicAudio', 'musicBar', 'mbPrev', 'mbPlay', 'mbNext', 'mbTitle', 'mbTitleText', 'mbMute', 'mbVol',
  'musicImport', 'musicFileInput', 'musicNewList', 'musicPlayAll', 'musicShuffle', 'musicRepeat',
  'musicLists', 'musicTracks', 'musicListTitle', 'musicListCount', 'musicRename', 'musicDelete',
  'musicAddFromLib', 'musicStorage', 'musicPickModal', 'musicPickList', 'musicPickSearch', 'musicPickAdd', 'musicPickClose',
];
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const lostIds = musicIds.filter((id) => !htmlIds.has(id));
if (lostIds.length) fail(`во вкладке «Музыка» нет элементов: ${lostIds.join(', ')}`);
console.log(`OK: элементы плеера на месте (${musicIds.length})`);

/* ── Экспорт: музыка входит в резервную копию, аудио — нет ── */
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const exportLine = appSrc.split('\n').find((l) => l.includes('version:5') && l.includes('return {'));
if (!exportLine) fail('в экспорте нет version:5');
if (!exportLine.includes('music: musicMetaSnapshot()')) fail('в экспорте нет описания плейлистов');
if (/music:\s*music\b/.test(exportLine)) fail('в экспорт попали сами треки, а не описание');
console.log('OK: резервная копия v5 с плейлистами и без аудио');
