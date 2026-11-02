
/* ════════════ Mодель данных ════════════ */
const TYPES = { pc:'pc', rule:'rule', note:'note' };
const TYPE_LABEL = { pc:'ПК', mob:'Монстр', rule:'Правила', note:'Заметка', img:'Файл' };

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
      const blob=new Blob([raw],{type:'application/octet-stream'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob); a.download=label+'.повреждено.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
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
}
window.addEventListener('beforeunload', persistBlocks);
window.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') persistBlocks(); });

/* ═══ Undo: кольцо снапшотов последнего состояния (до 30 шагов) ═══ */
const UNDO_KEY = 'shirma_undo_v1';
const UNDO_MAX = 30;
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
    localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
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
  collapsed=new Set(blocks.map(b=>b.id));
  activeParentId=null;
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

/* ════════════ Render: sidebar tree ════════════ */
/* ════════════════ Render: canvas ════════════════ */
function render(){
  const canvas = document.getElementById('canvas');
  canvas.classList.toggle('free', freeLayout);
  let base = blocksTab==='monsters'
    ? blocks.filter(b=> b.type==='mob')
    : blocks.filter(b=> b.type!=='mob');
  const list = searchFilter ? base.filter(matches) : (activeParentId===null ? base : base.filter(b=>b.id===activeParentId));
  document.getElementById('crumbsRoot').textContent = (blocksTab==='monsters'?'Монстры':'Персонажи')
    + (searchFilter?' · результаты поиска':(activeParentId===null?'':(' / '+(findBlock(activeParentId)?.title||'корень'))));

  if(!list.length){
    canvas.innerHTML = `<div class="canvas-watermark">${searchFilter?'Ничего не найдено.':(blocksTab==='monsters'?'Здесь будут монстры. Добавьте их через «👹 Бестиарий» → «＋ Добавить на ширму».':'Добавьте первого персонажа — «＋ ПК» в правом меню.')}</div>`;
  } else {
    const safeCard = b => { try { return blockCard(b); } catch(e){
      return `<div class="block" data-id="${b.id}"><div class="block-head"><div class="ttl-note"><span>${escapeHtml(b.title||'Блок')}</span></div></div><div class="block-body"><div class="hint">Ошибка отображения блока: ${escapeHtml(String((e&&e.message)||e))}</div></div></div>`;
    } };
    if(freeLayout){
      canvas.innerHTML = list.map((b,idx)=>{
        const card = safeCard(b);
        const x = b.x!=null?b.x:(24 + (idx%12)*32), y = b.y!=null?b.y:(24 + (idx%12)*26);
        return `<div class="canvas-free-wrap" style="position:absolute;left:${x}px;top:${y}px;width:${b.w||360}px;z-index:${b._z||0}">${card}</div>`;
      }).join('');
    } else {
      canvas.innerHTML = `<div style="max-width:820px">` + list.map(safeCard).join('') + `</div>`;
    }
  }
  save();
}

function blockCard(b){
  const open = !collapsed.has(b.id);
  const border = 'border-'+b.type;
  const ttype = TYPE_LABEL[b.type];
  const w = b.w || 820;
  const li = `<div class="block ${border}" data-id="${b.id}" style="width:${w}px">
    <div class="block-head" data-toggle>
      <span class="collapse ${open?'':'collapsed'}">▸</span>
      <div class="ttl-note">
        <span class="block-title" data-title="${b.id}" contenteditable="true" spellcheck="false" title="Кликните, чтобы переименовать">${escapeHtml(b.title||'(без названия)')}</span>
        <span class="type-tag ${b.type}">${ttype}</span>
      </div>
    </div>
    ${ open ? bodyHtml(b) : `<div class="block-foot"><button class="del" data-action="delete" data-id="${b.id}">Удалить</button></div>` }
    <div class="resize-handle" data-resize="${b.id}" title="Изменить размер"></div>
  </div>`;
  return li;
}

function statsInput(b){
  return `<div class="stats">`+ b.stats.map((s,i)=>`<div class="stat">
    <div class="lbl">${ITEMS_FOR_9[i]||''}</div>
    <input class="val" type="number" min="1" max="30" value="${s}" data-stat-index="${i}" data-stats-id="${b.id}">
    <div class="mod" data-roll-stat="${ITEMS_FOR_9[i]||''}" data-roll-id="${b.id}" title="Бросить d20 + модификатор">${signed(modf(s))}</div>
  </div>`).join('')+`</div>`;
}

function bodyHtml(b){
  let inner='';
  if(b.type==='mob' && b.mdata){ inner = mobStatBlockHtml(b); }
  else if(b.type==='pc' || b.type==='mob'){
    inner += `<div class="props">`+Object.entries(b.props).map(([k,v])=>`<div class="prop"><span class="lbl">${escapeHtml(k)}</span><input class="v" data-prop-key="${escapeHtml(k)}" data-prop-id="${b.id}" value="${escapeHtml(String(v))}"></div>`).join('')+`</div>`;
    if(b.type==='pc') inner += hpRowHtml(b);
    if(b.type==='pc') inner += resourcesHtml(b);
    inner += statsInput(b);
    inner += `<div class="attack-row">
      <span class="lbl">Атака:</span>
      <input class="attack-input" type="text" data-attack="${b.id}" value="${escapeHtml(b.attack!==undefined?b.attack:'+0')}" placeholder="+бонус" title="Бонус атаки, напр. +5">
      <button data-rollatt="${b.id}" title="Бросок атаки: d20 + бонус">⚔️ Бросить атаку</button>
      <span class="hint" data-attresult="${b.id}"></span>
    </div>`;
  }
  if(b.type==='img'){
    const src = safeMediaSrc(mediaFor(b));
    if(src && b.kind==='image'){
      inner += `<div class="block-img-prev"><img src="${escapeHtml(src)}" alt="${escapeHtml(b.fileName||'')}"></div>`;
    } else if(src && b.kind==='doc'){
      inner += `<div class="block-doc"><span class="doc-ico">${docIcon(b.fileName)}</span>
        <span class="doc-name">${escapeHtml(b.fileName||'документ')}</span>
        <span class="doc-size">${escapeHtml(b.sizeLabel||'')}</span>
        <a class="doc-open" href="${escapeHtml(src)}" download="${escapeHtml(b.fileName||'doc')}">Скачать</a>
        <a class="doc-open" href="${escapeHtml(src)}" target="_blank" rel="noopener">Открыть</a>
      </div>`;
    }
  }
  if(b.type==='mob' && b.mdata){ inner += `<div class="hint" style="margin-top:6px">Текстовая заметка к статблоку:</div><textarea data-field="text" data-id="${b.id}" style="min-height:60px">${escapeHtml(b.text)}</textarea>`; }
  else if(b.type==='img'){ /* no textarea for media blocks */ }
  else inner += `<textarea data-field="text" data-id="${b.id}">${escapeHtml(b.text)}</textarea>`;
  return `<div class="block-body">${inner}</div>
    <div class="block-foot">
      <button data-action="collapse">Свернуть</button>
      <button data-action="expand">Развернуть</button>
      ${b.type==='pc'?`<button data-action="rollAll" data-roll-id="${b.id}" title="Бросить d20 по всем характеристикам">Бросок всех</button>`:''}
      ${(b.type==='pc'||b.type==='mob')?`<button data-action="battle" data-battle-id="${b.id}" title="Добавить в вкладку «Бой»">⚔ В бой</button>`:''}
      <span class="size-info">Ширина: <input class="resize-input" type="number" min="200" max="1600" step="20" value="${b.w||820}" data-width="${b.id}" title="Ширина блока, px"></span>
      <span class="hint" style="margin-left:auto">редактируйте заголовок и текст прямо здесь</span>
      <button class="del" data-action="delete">Удалить блок</button>
    </div>`;
}
/* ═══ Ресурсы (ячейки, патроны, вдохновение и т.п.) ═══ */
function resourcesHtml(b){
  const list = b.res || [];
  return `<div class="res-row">
    <span class="lbl res-lbl">Ресурсы:</span>
    <span class="res-list">
      ${list.map((r,i)=>`
        <span class="res-chip ${r.cur<=0?'empty':''}" data-res-chip="${b.id}" data-res-i="${i}">
          <button class="res-btn" data-res-op="dec" data-res-id="${b.id}" data-res-i="${i}" title="Минус один">−</button>
          <span class="res-name" contenteditable="true" spellcheck="false" data-res-name="${b.id}" data-res-i="${i}" title="Клик — переименовать">${escapeHtml(r.name||'Ресурс')}</span>
          <span class="res-val" data-res-val="${b.id}" data-res-i="${i}">${r.cur}/${r.max}</span>
          <button class="res-btn" data-res-op="inc" data-res-id="${b.id}" data-res-i="${i}" title="Плюс один">+</button>
          <button class="res-x" data-res-del="${b.id}" data-res-i="${i}" title="Удалить ресурс">✕</button>
        </span>`).join('')}
      <button class="res-add" data-res-add="${b.id}" title="Добавить ресурс">＋ Ресурс</button>
    </span>
  </div>`;
}
function findBlockRes(id, i){ const b=findBlock(id); if(!b) return null; return (b.res||[])[i]; }
/* ═══ ХП и урон на листе ПК ═══ */
function hpMaxOf(b){ return Math.max(0, parseInt(b.props && b.props['ХП'] || b.props && b.props['HP']) || 0); }
function hpCurOf(b){
  const max=hpMaxOf(b);
  return Math.max(0, Math.min(max, max - Math.max(0, Math.round(+b.dmg)||0)));
}
function hpRowHtml(b){
  const hpMax=hpMaxOf(b), cur=hpCurOf(b);
  const knocked = cur<=0 && hpMax>0;
  return `<div class="hp-row">
    <span class="lbl">ХП:</span>
    <span class="hp-big ${knocked?'knocked':''}" data-hp-val="${b.id}">${cur}</span>
    <span class="hint">/ ${hpMax}</span>
    <button class="res-btn hp-btn" data-hp-op="d5" data-hp-id="${b.id}" title="Урон 5">−5</button>
    <button class="res-btn hp-btn" data-hp-op="d1" data-hp-id="${b.id}" title="Урон 1">−1</button>
    <button class="res-btn hp-btn" data-hp-op="h1" data-hp-id="${b.id}" title="Лечение 1">+1</button>
    <button class="res-btn hp-btn" data-hp-op="h5" data-hp-id="${b.id}" title="Лечение 5">+5</button>
    <input class="hp-dmg-in" type="number" min="0" data-hp-in="${b.id}" placeholder="урон ⏎" title="Введите урон и нажмите Enter">
    ${knocked?'<span class="hint" style="color:var(--danger)">☠ выбыл</span>':''}
  </div>`;
}
function hpApply(bid, op){
  const b=findBlock(bid); if(!b) return;
  const hpMax=hpMaxOf(b);
  let cur=hpCurOf(b);
  if(op==='d5') cur-=5;
  else if(op==='d1') cur-=1;
  else if(op==='h1') cur+=1;
  else if(op==='h5') cur+=5;
  else if(op==='healFull'){ cur=hpMax; }
  cur=Math.max(0, Math.min(hpMax, cur));
  b.dmg = hpMax - cur;
  const el=document.querySelector('[data-hp-val="'+b.id+'"]');
  if(el){
    el.textContent = cur;
    el.classList.toggle('knocked', cur<=0 && hpMax>0);
    const row=el.closest('.hp-row');
    const tag=row && row.querySelector('.hp-dead');
    if(tag) tag.remove();
    if(cur<=0 && hpMax>0 && row){
      const s=document.createElement('span'); s.className='hint hp-dead'; s.style.color='var(--danger)'; s.textContent='☠ выбыл';
      row.appendChild(s);
    }
  }
  save();
}
function hpInputDamage(inEl){
  const b=findBlock(inEl.dataset.hpIn); if(!b) return;
  const n=Math.round(+inEl.value)||0;
  if(n>0){
    const hpMax=hpMaxOf(b);
    b.dmg = Math.min(hpMax, Math.max(0, Math.round(+b.dmg||0) + n));
    save();
  }
  inEl.value='';
  hpApply(inEl.dataset.hpIn, 'refresh'); // перерисовать значение/метку
}
function mobStatBlockHtml(b){
  const d=b.mdata||{};
  const AB_RU={Str:'СИЛ',Dex:'ЛОВ',Con:'ТЕЛ',Int:'ИНТ',Wis:'МУД',Cha:'ХАР'};
  const abRow = (d.ab_list||[]).map(a=>`
    <div class="mob-ab"><div class="mob-ab-k">${AB_RU[a.k]||a.k}</div>
      <div class="mob-ab-v">${a.v}</div>
      <div class="mob-ab-m">${a.m>=0?'+'+a.m:a.m}${a.s&&a.s!==(a.m>=0?'+'+a.m:a.m)?' ('+a.s+')':''}</div>
    </div>`).join('');
  const actsHtml = actsGroupsHtml(d);
  return `<div class="mob-block">
    <div class="mob-meta">
      <div class="mob-type">${escapeHtml(d.type||'')}</div>
      <div class="mob-meta-row">
        <span>КД <b>${escapeHtml(d.ac||'—')}</b></span>
        <span>ХП <b>${escapeHtml(d.hp||'—')}</b></span>
        <span>Скорость <b>${escapeHtml(d.sp||'—')}</b></span>
      </div>
    </div>
    <div class="mob-ab-row">${abRow}</div>
    ${d.sk?`<div class="mob-line"><b>Навыки</b> ${escapeHtml(d.sk)}</div>`:''}
    ${d.sen?`<div class="mob-line"><b>Чувства</b> ${escapeHtml(d.sen)}</div>`:''}
    ${d.lang?`<div class="mob-line"><b>Языки</b> ${escapeHtml(d.lang)}</div>`:''}
    <div class="mob-line"><b>Опасность</b> ${escapeHtml(shortCr(d.cr))}</div>
    <div class="mob-line"><b>Инициатива</b> ${escapeHtml(d.init||'—')}</div>
    ${actsHtml}
  </div>`;
}
/* Общий разбор действия монстра: «Название. Текст» */
function splitAct(txt){
  const s=String(txt||''); const ci=s.indexOf('. ');
  return ci>0 ? { name:s.slice(0,ci), body:s.slice(ci+2) } : { name:'', body:s };
}
/* Группировка действий по тегам, порядок фиксированный */
const ACT_TAG_ORDER=['Черты','Действия','Бонус','Реакция','Легендарные'];
function actsGroupsHtml(d){
  const groups={};
  (d.acts||[]).forEach(a=>{ (groups[a.tag]=groups[a.tag]||[]).push(a.text); });
  let html='';
  ACT_TAG_ORDER.forEach(tag=>{
    if(groups[tag] && groups[tag].length){
      html += `<div class="mob-section"><div class="mob-sec-title">${escapeHtml(tag)}</div>`;
      groups[tag].forEach(txt=>{
        const {name, body}=splitAct(txt);
        html += `<div class="mob-act"><b>${escapeHtml(name)}</b> ${escapeHtml(body)}</div>`;
      });
      html += `</div>`;
    }
  });
  return html;
}
function docIcon(name){
  const n=(name||'').toLowerCase();
  if(n.endsWith('.pdf')) return '📕';
  if(n.endsWith('.txt')||n.endsWith('.md')) return '📄';
  if(n.endsWith('.docx')||n.endsWith('.doc')) return '📘';
  if(n.endsWith('.json')) return '🧾';
  return '📎';
}

/* ════════════ Helpers ════════════ */
function modf(s){ return Math.floor((s-10)/2); }
function signed(n){ return (n>=0?'+':'')+n; }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function matches(b){
  if(!searchFilter) return true;
  const q = searchFilter.toLowerCase();
  const props = Object.values(b.props||{}).join(' ').toLowerCase();
  const resNames = Array.isArray(b.res) ? b.res.map(r=>(r&&r.name)||'').join(' ') : '';
  return (b.title||'').toLowerCase().includes(q) || (b.text||'').toLowerCase().includes(q)
    || props.includes(q) || resNames.toLowerCase().includes(q);
}

/* ═══ Делегирование событий канваса ═══
   Один набор слушателей на #canvas вместо повторного биндинга после каждого рендера;
   карточки обновляются точечно через renderBlockOnly(). */
let canvasEventsInited = false;
function initCanvasEvents(){
  if(canvasEventsInited) return;
  canvasEventsInited = true;
  // Импорт файлов перетаскиванием на холст
  const canvasEl = document.getElementById('canvas');
  if(canvasEl){
    ['dragover','dragenter'].forEach(ev => canvasEl.addEventListener(ev, e=>{
      if(e.dataTransfer && Array.from(e.dataTransfer.types||[]).includes('Files')) e.preventDefault();
    }));
    canvasEl.addEventListener('drop', e=>{
      const dt = e.dataTransfer; if(!dt) return;
      const files = Array.from(dt.files||[]);
      if(!files.length) return;
      e.preventDefault();
      files.forEach(f=> importFile(f));
    });
  }
  const canvas = document.getElementById('canvas');

  canvas.addEventListener('click', e=>{
    const t = e.target;
    // клик по заголовку блока — свернуть/развернуть
    if(t.closest('[data-toggle]') && !t.closest('.block-title')){
      const blockEl=t.closest('.block');
      if(blockEl) toggleBlock(blockEl.dataset.id);
      return;
    }
    if(t.closest('.block-title')) return; // contenteditable: сама обрабатывает
    const rollAtt = t.closest('[data-rollatt]');
    if(rollAtt){
      const id=rollAtt.dataset.rollatt, b=findBlock(id); if(!b) return;
      const bonus = parseFloat(b.attack||'0')||0;
      const roll = 1+Math.floor(Math.random()*20);
      const total = roll+bonus;
      const crit = roll===20 ? ' — КРИТ!' : (roll===1?' — авто-промах':'');
      const resEl = document.querySelector('[data-attresult="'+id+'"]');
      if(resEl) resEl.textContent = `d20 ${roll} + ${bonus} = ${total}${crit}`;
      const rr=document.getElementById('rollResult');
      if(rr) rr.textContent = `Атака: ${total}`;
      if(roll===20) playSound('crit');
      else if(roll===1) playSound('fail');
      return;
    }
    const statMod = t.closest('.stat .mod');
    if(statMod){
      const b=findBlock(statMod.dataset.rollId); if(!b) return;
      const idx=ITEMS_FOR_9.indexOf(statMod.dataset.rollStat);
      const m=idx>=0?modf(b.stats[idx]):0;
      doRoll('d20',1, (m>=0?`+${m}`:m));
      return;
    }
    const rollAll = t.closest('[data-action="rollAll"]');
    if(rollAll){
      const b=findBlock(rollAll.dataset.rollId); if(!b) return;
      let out='';
      b.stats.forEach((s,i)=>{ out+=`${ITEMS_FOR_9[i]}: ${doOneD20()+modf(s)}  `; });
      document.getElementById('rollResult').textContent = 'Бросок всех: '+out;
      rollHistory.push('Бросок всех ПК: '+out);
      return;
    }
    const hpBtn = t.closest('[data-hp-op]');
    if(hpBtn){ hpApply(hpBtn.dataset.hpId, hpBtn.dataset.hpOp); return; }
    const hpIn = t.closest('[data-hp-in]') || t.closest('.hp-dmg-in');
    // кнопки действий блока: delete / collapse / expand
    const act = t.closest('[data-action]');
    if(act){
      const blockEl=act.closest('.block'); if(!blockEl) return;
      const id = act.dataset.id || blockEl.dataset.id;
      if(act.dataset.action==='delete'){ if(confirm('Удалить блок?')) removeBlock(id); }
      else if(act.dataset.action==='collapse'){ collapsed.add(id); renderBlockOnly(id); save(); }
      else if(act.dataset.action==='expand'){ collapsed.delete(id); renderBlockOnly(id); save(); }
      else if(act.dataset.action==='battle'){ addBlockToBattle(findBlock(act.dataset.battleId)); }
      return;
    }
    const resBtn = t.closest('[data-res-op]');
    if(resBtn){
      const r=findBlockRes(resBtn.dataset.resId, +resBtn.dataset.resI); if(!r) return;
      r.cur = resBtn.dataset.resOp==='inc'
        ? Math.min(r.max, r.cur+1)
        : Math.max(0, r.cur-1);
      const chip=resBtn.closest('.res-chip');
      const valEl=chip && chip.querySelector('.res-val');
      if(valEl) valEl.textContent = `${r.cur}/${r.max}`;
      if(chip) chip.classList.toggle('empty', r.cur<=0);
      save();
      return;
    }
    const resAdd = t.closest('[data-res-add]');
    if(resAdd){
      const b=findBlock(resAdd.dataset.resAdd); if(!b) return;
      if(!Array.isArray(b.res)) b.res=[];
      b.res.push({ name:'Ресурс', cur:3, max:3 });
      if(b.res.length>20) b.res.shift();
      save(); renderBlockOnly(b.id);
      return;
    }
    const resDel = t.closest('[data-res-del]');
    if(resDel){
      const b=findBlock(resDel.dataset.resDel); if(!b) return;
      b.res.splice(+resDel.dataset.resI, 1);
      save(); renderBlockOnly(b.id);
      return;
    }
  });

  canvas.addEventListener('input', e=>{
    const t = e.target;
    if(t.matches('[data-field="text"]')){
      const b=findBlock(t.dataset.id); if(b){ b.text=t.value; save(); }
      return;
    }
    if(t.matches('[data-attack]')){
      const b=findBlock(t.dataset.attack); if(b){ b.attack=t.value; save(); }
      return;
    }
    if(t.matches('.stat input.val')){
      const b=findBlock(t.dataset.statsId); if(!b) return;
      const idx=+t.dataset.statIndex;
      b.stats[idx]=Math.max(1,Math.min(30,parseInt(t.value)||10));
      const modEl=t.parentElement.querySelector('.mod');
      if(modEl) modEl.textContent = signed(Math.floor((b.stats[idx]-10)/2));
      save();
      return;
    }
    if(t.matches('.prop input.v')){
      const b=findBlock(t.dataset.propId); if(!b) return;
      b.props[t.dataset.propKey]=t.value; save();
      return;
    }
  });

  canvas.addEventListener('change', e=>{
    const t = e.target;
    if(t.matches('.stat input.val')){
      const b=findBlock(t.dataset.statsId); if(!b) return;
      const idx=+t.dataset.statIndex;
      const v=Math.max(1,Math.min(30,parseInt(t.value)||10));
      b.stats[idx]=v; t.value=v; save();
      return;
    }
    if(t.matches('[data-width]')){
      const b=findBlock(t.dataset.width); if(!b) return;
      const v=Math.max(180,Math.min(1600,parseInt(t.value)||820));
      t.value=v; b.w=v; save();
      const el=document.querySelector('.block[data-id="'+t.dataset.width+'"]');
      if(el) el.style.width=v+'px';
      return;
    }
    if(t.matches('.hp-dmg-in')){
      hpInputDamage(t);
      return;
    }
  });

  canvas.addEventListener('focusout', e=>{
    const t = e.target;
    if(t.matches('.block-title')){
      const b=findBlock(t.dataset.title); if(!b) return;
      const val=t.textContent.trim();
      if(!val){ t.textContent=b.title||''; return; }
      b.title=val; save(); render();
      return;
    }
    if(t.matches('[data-res-name]')){
      const b=findBlock(t.dataset.resName); if(!b) return;
      const r=(b.res||[])[+t.dataset.resI]; if(!r) return;
      r.name = t.textContent.trim().slice(0,40) || 'Ресурс';
      save();
      return;
    }
  });

  canvas.addEventListener('keydown', e=>{
    const t = e.target;
    if((t.matches('.block-title') || t.matches('[data-res-name]')) && e.key==='Enter'){ e.preventDefault(); t.blur(); }
    if(t.matches('.hp-dmg-in') && e.key==='Enter'){ e.preventDefault(); t.blur(); }
  });

  canvas.addEventListener('mousedown', e=>{
    const t = e.target;
    // переименование не должно начинать drag
    if(t.closest('.block-title') || t.closest('[data-res-name]')){ e.stopPropagation(); return; }
    if(t.closest('select,input,textarea,a,button')) return;
    const handle = t.closest('[data-resize]');
    if(handle){ startBlockResize(e, handle); return; }
    if(freeLayout){
      const head = t.closest('.block-head');
      if(head) startBlockDrag(e, head);
    }
  });
}

/* Точечная перерисовка одной карточки (и внешнего wrapper в свободном холсте) */
function renderBlockOnly(id){
  const b=findBlock(id); if(!b) return;
  const el=document.querySelector('#canvas .block[data-id="'+id+'"]');
  if(!el){ render(); return; }
  const freeWrap = freeLayout ? el.parentElement : null;
  if(freeWrap && freeWrap.classList.contains('canvas-free-wrap')){
    freeWrap.innerHTML = blockCard(b);
    freeWrap.style.width = (b.w||360)+'px';
  } else {
    el.outerHTML = blockCard(b);
  }
}
function startBlockResize(e, handle){
  e.stopPropagation();
  const block=handle.closest('.block'), id=block.dataset.id, b=findBlock(id); if(!b) return;
  const startX=e.clientX, startW=b.w||block.offsetWidth||820;
  block.classList.add('dragging');
  pointerDrag(e, ev=>{
    const nw=Math.max(180,Math.min(1600, startW + (ev.clientX-startX)));
    block.style.width=nw+'px'; b.w=nw;
  }, ()=>{
    block.classList.remove('dragging'); save();
    const inp=block.querySelector('.resize-input'); if(inp) inp.value=b.w;
  });
}
function startBlockDrag(e, head){
  const block=head.closest('.block');
  const id=block.dataset.id, wrap=block.parentElement, b=findBlock(id); if(!b) return;
  const startX=e.clientX, startY=e.clientY;
  const ox=b.x!=null?b.x:wrap.offsetLeft, oy=b.y!=null?b.y:wrap.offsetTop;
  block.classList.add('dragging');
  b._z = Math.max(1,(b._z||0)+1); wrap.style.zIndex=b._z;
  pointerDrag(e, ev=>{
    b.x = Math.max(0, ox+(ev.clientX-startX)); b.y = Math.max(0, oy+(ev.clientY-startY));
    wrap.style.left=b.x+'px'; wrap.style.top=b.y+'px';
  }, ()=>{ block.classList.remove('dragging'); save(); });
}
function toggleBlock(id){
  if(collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  renderBlockOnly(id);
  save();
}
function removeBlock(id){
  const victim=blocks.find(b=>b.id===id);
  pushUndo('удаление блока «'+((victim&&victim.title)||'')+'»');
  blocks = blocks.filter(b=>b.id!==id);
  blocks.forEach(b=>{ b.links = b.links.filter(x=>x!==id); });
  if(activeParentId===id) activeParentId=null;
  save(); render();
}

/* ═══ Layout toggle ═══ */
document.getElementById('btnLayout').addEventListener('click', ()=>{
  freeLayout=!freeLayout;
  document.getElementById('btnLayout').textContent = freeLayout?'Лента':'Свободный холст';
  render();
});

/* ═══ Темы (светлая/тёмная) ═══ */
const THEME_KEY = 'shirma_theme_v1';
function applyTheme(t){
  if(t==='light'){ document.documentElement.setAttribute('data-theme','light'); }
  else { document.documentElement.removeAttribute('data-theme'); }
  const b=document.getElementById('btnTheme');
  if(b){ b.textContent = t==='light' ? '🌙' : '☀️'; }
}
function currentTheme(){
  try{ return localStorage.getItem(THEME_KEY)==='light' ? 'light' : 'dark'; }catch(e){ return 'dark'; }
}
(function(){
  applyTheme(currentTheme());
  const b=document.getElementById('btnTheme');
  if(b) b.addEventListener('click', ()=>{
    const nt = currentTheme()==='light' ? 'dark' : 'light';
    try{ localStorage.setItem(THEME_KEY, nt); }catch(e){}
    applyTheme(nt);
  });
})();

/* ═══ Полноэкранный режим ═══ */
(function(){
  const btn=document.getElementById('btnFullscreen');
  if(!btn) return;
  function ref(){
    btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    btn.title = document.fullscreenElement? 'Выйти из полноэкранного режима' : 'Полноэкранный режим';
  }
  btn.addEventListener('click', ()=>{
    if(document.fullscreenElement){ document.exitFullscreen&&document.exitFullscreen().catch(()=>{}); }
    else { const el=document.documentElement; (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); }
  });
  document.addEventListener('fullscreenchange', ref);
  document.addEventListener('webkitfullscreenchange', ref);
})();

/* ═══ Меню команд (☰) ═══ */
(function(){
  const btn=document.getElementById('btnMenu');
  const panel=document.getElementById('menuPanel');
  if(!btn||!panel) return;
  btn.addEventListener('click', e=>{ e.stopPropagation(); panel.classList.toggle('open'); });
  document.addEventListener('click', e=>{ if(!e.target.closest('.menu-wrap')) panel.classList.remove('open'); });
  panel.addEventListener('click', ()=> panel.classList.remove('open'));
})();

/* ═══ Сворачивание верхней панели ═══ */
(function(){
  const KEY='shirma_topcollapsed_v1';
  const collapse=document.getElementById('topCollapse');
  const handle=document.getElementById('topHandle');
  function apply(col){
    document.body.classList.toggle('top-collapsed', !!col);
    if(handle) handle.hidden = !col;
    if(collapse) collapse.title = col?'Развернуть верхнюю панель':'Свернуть верхнюю панель';
  }
  function toggle(){
    const col = !document.body.classList.contains('top-collapsed');
    try{ localStorage.setItem(KEY, col?'1':'0'); }catch(e){}
    apply(col);
  }
  if(collapse) collapse.addEventListener('click', toggle);
  if(handle) handle.addEventListener('click', toggle);
  let col=0;
  try{ col = localStorage.getItem(KEY)==='1'?1:0; }catch(e){}
  apply(col);
})();

/* ═══ Звуки (Web Audio, синтез — файлов нет) ═══ */
const SOUND_KEY = 'shirma_sound_v1';
let soundOn = true;
try{ soundOn = localStorage.getItem(SOUND_KEY)!=='0'; }catch(e){}
let audioCtx = null;
function audioReady(){
  try{
    if(!soundOn) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }catch(e){ return null; }
}
function beep(freq, dur, type, vol, delay){
  try{
    const ctx=audioReady(); if(!ctx) return;
    const t0 = ctx.currentTime + (delay||0);
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type = type||'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol||0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0+dur+0.05);
  }catch(e){}
}
function playSound(name){
  if(!soundOn) return;
  if(name==='turn'){ beep(500,.08,'triangle'); beep(760,.11,'triangle',.05,.08); }
  else if(name==='crit'){ beep(660,.09,'square',.05); beep(880,.09,'square',.05,.09); beep(1320,.16,'square',.04,.18); }
  else if(name==='tick'){ beep(880,.04,'sine',.03); }
  else if(name==='round'){ beep(560,.09,'sine'); beep(560,.09,'sine',.06,.15); }
  else if(name==='ding'){ beep(980,.14,'sine'); beep(1470,.22,'sine',.05,.12); }
}
const soundBtn = document.getElementById('btnSound');
function soundBtnState(){ if(soundBtn){ soundBtn.textContent = soundOn?'🔔':'🔕'; soundBtn.title = soundOn?'Звуки включены (клик — выключить)':'Звуки выключены (клик — включить)'; } }
if(soundBtn) soundBtn.addEventListener('click', ()=>{
  soundOn=!soundOn;
  try{ localStorage.setItem(SOUND_KEY, soundOn?'1':'0'); }catch(e){}
  soundBtnState();
  toast(soundOn?'Звуки включены':'Звуки выключены');
});
soundBtnState();

/* ═══ Таймер боя: 1 раунд = 6 секунд ═══ */
let timerRunning=false, timerSeconds=0, timerInterval=null;
const timerBtn = document.getElementById('btnTimer');
const timerLbl = document.createElement('span');
timerLbl.className='hint'; timerLbl.id='timerLabel';
if(timerBtn && timerBtn.parentElement) timerBtn.parentElement.insertBefore(timerLbl, timerBtn.nextSibling);
function paintTimer(){
  const rounds=Math.floor(timerSeconds/6), s=timerSeconds%6;
  timerLbl.textContent = timerRunning
    ? `раунд ${rounds+1} · ${s}с`
    : (timerSeconds ? `таймер: ${timerSeconds}с (${rounds+1} раунд)` : '');
}
function timerToggle(){
  if(timerRunning){
    clearInterval(timerInterval); timerRunning=false;
    playSound('ding'); toast('Таймер остановлен');
  } else {
    audioReady();
    timerRunning=true;
    timerInterval=setInterval(()=>{
      timerSeconds++;
      const roundTick = timerSeconds%6===0;
      paintTimer();
      if(roundTick) playSound('round'); else playSound('tick');
    },1000);
    toast('Секундомер боя: 1 раунд = 6 секунд');
  }
  if(timerBtn) timerBtn.textContent = timerRunning?'⏹':'⏱ 6с';
  paintTimer();
}
if(timerBtn) timerBtn.addEventListener('click', timerToggle);

/* ════════════ Events ════════════ */
document.getElementById('addPc').addEventListener('click', ()=> addBlock('pc'));

/* ═══ Base rules D&D 5.5 ═══ */

document.getElementById('mediaInput').addEventListener('change', function(e){
  const files=Array.from(e.target.files||[]);
  files.forEach(f=> importFile(f));
  e.target.value='';
});
function importFile(file){
  const reader=new FileReader();
  const isImg=/^image\//i.test(file.type);
  reader.onload=()=>{
    const data=reader.result; // dataURL
    prepareCanvasForAdd();
    const b=makeBlock('img', file.name.replace(/\.[^.]+$/,'') || 'Файл');
    Object.assign(b, freeCascadePos());
    b.kind = isImg?'image':'doc';
    const key = 'media_'+b.id;
    mediaCache[key] = data;   // держим в памяти
    idbPut(key, data);        // и в IndexedDB (не в localStorage)
    b.dataKey = key;
    b.data = '';              // base64 в localStorage НЕ храним
    b.fileName = file.name;
    b.sizeLabel = file.size>1048576 ? (file.size/1048576).toFixed(1)+' МБ' : Math.ceil(file.size/1024)+' КБ';
    b.collapse = false;
    blocks.push(b);
    save(); render();
    document.getElementById('canvas').querySelector('[data-id="'+b.id+'"] .block-head')?.scrollIntoView({behavior:'smooth'});
  };
  reader.readAsDataURL(file);
}
function addBlock(type){
  prepareCanvasForAdd();
  const b=makeBlock(type, TYPE_LABEL[type]+' — новый');
  Object.assign(b, freeCascadePos());
  blocks.push(b);
  if(type==='pc'){
    Object.assign(b.props,{Класс:'',Раса:'',HP:10,'Броня КК':10,Инициат:'+0'});
    b.res=[{ name:'Вдохновение', cur:1, max:1 }];
  }
  save(); render();
}
const renderSearchDebounced = debounce(render, 180);
const searchEl=document.getElementById('search');
if(searchEl) searchEl.addEventListener('input', e=>{ searchFilter=e.target.value.trim(); renderSearchDebounced(); });

/* ═══ Local library search (ленивая загрузка library-data.js) ═══ */
let LIB = null;
let libLoadingPromise = null;
function ensureLibrary(){
  if(window.LIBRARY){ LIB=window.LIBRARY; return Promise.resolve(); }
  if(libLoadingPromise) return libLoadingPromise;
  libLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='library-data.js';
    s.onload=()=>{ LIB=window.LIBRARY || { spells:[], items:[] }; resolve(); };
    s.onerror=()=>{ libLoadingPromise=null; reject(new Error('не удалось загрузить library-data.js')); };
    document.head.appendChild(s);
  });
  return libLoadingPromise;
}
const RULES_FOR_LIB = BASE_RULES || [];
const libModal = document.getElementById('libModal');
const libSearch = document.getElementById('libSearch');
const libKind = document.getElementById('libKind');
const libResults = document.getElementById('libResults');

/* ═══ Модалки: единое закрытие с возвратом фокуса на кнопку-открыватель ═══ */
let modalOpener = null;
function openModal(m, opener){ modalOpener = opener || null; m.hidden = false; }
function closeModal(m){
  if(!m || m.hidden) return;
  m.hidden = true;
  if(modalOpener && document.contains(modalOpener)){ try{ modalOpener.focus(); }catch(e){} }
  modalOpener = null;
}

/* ═══ Bestiary (ленивая загрузка тяжёлого bestiary-data.js) ═══ */
let bestiaryLoadingPromise = null;
function ensureBestiary(){
  if(window.BESTIARY && window.BESTIARY.length) return Promise.resolve();
  if(bestiaryLoadingPromise) return bestiaryLoadingPromise;
  bestiaryLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='bestiary-data.js';
    s.onload=()=>resolve();
    s.onerror=()=>{ bestiaryLoadingPromise=null; reject(new Error('не удалось загрузить bestiary-data.js')); };
    document.head.appendChild(s);
  });
  return bestiaryLoadingPromise;
}
const bestModal = document.getElementById('bestModal');
const bestSearch = document.getElementById('bestSearch');
const bestResults = document.getElementById('bestResults');
const bestResultClose = document.getElementById('bestResultClose');
let bestState = { list:true, monster:null };
let bestAll = [];

let bestShowCount = 60;
function renderBestiary(){
  if(!bestState.list && bestState.monster){ renderBestMonster(bestState.monster); return; }
  const q = normalizeLib(bestSearch.value);
  let list;
  if(!q){ list = bestAll.slice(0, bestShowCount); }
  else{
    // при поиске НЕ трогаем bestShowCount — раньше он раздувался навсегда
    list = bestAll.filter(m => normalizeLib(m.n+' '+m.en+' '+m.type).includes(q));
  }
  if(!list.length){ bestResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  bestResultClose.style.display='none';
  bestResults.innerHTML = list.map(m=>`
    <div class="lib-row" data-type="librow" data-best="${m.id}" style="cursor:pointer">
      <span class="lib-kind k-rule">${escapeHtml(shortCr(m.cr))}</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(m.n)}</div>
        <div class="lib-meta">${escapeHtml(m.type)} · КД ${escapeHtml(m.ac)} · ХП ${escapeHtml(m.hp)}</div>
      </div>
      <span class="lib-add" title="Открыть">›</span>
    </div>`).join('');
  if(!q && bestShowCount < bestAll.length) bestResults.innerHTML += `<div class="lib-empty" style="text-align:center"><button id="bestMore" style="margin:auto">Показать ещё (${bestShowCount} / ${bestAll.length})</button></div>`;
  if(list.length){ /* bind */ bestResults.querySelectorAll('[data-best]').forEach(row=>{
    row.addEventListener('click', ()=>{
      const m = bestAll.find(x=>x.id==row.dataset.best);
      if(m){ bestState.list=false; bestState.monster=m; renderBestiary(); }
    });
  }); }
  const more=bestResults.querySelector('#bestMore');
  if(more) more.addEventListener('click', ()=>{ bestShowCount = Math.min(bestAll.length, bestShowCount+120); renderBestiary(); });
}
function shortCr(cr){ return str(cr).split(' ')[0]; }
function str(s){ return String(s||''); }
function safeArr(x){ return Array.isArray(x) ? x : []; }
function renderBestMonster(m){
  bestResultClose.style.display='inline-block';
  m = (m && typeof m === 'object') ? m : {};
  const ab = (typeof m.ab === 'string') ? m.ab : '';
  const acts = safeArr(m.acts);
  try {
  bestResults.innerHTML = `<div class="best-card">
    <div class="best-h">
      <span class="bh-name">${escapeHtml(m.n)}</span>
      <span class="bh-type">${escapeHtml(m.type)}</span>
    </div>
    ${m.img?`<div class="best-img"><img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.n)}" onerror="this.style.display='none'"></div>`:''}
    <div style="margin:8px 0">
      <button data-best-add="${m.id}" title="Добавить монстра как блок на ширму">＋ Добавить на ширму</button>
      <button data-best-token="${m.id}" title="Добавить токен на карту боя с инициативой и ХП">⬤ На карту боя</button>
      <span class="hint" style="margin-left:8px">Блок — во вкладке «Монстры», токен — на карте боя</span>
    </div>
    <div class="best-meta">
      <span class="tag"><b>Опасн.</b> ${escapeHtml(shortCr(m.cr))}</span>
      <span class="tag"><b>КД</b> ${escapeHtml(m.ac)}</span>
      <span class="tag"><b>ХП</b> ${escapeHtml(m.hp)}</span>
      <span class="tag"><b>Скорость</b> ${escapeHtml(m.sp)}</span>
      <span class="tag"><b>Иниц.</b> ${escapeHtml(m.init)}</span>
    </div>
    <div class="best-stats">
      ${ab.split(', ').map(si=>{
        const mm=si.match(/^\s*(\S+)\s+(\d+)\s+([+-]\d+)/);
        return `<div class="best-stat"><div class="l">${escapeHtml(mm?mm[1]:si)}</div><div class="v">${mm?mm[2]:''}</div><div class="v" style="font-size:11px;color:var(--muted)">${mm?mm[3]:''}</div></div>`;
      }).join('')}
    </div>
    ${m.sk?`<div class="best-meta"><span class="tag"><b>Навыки</b> ${escapeHtml(m.sk)}</span></div>`:''}
    ${m.sen?`<div class="best-meta"><span class="tag"><b>Чувства</b> ${escapeHtml(m.sen)}</span></div>`:''}
    ${m.lang?`<div class="best-meta"><span class="tag"><b>Языки</b> ${escapeHtml(m.lang)}</span></div>`:''}
    ${(acts.length)?`<div class="best-acts">
      ${acts.map(a=>{
        const txt = (typeof a==='string') ? a : (a && typeof a==='object' ? (a.text||'') : '');
        const tag = (a && typeof a==='object' && a.tag) ? a.tag : '';
        const {name, body}=splitAct(txt);
        return `<div class="act"><span class="an">${tag?escapeHtml(tag)+' — ':''}${escapeHtml(name)}.</span> ${escapeHtml(body)}</div>`;
      }).join('')}
    </div>`:''}
  </div>`;
  } catch(e){
    bestResults.innerHTML = `<div class="best-card"><div class="best-h"><span class="bh-name">${escapeHtml(m.n||'Монстр')}</span></div>
      <div class="hint">Не удалось полностью отобразить карточку: ${escapeHtml(String(e&&e.message||e))}</div>
      <button data-best-add="${m.id}" title="Добавить монстра как блок на ширму">＋ Добавить на ширму</button></div>`;
  }
  bestResults.querySelectorAll('[data-best-add]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=+btn.dataset.bestAdd;
      const mon = bestAll.find(x=>x.id===id);
      if(mon) addMonsterBlock(mon);
    });
  });
  bestResults.querySelectorAll('[data-best-token]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=+btn.dataset.bestToken;
      const mon = bestAll.find(x=>x.id===id);
      if(mon) addMarkerFromMonster(mon);
    });
  });
}
/* Монстр из бестиария → маркер на карте */
function addMarkerFromMonster(m){
  if(!m || m.id==null) return;
  const mp=curMap();
  if(mp){
    mp.markers.push({ id:'k'+Math.random().toString(36).slice(2,7),
      x: mp.baseW/2 + (mp.markers.length%4)*24, y: mp.baseH/2 + (mp.markers.length%4)*24,
      label: m.n||'Монстр', color:'#c0564f' });
    saveMap();
  }
  if(currentTab!=='map') showTab('map'); else renderMap();
  toast('Маркер «'+(m.n||'Монстр')+'» на карте');
}

function addMonsterBlock(m){
  prepareCanvasForAdd();
  const b=makeBlock('mob', '👹 '+m.n);
  Object.assign(b, freeCascadePos());
  b.props = {
    'Опасн.': shortCr(m.cr), 'КД': m.ac, 'ХП': m.hp,
    'Скорость': m.sp, 'Иниц.': m.init
  };
  // structured data for official stat block rendering
  b.mdata = {
    type: m.type, cr: m.cr, ac: m.ac, hp: m.hp, sp: m.sp, init: m.init,
    ab_list: m.ab_list||[], sk: m.sk||'', sen: m.sen||'', lang: m.lang||'',
    acts: m.acts||[]
  };
  const order=['Str','Dex','Con','Int','Wis','Cha'];
  b.stats = (m.ab_list&&m.ab_list.length)? m.ab_list.map(x=>x.v) : [10,10,10,10,10,10];
  b.text = '';
  blocks.push(b);
  save();
  // переключаемся на вкладку «Монстры», чтобы добавленный монстр был виден
  if(currentTab!=='monsters'){ showTab('monsters'); } else { render(); }
  // прокручиваем канвас к добавленному блоку
  setTimeout(()=>{
    const el=document.querySelector('#canvas [data-id="'+b.id+'"]');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 30);
  toast('Монстр «'+m.n+'» добавлен во вкладку «Монстры»');
}
bestResultClose.addEventListener('click', ()=>{ bestState.list=true; bestState.monster=null; renderBestiary(); });
document.getElementById('btnBestiary').addEventListener('click', ()=>{
  ensureBestiary().then(()=>{
    bestAll = (window.BESTIARY || []).slice();
    bestState = { list:true, monster:null };
    bestSearch.value='';
    bestShowCount = 60;
    openModal(bestModal, document.getElementById('btnBestiary'));
    renderBestiary();
  }).catch(err=>{
    openModal(bestModal, document.getElementById('btnBestiary'));
    bestResults.innerHTML = `<div class="lib-empty">Ошибка загрузки бестиария: ${escapeHtml(String(err.message||err))}. Проверьте, что файл bestiary-data.js лежит рядом с index.html.</div>`;
  });
});
document.getElementById('bestClose').addEventListener('click', ()=> closeModal(bestModal));
bestModal.addEventListener('click', e=>{ if(e.target===bestModal) closeModal(bestModal); });
const bestSearchDebounced = debounce(renderBestiary, 180);
bestSearch.addEventListener('input', ()=>{
  bestState.list=true; bestState.monster=null;
  if(!bestSearch.value.trim()) bestShowCount = 60;   // сброс раздутого счётчика при очистке поиска
  bestSearchDebounced();
});

document.getElementById('btnLibrary').addEventListener('click', ()=>{
  openModal(libModal, document.getElementById('btnLibrary'));
  ensureLibrary().then(()=>{
    libSearch.value='';
    libKind.value='all';
    libSearch.focus();
    renderLib();
  }).catch(err=>{
    libResults.innerHTML = `<div class="lib-empty">Ошибка загрузки библиотеки: ${escapeHtml(String(err.message||err))}. Проверьте, что файл library-data.js лежит рядом с index.html.</div>`;
  });
});
document.getElementById('libClose').addEventListener('click', ()=> closeModal(libModal));
libModal.addEventListener('click', e=>{ if(e.target===libModal) closeModal(libModal); });
const libSearchDebounced = debounce(renderLib, 180);
libSearch.addEventListener('input', ()=> libSearchDebounced());
libKind.addEventListener('change', ()=> renderLib());

function normalizeLib(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function renderLib(){
  const q = normalizeLib(libSearch.value);
  const kind = libKind.value;
  let rows=[];
  const inKind = k => kind==='all'||kind===k;
  const matchQ = t => !q || normalizeLib(t).includes(q);

  const spells=(LIB&&LIB.spells)||[], items=(LIB&&LIB.items)||[];
  if(inKind('spell')) spells.forEach(sp=>{ if(matchQ(sp.n+' '+sp.sc)) rows.push({kind:'spell', sp}); });
  if(inKind('item'))  items.forEach(it=>{ if(matchQ(it.n)) rows.push({kind:'item', it}); });
  if(inKind('rule'))  RULES_FOR_LIB.forEach(r=>{ if(matchQ(r.title+' '+r.text)) rows.push({kind:'rule', rule:r}); });

  if(!rows.length){ libResults.innerHTML=`<div class="lib-empty">Ничего не найдено. Попробуйте другое слово.</div>`; return; }

  const limit = 80;
  let html = rows.slice(0,limit).map((r,i)=>{
    const addBtn = `<span class="lib-add" data-add="${i}" title="Добавить на ширму">＋</span>`;
    if(r.kind==='spell'){
      const s=r.sp;
      const meta = `Ур.${s.l} · ${s.sc} · ${s.t} · ${s.r} · ${s.d}${s.c?' · '+s.c:''} · ${s.cls}`;
      return `<div class="lib-row" data-type="librow">
        <span class="lib-kind k-spell">Закл.</span>
        <div class="lib-main">
          <div class="lib-title">${escapeHtml(s.n)}</div>
          <div class="lib-meta">${escapeHtml(meta)}</div>
          ${s.desc?`<div class="lib-p">${escapeHtml(s.desc.slice(0,140))}${s.desc.length>140?'…':''}</div>`:''}
        </div>${addBtn}</div>`;
    }
    if(r.kind==='item'){
      const it=r.it;
      let meta = `${it.t}`;
      if(it.d1) meta += ` · Урон ${it.d1}` + (it.d2?`/${it.d2}`:'');
      if(it.v) meta += ` · ${it.v}`;
      if(it.w) meta += ` · ${it.w}`;
      if(it.p) meta += ` · ${it.p}`;
      return `<div class="lib-row" data-type="librow">
        <span class="lib-kind k-item">Предм.</span>
        <div class="lib-main">
          <div class="lib-title">${escapeHtml(it.n)}</div>
          <div class="lib-meta">${escapeHtml(meta)}</div>
        </div>${addBtn}</div>`;
    }
    const rl=r.rule;
    return `<div class="lib-row" data-type="librow">
      <span class="lib-kind k-rule">Прав.</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(rl.title)}</div>
        <div class="lib-p">${escapeHtml(String(rl.text||'').slice(0,120))}</div>
      </div>${addBtn}</div>`;
  }).join('');

  if(rows.length>limit) html += `<div class="lib-empty">…ещё ${rows.length-limit} результатов. Уточните запрос.</div>`;
  libResults.innerHTML = html;

  libResults.querySelectorAll('[data-add]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const idx=+btn.dataset.add;
      const r=rows[idx];
      if(r.kind==='spell') addSpellBlock(r.sp);
      else if(r.kind==='item') addItemBlock(r.it);
      else if(r.kind==='rule') addRuleBlock(r.rule);
    });
  });
}

/* ═══ Adding from library to canvas ═══ */
function addSpellBlock(s){
  const b=makeBlock('rule', '📜 '+s.n);
  let txt = `Уровень: ${s.l} (${s.sc})\nВремя: ${s.t}\nДистанция: ${s.r}\nДлительность: ${s.d}`;
  if(s.c) txt += `\n${s.c}`;
  if(s.cls) txt += `\nДоступно: ${s.cls}`;
  if(s.desc) txt += `\n\n—————\n${s.desc}`;
  b.text = txt;
  blocks.push(b);
  save(); render();
}
function addItemBlock(it){
  let txt = `Тип: ${it.t}`;
  if(it.d1) txt += `\nУрон: ${it.d1}` + (it.d2?` / ${it.d2}`:'') + (it.dt?' ('+it.dt+')':'');
  if(it.v) txt += `\nЦена: ${it.v}`;
  if(it.w) txt += `\nВес: ${it.w}`;
  if(it.p) txt += `\nСвойства: ${it.p}`;
  addRuleBlock({ title:'🎒 '+it.n, text:txt.trim() });
}
function addRuleBlock(r){
  const b=makeBlock('rule', r.title);
  b.text = r.text||'';
  blocks.push(b);
  save(); render();
}

/* ═══ Dice ═══ */
let currentDie='d20';
let rollHistory=[];
const dieSel=document.getElementById('dieSel');
const dieCustom=document.getElementById('dieCustom');
function resolveDie(){
  if(dieSel && dieSel.value==='custom'){
    const n=parseInt(dieCustom && dieCustom.value)||0;
    return n>=2 ? `d${n}` : null;
  }
  return dieSel ? `d${dieSel.value}` : currentDie;
}
function applyDieUI(){
  if(!dieSel) return;
  const custom = dieSel.value==='custom';
  if(dieCustom) dieCustom.style.display = custom ? '' : 'none';
  const d=resolveDie();
  currentDie = d || currentDie;
}
if(dieSel){
  dieSel.addEventListener('change', applyDieUI);
}
if(dieCustom){
  dieCustom.addEventListener('input', ()=>{ currentDie=resolveDie()||currentDie; });
}
document.getElementById('btnRoll').addEventListener('click', ()=>{
   doRoll(currentDie, parseInt(document.getElementById('dieCount').value)||1, null);
 });
 const btnRollShort=document.getElementById('btnRollShort');
 if(btnRollShort) btnRollShort.addEventListener('click', ()=>{
   doRoll(currentDie, parseInt(document.getElementById('dieCount').value)||1, null);
 });
function doRoll(die,count,modLabel){
  const n=parseInt(die.slice(1)); const cnt=count||1;
  const rolls=Array.from({length:cnt},()=>1+Math.floor(Math.random()*n));
  const sum=rolls.reduce((a,b)=>a+b,0);
  const label= ` (${rolls.join('+')})` + (modLabel?` ${modLabel}`:'');
  document.getElementById('rollResult').textContent = `${die}${cnt>1?`×${cnt}`:''} ➜ ${sum}`;
  document.getElementById('rollLog').textContent = label;
  rollHistory.push(`${die}${cnt>1?`×${cnt}`:''} = ${sum}${label}`);
  if(rollHistory.length>8) rollHistory.shift();
}
function doOneD20(){ return 1+Math.floor(Math.random()*20); }
document.getElementById('btnExport').addEventListener('click', ()=>{
  // собираем блобы медиа, на которые ссылаются блоки, фон карты и токены
  const media={};
  const collect=k=>{ if(k && mediaCache[k]) media[k]=mediaCache[k]; };
  blocks.forEach(b=> collect(b.dataKey));
  maps.forEach(m=>{ collect(m.bgKey); (m.markers||[]).forEach(k=> collect(k.imgKey)); });
  const payload={ version:2, exported:Date.now(), blocks, media };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='shirma-backup.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      let data=JSON.parse(r.result);
      let arr, media=null;
      if(Array.isArray(data)) arr=data;                                  // старый формат: просто массив блоков
      else if(data && Array.isArray(data.blocks)){ arr=data.blocks; media=data.media; } // v2: блоки + медиа
      else { alert('Неизвестный формат файла'); return; }
      arr = sanitizeBlocks(arr);
      if(!arr.length){ alert('В файле нет корректных блоков'); return; }
      pushUndo('импорт из файла');
      if(media && typeof media==='object'){
        Object.entries(media).forEach(([k,v])=>{
          if(typeof k==='string' && typeof v==='string' && /^data:/.test(v)){ mediaCache[k]=v; idbPut(k,v); }
        });
      }
      blocks=arr; collapsed=new Set(); activeParentId=null; save(); render();
      toast('Импортировано блоков: '+arr.length);
    }catch(err){ alert('Ошибка чтения файла'); }
  };
  r.readAsText(f); e.target.value='';
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  if(confirm('Перезаписать все данные демо-версией?')){ pushUndo('сброс к демо-данным'); seed(); }
});

/* ═══ Shop ═══ */
const SHOP = window.SHOP || [];
const shopModal = document.getElementById('shopModal');
const shopSearch = document.getElementById('shopSearch');
const shopCat = document.getElementById('shopCat');
const shopResults = document.getElementById('shopResults');

function shopCats(){
  const seen=[];
  SHOP.forEach(i=>{ if(!seen.includes(i.c)) seen.push(i.c); });
  return seen;
}
function renderShop(){
  const q = normalizeLib(shopSearch.value);
  const cat = shopCat.value;
  let list = SHOP.filter(i=>{
    if(cat!=='all' && i.c!==cat) return false;
    if(q && !normalizeLib(i.n+' '+i.c).includes(q)) return false;
    return true;
  });
  if(!list.length){ shopResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  const limit=100;
  shopResults.innerHTML = list.slice(0,limit).map(i=>`
    <div class="lib-row"><span class="lib-kind k-item">${escapeHtml(i.c.split(' ')[0])}</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(i.n)}</div>
        <div class="lib-meta">${escapeHtml(i.c)}${i.w?` · ${escapeHtml(i.w)}`:''}</div>
      </div>
      <span class="shop-price" style="color:var(--accent2); font-weight:700; align-self:center">${escapeHtml(i.v)}</span>
    </div>`).join('');
  if(list.length>limit) shopResults.innerHTML+=`<div class="lib-empty">…ещё ${list.length-limit} — уточните запрос.</div>`;
}
document.getElementById('btnShop').addEventListener('click', ()=>{
  const cats=shopCats();
  shopCat.innerHTML = '<option value="all">Все категории</option>'+cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  shopSearch.value=''; shopCat.value='all';
  openModal(shopModal, document.getElementById('btnShop')); renderShop();
});
document.getElementById('shopClose').addEventListener('click', ()=> closeModal(shopModal));
shopModal.addEventListener('click', e=>{ if(e.target===shopModal) closeModal(shopModal); });
const shopSearchDebounced = debounce(renderShop, 180);
shopSearch.addEventListener('input', ()=> shopSearchDebounced());
shopCat.addEventListener('change', renderShop);

/* ═══ Tabs ═══ */
let currentTab = 'chars';
let blocksTab = 'chars'; // 'chars' | 'monsters'
KEYS.tab = 'shirma_tab_last_v1';
const tabs = {
  chars: document.getElementById('view-chars'),
  sessions: document.getElementById('view-sessions'),
  map: document.getElementById('view-map'),
  battle: document.getElementById('view-battle'),
};
function showTab(name){
  currentTab = name;
  try{ localStorage.setItem(KEYS.tab, name); }catch(e){}
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
  tabs.chars.hidden = true;
  tabs.sessions.hidden = true;
  tabs.map.hidden = true;
  tabs.battle.hidden = true;
  if(name==='chars'||name==='monsters'){
    blocksTab = name;
    tabs.chars.hidden = false;
    render();
  } else if(name==='sessions'){
    tabs.sessions.hidden = false;
    ensureSessions();
  } else if(name==='map'){
    tabs.map.hidden = false;
    renderMap();
  } else if(name==='battle'){
    tabs.battle.hidden = false;
    renderBattle();
  }
  save();
}
document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> showTab(t.dataset.tab)));

/* ════════════ Карты ════════════ */
const STORE_MAP = KEYS.map;
const MAP_MAX_BYTES = 8*1024*1024;      // лимит размера файла карты
const MAP_ALLOWED = ['image/png','image/jpeg','image/webp'];
let maps = [];                 // {id,name,bgKey,bg,baseW,baseH,zoom,scrollX,scrollY,markers:[],draw:[]}
let activeMapId = null;
let mapLocked = false;
let mapPenOn = false;
let mapGridOn = true;   // сетка карты включена по умолчанию
let mapGridStep = 18;   // шаг сетки, px
let mapPlaceOn = false; // режим расстановки маркеров кликом
let selectedMarkerId = null;
let mapRulerOn = false;
let rulerPt = null;     // {x,y} точка начала измерения (в координатах карты)

function curMap(){ return maps.find(m=>m.id===activeMapId) || null; }
function loadMap(){
  const data = safeParseRaw(localStorage.getItem(STORE_MAP), 'shirma_map');
  if(Array.isArray(data) && data.length){ maps = data.map(normMap); }
  else if(data && typeof data==='object' && !Array.isArray(data)){
    // миграция старого формата {bg, tokens, zoom, scrollX, scrollY, locked, combat, concentration}
    maps = [{
      id: 'm'+Date.now().toString(36), name:'Карта 1',
      bgKey: data.bgKey||null, bg: data.bg||null,
      baseW: data.baseW||800, baseH: data.baseH||600,
      zoom: data.zoom||1, scrollX: data.scrollX||0, scrollY: data.scrollY||0,
      markers: (data.tokens||[]).map(t=>({ id:t.id||('k'+Math.random().toString(36).slice(2,7)),
        x:t.x, y:t.y, label:t.title||'Маркер', color:t.color||'#7fb3e6' })),
      draw: []
    }];
  } else { maps = []; }
  if(!maps.length){ maps=[{ id:'m'+Date.now().toString(36), name:'Карта 1', bgKey:null, bg:null,
      baseW:800, baseH:600, zoom:1, scrollX:0, scrollY:0, markers:[], draw:[] }]; }
  if(!activeMapId) activeMapId = maps[0].id;
  return true;
}
function normMap(m){
  return {
    id:String(m.id||('m'+Math.random().toString(36).slice(2,7))),
    name:String(m.name||'Карта').slice(0,40),
    bgKey:m.bgKey||null, bg:m.bg||null,
    baseW:Math.max(100, +m.baseW||800), baseH:Math.max(100, +m.baseH||600),
    zoom: (+m.zoom>0? +m.zoom : 1),
    scrollX:+m.scrollX||0, scrollY:+m.scrollY||0,
    markers: Array.isArray(m.markers)? m.markers.map(normMarker) : [],
    draw: Array.isArray(m.draw)? m.draw.map(normStroke) : []
  };
}
function normMarker(t){ return { id:String(t.id||('k'+Math.random().toString(36).slice(2,7))),
  x:+t.x||0, y:+t.y||0, label:String(t.label||'Маркер').slice(0,40), color:t.color||'#7fb3e6' }; }
function normStroke(s){ return { color:s.color||'#c9a227', width:+s.width||2,
  pts: Array.isArray(s.pts)? s.pts.map(p=>[+p[0],+p[1]]) : [] }; }

function saveMap(){ try{ localStorage.setItem(STORE_MAP, JSON.stringify(maps)); }catch(e){} }

function mapZoom(delta){
  if(mapLocked) return;
  const m=curMap(); if(!m) return;
  m.zoom = Math.min(4, Math.max(0.15, m.zoom + delta));
  renderMap();
}
function updateMapLockBtn(){
  const btn=document.getElementById('mapLock'); if(!btn) return;
  btn.textContent = mapLocked ? '🔒 Закреплено' : '🔓 Закрепить';
  btn.title = mapLocked ? 'Карта закреплена: масштаб и прокрутка заблокированы' : 'Закрепить карту в текущем положении';
}
function updateMapPenBtn(){
  const btn=document.getElementById('mapPen'); if(!btn) return;
  btn.textContent = mapPenOn ? '✏ Перо (рисует)' : '✏ Перо';
  btn.classList.toggle('active', !!mapPenOn);
  const clr=document.getElementById('mapPenClear'); if(clr) clr.hidden = !mapPenOn;
  const mc=document.getElementById('mapCanvas'); if(mc){
    const cv=mc.querySelector('canvas.map-draw');
    if(cv) cv.classList.toggle('drawing', !!mapPenOn);
  }
}

function renderMap(){
  const mc = document.getElementById('mapCanvas'); if(!mc) return;
  const m = curMap();
  renderMapTabs();
  mc.innerHTML='';
  if(!m){ return; }
  mc.classList.toggle('locked', !!mapLocked);
  mc.classList.toggle('no-grid', !mapGridOn);
  mc.style.setProperty('--grid-step', mapGridStep+'px');
  mc.scrollLeft = m.scrollX||0; mc.scrollTop = m.scrollY||0;
  const z = m.zoom;
  const wrapper=document.createElement('div');
  wrapper.className='map-zoom';
  wrapper.style.transform='scale('+z+')';
  wrapper.style.transformOrigin='0 0';
  wrapper.style.width=m.baseW+'px';
  wrapper.style.height=m.baseH+'px';
  mc.appendChild(wrapper);
  if(mapGridOn){
    const grid=document.createElement('div');
    grid.className='map-grid';
    wrapper.appendChild(grid);
  }
  // название карты
  const titleEl=document.createElement('div');
  titleEl.className='map-title';
  titleEl.textContent=m.name;
  titleEl.addEventListener('click', e=>{ e.stopPropagation(); renameMap(m.id); });
  wrapper.appendChild(titleEl);
  // линейка (визуал)
  if(mapRulerOn && rulerPt){
    const li=document.createElement('div'); li.className='map-ruler'; wrapper.appendChild(li);
  }
  const lbl=document.getElementById('mapZoomLabel'); if(lbl) lbl.textContent=Math.round(z*100)+'%';

  const bgSrc = (m.bgKey && mediaCache[m.bgKey]) || m.bg;
  if(bgSrc){
    mc.classList.add('has-bg');
    const img=document.createElement('img');
    img.className='map-bg';
    img.src=bgSrc; img.draggable=false;
    img.onload=()=>{ m.baseW=img.naturalWidth||m.baseW; m.baseH=img.naturalHeight||m.baseH;
      wrapper.style.width=m.baseW+'px'; wrapper.style.height=m.baseH+'px';
      fitCanvas(wrapper,m); };   // размеры обновляются после загрузки
    wrapper.appendChild(img);
  } else { mc.classList.remove('has-bg'); }

  // маркеры
  (m.markers||[]).forEach(k=>{
    const el=document.createElement('div');
    const sel = k.id===selectedMarkerId;
    el.className='map-marker'+(sel?' selected':'');
    el.style.left=percent(k.x,m.baseW)+'%'; el.style.top=percent(k.y,m.baseH)+'%';
    el.style.background=k.color||'#7fb3e6';
    el.dataset.id=k.id;
    el.title=k.label;
    const lbl2=document.createElement('div'); lbl2.className='map-marker-label'; lbl2.textContent=k.label;
    el.appendChild(lbl2);
    wrapper.appendChild(el);
    // клик — выбрать маркер (не перетаскивание)
    el.addEventListener('click', e=>{
      e.stopPropagation();
      selectedMarkerId = (selectedMarkerId===k.id)? null : k.id;
      renderMap();
    });
    // drag маркера
    el.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      if(mapPenOn) return;
      const sx=e.clientX, sy=e.clientY, ox=k.x, oy=k.y;
      pointerDrag(e, ev=>{
        k.x=Math.max(0,Math.min(m.baseW, ox + (ev.clientX-sx)/z));
        k.y=Math.max(0,Math.min(m.baseH, oy + (ev.clientY-sy)/z));
        el.style.left=percent(k.x,m.baseW)+'%'; el.style.top=percent(k.y,m.baseH)+'%';
      }, ()=>{ saveMap(); renderMap(); });
    });
  });
  // слой рисования
  const cv=document.createElement('canvas');
  cv.className='map-draw';
  wrapper.appendChild(cv);
  fitCanvas(wrapper,m);
  let ctx=cv.getContext('2d');
  drawStrokes(ctx,cv,m);
  bindDraw(cv,wrapper,m);
  updateMapLockBtn();
  updateMapPenBtn();
  // прокрутка после рендера
  requestAnimationFrame(()=>{ mc.scrollLeft=m.scrollX||0; mc.scrollTop=m.scrollY||0; });
}
function percent(v,total){ return (total>0? (v/total*100) : 0).toFixed(2); }
function fitCanvas(wrapper,m){
  const cv=wrapper.querySelector('canvas.map-draw'); if(!cv) return;
  const dpr=window.devicePixelRatio||1;
  cv.style.width='100%'; cv.style.height='100%';
  cv.width=Math.round(m.baseW*dpr); cv.height=Math.round(m.baseH*dpr);
}
function drawStrokes(ctx,cv,m){
  if(!ctx) return;
  const dpr=window.devicePixelRatio||1;
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.scale(dpr,dpr);
  ctx.lineCap='round'; ctx.lineJoin='round';
  (m.draw||[]).forEach(s=>{
    if(!s.pts || s.pts.length<2) return;
    ctx.strokeStyle=s.color||'#c9a227'; ctx.lineWidth=Math.max(0.5,+s.width||2);
    ctx.beginPath();
    s.pts.forEach((p,i)=>{ i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); });
    ctx.stroke();
  });
  ctx.restore();
}
function bindDraw(cv,wrapper,m){
  const dpr=window.devicePixelRatio||1;
  let drawing=false, curStroke=null, ctx=cv.getContext('2d');
  function toBase(e){
    const r=cv.getBoundingClientRect();
    return [ (e.clientX-r.left) * (m.baseW/r.width), (e.clientY-r.top) * (m.baseH/r.height) ];
  }
  cv.addEventListener('pointerdown', e=>{
    if(!mapPenOn) return;
    e.preventDefault(); cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
    drawing=true; curStroke={ color: markerColor(), width:2, pts:[toBase(e)] };
  });
  cv.addEventListener('pointermove', e=>{
    if(!drawing||!mapPenOn) return;
    e.preventDefault();
    const p=toBase(e); curStroke.pts.push(p);
    // отрисовка сразу
    const [x,y]=p, prev=curStroke.pts[curStroke.pts.length-2]||p;
    ctx.save(); ctx.scale(dpr,dpr); ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle=curStroke.color; ctx.lineWidth=curStroke.width;
    ctx.beginPath(); ctx.moveTo(prev[0],prev[1]); ctx.lineTo(x,y); ctx.stroke(); ctx.restore();
  });
  const end=()=>{ if(drawing){ drawing=false; if(curStroke&&curStroke.pts.length>1){ m.draw.push(curStroke); saveMap(); } curStroke=null; } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', end);
}
function markerColor(){
  // чередуем цвета маркеров/пера, чтобы новое было видно
  const m=curMap(); if(!m) return '#c9a227';
  const palette=['#c9a227','#7fb3e6','#c0564f','#86c48f','#c9a2e6','#e68a4a'];
  return palette[(m.draw&&m.draw.length) % palette.length];
}
function renderMapTabs(){
  const box=document.getElementById('mapTabs'); if(!box) return;
  box.innerHTML = maps.map(m=>`<span class="map-tab ${m.id===activeMapId?'active':''}" data-mid="${m.id}" title="${escapeHtml(m.name)}">
    <span class="mt-name">${escapeHtml(m.name)}</span>
    <button class="mt-del" data-md="${m.id}" title="Удалить карту" aria-label="Удалить карту">✕</button>
  </span>`).join('') + `<button class="map-tab add" id="mapAddTab" title="Добавить карту">＋</button>`;
  box.querySelectorAll('[data-mid]').forEach(el=> el.addEventListener('click', e=>{
    if(e.target.closest('.mt-del')) return;
    activeMapId=el.dataset.mid; saveMap(); renderMap();
  }));
  box.querySelectorAll('[data-md]').forEach(btn=> btn.addEventListener('click', e=>{
    e.stopPropagation();
    const id=btn.dataset.md; if(maps.length<=1){ toast('Карта одна — удалять не будем'); return; }
    if(!confirm('Удалить эту карту?')) return;
    const m=maps.find(x=>x.id===id);
    if(m&&m.bgKey){ idbDel(m.bgKey); delete mediaCache[m.bgKey]; }
    maps=maps.filter(x=>x.id!==id);
    if(activeMapId===id) activeMapId=maps[0].id;
    saveMap(); renderMap();
  }));
  const addTab=document.getElementById('mapAddTab');
  if(addTab) addTab.addEventListener('click', ()=> document.getElementById('mapFileInput').click());
}
function mapAddFromFile(file){
  if(!file) return;
  if(!MAP_ALLOWED.includes(file.type) && !/^image\//.test(file.type)){ toast('Нужен файл изображения (PNG/JPG/WebP)'); return; }
  if(file.size > MAP_MAX_BYTES){ toast('Карта слишком большая: до 8 МБ'); return; }
  const reader=new FileReader();
  reader.onload=()=>{
    const data=reader.result;
    const key='mapbg_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    mediaCache[key]=data; idbPut(key,data);
    const m={ id:'m'+Math.random().toString(36).slice(2,8), name:'Карта '+(maps.length+1),
      bgKey:key, bg:null, baseW:800, baseH:600, zoom:1, scrollX:0, scrollY:0, markers:[], draw:[] };
    // пробуем узнать размеры картинки
    const im=new Image(); im.onload=()=>{ m.baseW=im.naturalWidth||800; m.baseH=im.naturalHeight||600; saveMap(); renderMap(); };
    im.src=data;
    maps.push(m); activeMapId=m.id;
    saveMap(); renderMap();
    toast('Карта «'+m.name+'» добавлена');
  };
  reader.readAsDataURL(file);
}
function addMapMarker(){
  // включить/выключить режим расстановки маркеров кликом
  mapPlaceOn = !mapPlaceOn;
  const hint=document.getElementById('mapPlaceHint'); if(hint) hint.hidden = !mapPlaceOn;
  const btn=document.getElementById('mapAddMarker'); if(btn) btn.classList.toggle('active', !!mapPlaceOn);
  if(mapPlaceOn) toast('Кликните по карте, чтобы поставить маркер');
}
function placeMarkerAt(x,y){
  const m=curMap(); if(!m) return;
  const label=prompt('Подпись маркера:','Маркер'); if(label===null) return;
  m.markers.push({ id:'k'+Math.random().toString(36).slice(2,7), x:x, y:y,
    label:(label.trim()||'Маркер').slice(0,40), color:'#7fb3e6' });
  saveMap(); renderMap();
}
function renameMap(id){
  const m=maps.find(x=>x.id===id); if(!m) return;
  const t=prompt('Название карты:',m.name); if(t===null) return;
  m.name=(t.trim()||'Карта').slice(0,40); saveMap(); renderMap();
}
function mapRulerToggle(){
  mapRulerOn=!mapRulerOn; rulerPt=null;
  const b=document.getElementById('mapRuler'); if(b) b.classList.toggle('active', !!mapRulerOn);
  const l=document.getElementById('mapRulerLabel'); if(l){ l.hidden=!mapRulerOn; l.textContent=mapRulerOn?'Клик №1…':''; }
}
function mapDuplicate(){
  const m=curMap(); if(!m) return;
  const cp=normMap({ id:'m'+Math.random().toString(36).slice(2,8), name:(m.name||'Карта')+' (копия)',
    bgKey:m.bgKey, bg:m.bg, baseW:m.baseW, baseH:m.baseH, zoom:m.zoom, scrollX:m.scrollX, scrollY:m.scrollY,
    markers:m.markers.map(k=>({...k,id:'k'+Math.random().toString(36).slice(2,7)})),
    draw:m.draw.map(s=>({color:s.color,width:s.width,pts:s.pts.map(p=>[p[0],p[1]])})) });
  maps.push(cp); activeMapId=cp.id; saveMap(); renderMap(); toast('Карта дублирована');
}
function mapSnapPNG(){
  const m=curMap(); if(!m) return;
  const cv=document.createElement('canvas'); cv.width=m.baseW; cv.height=m.baseH;
  const ctx=cv.getContext('2d');
  if(m.bgKey&&mediaCache[m.bgKey]){ const im=new Image(); im.onload=()=>{ drawSnap(im); }; im.src=mediaCache[m.bgKey]; }
  else drawSnap(null);
  function drawSnap(bg){
    if(bg) ctx.drawImage(bg,0,0,cv.width,cv.height);
    (m.draw||[]).forEach(s=>{ if(!s.pts||s.pts.length<2) return; ctx.strokeStyle=s.color; ctx.lineWidth=s.width; ctx.lineCap='round';
      ctx.beginPath(); s.pts.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke(); });
    (m.markers||[]).forEach(k=>{ ctx.beginPath(); ctx.fillStyle=k.color; ctx.arc(k.x,k.y,10,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke(); });
    const a=document.createElement('a'); a.href=cv.toDataURL('image/png'); a.download=(m.name||'карта')+'.png';
    document.body.appendChild(a); a.click(); a.remove(); toast('Карта сохранена в PNG');
  }
}
function mapClearDraw(){
  const m=curMap(); if(!m) return;
  if(m.draw.length && confirm('Стереть нарисованное с карты?')){ m.draw=[]; saveMap(); renderMap(); }
}

/* ── обработчики карты ── */
{ const fi=document.getElementById('mapFileInput');
  if(fi) fi.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if(f) mapAddFromFile(f); e.target.value=''; });
  const add=document.getElementById('mapAdd'); if(add) add.addEventListener('click', ()=> fi&&fi.click());
  const zl=document.getElementById('mapZoomReset');
  if(zl) zl.addEventListener('click', ()=>{ if(mapLocked) return; const m=curMap(); if(m){ m.zoom=1; renderMap(); } });
  document.getElementById('mapZoomIn')&&document.getElementById('mapZoomIn').addEventListener('click', ()=> mapZoom(0.15));
  document.getElementById('mapZoomOut')&&document.getElementById('mapZoomOut').addEventListener('click', ()=> mapZoom(-0.15));
  document.getElementById('mapLock')&&document.getElementById('mapLock').addEventListener('click', ()=>{
    mapLocked=!mapLocked;
    const mc=document.getElementById('mapCanvas');
    if(mc){ const m=curMap(); if(m){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; } }
    renderMap();
  });
  document.getElementById('mapAddMarker')&&document.getElementById('mapAddMarker').addEventListener('click', addMapMarker);
  const gridBtn=document.getElementById('mapGrid');
  if(gridBtn){
    function updateGrid(){ gridBtn.classList.toggle('active', !!mapGridOn); }
    gridBtn.addEventListener('click', ()=>{ mapGridOn=!mapGridOn; saveMap(); renderMap(); updateGrid(); });
    updateGrid();
  }
  const stepSel=document.getElementById('mapGridStep');
  if(stepSel){
    stepSel.value = String(mapGridStep);
    stepSel.addEventListener('change', ()=>{ mapGridStep=parseInt(stepSel.value,10)||18; saveMap(); renderMap(); });
  }
  const pen=document.getElementById('mapPen'); if(pen) pen.addEventListener('click', ()=>{ mapPenOn=!mapPenOn; updateMapPenBtn(); });
  document.getElementById('mapRuler')&&document.getElementById('mapRuler').addEventListener('click', mapRulerToggle);
  document.getElementById('mapDup')&&document.getElementById('mapDup').addEventListener('click', mapDuplicate);
  document.getElementById('mapSnap')&&document.getElementById('mapSnap').addEventListener('click', mapSnapPNG);
  document.getElementById('mapPenClear')&&document.getElementById('mapPenClear').addEventListener('click', mapClearDraw);
  const mc=document.getElementById('mapCanvas');
  if(mc){
    mc.addEventListener('scroll', ()=>{
      const m=curMap(); if(!m||mapLocked) return; m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; saveMap();
    });
    mc.addEventListener('wheel', e=>{ e.preventDefault(); if(!mapLocked) mapZoom(e.deltaY<0?0.1:-0.1); }, { passive:false });
    // панорама: тащим пустое место карты мышью
    mc.addEventListener('mousedown', e=>{
      if(mapLocked||mapPenOn) return;
      if(e.target.closest('.map-marker')||e.target.closest('.map-draw')) return;
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, sl=mc.scrollLeft, st=mc.scrollTop;
      let moved=false;
      pointerDrag(e, ev=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(dx||dy) moved=true;
        mc.scrollLeft=sl-dx; mc.scrollTop=st-dy;
      }, ()=>{
        if(moved){ const m=curMap(); if(m){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; saveMap(); } }
      });
    });
  }
  // клик по карте: расстановка маркера (режим placement)
  { const MC=document.getElementById('mapCanvas');
    if(MC){
      MC.addEventListener('click', e=>{
        if(e.target.closest('.map-marker')) return; // выбор маркера — в самом маркере
        const m=curMap(); if(!m) return;
        const w=MC.querySelector('.map-zoom'); if(!w) return;
        const r=w.getBoundingClientRect();
        const z=m.zoom||1;
        const x=(e.clientX-r.left)/z, y=(e.clientY-r.top)/z;
        if(x<0||y<0||x>m.baseW||y>m.baseH) return;
        if(mapRulerOn){
          if(!rulerPt){ rulerPt={x:x,y:y}; const l=document.getElementById('mapRulerLabel'); if(l) l.textContent='Клик №2 — конец измерения'; }
          else{
            const dist=Math.round(Math.hypot(x-rulerPt.x, y-rulerPt.y) / (mapGridStep||18) * 10)/10;
            const l=document.getElementById('mapRulerLabel'); if(l){ l.hidden=true; l.textContent=''; }
            toast('Расстояние: '+dist+' клеток');
            rulerPt=null; renderMap();
          }
          return;
        }
        if(mapPlaceOn){ placeMarkerAt(x,y); return; }
        if(selectedMarkerId){ selectedMarkerId=null; renderMap(); }
      });
    }
    // панель управления выбранным маркером
    const ctl=document.getElementById('markerCtl');
    function updateMarkerCtl(){
      if(!ctl) return;
      const m=curMap();
      const k = m && selectedMarkerId ? m.markers.find(x=>x.id===selectedMarkerId) : null;
      ctl.classList.toggle('hidden', !k);
      const nm=document.getElementById('markerName'); if(nm) nm.textContent=k?k.label:'';
    }
    function deselect(){ selectedMarkerId=null; renderMap(); updateMarkerCtl(); }
    document.getElementById('markerRename')&&document.getElementById('markerRename').addEventListener('click', ()=>{
      const m=curMap(); const k=m&&selectedMarkerId?m.markers.find(x=>x.id===selectedMarkerId):null; if(!k) return;
      const t=prompt('Имя маркера:',k.label); if(t===null) return; k.label=(t.trim()||'Маркер').slice(0,40); saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerColor')&&document.getElementById('markerColor').addEventListener('click', ()=>{
      const palette=['#7fb3e6','#c0564f','#86c48f','#c9a227','#c9a2e6','#e68a4a','#6ac4c9'];
      const m=curMap(); const k=m&&selectedMarkerId?m.markers.find(x=>x.id===selectedMarkerId):null; if(!k) return;
      const i=palette.indexOf(k.color); k.color=palette[(i+1)%palette.length]; saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerDel')&&document.getElementById('markerDel').addEventListener('click', ()=>{
      const m=curMap(); if(!m||!selectedMarkerId) return; if(!confirm('Удалить маркер?')) return;
      m.markers=m.markers.filter(x=>x.id!==selectedMarkerId); selectedMarkerId=null; saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerDone')&&document.getElementById('markerDone').addEventListener('click', deselect);
    window.updateMapMarkerCtl=updateMarkerCtl;
  }
}

/* ════════════ Random tables ════════════ */

const tablesModal = document.getElementById('tablesModal');
const tablesSelect = document.getElementById('tablesSelect');
const tablesResult = document.getElementById('tablesResult');
function fillTableSelect(){
  tablesSelect.innerHTML = Object.keys(RANDOM_TABLES).map((k,i)=>`<option value="${i}">${escapeHtml(k)}</option>`).join('');
}
document.getElementById('btnTables').addEventListener('click', ()=>{
  fillTableSelect();
  tablesResult.innerHTML = '<div class="lib-empty">Выберите таблицу и бросьте кость.</div>';
  openModal(tablesModal, document.getElementById('btnTables'));
});
document.getElementById('tablesClose').addEventListener('click', ()=> closeModal(tablesModal));
tablesModal.addEventListener('click', e=>{ if(e.target===tablesModal) closeModal(tablesModal); });
/* Esc закрывает любое открытое окно */
window.addEventListener('keydown', e=>{
  if(e.key!=='Escape') return;
  [libModal, bestModal, shopModal, tablesModal, goModalOrNull()].forEach(m=> closeModal(m));
});
/* ═══ Глобальный поиск (Ctrl+K / Cmd+K) ═══ */
let goModalRef = document.getElementById('goModal');
function goModalOrNull(){ return goModalRef; }
const goInput = document.getElementById('goInput');
const goResults = document.getElementById('goResults');
const goClose = document.getElementById('goClose');

function renderGo(qRaw){
  if(!goResults) return;
  const q = normalizeLib(qRaw||'');
  if(!q){ goResults.innerHTML='<div class="lib-empty">Начните вводить: блоки, монстры, заклинания, предметы, правила.</div>'; return; }
  const LIMIT=60, rows=[];
  const hit = t => normalizeLib(t).includes(q);
  const push = r => { if(rows.length<LIMIT) rows.push(r); };
  blocks.forEach(b=>{ if(hit((b.title||'')+' '+(b.text||'')+' '+Object.values(b.props||{}).join(' '))) push({kind:'block',label:b.title||'Блок',meta:TYPE_LABEL[b.type]||'',b}); });
  (bestAll||[]).forEach(m=>{ if(hit((m.n||'')+' '+(m.en||'')+' '+(m.type||''))) push({kind:'monster',label:'👹 '+(m.n||''),meta:m.type||'',mon:m}); });
  ((LIB&&LIB.spells)||[]).forEach(sp=>{ if(hit((sp.n||'')+' '+(sp.sc||'')+' '+(sp.cls||''))) push({kind:'spell',label:'📜 '+sp.n,meta:(sp.l!==undefined?('Ур.'+sp.l+' · '):'')+(sp.sc||''),sp}); });
  ((LIB&&LIB.items)||[]).forEach(it=>{ if(hit(it.n||'')) push({kind:'item',label:'🎒 '+it.n,meta:it.t||'',it}); });
  RULES_FOR_LIB.forEach(r=>{ if(hit((r.title||'')+' '+(r.text||''))) push({kind:'rule',label:r.title,meta:'Правила',rule:r}); });
  if(!rows.length){ goResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  const badge={block:'Блок',monster:'Монстр',spell:'Закл.',item:'Предм.',rule:'Прав.'};
  goResults.innerHTML = rows.map((r,i)=>`<div class="lib-row go-row" data-go="${i}">
    <span class="lib-kind">${badge[r.kind]||''}</span>
    <div class="lib-main"><div class="lib-title">${escapeHtml(r.label)}</div>${r.meta?`<div class="lib-meta">${escapeHtml(r.meta)}</div>`:''}</div>
  </div>`).join('');
  goResults.querySelectorAll('[data-go]').forEach(el=> el.addEventListener('click', ()=>{
    const r=rows[+el.dataset.go]; if(!r) return;
    runGoAction(r); closeModal(goModalRef);
  }));
}
function runGoAction(r){
  if(r.kind==='block'){
    const b=r.b;
    searchFilter = b.title||'';
    const s=document.getElementById('search'); if(s) s.value=searchFilter;
    showTab(b.type==='mob'?'monsters':'chars');
    toast('Найдено на ширме: '+(b.title||'блок'));
  } else if(r.kind==='monster'){ addMonsterBlock(r.mon); toast('Монстр добавлен на ширму'); }
  else if(r.kind==='spell'){ addSpellBlock(r.sp); toast('Заклинание добавлено на ширму'); }
  else if(r.kind==='item'){ addItemBlock(r.it); toast('Предмет добавлен на ширму'); }
  else if(r.kind==='rule'){ addRuleBlock(r.rule); toast('Правило добавлено на ширму'); }
}
function openGo(){
  if(!goModalRef) return;
  openModal(goModalRef, document.activeElement);
  if(goInput){ goInput.value=''; goInput.focus(); }
  renderGo('');
  ensureBestiary().then(()=>{ if(!bestAll.length) bestAll=(window.BESTIARY||[]).slice(); renderGo(goInput?goInput.value:''); }).catch(()=>{});
  ensureLibrary().then(()=> renderGo(goInput?goInput.value:'')).catch(()=>{});
}
if(goClose) goClose.addEventListener('click', ()=> closeModal(goModalRef));
if(goInput){
  const renderGoDebounced = debounce(()=> renderGo(goInput.value), 140);
  goInput.addEventListener('input', renderGoDebounced);
  goInput.addEventListener('keydown', e=>{
    if(e.key==='Enter' && goResults){ const first=goResults.querySelector('[data-go]'); if(first) first.click(); }
  });
}
window.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='k'){ e.preventDefault(); openGo(); }
});
document.getElementById('tablesRoll').addEventListener('click', ()=>{
  const key = Object.keys(RANDOM_TABLES)[+tablesSelect.value];
  const list = RANDOM_TABLES[key];
  const roll = 1 + Math.floor(Math.random()*list.length);
  const val = list[roll-1];
  tablesResult.innerHTML = `<div class="lib-row"><span class="lib-kind k-rule">d${list.length}</span>
    <div class="lib-main">
      <div class="lib-meta">${escapeHtml(key)} · бросок: ${roll}</div>
      <div class="lib-title" style="margin-top:6px; font-size:15px">${escapeHtml(val)}</div>
    </div></div>`;
});

/* ════════════ Сессии (редактор в стиле Obsidian) ════════════ */
const STORE_SESSIONS = KEYS.sessions;
let sessions = [];
let activeSessionId = null;
let sessionsInited = false;

function loadSessions(){
  const data = safeParseRaw(localStorage.getItem(STORE_SESSIONS), 'shirma_sessions');
  if(Array.isArray(data)){ sessions=data; return sessions.length>0; }
  sessions=[]; return false;
}
/* Резервная копия сессий в IndexedDB (не ограничена квотой localStorage) */
const SESS_IDB_KEY = 'sess_backup_v1';
function sessionsFromIdb(){
  const raw = mediaCache[SESS_IDB_KEY];
  if(raw==null) return null;
  try{
    const arr = JSON.parse(typeof raw==='string' ? raw : String(raw));
    return (Array.isArray(arr) && arr.length) ? arr : null;
  }catch(e){ return null; }
}
const persistSessions = debounce(()=>{
  try{
    const out=sessions.map(s=>({...s, html:stripSessionHtml(s.html)}));
    const str=JSON.stringify(out);
    try{ localStorage.setItem(STORE_SESSIONS, str); }catch(e){ console.warn('Сессии не влезли в localStorage — храним в IndexedDB'); }
    idbPut(SESS_IDB_KEY, str); // всегда дублируем в IndexedDB
  }catch(e){ console.warn('Не удалось сохранить сессии:', e); }
}, 300);
function scheduleSaveSessions(){
  persistSessions();
  const el=document.getElementById('sessionSaved');
  if(el){ el.textContent='Сохранение…'; setTimeout(()=>{ if(el) el.textContent='Сохранено'; }, 350); }
}
function findSession(id){ return sessions.find(s=>s.id===id); }
function stripSessionHtml(html){
  if(!html) return html||'';
  const d=document.createElement('div'); d.innerHTML=html;
  d.querySelectorAll('img[data-mkey]').forEach(img=> img.removeAttribute('src'));
  return d.innerHTML;
}
function hydrateSessionHtml(html){
  if(!html) return html||'';
  const d=document.createElement('div'); d.innerHTML=html;
  let changed=false;
  d.querySelectorAll('img[data-mkey]').forEach(img=>{
    const k=img.getAttribute('data-mkey');
    const src=(k && mediaCache[k]) || '';
    if(src){ img.setAttribute('src',src); changed=true; }
  });
  return changed ? d.innerHTML : (html||'');
}

function ensureSessions(){
  if(!sessionsInited){
    sessionsInited = true;
    if(!loadSessions()){
      const backup = sessionsFromIdb();         // localStorage пуст/не влез — пробуем IndexedDB
      if(backup){ sessions=backup; toast('Сессии восстановлены из резервной копии'); }
    }
    bindSessionControls();
    if(!sessions.length){ newSession(true); }
    else { renderSessionsList(); selectSession(sessions[0].id); }
  } else {
    renderSessionsList();
  }
}
function renderSessionsList(){
  const box=document.getElementById('sessionsList');
  if(!box) return;
  if(!sessions.length){ box.innerHTML='<div class="hint" style="padding:8px">Нет сессий</div>'; return; }
  box.innerHTML = sessions.map(s=>{
    const date = s.updated ? new Date(s.updated).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="session-item ${s.id===activeSessionId?'active':''}" data-sid="${s.id}">
      <div class="si-title">${escapeHtml(s.title||'Без названия')}</div>
      <div class="si-date">${date}</div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-sid]').forEach(el=> el.addEventListener('click', ()=> selectSession(el.dataset.sid)));
}
function selectSession(id){
  const s=findSession(id); if(!s) return;
  activeSessionId=id;
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  if(titleEl) titleEl.value = s.title||'';
  if(ed) ed.innerHTML = hydrateSessionHtml(s.html||'');
  const sv=document.getElementById('sessionSaved'); if(sv) sv.textContent='';
  renderSessionsList();
}
function newSession(silent){
  const now=Date.now();
  const s={ id:'s'+now.toString(36)+Math.random().toString(36).slice(2,6), title:'Сессия '+new Date(now).toLocaleDateString('ru-RU'), html:'', updated:now };
  sessions.unshift(s);
  persistSessions();
  activeSessionId=s.id;
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  if(titleEl) titleEl.value=s.title;
  if(ed) ed.innerHTML='';
  renderSessionsList();
  if(!silent){ scheduleSaveSessions(); }
}
function bindSessionControls(){
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  const delBtn=document.getElementById('sessionDelete');
  const newBtn=document.getElementById('sessionNew');
  if(newBtn) newBtn.addEventListener('click', ()=> newSession());
  if(titleEl) titleEl.addEventListener('input', ()=>{
    const s=findSession(activeSessionId); if(!s) return;
    s.title=titleEl.value; s.updated=Date.now(); scheduleSaveSessions(); renderSessionsList();
  });
  if(ed) ed.addEventListener('input', ()=>{
    const s=findSession(activeSessionId); if(!s){ return; }
    s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions();
  });
  if(delBtn) delBtn.addEventListener('click', ()=>{
    if(!activeSessionId) return;
    if(!confirm('Удалить эту сессию?')) return;
    pushUndo('удаление сессии');
    sessions = sessions.filter(s=>s.id!==activeSessionId);
    persistSessions();
    if(sessions.length){ selectSession(sessions[0].id); } else { activeSessionId=null; const t=document.getElementById('sessionTitle'); const e=document.getElementById('sessionEditor'); if(t)t.value=''; if(e)e.innerHTML=''; renderSessionsList(); }
  });
  const mdBtn=document.getElementById('sessionExportMd');
  const pdfBtn=document.getElementById('sessionExportPdf');
  if(mdBtn) mdBtn.addEventListener('click', exportSessionMd);
  if(pdfBtn) pdfBtn.addEventListener('click', exportSessionPdf);
  bindSessionToolbar();
}
function bindSessionToolbar(){
  const bar=document.getElementById('sessionToolbar');
  const ed=document.getElementById('sessionEditor');
  if(!bar || !ed) return;
  // mousedown с preventDefault — чтобы не терять выделение в редакторе
  bar.addEventListener('mousedown', e=>{ if(e.target.closest('button')) e.preventDefault(); });
  bar.querySelectorAll('[data-cmd]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      try{ document.execCommand(btn.dataset.cmd, false, null); }catch(e){}
      afterEdit();
    });
  });
  bar.querySelectorAll('[data-block]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      const tag=btn.dataset.block;
      try{ document.execCommand('formatBlock', false, tag); }catch(e){}
      afterEdit();
    });
  });
  bar.querySelectorAll('[data-link]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      const url=prompt('Адрес ссылки (URL):','https://'); if(!url) return;
      try{ document.execCommand('createLink', false, url); }catch(e){}
      afterEdit();
    });
  });
  // вставка картинки: кнопка → выбор файла
  const imgBtn=document.getElementById('sessionImgBtn');
  const imgInput=document.getElementById('sessionImgInput');
  if(imgBtn && imgInput){
    imgBtn.addEventListener('click', ()=> imgInput.click());
    imgInput.addEventListener('change', e=>{
      const f=e.target.files && e.target.files[0];
      if(f) insertImageIntoSession(f);
      e.target.value='';
      afterEdit();
    });
  }
  // вставка из буфера обмена (Ctrl+V)
  ed.addEventListener('paste', e=>{
    const items=e.clipboardData && e.clipboardData.items;
    if(!items) return;
    for(const it of items){
      if(it.type && it.type.indexOf('image')===0){
        const f=it.getAsFile();
        if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
        return;
      }
    }
  });
  // перетаскивание файла в редактор
  ed.addEventListener('drop', e=>{
    const dt=e.dataTransfer; if(!dt) return;
    const f=[...(dt.files||[])].find(x=>/^image\//.test(x.type));
    if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
  });
  function afterEdit(){
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions(); }
  }
}

function insertImageIntoSession(file){
  if(!file || !/^image\//.test(file.type)) return;
  const ed=document.getElementById('sessionEditor'); if(!ed) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const data=reader.result;
    const key='sessimg_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    mediaCache[key]=data; idbPut(key,data);
    const img=document.createElement('img');
    img.setAttribute('src',data);
    img.setAttribute('data-mkey',key);
    img.setAttribute('alt','');
    const sel=window.getSelection();
    let inserted=false;
    if(sel && sel.rangeCount){
      const range=sel.getRangeAt(0);
      if(ed.contains(range.commonAncestorContainer)){
        range.deleteContents(); range.insertNode(img);
        const after=document.createRange(); after.setStartAfter(img); after.collapse(true);
        sel.removeAllRanges(); sel.addRange(after); inserted=true;
      }
    }
    if(!inserted) ed.appendChild(img);
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions(); }
  };
  reader.readAsDataURL(file);
}

/* ════════════ Экспорт сессии в Markdown / PDF ════════════ */
function htmlToMarkdown(html){
  const root=document.createElement('div'); root.innerHTML=html||'';
  function esc(s){ return s; }
  function walk(node){
    if(node.nodeType===3) return node.nodeValue;
    if(node.nodeType!==1) return '';
    const tag=node.nodeName.toLowerCase();
    const inner=Array.from(node.childNodes).map(walk).join('');
    switch(tag){
      case 'h1': return '\n# '+inner.trim()+'\n';
      case 'h2': return '\n## '+inner.trim()+'\n';
      case 'h3': return '\n### '+inner.trim()+'\n';
      case 'h4': return '\n#### '+inner.trim()+'\n';
      case 'strong': case 'b': return '**'+inner+'**';
      case 'em': case 'i': return '_'+inner+'_';
      case 's': case 'strike': case 'del': return '~~'+inner+'~~';
      case 'u': return inner;
      case 'code': return '`'+inner+'`';
      case 'pre': return '\n```\n'+node.textContent.replace(/\n+$/,'')+'\n```\n';
      case 'blockquote': return '\n> '+inner.trim().replace(/\n/g,'\n> ')+'\n';
      case 'a': return '['+inner+']('+(node.getAttribute('href')||'')+')';
      case 'img': return '!['+(node.getAttribute('alt')||'')+']('+(node.getAttribute('src')||'')+')';
      case 'ul': return '\n'+Array.from(node.children).map(li=>'- '+li.textContent.trim()).join('\n')+'\n';
      case 'ol': return '\n'+Array.from(node.children).map((li,i)=>(i+1)+'. '+li.textContent.trim()).join('\n')+'\n';
      case 'li': return inner;
      case 'br': return '\n';
      case 'hr': return '\n---\n';
      case 'p': case 'div': return '\n'+inner+'\n';
      default: return inner;
    }
  }
  let md=walk(root);
  md=md.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return md;
}
function downloadFile(name, content, mime){
  const blob=new Blob([content],{type:mime||'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function safeFileName(name){ return String(name||'session').replace(/[\/\\:*?"<>|]+/g,'_').slice(0,80); }
function exportSessionMd(){
  const s=findSession(activeSessionId); if(!s){ alert('Нет активной сессии'); return; }
  const md='# '+(s.title||'Сессия')+'\n\n'+htmlToMarkdown(hydrateSessionHtml(s.html||''));
  downloadFile(safeFileName(s.title)+'.md', md, 'text/markdown;charset=utf-8');
}
function exportSessionPdf(){
  const s=findSession(activeSessionId); if(!s){ alert('Нет активной сессии'); return; }
  const bodyHtml=hydrateSessionHtml(s.html||'');
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(s.title||'Сессия')}</title>
    <style>
      body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 20px;line-height:1.6;font-size:14px}
      h1{font-size:24px;margin:0 0 14px}h2{font-size:19px}h3{font-size:16px}
      blockquote{border-left:3px solid #999;margin:10px 0;padding:4px 12px;color:#555}
      pre{background:#f4f4f4;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px}
      code{background:#f4f4f4;padding:1px 4px;border-radius:3px}
      a{color:#1155cc} img{max-width:100%}
    </style></head><body><h1>${escapeHtml(s.title||'Сессия')}</h1>${bodyHtml}</body></html>`;
  const frame=document.createElement('iframe');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc=frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch(e){ alert('Не удалось открыть печать: '+e.message); }
    setTimeout(()=>frame.remove(), 1500);
  }, 400);
}

/* ════════════ Вкладка «Бой» ════════════ */
const STORE_BATTLE = 'shirma_battle_v1';
let battleParts = [];   // {id,name,side:'opp'|'char',ac,hp,init}

function loadBattle(){
  const data = safeParseRaw(localStorage.getItem(STORE_BATTLE), 'shirma_battle');
  if(Array.isArray(data) && data.length){
    battleParts = data.map(p=>({ id:String(p.id||uniq()), name:String(p.name||'Участник').slice(0,60),
      side: p.side==='char'?'char':'opp', ac: numField(p.ac), hp: numField(p.hp), init: numField(p.init),
      atk: p.atk===undefined ? '' : numField(p.atk),
      acts: Array.isArray(p.acts) ? p.acts.slice(0,40).map(a=>({tag:String(a.tag||''),text:String(a.text||'')})) : [],
      applied: Array.isArray(p.applied) ? p.applied.slice(0,40).map(x=>String(x)) : [] }));
    return true;
  }
  battleParts = []; return false;
}
function numField(v){
  const n = parseFloat(v);
  return isNaN(n) ? '' : n;
}
function saveBattle(){ try{ localStorage.setItem(STORE_BATTLE, JSON.stringify(battleParts)); }catch(e){} }
function battleSorted(){
  return battleParts.slice().sort((a,b)=>{
    const ae = a.init==='' || a.init==null, be = b.init==='' || b.init==null;
    if(ae && be) return 0;
    if(ae) return 1;   // пустая инициатива — в конец
    if(be) return -1;
    return b.init - a.init;
  });
}
function renderBattle(){
  const list = document.getElementById('battleList');
  if(!list) return;
  if(!battleParts.length){
    list.innerHTML = `<div class="battle-empty">Бой пуст. Добавьте противников и персонажей — они сортируются по инициативе (по убыванию).</div>`;
    return;
  }
  const sorted = battleSorted();
  list.innerHTML = sorted.map(p=>`
    <div class="battle-card ${p.side==='opp'?'opp':''}" data-bid="${p.id}">
      <div class="bt-side">${p.side==='opp'?'⬤':'👤'}</div>
      <input class="bt-name" data-field="name" data-bid="${p.id}" value="${escapeHtml(p.name)}" spellcheck="false" aria-label="Имя">
      <span class="bt-grp"><span class="bt-lbl">КД</span><input class="bt-in bt-ac" data-field="ac" data-bid="${p.id}" type="number" value="${p.ac}" aria-label="КД"></span>
      <span class="bt-grp bt-hpgrp">
        <span class="bt-lbl">ХП</span>
        <button class="bt-hpbtn" data-hp-op="dec" data-bid="${p.id}" title="−1 ХП" aria-label="−1 ХП">−</button>
        <input class="bt-in bt-hp" data-field="hp" data-bid="${p.id}" type="number" value="${p.hp}" aria-label="ХП">
        <button class="bt-hpbtn" data-hp-op="inc" data-bid="${p.id}" title="+1 ХП" aria-label="+1 ХП">+</button>
        <input class="bt-in bt-dmg" data-dmg data-bid="${p.id}" type="number" placeholder="урон ⏎" title="Введите урон и нажмите Enter" aria-label="Урон">
      </span>
      <span class="bt-grp"><span class="bt-lbl">Иниц</span><input class="bt-in bt-init" data-field="init" data-bid="${p.id}" type="number" value="${p.init}" aria-label="Инициатива"></span>
      <span class="bt-grp bt-atkgrp">
        <input class="bt-in bt-atkbonus" data-field="atk" data-bid="${p.id}" type="number" value="${p.atk}" placeholder="атк" title="Бонус атаки" aria-label="Бонус атаки">
        <button class="bt-atk" data-attack data-bid="${p.id}" title="Бросок атаки: d20 + бонус" aria-label="Атака">⚔ Атака</button>
      </span>
      <button class="bt-del" data-del="${p.id}" title="Убрать из боя" aria-label="Убрать">🗑</button>
      ${(p.acts && p.acts.length) ? `<div class="bt-acts">
        <select class="bt-acts-select" data-act-select="${p.id}" aria-label="Действия монстра">
          <option value="">— действие монстра…</option>
          ${p.acts.map((a,i)=>`<option value="${i}">${escapeHtml((a.tag? a.tag+': ' : '')+ a.text.slice(0,90))}</option>`).join('')}
        </select>
      </div>` : ''}
      ${(p.applied && p.applied.length) ? `<div class="bt-applied">${p.applied.map((t,i)=>`
        <span class="bt-chip">${escapeHtml(t)}<button class="bt-chip-del" data-achip="${p.id}" data-ai="${i}" title="Убрать">✕</button></span>`).join('')}</div>` : ''}
    </div>`).join('');
}
function applyBattleDamage(inp){
  const p = battleParts.find(x=>x.id===inp.dataset.bid);
  if(!p) return;
  const dmg = Math.max(0, Math.round(+inp.value)||0);
  inp.value='';
  if(dmg<=0){ if(p.hp==='') return; }
  const cur = p.hp==='' ? 0 : (p.hp||0);
  p.hp = Math.max(0, cur - dmg);
  saveBattle();
  const hpInput = document.querySelector(`.battle-list [data-bid="${p.id}"][data-field="hp"]`);
  if(hpInput) hpInput.value = p.hp;
  if(dmg>0) toast(`«${p.name}» получил ${dmg} урона → ХП ${p.hp}`);
}
function addBlockToBattle(b){
  if(!b) return;
  const side = b.type==='mob' ? 'opp' : 'char';
  const md = b.mdata||{};
  const p = b.props||{};
  const name = b.title || 'Участник';
  const ac = side==='opp'
    ? (md.ac!==undefined ? md.ac : '')
    : (p['Броня КК'] ?? p['КД'] ?? p['AC'] ?? '');
  const hp = side==='opp'
    ? (md.hp!==undefined ? md.hp : '')
    : (hpMaxOf(b) || (p['ХП'] ?? p['HP'] ?? ''));
  const init = side==='opp'
    ? (md.init!==undefined ? md.init : '')
    : (p['Инициат'] ?? p['Иниц'] ?? '');
  const acts = side==='opp' ? ((md.acts||[]).map(a=>({tag:String(a.tag||''),text:String(a.text||'')}))) : [];
  battleParts.push({ id:uniq(), name:String(name).slice(0,60), side,
    ac: numField(ac), hp: numField(hp), init: numField(init), atk: '', acts, applied: [] });
  saveBattle(); renderBattle();
  toast('«'+name+'» добавлен(а) в бой');
  showTab('battle');
}
function battleAdd(side){
  const name = prompt((side==='opp'?'Имя противника':'Имя персонажа')+':', side==='opp'?'Противник':'Персонаж');
  if(name===null || !name.trim()) return;
  battleParts.push({ id:uniq(), name:name.trim().slice(0,60), side, ac:'', hp:'', init:'', atk:'', acts:[], applied:[] });
  saveBattle(); renderBattle();
}
function bindBattle(){
  const addOpp = document.getElementById('battleAddOpp');
  const addChar = document.getElementById('battleAddChar');
  const clr = document.getElementById('battleClear');
  if(addOpp) addOpp.addEventListener('click', ()=> battleAdd('opp'));
  if(addChar) addChar.addEventListener('click', ()=> battleAdd('char'));
  if(clr) clr.addEventListener('click', ()=>{
    if(!battleParts.length) return;
    if(confirm('Очистить список участников боя?')){
      battleParts=[]; saveBattle(); renderBattle();
    }
  });
  const list = document.getElementById('battleList');
  if(list){
    list.addEventListener('input', e=>{
      const inp = e.target.closest('[data-field]');
      if(!inp) return;
      const p = battleParts.find(x=>x.id===inp.dataset.bid);
      if(!p) return;
      const f = inp.dataset.field;
      if(f==='name'){ p.name = inp.value.slice(0,60); }
      else { p[f] = numField(inp.value); }
      saveBattle();
      if(f==='init'){
        const order = battleSorted().map(x=>x.id);
        const els = [...list.querySelectorAll('.battle-card')];
        els.sort((x,y)=> order.indexOf(x.dataset.bid) - order.indexOf(y.dataset.bid));
        els.forEach(el=> list.appendChild(el));
      }
    });
    list.addEventListener('click', e=>{
      const del = e.target.closest('[data-del]');
      if(del){ battleParts = battleParts.filter(x=>x.id!==del.dataset.del); saveBattle(); renderBattle(); return; }
      const chip = e.target.closest('[data-achip]');
      if(chip){
        const p = battleParts.find(x=>x.id===chip.dataset.achip);
        if(p && Array.isArray(p.applied)){ p.applied.splice(+chip.dataset.ai,1); saveBattle(); renderBattle(); }
        return;
      }
      const hpBtn = e.target.closest('[data-hp-op]');
      if(hpBtn){
        const p = battleParts.find(x=>x.id===hpBtn.dataset.bid);
        if(!p) return;
        const cur = p.hp==='' ? 0 : (p.hp||0);
        const nv = hpBtn.dataset.hpOp==='dec' ? Math.max(0, cur-1) : cur+1;
        p.hp = nv; saveBattle();
        const hpInput = list.querySelector(`[data-bid="${p.id}"][data-field="hp"]`);
        if(hpInput) hpInput.value = nv;
        return;
      }
      const atkBtn = e.target.closest('[data-attack]');
      if(atkBtn){
        const p = battleParts.find(x=>x.id===atkBtn.dataset.bid);
        if(!p) return;
        const bonus = p.atk==='' ? 0 : (p.atk||0);
        const roll = 1+Math.floor(Math.random()*20);
        const total = roll+bonus;
        let note='';
        if(roll===20) note=' — КРИТ!';
        else if(roll===1) note=' — промах';
        else if(p.ac!=='' && p.ac!=null) note = total >= p.ac ? ' — попадание' : ' — промах';
        toast(`Атака «${p.name}»: d20 ${roll} + ${bonus} = ${total}${note}`);
        return;
      }
    });
    list.addEventListener('keydown', e=>{
      const dmg = e.target.closest('[data-dmg]');
      if(!dmg) return;
      if(e.key==='Enter'){ applyBattleDamage(dmg); e.preventDefault(); }
    });
    list.addEventListener('change', e=>{
      const dmg = e.target.closest('[data-dmg]');
      if(dmg){ applyBattleDamage(dmg); return; }
      const actSel = e.target.closest('[data-act-select]');
      if(actSel){
        const idx = +actSel.value;
        actSel.value = '';
        if(!idx && idx!==0) return;
        const p = battleParts.find(x=>x.id===actSel.dataset.actSelect);
        if(!p) return;
        const act = (p.acts||[])[idx];
        if(!act) return;
        const txt = (act.tag? act.tag+': ' : '') + act.text;
        if(!Array.isArray(p.applied)) p.applied=[];
        if(!p.applied.includes(txt)) p.applied.push(txt);
        saveBattle(); renderBattle();
        return;
      }
    });
  }
  loadBattle();
}
/* ════════════ Эффекты монстров по типам ════════════ */
const MON_TYPE_EFFECTS = {
  'Аберрация': {
    desc:'Осколки реальности и чужие разумы: устойчивы к контролю разума, бьют по ментальности.',
    rows:[
      ['Телепатия','Контроль на расстоянии','Урон/контроль без прямого контакта; спасброски Интеллекта/Мудрости'],
      ['Разрушение разума','Специальное','Атака по Инт/Мудр: при провале — снижение спасбросков, накладывает «Ошеломлён»'],
      ['Сбивание концентрации','Против заклинателей','Метаются объекты/вспышки, чтобы сорвать концентрацию и дистанцию'],
    ]
  },
  'Зверь': {
    desc:'Обычные животные: нет магических способностей, но быстры и опасны в стае.',
    rows:[
      ['Когти/клыки','Простая атака','Обычно только урон; бонус стаи даёт преимущество на бросок атаки'],
      ['Стая','Ситуационный бонус','+к атаке/урону, если рядом союзник; уязвимы к запугиванию и огню'],
      ['Охота','Тактика','При ХП ниже половины — агрессивнее, бонус к урону'],
    ]
  },
  'Конструкт': {
    desc:'Механизмы и големы: без усталости, невосприимчивы ко многим состояниям, точные удары.',
    rows:[
      ['Точные удары','Оружие','Часто бонус к броску атаки; точнее по неподвижным целям'],
      ['Иммунитеты','Состояния','Яд, очарование, испуг, усталость, паралич и отравление обычно не действуют'],
      ['Встроенное оружие','Специальное','Жало/лучи/шипы; перезарядка по их правилам'],
    ]
  },
  'Дракон': {
    desc:'Дыхание и страх: мощные атаки по площади, страшащая аура у взрослых особей.',
    rows:[
      ['Дыхание','Оружие по площади','Линия/конус, спасбросок Ловк/Сил/Телос; перезарядка через ход'],
      ['Страх','Аура легендарного дракона','Спасбросок Мудрости; при провале — «Испуган»'],
      ['Легендарные действия','До 3 за ход','Атака хвостом/крыльями вне очереди в конце хода противника'],
    ]
  },
  'Элементаль': {
    desc:'Стихии: устойчивы к своему типу, иммунны к яду/усталости, не нуждаются в дыхании.',
    rows:[
      ['Стихийная атака','Урон стихией','Бонус к урону своей стихией; иммунитет к яду, оглушению, усталости'],
      ['Передвижение','Форма','Летает / плавает / проходит сквозь землю — сложно заблокировать'],
      ['Вихрь / вспышка','Область','Сбивает с ног, гасит огонь, снимает концентрацию'],
    ]
  },
  'Фея': {
    desc:'Природа и иллюзии: очарование, ускорение, обман; слабы против холодного железа.',
    rows:[
      ['Очарование','Контроль','Спасбросок Мудрости; при провале — «Очарован»/«Подчинён»'],
      ['Иллюзии / лёгкость','Обман','Иллюзии, невидимость, ускорение; спасброски Интеллекта/Мудрости'],
      ['Уязвимость','Холодное железо','Урон от холодного железа 1d6 не-магического урона'],
    ]
  },
  'Исчадие': {
    desc:'Нижние планы: устойчивы к огню/яду/холоду, стойки ко многим состояниям.',
    rows:[
      ['Сопротивления','Общее','Огню, яду, холоду; иммунитет к яду, очарованию, испугу нередко'],
      ['Проклятия и яд','Специальное','Проклятия, заражение, «Отравлен»; урон, понижающий максимум ХП'],
      ['Магическое сопротивление','Общее','Преимущество на спасброски от заклинаний'],
    ]
  },
  'Гигант': {
    desc:'Мощь и бросок камней: здоровые физические спасброски, атаки по площади ударом.',
    rows:[
      ['Бросок камня','Дальняя атака','Высокий урон; учёт укрытий, может бросать по области'],
      ['Размашистый удар','По площади','Конус/круг перед собой; спасбросок Ловкости'],
      ['Стойкость','ХП','Много ХП; слаб к магии разума, но силён физически'],
    ]
  },
  'Гуманоид': {
    desc:'Разум и оружие: используют снаряжение и тактику, нет врождённой сверхзащиты.',
    rows:[
      ['Оружие','Стандарт','Обычные атаки; ищите магическое оружие и преимущества в строю'],
      ['Тактика / строй','Бонусы','Бонусы «Строю»/«Кличу» при союзниках; слабеет изолированный'],
      ['Яды и ловушки','Снаряжение','Яды (спасбросок Телосложения), ловушки, подкопы'],
    ]
  },
  'Чудовище': {
    desc:'Крупные хищники: уникальные физические способности, сложные атаки с эффектами.',
    rows:[
      ['Жало / клешня / щупальца','Специальное','Атаки с накопленными эффектами: яд, хватка, усыхание'],
      ['Хватка','Контроль','При попадании — «Схвачен»; проверка Сил/Ловк, чтобы высвободиться'],
      ['Сенсоры','Обнаружение','Тёмное зрение, слепозрение, «обоняние» — трудно скрыться'],
    ]
  },
  'Слизь (Тварь-желе)': {
    desc:'Бесформенные пожиратели: растворяют снаряжение, проходят сквозь щели, стоек к яду.',
    rows:[
      ['Растворение','Против снаряжения','Повреждает оружие/броню при касании; иммунитет к ослеплению'],
      ['Сквозь щели','Передвижение','Проходит через узкие проёмы до 1–5 см'],
      ['Иммунитеты','Состояния','Яд, усталость, очарование, испуг, паралич, ослепление'],
    ]
  },
  'Растение': {
    desc:'Недвижимые ловушки: корни и усики, ядовитые споры, стойкость к яду.',
    rows:[
      ['Корни / усики','Хватка','«Опутан»/«Схвачен» корнями при касании'],
      ['Споры / пыльца','Яд','Конус спор: яд (Телос) или «Опутан»'],
      ['Иммунитеты','Состояния','Яд, очарование, испуг; уязвимы к огню'],
    ]
  },
  'Нежить': {
    desc:'Мёртвые души: сопротивляются немагическому урону, атаки с жизнеотводом и страхом.',
    rows:[
      ['Жизнеотвод','Урон + лечит','Урон добавляется к ХП нежити при попадании'],
      ['Паралич / страх','Состояния','При провале — «Парализован»/«Испуган»; спасброски Телос/Мудр'],
      ['Иммунитеты','Общее','Яд, усталость, очарование, испуг; сопротивление немагическому урону'],
    ]
  },
};
const monEffModal = document.getElementById('monEffModal');
const monEffType = document.getElementById('monEffType');
const monEffResults = document.getElementById('monEffResults');
function renderMonEff(){
  if(!monEffResults) return;
  const t = monEffType ? monEffType.value : '';
  const keys = Object.keys(MON_TYPE_EFFECTS);
  const list = t ? [t] : keys;
  if(!list.length){ monEffResults.innerHTML='<div class="lib-empty">Нет данных.</div>'; return; }
  monEffResults.innerHTML = list.map(k=>{
    const e = MON_TYPE_EFFECTS[k];
    return `<div class="me-type">
      <div class="me-head">${escapeHtml(k)}</div>
      <div class="hint" style="margin-bottom:6px">${escapeHtml(e.desc)}</div>
      <table class="me-table">
        <thead><tr><th>Эффект</th><th>Тип</th><th>Как применяется</th></tr></thead>
        <tbody>${(e.rows||[]).map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');
}
document.getElementById('btnMonEffects').addEventListener('click', ()=>{
  if(monEffType && !monEffType.options.length){
    Object.keys(MON_TYPE_EFFECTS).forEach(k=>{
      const o=document.createElement('option'); o.value=k; o.textContent=k; monEffType.appendChild(o);
    });
  }
  monEffType.value = '';
  openModal(monEffModal, document.getElementById('btnMonEffects'));
  renderMonEff();
});
document.getElementById('monEffClose').addEventListener('click', ()=> closeModal(monEffModal));
monEffModal.addEventListener('click', e=>{ if(e.target===monEffModal) closeModal(monEffModal); });
if(monEffType) monEffType.addEventListener('change', renderMonEff);

(function init(){
  initCanvasEvents();
  collapsed = new Set();
  if(!load()){ blocks = SAMPLES.map(s=>makeBlock(s.type,s.title,{title:s.title, links:s.links, stats:s.stats||[10,10,10,10,10,10], props:s.props||{}, res:sanitizeRes(s.res), text:s.text||''})); }
  blocks.forEach(b=>{ collapsed.add(b.id); });
  loadMap();
  // загрузка медиа из IndexedDB + миграция старых base64 из localStorage
  loadAllMedia().then(()=>{
    let migrated=false;
    blocks.forEach(b=>{
      if(b.data && (b.kind==='image'||b.kind==='doc') && !b.dataKey){
        const key='media_'+b.id; mediaCache[key]=b.data; idbPut(key,b.data); b.dataKey=key; b.data=''; migrated=true;
      }
    });
    maps.forEach(m=>{
      if(m.bg && !m.bgKey){
        const key='mapbg_'+m.id; mediaCache[key]=m.bg; idbPut(key,m.bg); m.bgKey=key; m.bg=''; migrated=true;
      }
    });
    if(migrated){ persistBlocks(); saveMap(); }
    render(); renderMap();
  });
  let savedTab='chars';
  try{ savedTab=localStorage.getItem(KEYS.tab)||'chars'; }catch(e){}
  if(!['chars','monsters','sessions','map','battle'].includes(savedTab)) savedTab='chars';
  bindBattle();
  showTab(savedTab);   // remember последняя вкладка
})();
