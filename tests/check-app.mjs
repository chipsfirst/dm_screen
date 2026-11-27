import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
/* Части приложения подключаются в этом порядке в index.html — здесь тот же порядок. */
const APP_PARTS = [
  'js/app/core/01-state.js',
  'js/app/ui/02-render.js',
  'js/app/ui/03-ui.js',
  'js/app/ui/04-events.js',
  'js/app/data/05-rules.js',
  'js/app/ui/06-modals.js',
  'js/app/data/07-bestiary.js',
  'js/app/data/08-content.js',
  'js/app/media/09-music.js',
  'js/app/media/10-map.js',
  'js/app/ui/11-search.js',
  'js/app/pages/12-sessions.js',
  'js/app/pages/13-battle.js',
  'js/app/pages/14-generators.js',
  'js/app/ui/15-cards.js',
  'js/app/ui/16-print.js',
  'js/app/ui/17-sessions-ext.js',
  'js/app/ui/18-map-ext.js',
  'js/app/ui/19-polish.js',
  'js/app/ui/20-timer.js',
  'js/app/ui/21-favorites.js',
  'js/app/ui/22-hud.js',
  'js/app/ui/23-smoke.js',
  'js/app/ui/24-reference.js',
  'js/app/ui/26-encounter.js',
  'js/app/ui/27-character.js',
  'js/app/ui/28-home-dashboard.js',
  'js/app/ui/29-table-mode.js',
  'js/app/media/30-ambience.js',
  'js/app/ui/31-handouts.js',
  'js/app/ui/32-chronicle.js',
  'js/app/ui/33-canvas.js',
  'js/app/ui/34-print-kit.js',
  'js/app/ui/35-content.js',
];
const files = [
  'tests/dom-stub.js',
  'js/data/shop-data.js',
  'js/data/shop-catalog-data.js',
  'js/data/app-data.js',
  'js/data/rules-data.js',
  'js/data/class-progress-data.js',
  'js/data/books-data.js',
  'js/data/srd-data.js',
  'js/data/srd-chars-data.js',
  'js/data/conditions-data.js',
  'js/data/content-packs.js',
  'js/data/content-packs-extra.js',
  'js/data/content-packs-more.js',
  'js/data/content-packs-court-academy.js',
  'js/icons.js',
  ...APP_PARTS,
];

const ctx = vm.createContext({ console, process });
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* 1. Каждая часть должна быть синтаксически целой сама по себе. */
for (const f of APP_PARTS) {
  try {
    new vm.Script(read(f), { filename: f });
  } catch (err) {
    console.error(`СИНТАКСИС в ${f}: ${err && err.message}`);
    process.exit(1);
  }
}

/* 2. Поведение проверяем на склейке в том же порядке, что и в index.html. */
for (const f of files.filter((f) => !APP_PARTS.includes(f))) {
  try {
    vm.runInContext(read(f), ctx, { filename: f });
  } catch (err) {
    console.error(`ОШИБКА при загрузке ${f}: ${err && err.message}`);
    process.exit(1);
  }
}
try {
  vm.runInContext(APP_PARTS.map(read).join(''), ctx, { filename: 'app.js' });
} catch (err) {
  console.error(`ОШИБКА при загрузке приложения: ${err && err.message}`);
  process.exit(1);
}

function fail(msg) {
  console.error(`ОШИБКА: ${msg}`);
  process.exit(1);
}

try {
  const blocks = vm.runInContext('blocks.length', ctx);
  const presets = vm.runInContext('MOB_PRESETS.length', ctx);
  console.log(`OK: приложение загрузилось, блоков ${blocks}, пресетов ${presets}`);
} catch (err) {
  fail(`приложение не инициализировалось: ${err && err.message}`);
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
const appSrc = APP_PARTS.map(read).join('');
const exportLine = appSrc.split('\n').find((l) => l.includes('version:5') && l.includes('return {'));
if (!exportLine) fail('в экспорте нет version:5');
if (!exportLine.includes('music: musicMetaSnapshot()')) fail('в экспорте нет описания плейлистов');
if (/music:\s*music\b/.test(exportLine)) fail('в экспорт попали сами треки, а не описание');
console.log('OK: резервная копия v5 с плейлистами и без аудио');

/* ── Версии: appVersion, tauri.conf.json и Cargo.toml должны совпадать ── */
const appVersion = (html.match(/id="appVersion"[^>]*>([^<]+)</) || [])[1];
const tauriConf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
const cargo = fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf8');
const cargoVersion = (cargo.match(/^version\s*=\s*"([^"]+)"/m) || [])[1];
if (!appVersion) fail('в index.html нет #appVersion');
if (appVersion !== tauriConf.version) fail(`appVersion ${appVersion} ≠ tauri.conf.json ${tauriConf.version}`);
if (appVersion !== cargoVersion) fail(`appVersion ${appVersion} ≠ Cargo.toml ${cargoVersion}`);
const assetVersions = [...new Set([...html.matchAll(/[?&]v=([^"&]+)/g)].map((m) => m[1]))];
const badVersions = assetVersions.filter((v) => v !== appVersion);
if (badVersions.length) fail(`версии ассетов не совпадают: ${badVersions.join(', ')}`);
console.log(`OK: версия совпадает везде — ${appVersion} (${assetVersions.length} версия ассетов)`);

/* ── wow-data.js грузится лениво, но обязан попасть в сборку ── */
if (/<script[^>]+wow-data\.js/.test(html)) fail('wow-data.js снова подключён тегом script — старт станет тяжелее');
const packSrc = fs.readFileSync(path.join(root, 'packaging/pack_web.sh'), 'utf8');
if (!packSrc.includes('js/data')) fail('pack_web.sh не копирует js/data — данные не попадут в сборку');
if (!fs.existsSync(path.join(root, 'js/data/wow-data.js'))) fail('нет js/data/wow-data.js — ленивая загрузка сломается');
console.log('OK: wow-data.js не грузится на старте и копируется в сборку');

/* ── Модалки: у каждой должна быть текстовая метка для скринридера ── */
const modalStarts = [...html.matchAll(/<div class="modal" id="([^"]+)"[^>]*>/g)];
const noLabel = modalStarts.filter((m, i) => {
  const start = m.index;
  const next = modalStarts[i + 1];
  const seg = html.slice(start, next ? next.index : html.length);
  if (/aria-label(?:ledby)?=/.test(m[0])) return false;
  const head = (seg.match(/<div class="modal-head">([\s\S]*?)<\/div>/) || [])[1];
  const text = head ? head.replace(/<[^>]+>/g, '').replace(/✕/g, '').trim() : '';
  return text.length < 2 && !/aria-label=/.test(seg.slice(0, 1200));
});
if (noLabel.length) fail(`модалки без текстовой метки: ${noLabel.map((m) => m[1]).join(', ')}`);
console.log(`OK: у всех модалок есть метка (${modalStarts.length})`);

/* ── getElementById: новые опечатки в id не должны проходить незамеченными ── */
const declaredIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const dynamicIds = new Set([...appSrc.matchAll(/id=\\?["']([A-Za-z][\w-]*)\\?["']/g)].map((m) => m[1]));
const legacyIds = new Set([
  'btnRollShort', 'btnSound', 'btnTimer', 'crumbsRoot', 'mapAddMarker', 'mapDup', 'mapGrid',
  'mapGridStep', 'mapLock', 'mapPen', 'mapPenClear', 'mapPlaceHint', 'markerColor', 'markerCtl',
  'markerDel', 'markerDone', 'markerName', 'markerRename', 'search',
]);
const usedIds = new Set([...appSrc.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]));
const unknownIds = [...usedIds].filter((id) => !declaredIds.has(id) && !dynamicIds.has(id) && !legacyIds.has(id));
if (unknownIds.length) fail(`getElementById ищет несуществующие id: ${unknownIds.join(', ')}`);
console.log(`OK: все id из кода существуют (${usedIds.size}, известных легаси — ${legacyIds.size})`);

/* ── Новые модули: справочник, прогрессия, встречи, персонаж, печать и Пульт ── */
const rules = vm.runInContext('RULES_DATA', ctx);
if(!Array.isArray(rules) || rules.length < 50) fail(`справочник: статей ${rules && rules.length}, ожидалось не меньше 50`);
const ruleCats = vm.runInContext('RULES_CATEGORIES.length', ctx);
if(ruleCats < 6) fail(`справочник: категорий ${ruleCats}, ожидалось не меньше 6`);

const progress = vm.runInContext('CLASS_PROGRESS', ctx);
const classes = Object.keys(progress || {});
if(classes.length !== 12) fail(`прогрессия: классов ${classes.length}, ожидалось 12`);
for(const [name, cls] of Object.entries(progress || {})){
  const levels = Object.keys(cls.features || {});
  if(levels.length !== 20 || levels[0] !== '1' || levels[19] !== '20') {
    fail(`прогрессия: у класса ${name} не 20 уровней`);
  }
  if(!cls.subclass || !cls.subclass.name_ru) fail(`прогрессия: у класса ${name} нет подкласса`);
}

for(const name of ['openRulesPanel','openCharacterBuilder','openPrintAllCards','buildBattleTrackerSheet','openPrintBattle','renderHomeDashboard','buildConditionSheets','buildStateTokenSheets','buildInitTokenSheets','openContentPacks']){
  if(typeof vm.runInContext(name, ctx) !== 'function') fail(`не загружена функция ${name}`);
}
const conditionCount = vm.runInContext('CONDITIONS_2024.length', ctx);
if(conditionCount !== 15) fail(`состояния: ${conditionCount}, ожидалось 15`);
const packPresets = vm.runInContext('CONTENT_PACK_PRESETS', ctx);
if(!Array.isArray(packPresets) || packPresets.length < 7) fail(`контент-паки: паков ${packPresets && packPresets.length}, ожидалось не меньше 7`);
const packItems = packPresets.reduce((n,p)=> n + (p.items || []).length, 0);
if(packItems < 270) fail(`контент-паки: записей ${packItems}, ожидалось не меньше 270`);

const backup = vm.runInContext('buildBackupPayload()', ctx);
if(!backup || backup.version !== 5) fail('резервная копия: неверная версия');
for(const key of ['blocks','media','sessions','map','battle','battleLog','battleTurn','music','ambience','templates','sessionTemplates']){
  if(!(key in backup)) fail(`резервная копия: нет поля ${key}`);
}
console.log(`OK: новые модули загружены — статей ${rules.length}, классов ${classes.length}, бэкап v${backup.version}`);

const ambienceFiles = ['rain.mp3','wind.ogg','fire.m4a','tavern.ogg','cave.ogg'];
for(const file of ambienceFiles){
  if(!fs.existsSync(path.join(root, 'assets/ambience', file))) fail(`нет атмосферного звука: ${file}`);
}
console.log(`OK: атмосферные звуки на месте (${ambienceFiles.length})`);

/* ── HTML: уникальные id и все app-скрипты в тестовом списке ── */
const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const seenIds = new Set();
const duplicateIds = new Set();
allIds.forEach((id) => {
  if(seenIds.has(id)) duplicateIds.add(id);
  else seenIds.add(id);
});
if(duplicateIds.size) fail(`дубли id: ${[...duplicateIds].join(', ')}`);

const appScripts = [...html.matchAll(/<script[^>]+src="(js\/app\/[^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);
const missingFromTests = appScripts.filter((f) => !APP_PARTS.includes(f));
const extraInTests = APP_PARTS.filter((f) => !appScripts.includes(f));
if(missingFromTests.length) fail(`скрипты не проверяются: ${missingFromTests.join(', ')}`);
if(extraInTests.length) fail(`в тестах лишние скрипты: ${extraInTests.join(', ')}`);
console.log(`OK: id уникальны (${allIds.length}), все app-скрипты в тестах (${appScripts.length})`);
