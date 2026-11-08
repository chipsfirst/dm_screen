
/* ════════════ Mодель данных ════════════ */
const TYPES = { pc:'pc', rule:'rule', note:'note' };
const TYPE_LABEL = { pc:'ПК', mob:'Монстр', rule:'Правила', note:'Заметка', img:'Файл' };

/* Иконки: game-icons.net (Lorc, Delapouite), CC BY 3.0 */
function gi(name, cls){
  const p = (window.GI_PATHS && window.GI_PATHS[name]) || '';
  return `<svg class="gi${cls?' '+cls:''}" viewBox="0 0 512 512" aria-hidden="true" focusable="false">${p}</svg>`;
}
function hydrateIcons(root){
  (root||document).querySelectorAll('[data-gi]').forEach(el=>{
    if(el.dataset.giDone) return;
    el.innerHTML = gi(el.dataset.gi);
    el.dataset.giDone = '1';
  });
}

let blocks = [];
let activeParentId = null;   // какой блок сейчас "раскрыт" как коллекция (null = корень)
let collapsed = new Set();   // id блоков, свёрнутых на дашборде
let searchFilter = '';
let freeLayout = false;      // свободный холст (drag-n-drop) или лента

const ITEMS_FOR_9 = ['Сила','Ловк','Телосл','Интел','Мудр','Хар'];

const KEYS = {
  blocks: 'shirma_blocks_v1',
  map: 'shirma_map_v1',
  sessions: 'shirma_sessions_v1',
};
const STORE_KEY = KEYS.blocks;

/* ═══ IndexedDB для медиа (картинки/документы/фоны) ═══ */
const MEDIA_DB = 'shirma_media_v1';
const MEDIA_STORE = 'media';
const mediaCache = {}; // key -> dataURL (в памяти)
let mediaDBPromise = null;
function openMediaDB(){
  if(mediaDBPromise) return mediaDBPromise;
  mediaDBPromise = new Promise((resolve)=>{
    try{
      const req = indexedDB.open(MEDIA_DB, 1);
      req.onupgradeneeded = ()=>{ const db=req.result; if(!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> resolve(null);
    }catch(e){ resolve(null); }
  });
  return mediaDBPromise;
}
function idbPut(key, val){
  openMediaDB().then(db=>{ if(!db) return; try{ const tx=db.transaction(MEDIA_STORE,'readwrite'); tx.objectStore(MEDIA_STORE).put(val, key); }catch(e){} });
}
function idbDel(key){
  openMediaDB().then(db=>{ if(!db) return; try{ const tx=db.transaction(MEDIA_STORE,'readwrite'); tx.objectStore(MEDIA_STORE).delete(key); }catch(e){} });
}
function idbGet(key){
  return openMediaDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(null); return; }
    try{
      const tx=db.transaction(MEDIA_STORE,'readonly');
      const req=tx.objectStore(MEDIA_STORE).get(key);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    }catch(e){ resolve(null); }
  }));
}
function loadAllMedia(){
  return openMediaDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(); return; }
    try{
      const tx=db.transaction(MEDIA_STORE,'readonly');
      const store=tx.objectStore(MEDIA_STORE);
      const req=store.openCursor();
      req.onsuccess=(e)=>{ const cur=e.target.result; if(cur){ mediaCache[cur.key]=cur.value; cur.continue(); } else resolve(); };
      req.onerror=()=>resolve();
    }catch(e){ resolve(); }
  }));
}
function mediaFor(b){ return (b.dataKey && mediaCache[b.dataKey]) || b.data || ''; }
/* Защита от подставляемых извне значений: пропускаем только валидные URL/dataURL */
function safeMediaSrc(s){
  s=String(s||'');
  return (/^data:(image|application|text)\//.test(s) || /^(blob:|https?:)/.test(s)) ? s : '';
}

/* Общий механизм перетаскивания: onMove(clientEvent), onEnd()
   Работает и с мышью, и с тачскрином (touch-события поверх). */
function pointerDrag(e, onMove, onEnd){
  if(e && e.cancelable) e.preventDefault();
  const getXY = ev => (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
  function move(ev){
    if(ev.type==='touchmove' && ev.cancelable) ev.preventDefault(); // не скроллить страницу пальцем
    onMove(getXY(ev));
  }
  function done(){
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', done);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', done);
    if(typeof onEnd==='function') onEnd();
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', done);
  window.addEventListener('touchmove', move, { passive:false });
  window.addEventListener('touchend', done);
}

/* ═══ Безопасный разбор localStorage: при битых данных предлагаем скачать копию ═══ */
function safeParseRaw(raw, label){
  if(raw==null || raw==='') return null;
  try{ return JSON.parse(raw); }
  catch(e){
    try{
      saveFile(label+'.повреждено.json', raw, 'application/octet-stream');
    }catch(e2){}
    toast('Данные «'+label+'» повреждены — повреждённая копия скачана файлом');
    return null;
  }
}
function load(){
  const raw = localStorage.getItem(STORE_KEY);
  const data = safeParseRaw(raw, 'shirma_blocks');
  if(Array.isArray(data) && data.length){ blocks = data; return true; }
  return false;
}
function makeBlock(type,title,extra){
  return Object.assign({ id:uniq(), type, title, collapse:false, links:[], stats:[10,10,10,10,10,10], props:{}, res:[], dmg:0, text:'', x:null, y:null, w:360, uid:Date.now().toString(36)+Math.random().toString(36).slice(2,7) }, extra||{});
}
function sanitizeRes(list){
  const out=[];
  (Array.isArray(list)?list:[]).slice(0,20).forEach(r=>{
    if(!r || typeof r!=='object') return;
    const max = Math.max(0, Math.min(9999, Math.round(+r.max)||0));
    const cur = Math.max(0, Math.min(max||9999, Math.round(+r.cur)||0));
    out.push({ name:String(r.name||'').slice(0,40), cur, max });
  });
  return out;
}
function freeCascadePos(){
  const n = blocks.length % 12;
  return { x: 24 + n*32, y: 24 + n*26 };
}
function prepareCanvasForAdd(){
  activeParentId = null;
  if(searchFilter){
    searchFilter='';
    const s=document.getElementById('search'); if(s) s.value='';
  }
}
function uniq(){ return 'b'+Math.random().toString(36).slice(2,9); }
function toast(msg){
  const t=document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'), 10);
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 2600);
}
/* ═══ Глобальная обработка ошибок: не молчим ═══ */
let lastErrorSig = '', errorCount = 0;
function reportError(kind, err){
  const msg = String((err && (err.message || err.reason || err)) || 'неизвестная ошибка');
  const sig = kind + '|' + msg.slice(0, 120);
  if(sig === lastErrorSig){ errorCount++; } else { lastErrorSig = sig; errorCount = 1; }
  try{ if(typeof console!=='undefined' && console.error) console.error('[' + kind + ']', err); }catch(e){}
  if(errorCount > 3) return;               // один и тот же сбой не спамит
  try{ toast('Ошибка: ' + msg.slice(0, 160)); }catch(e){}
}
window.addEventListener('error', e=>{
  // ошибки загрузки картинок/скриптов приходят без e.error — их не трогаем
  if(e && e.error) reportError('JS', e.error);
});
window.addEventListener('unhandledrejection', e=>{
  const r = e && e.reason;
  // отмену загрузки (AbortError) и ожидаемые отказы данных показывать не нужно
  if(r && (r.name === 'AbortError' || r.name === 'QuotaExceededError')) return;
  reportError('Promise', r);
});

function debounce(fn, ms){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this, args), ms);
  };
}
function persistBlocks(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(blocks)); }catch(e){ console.warn('Не удалось сохранить блоки:', e); }
}
const persistBlocksDebounced = debounce(persistBlocks, 250);
function save(){
  const fc=document.getElementById('footerCount'); if(fc) fc.textContent=blocks.length;
  persistBlocksDebounced();
  scheduleDirSave();
}
window.addEventListener('beforeunload', ()=>{ persistBlocks(); if(saveDirHandle) { try{ writeBackupToDir(); }catch(e){} } });
window.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') persistBlocks(); });

/* ═══ Сохранение в папку на диске (File System Access API) ═══ */
const SAVE_DIR_KEY = '__shirma_dir';
let saveDirHandle = null;
let dirSaveTimer = null;
const supportsDirPick = typeof window!=='undefined' && typeof window.showDirectoryPicker==='function';

function buildBackupPayload(){
  const media={};
  const collect=k=>{ if(k && mediaCache[k]) media[k]=mediaCache[k]; };
  (typeof blocks!=='undefined'?blocks:[]).forEach(b=> collect(b.dataKey));
  (typeof maps!=='undefined'?maps:[]).forEach(m=>{ collect(m.bgKey); (m.markers||[]).forEach(k=> collect(k.imgKey)); });
  let sessions=null, map=null, battle=null, battleLogData=null;
  try{ sessions = JSON.parse(localStorage.getItem('shirma_sessions_v1')||'null'); }catch(e){}
  try{ map = JSON.parse(localStorage.getItem('shirma_map_v1')||'null'); }catch(e){}
  try{ battle = JSON.parse(localStorage.getItem('shirma_battle_v1')||'null'); }catch(e){}
  try{ battleLogData = JSON.parse(localStorage.getItem('shirma_battle_log_v1')||'null'); }catch(e){}
  let turn = null;
  try{ turn = JSON.parse(localStorage.getItem('shirma_battle_turn_v1')||'null'); }catch(e){}
  return { version:5, exported:Date.now(), blocks, media, sessions, map, battle, battleLog: battleLogData, battleTurn: turn, music: musicMetaSnapshot() };
}
function scheduleDirSave(){
  if(!saveDirHandle) return;
  if(dirSaveTimer) clearTimeout(dirSaveTimer);
  dirSaveTimer = setTimeout(()=>{ dirSaveTimer=null; writeBackupToDir(); }, 1500);
}
async function writeBackupToDir(){
  if(!saveDirHandle) return false;
  try{
    if(saveDirHandle.queryPermission){
      let perm = await saveDirHandle.queryPermission({mode:'readwrite'});
      if(perm!=='granted' && saveDirHandle.requestPermission){
        perm = await saveDirHandle.requestPermission({mode:'readwrite'});
      }
      if(perm!=='granted') return false;
    }
    const fh = await saveDirHandle.getFileHandle('shirma-backup.json', {create:true});
    const w = await fh.createWritable();
    await w.write(JSON.stringify(buildBackupPayload(), null, 2));
    await w.close();
    updateSaveDirStatus();
    return true;
  }catch(e){ return false; }
}
function updateSaveDirStatus(){
  const el = document.getElementById('homeSaveDirStatus');
  if(!el) return;
  if(!supportsDirPick){
    el.textContent = window.__TAURI__
      ? 'В настольной версии используйте «Экспорт» — файл сохранится через диалог.'
      : 'Браузер не поддерживает запись в папку — используйте «Экспорт JSON».';
    el.dataset.state='unsupported'; return;
  }
  if(saveDirHandle){ el.textContent = 'Папка подключена: файл shirma-backup.json обновляется автоматически.'; el.dataset.state='on'; }
  else { el.textContent = 'Папка не подключена. Выберите её, чтобы хранить резервную копию на диске.'; el.dataset.state='off'; }
}
async function chooseSaveDir(){
  if(!supportsDirPick){ toast('Браузер не поддерживает сохранение в папку. Используйте «Экспорт JSON».'); return; }
  try{
    const dir = await window.showDirectoryPicker({ mode:'readwrite' });
    saveDirHandle = dir;
    idbPut(SAVE_DIR_KEY, dir);
    const ok = await writeBackupToDir();
    updateSaveDirStatus();
    toast(ok ? 'Папка сохранений подключена' : 'Папка выбрана, но запись не удалась');
  }catch(e){
    if(e && e.name==='AbortError') return;
    toast('Не удалось выбрать папку');
  }
}
async function initSaveDir(){
  if(!supportsDirPick) { updateSaveDirStatus(); return; }
  try{
    const h = await idbGet(SAVE_DIR_KEY);
    if(!h) { updateSaveDirStatus(); return; }
    let perm = 'prompt';
    if(h.queryPermission){ try{ perm = await h.queryPermission({mode:'readwrite'}); }catch(e){ perm='prompt'; } }
    if(perm==='granted'){ saveDirHandle = h; scheduleDirSave(); }
    else { /* нужно повторное разрешение — подключим по кнопке */ }
    updateSaveDirStatus();
  }catch(e){ updateSaveDirStatus(); }
}
(function(){
  const pick = ()=> chooseSaveDir();
  ['btnSaveDir','homeSaveDir'].forEach(id=>{ const b=document.getElementById(id); if(b) b.addEventListener('click', pick); });
  initSaveDir();
})();

/* ═══ Undo: кольцо снапшотов последнего состояния (до 30 шагов) ═══ */
const UNDO_KEY = 'shirma_undo_v1';
const UNDO_MAX = 30;
const UNDO_BYTES = 1200000;   // бюджет кольца: ~1,2 МБ, чтобы не упереться в квоту localStorage
function undoStack(){
  let stack=[];
  try{ stack=JSON.parse(localStorage.getItem(UNDO_KEY)); }catch(e){}
  return Array.isArray(stack)? stack : [];
}
function pushUndo(label){
  try{
    const stack=undoStack();
    stack.push({
      t:Date.now(), label:String(label||''),
      blocks: JSON.stringify(blocks),
      sessions: JSON.stringify(sessions),
    });
    while(stack.length>UNDO_MAX) stack.shift();
    // ограничение по весу: старые снапшоты выбрасываем, пока кольцо не влезет в бюджет
    let payload=JSON.stringify(stack);
    while(stack.length>1 && payload.length>UNDO_BYTES){
      stack.shift();
      payload=JSON.stringify(stack);
    }
    try{
      localStorage.setItem(UNDO_KEY, payload);
    }catch(e){
      // квота всё равно кончилась — режем кольцо вдвое и пробуем ещё
      while(stack.length>1){
        stack.splice(0, Math.ceil(stack.length/2));
        try{ localStorage.setItem(UNDO_KEY, JSON.stringify(stack)); return; }catch(err){}
      }
      try{ localStorage.removeItem(UNDO_KEY); }catch(err){}
      console.warn('Undo не помещается в localStorage — кольцо очищено');
    }
  }catch(e){ console.warn('Не удалось записать undo:', e); }
}
function undoLast(){
  const stack=undoStack();
  const snap=stack.pop();
  if(!snap){ toast('Нечего отменять'); return; }
  try{
    const b=JSON.parse(snap.blocks);  if(Array.isArray(b)) blocks=b;
    const s=JSON.parse(snap.sessions);if(Array.isArray(s)) sessions=s;
  }catch(e){}
  try{ localStorage.setItem(UNDO_KEY, JSON.stringify(stack)); }catch(e){}
  // сохраняем свёрнутость только для существующих блоков (не сворачиваем всё подряд)
  collapsed = new Set([...collapsed].filter(id=>blocks.some(b=>b.id===id)));
  activeParentId=null;
  // восстановленные сессии нужно записать, иначе откат потеряется после перезагрузки
  try{ persistSessions(); }catch(e){}
  // переоткрыть сессии из восстановленного состояния
  sessionsInited=true; activeSessionId=(sessions.length? sessions[0].id : null);
  if(currentTab==='sessions'){ renderSessionsList(); if(activeSessionId) selectSession(activeSessionId); }
  if(blocksTab==='monsters') showTab('monsters'); else showTab('chars');
  save(); render();
  toast('Отменено: '+(snap.label||'последнее изменение'));
}
document.getElementById('btnUndo').addEventListener('click', undoLast);
document.addEventListener('keydown', e=>{
  if(!((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='z')) return;
  const t=e.target;
  if(t && (t.closest('input,textarea') || t.isContentEditable)) return; // не мешаем undo в редакторе
  e.preventDefault(); undoLast();
});
function findBlock(id){ return blocks.find(b=>b.id===id); }
/* Очистка блоков из внешнего JSON: только нужные поля, только допустимые типы/значения.
   id генерируются заново — исключены коллизии и впрыскивание служебных полей. */
function sanitizeBlocks(arr){
  const okTypes=['pc','rule','note','mob','img'];
  const out=[];
  const clampStat=v=>{ const n=Math.round(+v); return isFinite(n)?Math.max(1,Math.min(30,n)):10; };
  (Array.isArray(arr)?arr:[]).forEach(raw=>{
    if(!raw || typeof raw!=='object') return;
    if(!okTypes.includes(raw.type)) return;
    const b=makeBlock(raw.type, String(raw.title||TYPE_LABEL[raw.type]));
    b.collapse=!!raw.collapse;
    b.w=Math.max(200, Math.min(1600, Math.round(+raw.w)||820));
    b.x=(raw.x!=null && isFinite(+raw.x) && +raw.x>=0)? +raw.x : null;
    b.y=(raw.y!=null && isFinite(+raw.y) && +raw.y>=0)? +raw.y : null;
    b.text=String(raw.text!=null?raw.text:'').slice(0,50000);
    if(Array.isArray(raw.stats) && raw.stats.length===6) b.stats=raw.stats.map(clampStat);
    if(raw.props && typeof raw.props==='object' && !Array.isArray(raw.props)){
      const p={};
      Object.entries(raw.props).slice(0,30).forEach(([k,v])=>{ p[String(k).slice(0,60)]=String(v!=null?v:'').slice(0,200); });
      b.props=p;
    }
    if(raw.attack!=null) b.attack=String(raw.attack).slice(0,20);
    b.dmg = Math.max(0, Math.round(+raw.dmg)||0);
    if(raw.res) b.res=sanitizeRes(raw.res);
    if(raw.fileName) b.fileName=String(raw.fileName).slice(0,120);
    if(raw.kind==='image'||raw.kind==='doc') b.kind=raw.kind;
    if(raw.sizeLabel) b.sizeLabel=String(raw.sizeLabel).slice(0,20);
    if(typeof raw.dataKey==='string' && raw.dataKey) b.dataKey=raw.dataKey.slice(0,80);
    if(typeof raw.data==='string' && /^data:/.test(raw.data)) b.data=raw.data;
    if(raw.mdata && typeof raw.mdata==='object'){
      const d=raw.mdata;
      b.mdata={
        type:String(d.type||''), cr:String(d.cr||''), ac:String(d.ac||''), hp:String(d.hp||''),
        sp:String(d.sp||''), init:String(d.init||''), sk:String(d.sk||'').slice(0,300),
        sen:String(d.sen||'').slice(0,200), lang:String(d.lang||'').slice(0,200),
        sav:String(d.sav||'').slice(0,120), imm:String(d.imm||'').slice(0,300),
        ab_list: safeArr(d.ab_list).slice(0,6).map(a=>({
          k:String(a&&a.k||'').slice(0,4),
          v:clampStat(a&&a.v), m:Math.round(+(a&&a.m))||0, s:String(a&&a.s||'').slice(0,6)
        })),
        acts: safeArr(d.acts).slice(0,60).map(a=>({
          tag:String((a&&typeof a==='object')?a.tag:'').slice(0,30),
          text:String(typeof a==='string'?a:((a&&a.text)||'')).slice(0,3000)
        }))
      };
    }
    out.push(b);
  });
  return out;
}

function seed(){
  blocks = SAMPLES.map(s=>makeBlock(s.type,s.title,{title:s.title, links:s.links, stats:s.stats||[10,10,10,10,10,10], props:s.props||{}, res:sanitizeRes(s.res), text:s.text||''}));
  collapsed = new Set(); blocks.forEach(b=>collapsed.add(b.id));
  save(); render();
}

